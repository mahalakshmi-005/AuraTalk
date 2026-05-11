const express        = require('express');
const http           = require('http');
const socketio       = require('socket.io');
const mongoose       = require('mongoose');
const cors           = require('cors');
const path           = require('path');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = socketio(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e6
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/api/auth', require('./routes/auth'));

const Message        = require('./models/Message');
const User           = require('./models/User');
const ConnectRequest = require('./models/ConnectRequest');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.log('❌ MongoDB:', err.message));

// ════════════════════════════════════════
//  MESSAGE REST APIs
// ════════════════════════════════════════

app.get('/api/messages/public', async (req, res) => {
  try {
    const msgs = await Message.find({ type: 'public' })
      .sort({ createdAt: 1 }).limit(200).lean();
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/messages/private/:a/:b', async (req, res) => {
  try {
    const { a, b } = req.params;
    // Verify connection
    const userA = await User.findById(a).select('connections').lean();
    if (!userA || !userA.connections.map(String).includes(String(b))) {
      return res.status(403).json({ error: 'Not connected' });
    }
    const msgs = await Message.find({
      type: 'private',
      $or: [{ senderId: a, receiverId: b }, { senderId: b, receiverId: a }]
    }).sort({ createdAt: 1 }).limit(200).lean();
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REST delete (fallback) ────────────────
app.delete('/api/messages/:id', async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
//  SOCKET STATE
// ════════════════════════════════════════

const onlineUsers = new Map(); // socketId → { userId, username, avatar }
const userSockets = new Map(); // userId   → socketId

const getOnlineList = () => Array.from(onlineUsers.values());
const getSocketId   = uid => userSockets.get(String(uid));

// ════════════════════════════════════════
//  SOCKET EVENTS
// ════════════════════════════════════════

io.on('connection', socket => {

  // ─── User comes online ────────────────
  socket.on('userOnline', async ({ userId, username, avatar }) => {
    userId = String(userId);
    const old = userSockets.get(userId);
    if (old && old !== socket.id) {
      onlineUsers.delete(old);
      const s = io.sockets.sockets.get(old);
      if (s) s.disconnect(true);
    }
    onlineUsers.set(socket.id, { userId, username, avatar: avatar || '' });
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    io.emit('onlineUsers', getOnlineList());
    // Mark unread messages as delivered
    await Message.updateMany(
      { receiverId: userId, status: 'sent' },
      { $set: { status: 'delivered' } }
    );
  });

  // ─── Public message ───────────────────
  socket.on('sendMessage', async data => {
    try {
      // Use publicAlias if set
      const user = await User.findById(data.userId).select('publicAlias').lean();
      const displayName = (user && user.publicAlias) ? user.publicAlias : data.username;

      const msg = await Message.create({
        senderId:   String(data.userId),
        senderName: displayName,
        content:    data.message   || '',
        imageData:  data.imageData || '',
        imageType:  data.imageType || '',
        forwarded:  data.forwarded || false,
        type:       'public',
        status:     'delivered'
      });
      io.emit('newMessage', msg.toObject());
    } catch (e) { console.log('sendMessage err:', e.message); }
  });

  // ─── Private message — must be connected ─
  socket.on('privateMessage', async data => {
    try {
      const sid = String(data.senderId);
      const rid = String(data.receiverId);

      // Security: verify they are connected
      const sender = await User.findById(sid).select('connections').lean();
      if (!sender || !sender.connections.map(String).includes(rid)) {
        socket.emit('dmBlocked', { reason: 'not_connected', receiverId: rid });
        return;
      }

      const recvSock = getSocketId(rid);
      const msg = await Message.create({
        senderId:   sid,
        senderName: data.senderName,
        receiverId: rid,
        content:    data.message   || '',
        imageData:  data.imageData || '',
        imageType:  data.imageType || '',
        forwarded:  data.forwarded || false,
        type:       'private',
        status:     recvSock ? 'delivered' : 'sent'
      });
      const payload = msg.toObject();
      socket.emit('privateMessage', payload);
      if (recvSock) io.to(recvSock).emit('privateMessage', payload);
    } catch (e) { console.log('privateMessage err:', e.message); }
  });

  // ─── Mark seen ────────────────────────
  socket.on('markSeen', async ({ senderId, receiverId }) => {
    try {
      senderId   = String(senderId);
      receiverId = String(receiverId);
      await Message.updateMany(
        { senderId, receiverId, status: { $ne: 'seen' } },
        { $set: { status: 'seen', seenAt: new Date() } }
      );
      const ss = getSocketId(senderId);
      if (ss) io.to(ss).emit('messagesSeen', { by: receiverId, from: senderId });
    } catch (e) { console.log('markSeen err:', e.message); }
  });

  // ─── Delete message — FIXED ───────────
  // Double-delete: socket confirms immediately, DB deletes, then broadcasts
  socket.on('deleteMessage', async ({ msgId, type, senderId, receiverId }) => {
    try {
      if (!msgId) return;

      // Delete from DB first
      const deleted = await Message.findByIdAndDelete(msgId);
      if (!deleted) {
        // Message already deleted or not found — still emit so UI stays clean
        console.log('deleteMessage: not found in DB', msgId);
      }

      const payload = { msgId: String(msgId) };

      if (type === 'public') {
        // Broadcast to everyone so all clients remove the bubble
        io.emit('messageDeleted', payload);
      } else {
        // Sender's own socket
        socket.emit('messageDeleted', payload);
        // Receiver's socket (if online)
        if (receiverId) {
          const rs = getSocketId(String(receiverId));
          if (rs) io.to(rs).emit('messageDeleted', payload);
        }
      }
    } catch (e) { console.log('deleteMessage err:', e.message); }
  });

  // ─── Connect request realtime ─────────
  socket.on('connectRequest', ({ toId, fromName, fromAvatar, requestId, note }) => {
    const ts = getSocketId(String(toId));
    if (ts) {
      io.to(ts).emit('connectRequestReceived', {
        requestId,
        fromId:     socket.userId,
        fromName,
        fromAvatar,
        note
      });
    }
  });

  // ─── Connect response realtime ────────
  socket.on('connectResponse', ({ toId, accepted, fromName }) => {
    const ts = getSocketId(String(toId));
    if (ts) {
      io.to(ts).emit('connectResponseReceived', { accepted, fromName });
    }
    io.emit('onlineUsers', getOnlineList());
  });

  // ─── Typing ───────────────────────────
  socket.on('typing',     d => socket.broadcast.emit('userTyping',     d));
  socket.on('stopTyping', d => socket.broadcast.emit('userStopTyping', d));

  // ─── Profile update ───────────────────
  socket.on('profileUpdated', data => {
    const u = onlineUsers.get(socket.id);
    if (u) { u.avatar = data.avatar || u.avatar; onlineUsers.set(socket.id, u); }
    socket.broadcast.emit('userProfileUpdated', data);
  });

  // ─── Disconnect ───────────────────────
  socket.on('disconnect', async () => {
    const u = onlineUsers.get(socket.id);
    if (u) {
      onlineUsers.delete(socket.id);
      if (userSockets.get(u.userId) === socket.id) userSockets.delete(u.userId);
      await User.findByIdAndUpdate(u.userId, { lastSeen: new Date() }).catch(() => {});
      io.emit('onlineUsers', getOnlineList());
    }
  });
});

// ─── Catch-all route ──────────────────────
app.get('/{*path}', (req, res) =>
  res.sendFile(path.join(__dirname, '../client/index.html'))
);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 AuraTalk v4 on http://localhost:${PORT}`));