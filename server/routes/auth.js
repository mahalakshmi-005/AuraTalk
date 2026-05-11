const router          = require('express').Router();
const bcrypt          = require('bcryptjs');
const jwt             = require('jsonwebtoken');
const User            = require('../models/User');
const ConnectRequest  = require('../models/ConnectRequest');
const auth            = require('../middleware/auth');

// ─── Register ─────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (username.length < 3)
      return res.status(400).json({ error: 'Username min 3 chars' });
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return res.status(400).json({ error: 'Username: letters, numbers, _ only' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password min 6 chars' });
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ error: 'Username or email taken' });
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hash });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, userId: user._id, username: user.username, about: user.about, avatar: user.avatar, dmPrivacy: user.dmPrivacy, publicAlias: user.publicAlias });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Login ────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(400).json({ error: 'Wrong password' });
    user.lastSeen = new Date();
    await user.save();
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, userId: user._id, username: user.username, about: user.about, avatar: user.avatar, dmPrivacy: user.dmPrivacy, publicAlias: user.publicAlias });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Get all users (with connection status) ───
router.get('/users', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('connections blocked');
    const connIds   = (me.connections || []).map(String);
    const blockedIds= (me.blocked    || []).map(String);

    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('username about avatar lastSeen dmPrivacy publicAlias connections')
      .lean();

    // Attach connection status for each user from my perspective
    const requests = await ConnectRequest.find({
      $or: [{ from: req.user.id }, { to: req.user.id }],
      status: 'pending'
    }).lean();

    const result = users.map(u => {
      const uid = String(u._id);
      const isConnected = connIds.includes(uid);
      const isBlocked   = blockedIds.includes(uid);

      // Pending request: did I send or they sent?
      const sentByMe = requests.find(r => String(r.from) === String(req.user.id) && String(r.to) === uid);
      const sentToMe = requests.find(r => String(r.to) === String(req.user.id) && String(r.from) === uid);

      return {
        _id:         u._id,
        username:    u.username,
        about:       u.about,
        avatar:      u.avatar,
        lastSeen:    u.lastSeen,
        dmPrivacy:   u.dmPrivacy,
        publicAlias: u.publicAlias,
        connectionStatus: isBlocked ? 'blocked'
          : isConnected ? 'connected'
          : sentByMe    ? 'pending_sent'
          : sentToMe    ? 'pending_received'
          : 'none'
      };
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Update profile ───────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.about       !== undefined) updates.about       = String(req.body.about).slice(0, 120);
    if (req.body.avatar      !== undefined) updates.avatar      = req.body.avatar;
    if (req.body.dmPrivacy   !== undefined) updates.dmPrivacy   = req.body.dmPrivacy;
    if (req.body.publicAlias !== undefined) updates.publicAlias = String(req.body.publicAlias).slice(0, 20).replace(/[^a-zA-Z0-9_]/g,'');
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true })
      .select('username about avatar dmPrivacy publicAlias');
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Send Connect Request ─────────────────
router.post('/connect/request/:toId', auth, async (req, res) => {
  try {
    const fromId = req.user.id;
    const toId   = req.params.toId;
    if (String(fromId) === String(toId)) return res.status(400).json({ error: 'Cannot connect to yourself' });

    // Check if already connected
    const me = await User.findById(fromId);
    if (me.connections.map(String).includes(String(toId)))
      return res.status(400).json({ error: 'Already connected' });

    // Check if target blocked sender
    const target = await User.findById(toId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.blocked.map(String).includes(String(fromId)))
      return res.status(403).json({ error: 'Cannot send request' });

    // Check existing request
    const existing = await ConnectRequest.findOne({ from: fromId, to: toId });
    if (existing) return res.status(400).json({ error: 'Request already sent' });

    // Check if they already sent a request to me → auto-accept
    const reverse = await ConnectRequest.findOne({ from: toId, to: fromId, status: 'pending' });
    if (reverse) {
      // Auto accept both
      reverse.status = 'accepted';
      await reverse.save();
      await User.findByIdAndUpdate(fromId, { $addToSet: { connections: toId } });
      await User.findByIdAndUpdate(toId,   { $addToSet: { connections: fromId } });
      return res.json({ status: 'auto_accepted', message: 'You are now connected!' });
    }

    const note = (req.body.message || '').slice(0, 100);
    await ConnectRequest.create({ from: fromId, to: toId, message: note });
    res.json({ status: 'sent' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Request already sent' });
    res.status(500).json({ error: e.message });
  }
});

// ─── Accept / Reject request ──────────────
router.put('/connect/:requestId/:action', auth, async (req, res) => {
  try {
    const { requestId, action } = req.params;
    if (!['accept','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const req2 = await ConnectRequest.findById(requestId);
    if (!req2) return res.status(404).json({ error: 'Request not found' });
    if (String(req2.to) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    req2.status = action === 'accept' ? 'accepted' : 'rejected';
    await req2.save();

    if (action === 'accept') {
      await User.findByIdAndUpdate(req2.from, { $addToSet: { connections: req2.to } });
      await User.findByIdAndUpdate(req2.to,   { $addToSet: { connections: req2.from } });
    }

    res.json({ status: req2.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Remove connection / Disconnect ───────
router.delete('/connect/:otherId', auth, async (req, res) => {
  try {
    const myId    = req.user.id;
    const otherId = req.params.otherId;
    await User.findByIdAndUpdate(myId,    { $pull: { connections: otherId } });
    await User.findByIdAndUpdate(otherId, { $pull: { connections: myId } });
    // Remove any existing requests
    await ConnectRequest.deleteMany({ $or: [{ from: myId, to: otherId }, { from: otherId, to: myId }] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Block user ───────────────────────────
router.post('/block/:otherId', auth, async (req, res) => {
  try {
    const myId    = req.user.id;
    const otherId = req.params.otherId;
    // Remove connection
    await User.findByIdAndUpdate(myId,    { $addToSet: { blocked: otherId }, $pull: { connections: otherId } });
    await User.findByIdAndUpdate(otherId, { $pull: { connections: myId } });
    await ConnectRequest.deleteMany({ $or: [{ from: myId, to: otherId }, { from: otherId, to: myId }] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Unblock ──────────────────────────────
router.delete('/block/:otherId', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { blocked: req.params.otherId } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Get my pending requests ───────────────
router.get('/connect/requests', auth, async (req, res) => {
  try {
    const pending = await ConnectRequest.find({ to: req.user.id, status: 'pending' })
      .populate('from', 'username avatar about')
      .sort({ createdAt: -1 })
      .lean();
    res.json(pending);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Change username
router.put('/username', auth, async (req, res) => {
  try {
    const { newUsername } = req.body;
    if (!newUsername || newUsername.length < 3)
      return res.status(400).json({ error: 'Username min 3 chars' });
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername))
      return res.status(400).json({ error: 'Letters, numbers, _ only' });
    const exists = await User.findOne({ username: newUsername });
    if (exists) return res.status(400).json({ error: 'Username already taken' });
    const user = await User.findByIdAndUpdate(req.user.id, { username: newUsername }, { new: true });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete account
router.delete('/account', auth, async (req, res) => {
  try {
    const Message = require('../models/Message');
    await Message.deleteMany({ senderId: String(req.user.id) });
    await User.findByIdAndDelete(req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
