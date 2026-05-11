// ════════════════════════════════════════
//  AuraTalk v4 — Privacy Edition (FINAL)
//  ✅ Connect Request System
//  ✅ Delete fixed (no re-appear on refresh)
//  ✅ Block / Disconnect
//  ✅ Public Alias / DM Privacy
//  ✅ Forward Messages
//  ✅ Seen Ticks
// ════════════════════════════════════════

(() => {
'use strict';

// ─── Auth ─────────────────────────────────
const token    = localStorage.getItem('token');
const userId   = localStorage.getItem('userId');
const username = localStorage.getItem('username');
if (!token || !userId || !username || username === 'null') {
  localStorage.clear();
  window.location.href = '/index.html';
  return;
}

// ─── Theme ────────────────────────────────
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');

// ─── Sound ────────────────────────────────
let soundOn   = localStorage.getItem('soundOn')   !== 'false';
let enterSend = localStorage.getItem('enterSend') !== 'false';
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
function playPing() {
  if (!soundOn || !audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(.3, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .25);
    o.start(); o.stop(audioCtx.currentTime + .25);
  } catch {}
}

// ─── Socket ───────────────────────────────
if (window._auraSocket) {
  try { window._auraSocket.removeAllListeners(); window._auraSocket.disconnect(); } catch {}
}
const socket = io({
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000
});
window._auraSocket = socket;

// ─── State ────────────────────────────────
let currentChat     = 'public';
let currentChatName = 'General Chat';
let allUsers        = [];
let onlineSet       = new Set();
let unread          = {};
let typingTimer     = null;
let selectedImage   = null;
let viewingUser     = null;   // full user object currently viewed
let pendingRequests = [];
let forwardingMsg   = null;
let forwardSelUid   = null;

// ─── DOM helpers ──────────────────────────
const $  = id => document.getElementById(id);
const messagesArea     = $('messagesArea');
const messageInput     = $('messageInput');
const sendBtn          = $('sendBtn');
const usersList        = $('usersList');
const chatLayout       = $('chatLayout');
const typingBar        = $('typingBar');
const typingText       = $('typingText');
const imageInput       = $('imageInput');
const imagePreviewWrap = $('imagePreviewWrap');
const imagePreviewImg  = $('imagePreviewImg');
const previewLabel     = $('previewLabel');
const emojiPicker      = $('emojiPicker');
const contextMenu      = $('contextMenu');

// ─── Forward Modal (create if absent) ─────
let forwardModal = $('forwardModal');
if (!forwardModal) {
  forwardModal = document.createElement('div');
  forwardModal.id        = 'forwardModal';
  forwardModal.className = 'modal-overlay hidden';
  forwardModal.innerHTML = `
    <div class="modal" style="max-width:360px">
      <div class="modal-header">
        <h2>↪ Forward Message</h2>
        <button id="closeForwardModal" class="modal-close">✕</button>
      </div>
      <div style="padding:12px 16px 4px">
        <input id="forwardSearch" type="text" placeholder="Search contacts..."
          style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);
          background:var(--glass-strong);color:var(--text-1);font-size:.9rem;outline:none;box-sizing:border-box"/>
      </div>
      <div id="forwardUserList" style="max-height:260px;overflow-y:auto;padding:6px 0"></div>
      <div style="padding:8px 16px 16px;border-top:1px solid var(--border);margin-top:4px">
        <div id="forwardPreview"
          style="font-size:.82rem;color:var(--text-2);padding:8px;background:var(--glass-strong);
          border-radius:8px;max-height:55px;overflow:hidden;margin-bottom:10px"></div>
        <button id="doForwardBtn" class="auth-btn" style="opacity:.5;cursor:not-allowed" disabled>Forward</button>
      </div>
    </div>`;
  document.body.appendChild(forwardModal);
}

// ─── My profile UI ────────────────────────
function initMyProfile() {
  const av = localStorage.getItem('avatar') || '';
  const ab = localStorage.getItem('about')  || 'Hey there! I am using AuraTalk.';
  const el = $('myAvatar');
  el.innerHTML = av ? `<img src="${av}" alt=""/>` : '';
  if (!av) el.textContent = username.charAt(0).toUpperCase();
  $('myUsername').textContent = '@' + username;
  $('myAbout').textContent    = ab;
}
initMyProfile();

// ════════════════════════════════════════
//  SOCKET EVENTS
// ════════════════════════════════════════

socket.on('connect', () => {
  socket.emit('userOnline', {
    userId, username,
    avatar: localStorage.getItem('avatar') || ''
  });
});

socket.on('onlineUsers', users => {
  if (!Array.isArray(users)) return;
  onlineSet = new Set(users.map(u => String(u.userId)));
  renderUsers();
  if (currentChat !== 'public') {
    const on = onlineSet.has(String(currentChat));
    $('chatHeaderStatus').textContent = on ? '● Online' : '● Offline';
    $('chatHeaderStatus').style.color = on ? 'var(--accent)' : '';
  }
});

socket.on('newMessage', msg => {
  if (!msg) return;
  if (currentChat === 'public') {
    appendMessage(msg, String(msg.senderId) === String(userId) ? 'sent' : 'received');
    scrollBottom();
  } else if (String(msg.senderId) !== String(userId)) {
    const b = $('publicBadge');
    b.textContent = (parseInt(b.textContent) || 0) + 1;
    b.classList.remove('hidden');
    showToast(msg.senderName, msg.content || '📷 Image', 'public');
    playPing();
  }
});

socket.on('privateMessage', msg => {
  if (!msg) return;
  const otherId = String(msg.senderId) === String(userId)
    ? String(msg.receiverId)
    : String(msg.senderId);

  if (currentChat === otherId) {
    appendMessage(msg, String(msg.senderId) === String(userId) ? 'sent' : 'received');
    scrollBottom();
    if (String(msg.senderId) !== String(userId)) {
      socket.emit('markSeen', { senderId: String(msg.senderId), receiverId: String(userId) });
    }
  } else if (String(msg.senderId) !== String(userId)) {
    unread[String(msg.senderId)] = (unread[String(msg.senderId)] || 0) + 1;
    renderUsers();
    const sender = allUsers.find(u => String(u._id) === String(msg.senderId));
    showToast(sender ? sender.username : msg.senderName, msg.content || '📷 Image', String(msg.senderId));
    playPing();
  }
});

socket.on('dmBlocked', () => {
  showToastSimple('🔒 Connect with this person first to send messages');
});

socket.on('messagesSeen', ({ by, from }) => {
  if (String(from) !== String(userId)) return;
  document.querySelectorAll('.msg-ticks').forEach(el => {
    el.innerHTML = tickSVG('seen');
  });
});

// ─── DELETE FIX: server emits msgId only, client removes bubble ───
socket.on('messageDeleted', ({ msgId }) => {
  if (!msgId) return;
  const el = document.querySelector(`[data-msgid="${CSS.escape(msgId)}"]`);
  if (el) {
    // Clear all event listeners by replacing node
    const replacement = document.createElement('div');
    replacement.className        = 'msg-bubble';
    replacement.dataset.msgid    = msgId;
    replacement.dataset.deleted  = '1';
    replacement.style.opacity    = '.55';
    replacement.style.cursor     = 'default';
    replacement.innerHTML        = '<em style="font-size:.8rem">🚫 Message deleted</em>';
    el.replaceWith(replacement);
  }
});

socket.on('connectRequestReceived', ({ requestId, fromId, fromName, fromAvatar, note }) => {
  // Avoid duplicates
  if (!pendingRequests.find(r => r._id === requestId)) {
    pendingRequests.unshift({
      _id:     requestId,
      from:    { _id: fromId, username: fromName, avatar: fromAvatar },
      message: note || ''
    });
    updateRequestsBadge();
  }
  showToastSimple(`🔗 ${escHtml(fromName)} wants to connect`);
  playPing();
});

socket.on('connectResponseReceived', ({ accepted, fromName }) => {
  if (accepted) {
    showToastSimple(`✅ ${escHtml(fromName)} accepted your request!`);
    loadUsers();
  } else {
    showToastSimple(`❌ ${escHtml(fromName)} declined your request`);
    loadUsers();
  }
});

socket.on('userTyping', ({ username: who, chatId }) => {
  const relevant = (chatId === 'public' && currentChat === 'public') ||
                   (chatId === String(userId) && currentChat !== 'public');
  if (relevant && who !== username) {
    typingBar.classList.remove('hidden');
    typingText.textContent = `${who} is typing...`;
  }
});
socket.on('userStopTyping', () => typingBar.classList.add('hidden'));

socket.on('userProfileUpdated', ({ userId: uid, avatar, about }) => {
  const user = allUsers.find(u => String(u._id) === String(uid));
  if (user) {
    if (avatar !== undefined) user.avatar = avatar;
    if (about  !== undefined) user.about  = about;
    renderUsers();
    if (currentChat === String(uid)) updateChatAvatarHeader(user);
  }
});

// ════════════════════════════════════════
//  DATA LOADING
// ════════════════════════════════════════

async function loadUsers() {
  try {
    const res = await fetch('/api/auth/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    allUsers = data;
    renderUsers();
    // Refresh viewingUser if modal is open
    if (viewingUser) {
      const updated = allUsers.find(u => String(u._id) === String(viewingUser._id));
      if (updated) viewingUser = updated;
    }
  } catch (e) { console.error('loadUsers:', e); }
}

async function loadRequests() {
  try {
    const res = await fetch('/api/auth/connect/requests', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    pendingRequests = await res.json();
    updateRequestsBadge();
  } catch (e) {}
}

function updateRequestsBadge() {
  const badge = $('requestsBadge');
  if (!badge) return;
  const n = pendingRequests.length;
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

async function loadPublicMessages() {
  try {
    const res  = await fetch('/api/messages/public');
    const msgs = await res.json();
    clearMessages();
    msgs.forEach(m => appendMessage(m, String(m.senderId) === String(userId) ? 'sent' : 'received'));
    scrollBottom(true);
  } catch (e) { console.error(e); }
}

async function loadPrivateMessages(otherId) {
  try {
    const res = await fetch(`/api/messages/private/${userId}/${otherId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 403) {
      clearMessages();
      showChatPlaceholder('🔒 You need to connect first before chatting privately');
      return;
    }
    const msgs = await res.json();
    clearMessages();
    msgs.forEach(m => appendMessage(m, String(m.senderId) === String(userId) ? 'sent' : 'received'));
    scrollBottom(true);
    socket.emit('markSeen', { senderId: String(otherId), receiverId: String(userId) });
  } catch (e) { console.error(e); }
}

// ════════════════════════════════════════
//  RENDER USERS  — Contacts / Discover
// ════════════════════════════════════════

function renderUsers() {
  const q = ($('searchInput').value || '').trim().toLowerCase();

  let list = allUsers.filter(u => {
    if (String(u._id) === String(userId)) return false;
    if (q) return u.username.toLowerCase().includes(q);
    return true;
  });

  if (!list.length) {
    usersList.innerHTML = `<div class="users-loading">${q ? 'No results' : 'No users yet'}</div>`;
    return;
  }

  const sortFn = (a, b) => {
    const ao = onlineSet.has(String(a._id)) ? 1 : 0;
    const bo = onlineSet.has(String(b._id)) ? 1 : 0;
    if (ao !== bo) return bo - ao;
    return (unread[String(b._id)] || 0) - (unread[String(a._id)] || 0);
  };

  const contacts = list.filter(u => u.connectionStatus === 'connected').sort(sortFn);
  const discover = list.filter(u => u.connectionStatus !== 'connected').sort(sortFn);

  let html = '';

  if (contacts.length) {
    html += `<div class="users-section-head">💬 Contacts (${contacts.length})</div>`;
    html += contacts.map(u => userItemHtml(u)).join('');
  }

  if (discover.length) {
    html += `<div class="users-section-head" style="margin-top:${contacts.length ? '6px' : '0'}">👥 Discover People</div>`;
    html += discover.map(u => userItemHtml(u)).join('');
  }

  usersList.innerHTML = html;

  usersList.querySelectorAll('.user-item').forEach(el => {
    el.addEventListener('click', () => {
      const uid    = el.dataset.id;
      const status = el.dataset.status;
      const user   = allUsers.find(u => String(u._id) === uid);
      if (!user) return;

      if (status === 'connected') {
        openPrivateChat(uid, user.username);
      } else {
        openUserActionModal(user);
      }
    });
  });
}

function userItemHtml(user) {
  const uid    = String(user._id);
  const online = onlineSet.has(uid);
  const badge  = unread[uid] || 0;
  const active = currentChat === uid ? 'active' : '';
  const av     = user.avatar
    ? `<img src="${user.avatar}" alt=""/>`
    : user.username.charAt(0).toUpperCase();

  const st = user.connectionStatus;
  let lockIcon = '';
  let subText  = online ? '● Online' : 'Offline';

  if (st === 'pending_sent') {
    lockIcon = ' ⏳';
    subText  = '<span style="font-size:.63rem;background:var(--glass-strong);color:var(--text-2);padding:2px 6px;border-radius:6px">Request Sent</span>';
  } else if (st === 'pending_received') {
    lockIcon = ' 🔔';
    subText  = '<span style="font-size:.63rem;background:var(--accent-dim);color:var(--accent);padding:2px 6px;border-radius:6px;font-weight:700;animation:pulseBadge 2s infinite">Respond ↩</span>';
  } else if (st === 'none') {
    lockIcon = ' 🔒';
  }

  return `
    <div class="user-item ${active}" data-id="${uid}" data-status="${st}" style="cursor:pointer">
      <div class="user-avatar-wrap">
        <div class="user-avatar">${av}</div>
        <span class="user-status-dot ${online ? 'online' : ''}"></span>
      </div>
      <div class="user-info">
        <div class="user-name">${escHtml(user.username)}<span style="font-size:.72rem;opacity:.7">${lockIcon}</span></div>
        <div class="user-last-msg">${subText}</div>
      </div>
      <div class="user-meta">
        ${badge ? `<div class="user-badge">${badge}</div>` : ''}
      </div>
    </div>`;
}

// ════════════════════════════════════════
//  USER ACTION MODAL
//  (Connect / Accept / Chat / Disconnect / Block)
// ════════════════════════════════════════

function openUserActionModal(user) {
  if (!user) return;
  viewingUser = user;

  const uid    = String(user._id);
  const online = onlineSet.has(uid);
  const status = user.connectionStatus;

  // Header
  $('userActionTitle').textContent = user.username;

  // Avatar
  const av = $('uaAvatar');
  if (user.avatar) { av.innerHTML = `<img src="${user.avatar}" alt=""/>`; }
  else { av.textContent = user.username.charAt(0).toUpperCase(); av.innerHTML = av.textContent; }

  // Online badge
  const badge = $('uaOnlineBadge');
  badge.textContent = online ? '● Online' : '● Offline';
  badge.className   = `profile-online-badge ${online ? 'online' : 'offline'}`;

  $('uaUsername').textContent = user.username;
  $('uaAbout').textContent    = user.about || 'Hey there! I am using AuraTalk.';

  // ─── Connect Section (dynamic per status) ─
  const cs = $('uaConnectSection');
  cs.innerHTML = '';

  if (status === 'none') {
    // Show connect request form
    cs.innerHTML = `
      <input id="connectNoteInput" type="text" maxlength="100"
        placeholder="Add a note (optional)..."
        class="ua-connect-note"/>
      <button id="sendConnectBtn" class="auth-btn">🔗 Send Connect Request</button>`;

    $('sendConnectBtn').addEventListener('click', () => {
      const note = ($('connectNoteInput') ? $('connectNoteInput').value.trim() : '');
      sendConnectRequest(uid, user.username, user.avatar || '', note);
    });

  } else if (status === 'pending_sent') {
    cs.innerHTML = `
      <div class="ua-status-box">
        ⏳ Connect request sent<br/>
        <span style="font-size:.78rem;color:var(--text-3)">Waiting for ${escHtml(user.username)} to respond</span>
      </div>`;

  } else if (status === 'pending_received') {
    // Find request details
    const req  = pendingRequests.find(r => String(r.from._id) === uid)
               || { _id: user.pendingRequestId, message: '' };
    const note = req.message
      ? `<div style="font-style:italic;font-size:.82rem;color:var(--text-2);margin-bottom:10px;padding:8px;background:var(--glass-strong);border-radius:8px">"${escHtml(req.message)}"</div>`
      : '';

    cs.innerHTML = `
      ${note}
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:10px;text-align:center">
        <strong>${escHtml(user.username)}</strong> wants to connect with you
      </p>
      <div style="display:flex;gap:8px">
        <button id="acceptReqBtn" class="auth-btn" style="flex:1">✅ Accept</button>
        <button id="rejectReqBtn" class="danger-btn" style="flex:1">❌ Decline</button>
      </div>`;

    $('acceptReqBtn').addEventListener('click', () => {
      respondRequest(req._id || user.pendingRequestId, 'accept', uid, user.username);
    });
    $('rejectReqBtn').addEventListener('click', () => {
      respondRequest(req._id || user.pendingRequestId, 'reject', uid, user.username);
    });

  } else if (status === 'connected') {
    cs.innerHTML = `
      <button id="chatNowBtn" class="auth-btn">💬 Open Chat</button>
      <button id="disconnectBtn" class="danger-btn" style="margin-top:8px">🔗 Disconnect</button>`;

    $('chatNowBtn').addEventListener('click', () => {
      $('userActionModal').classList.add('hidden');
      openPrivateChat(uid, user.username);
    });
    $('disconnectBtn').addEventListener('click', () => disconnectUser(uid, user.username));
  }

  // Block button always visible
  $('uaBlockBtn').onclick = () => blockUser(uid, user.username);

  $('userActionModal').classList.remove('hidden');
}

// ─── Send Connect Request ─────────────────
async function sendConnectRequest(toId, toName, toAvatar, note) {
  const btn = $('sendConnectBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    const res = await fetch(`/api/auth/connect/request/${toId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ message: note })
    });
    const data = await res.json();

    if (!res.ok) {
      showToastSimple('❌ ' + (data.error || 'Failed to send request'));
      if (btn) { btn.disabled = false; btn.textContent = '🔗 Send Connect Request'; }
      return;
    }

    // Notify target user via socket in real-time
    socket.emit('connectRequest', {
      toId,
      fromName:   username,
      fromAvatar: localStorage.getItem('avatar') || '',
      requestId:  data.requestId || '',
      note
    });

    if (data.status === 'auto_accepted') {
      showToastSimple('✅ You are now connected!');
    } else {
      showToastSimple(`✅ Connect request sent to ${escHtml(toName)}`);
    }

    $('userActionModal').classList.add('hidden');
    await loadUsers();
  } catch (e) {
    showToastSimple('❌ Network error. Try again.');
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Send Connect Request'; }
  }
}

// ─── Accept / Reject request ──────────────
async function respondRequest(requestId, action, fromId, fromName) {
  if (!requestId) {
    // requestId not found — reload requests and try again
    await loadRequests();
    const req = pendingRequests.find(r => String(r.from._id) === String(fromId));
    if (req) requestId = req._id;
    else { showToastSimple('❌ Request not found, please refresh'); return; }
  }

  try {
    const res = await fetch(`/api/auth/connect/${requestId}/${action}`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const d = await res.json();
      showToastSimple('❌ ' + (d.error || 'Failed'));
      return;
    }

    // Remove from pending list
    pendingRequests = pendingRequests.filter(r => r._id !== requestId);
    updateRequestsBadge();

    // Notify sender
    socket.emit('connectResponse', {
      toId:     fromId,
      accepted: action === 'accept',
      fromName: username
    });

    showToastSimple(action === 'accept'
      ? `✅ Connected with ${escHtml(fromName)}!`
      : `Request from ${escHtml(fromName)} declined`);

    $('userActionModal').classList.add('hidden');
    $('requestsModal').classList.add('hidden');

    await loadUsers();

    if (action === 'accept') {
      setTimeout(() => openPrivateChat(fromId, fromName), 400);
    }
  } catch (e) { showToastSimple('❌ Network error'); }
}

// ─── Disconnect ───────────────────────────
async function disconnectUser(otherId, otherName) {
  if (!confirm(`Remove ${otherName} from your contacts?`)) return;
  try {
    await fetch(`/api/auth/connect/${otherId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    showToastSimple(`🔗 Disconnected from ${escHtml(otherName)}`);
    $('userActionModal').classList.add('hidden');
    if (currentChat === otherId) openPublicChat();
    await loadUsers();
  } catch (e) { showToastSimple('❌ Network error'); }
}

// ─── Block ────────────────────────────────
async function blockUser(otherId, otherName) {
  if (!confirm(`Block ${otherName}?\nThey won't be able to connect or message you.`)) return;
  try {
    await fetch(`/api/auth/block/${otherId}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    showToastSimple(`🚫 ${escHtml(otherName)} blocked`);
    $('userActionModal').classList.add('hidden');
    if (currentChat === otherId) openPublicChat();
    await loadUsers();
  } catch (e) { showToastSimple('❌ Network error'); }
}

// ─── Requests Inbox Modal ─────────────────
if ($('requestsInboxBtn')) {
  $('requestsInboxBtn').addEventListener('click', () => {
    renderRequestsList();
    $('requestsModal').classList.remove('hidden');
  });
}
if ($('closeRequestsModal')) {
  $('closeRequestsModal').addEventListener('click', () =>
    $('requestsModal').classList.add('hidden'));
}
if ($('requestsModal')) {
  $('requestsModal').addEventListener('click', e => {
    if (e.target === $('requestsModal')) $('requestsModal').classList.add('hidden');
  });
}

function renderRequestsList() {
  const container = $('requestsList');
  if (!container) return;

  if (!pendingRequests.length) {
    container.innerHTML = `
      <div class="requests-empty">
        <div class="requests-empty-icon">✅</div>
        No pending requests
      </div>`;
    return;
  }

  container.innerHTML = pendingRequests.map(req => {
    const u  = req.from;
    const av = u.avatar
      ? `<img src="${u.avatar}" style="width:42px;height:42px;border-radius:50%;object-fit:cover"/>`
      : `<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem">${u.username.charAt(0).toUpperCase()}</div>`;
    const note = req.message
      ? `<div class="request-note">"${escHtml(req.message)}"</div>` : '';

    return `
      <div class="request-item">
        <div class="request-av">${av}</div>
        <div class="request-info">
          <div class="request-name">${escHtml(u.username)}</div>
          ${note}
        </div>
        <div class="request-actions">
          <button class="req-accept-btn" onclick="window._reqAccept('${req._id}','${u._id}','${escHtml(u.username)}')">✅</button>
          <button class="req-reject-btn" onclick="window._reqReject('${req._id}','${u._id}','${escHtml(u.username)}')">❌</button>
        </div>
      </div>`;
  }).join('');
}

// Global handlers for inline onclick in requests list
window._reqAccept = (rid, fid, fn) => respondRequest(rid, 'accept', fid, fn);
window._reqReject = (rid, fid, fn) => respondRequest(rid, 'reject', fid, fn);

// User Action Modal close
if ($('closeUserActionModal')) {
  $('closeUserActionModal').addEventListener('click', () =>
    $('userActionModal').classList.add('hidden'));
}
if ($('userActionModal')) {
  $('userActionModal').addEventListener('click', e => {
    if (e.target === $('userActionModal')) $('userActionModal').classList.add('hidden');
  });
}

// ════════════════════════════════════════
//  OPEN CHATS
// ════════════════════════════════════════

function openPublicChat() {
  currentChat     = 'public';
  currentChatName = 'General Chat';

  document.querySelectorAll('.user-item').forEach(e => e.classList.remove('active'));
  $('publicRoomBtn').classList.add('active');

  $('chatHeaderName').textContent   = 'General Chat';
  $('chatHeaderStatus').textContent = 'Public room · everyone can chat';
  $('chatHeaderStatus').style.color = '';

  const av = $('chatAvatarHeader');
  av.textContent = '🌍';
  av.style.background = 'transparent';

  $('viewProfileBtn').classList.add('hidden');
  viewingUser = null;

  const pb = $('publicBadge');
  pb.textContent = '0';
  pb.classList.add('hidden');

  loadPublicMessages();
  showChatOnMobile();
}

function openPrivateChat(uid, name) {
  currentChat     = String(uid);
  currentChatName = name;

  document.querySelectorAll('.user-item').forEach(e => e.classList.remove('active'));
  $('publicRoomBtn').classList.remove('active');

  const el = usersList.querySelector(`[data-id="${uid}"]`);
  if (el) el.classList.add('active');

  $('chatHeaderName').textContent = name;
  const on = onlineSet.has(String(uid));
  $('chatHeaderStatus').textContent = on ? '● Online' : '● Offline';
  $('chatHeaderStatus').style.color = on ? 'var(--accent)' : '';
  $('viewProfileBtn').classList.remove('hidden');

  const user = allUsers.find(u => String(u._id) === String(uid));
  if (user) { viewingUser = user; updateChatAvatarHeader(user); }

  delete unread[String(uid)];
  renderUsers();

  loadPrivateMessages(uid);
  showChatOnMobile();
}

function updateChatAvatarHeader(user) {
  const av = $('chatAvatarHeader');
  if (user.avatar) {
    av.innerHTML        = `<img src="${user.avatar}" alt=""/>`;
    av.style.background = 'transparent';
  } else {
    av.textContent      = user.username.charAt(0).toUpperCase();
    av.style.background = '';
  }
}

function showChatPlaceholder(msg) {
  messagesArea.innerHTML = `
    <div class="messages-welcome">
      <div class="welcome-icon">🔒</div>
      <div class="welcome-text">${msg}</div>
      <div class="welcome-sub">Click their name → Send Connect Request</div>
    </div>`;
}

// ════════════════════════════════════════
//  MESSAGES
// ════════════════════════════════════════

let lastDate = '', lastSender = '', lastGroup = null;

function clearMessages() {
  messagesArea.innerHTML = '';
  lastDate = ''; lastSender = ''; lastGroup = null;
}

function appendMessage(msg, type) {
  const isMe     = type === 'sent';
  const senderId = String(msg.senderId);
  const senderNm = msg.senderName || 'Unknown';
  const content  = msg.content    || '';
  const imgData  = msg.imageData  || '';
  const msgId    = String(msg._id || msg.id || '');
  const status   = msg.status     || 'sent';
  const ts       = new Date(msg.createdAt || Date.now());
  const timeStr  = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr  = ts.toLocaleDateString([],  { day: 'numeric', month: 'short', year: 'numeric' });

  // Date separator
  if (dateStr !== lastDate) {
    const sep = document.createElement('div');
    sep.className = 'date-sep';
    sep.innerHTML = `<span>${dateStr}</span>`;
    messagesArea.appendChild(sep);
    lastDate = dateStr; lastSender = ''; lastGroup = null;
  }

  // Group by sender
  if (senderId !== lastSender || !lastGroup) {
    lastGroup = document.createElement('div');
    lastGroup.className = `msg-group ${type}`;
    if (!isMe && currentChat === 'public') {
      const nm = document.createElement('div');
      nm.className   = 'msg-sender-name';
      nm.textContent = senderNm;
      lastGroup.appendChild(nm);
    }
    messagesArea.appendChild(lastGroup);
    lastSender = senderId;
  }

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (msgId) bubble.dataset.msgid = msgId;
  bubble._msgData = msg;

  // Forwarded label
  if (msg.forwarded) {
    const fl = document.createElement('div');
    fl.className   = 'msg-forwarded-label';
    fl.textContent = '↪ Forwarded';
    bubble.appendChild(fl);
  }

  // Content
  if (imgData) {
    const imgEl = document.createElement('img');
    imgEl.className = 'msg-image';
    imgEl.src       = imgData;
    imgEl.alt       = 'image';
    imgEl.addEventListener('click', e => { e.stopPropagation(); openLightbox(imgData); });
    bubble.appendChild(imgEl);
  } else {
    const t = document.createElement('span');
    t.className   = 'msg-text';
    t.textContent = content;
    bubble.appendChild(t);
  }

  // Meta (time + ticks)
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `
    <span class="msg-time">${timeStr}</span>
    ${isMe ? `<span class="msg-ticks">${tickSVG(status)}</span>` : ''}`;
  bubble.appendChild(meta);

  // Context menu (right-click / long-press)
  let pressTimer;
  bubble.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e, bubble, msg, isMe);
  });
 bubble.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  const savedX = touch.clientX;
  const savedY = touch.clientY;

  pressTimer = setTimeout(() => {
    showContextMenu({
      clientX: savedX,
      clientY: savedY
    }, bubble, msg, isMe);
  }, 600);
}, { passive: true });

bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
}

function tickSVG(status) {
  if (status === 'sent') {
    return `<svg class="tick-sent" viewBox="0 0 16 10"><path d="M1 5l4 4L15 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  // delivered or seen
  const cls = status === 'seen' ? 'tick-seen' : 'tick-delivered';
  return `<svg class="${cls}" viewBox="0 0 20 10">
    <path d="M1 5l4 4L15 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 5l4 4 8-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function scrollBottom(instant = false) {
  if (instant) messagesArea.scrollTop = messagesArea.scrollHeight;
  else requestAnimationFrame(() => { messagesArea.scrollTop = messagesArea.scrollHeight; });
}

// ════════════════════════════════════════
//  CONTEXT MENU
// ════════════════════════════════════════

function showContextMenu(e, bubble, msg, isMe) {
  if (bubble.dataset.deleted) return;
  contextMenu.innerHTML = '';
  contextMenu.classList.remove('hidden');

  const items = [];

  if (msg.content) {
    items.push({ label: '📋 Copy Text', action: () => {
      navigator.clipboard.writeText(msg.content).catch(() => {});
    }});
  }

  if (msg.content || msg.imageData) {
    items.push({ label: '↪ Forward', action: () => openForwardModal(msg) });
  }

  if (isMe && msg._id && !bubble.dataset.deleted) {
    items.push({ label: '🗑️ Delete', cls: 'danger', action: () => {
      const msgId      = String(msg._id || msg.id);
      const chatType   = currentChat === 'public' ? 'public' : 'private';
      const receiverId = currentChat === 'public' ? '' : String(currentChat);

      // Optimistic UI update immediately
      const replacement = document.createElement('div');
      replacement.className       = 'msg-bubble';
      replacement.dataset.msgid   = msgId;
      replacement.dataset.deleted = '1';
      replacement.style.opacity   = '.55';
      replacement.style.cursor    = 'default';
      replacement.innerHTML       = '<em style="font-size:.8rem">🚫 Message deleted</em>';
      bubble.replaceWith(replacement);

      // Tell server to delete from DB and notify others
      socket.emit('deleteMessage', {
        msgId,
        type:       chatType,
        senderId:   String(userId),
        receiverId
      });
    }});
  }

  if (!items.length) { contextMenu.classList.add('hidden'); return; }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className   = `msg-context-item${item.cls ? ' ' + item.cls : ''}`;
    div.textContent = item.label;
    div.addEventListener('click', () => { item.action(); hideContextMenu(); });
    contextMenu.appendChild(div);
  });

  const x = e.clientX ?? e.pageX;
  const y = e.clientY ?? e.pageY;
 contextMenu.style.position = 'fixed';
contextMenu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
contextMenu.style.top = Math.min(y + 10, window.innerHeight - 150) + 'px';
}

function hideContextMenu() { contextMenu.classList.add('hidden'); }
document.addEventListener('click',      hideContextMenu);
document.addEventListener('touchstart', hideContextMenu, { passive: true });

// ════════════════════════════════════════
//  FORWARD
// ════════════════════════════════════════

function openForwardModal(msg) {
  forwardingMsg = msg;
  forwardSelUid = null;

  const prev = $('forwardPreview');
  if (msg.imageData) {
    prev.innerHTML = `<img src="${msg.imageData}" style="max-height:45px;border-radius:6px"/>`;
  } else {
    prev.textContent = (msg.content || '').slice(0, 80);
  }

  const btn = $('doForwardBtn');
  btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed';

  $('forwardSearch').value = '';
  renderForwardList('');
  forwardModal.classList.remove('hidden');
}

function renderForwardList(q) {
  const contacts = allUsers.filter(u => {
    if (String(u._id) === String(userId)) return false;
    if (u.connectionStatus !== 'connected') return false;
    if (q) return u.username.toLowerCase().includes(q.toLowerCase());
    return true;
  });

  const container = $('forwardUserList');
  const publicSel = forwardSelUid === 'public';

  let html = `
    <div class="forward-user-item ${publicSel ? 'selected' : ''}" data-fwd-id="public"
      style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🌍</div>
      <div style="flex:1;font-weight:500;font-size:.9rem">General Chat</div>
      ${publicSel ? '<span style="color:var(--accent)">✓</span>' : ''}
    </div>`;

  contacts.forEach(user => {
    const uid = String(user._id);
    const sel = forwardSelUid === uid;
    const av  = user.avatar
      ? `<img src="${user.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover"/>`
      : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0">${user.username.charAt(0).toUpperCase()}</div>`;

    html += `
      <div class="forward-user-item ${sel ? 'selected' : ''}" data-fwd-id="${uid}"
        style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer">
        <div style="flex-shrink:0">${av}</div>
        <div style="flex:1;font-weight:500;font-size:.9rem">${escHtml(user.username)}</div>
        ${sel ? '<span style="color:var(--accent)">✓</span>' : ''}
      </div>`;
  });

  if (!contacts.length) {
    html += `<div style="padding:20px;text-align:center;color:var(--text-2);font-size:.85rem">No contacts yet — connect with people first</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.forward-user-item').forEach(el => {
    el.addEventListener('click', () => {
      forwardSelUid = el.dataset.fwdId;
      renderForwardList($('forwardSearch').value);
      const btn = $('doForwardBtn');
      btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
    });
  });
}

$('forwardSearch').addEventListener('input', e => renderForwardList(e.target.value.trim()));

$('closeForwardModal').addEventListener('click', () => {
  forwardModal.classList.add('hidden');
  forwardingMsg = null; forwardSelUid = null;
});
forwardModal.addEventListener('click', e => {
  if (e.target === forwardModal) {
    forwardModal.classList.add('hidden');
    forwardingMsg = null; forwardSelUid = null;
  }
});

$('doForwardBtn').addEventListener('click', () => {
  if (!forwardingMsg || !forwardSelUid) return;
  const payload = {
    message:   forwardingMsg.content   || '',
    imageData: forwardingMsg.imageData || '',
    imageType: forwardingMsg.imageType || '',
    forwarded: true
  };
  if (forwardSelUid === 'public') {
    socket.emit('sendMessage', { userId, username, ...payload });
    showToastSimple('✅ Forwarded to General Chat');
  } else {
    socket.emit('privateMessage', {
      senderId: userId, senderName: username, receiverId: forwardSelUid, ...payload
    });
    const t = allUsers.find(u => String(u._id) === forwardSelUid);
    showToastSimple(`✅ Forwarded to ${t ? escHtml(t.username) : 'user'}`);
  }
  forwardModal.classList.add('hidden');
  forwardingMsg = null; forwardSelUid = null;
});

// ════════════════════════════════════════
//  SEND MESSAGE
// ════════════════════════════════════════

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text && !selectedImage) return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  // Block DM to non-connected users
  if (currentChat !== 'public') {
    const user = allUsers.find(u => String(u._id) === currentChat);
    if (user && user.connectionStatus !== 'connected') {
      showToastSimple('🔒 Connect with this person first to send messages');
      return;
    }
  }

  const payload = {
    message:   text,
    imageData: selectedImage ? selectedImage.data : '',
    imageType: selectedImage ? selectedImage.type : ''
  };

  if (currentChat === 'public') {
    socket.emit('sendMessage', { userId, username, ...payload });
  } else {
    socket.emit('privateMessage', {
      senderId: userId, senderName: username, receiverId: currentChat, ...payload
    });
  }

  messageInput.value = '';
  clearSelectedImage();
  stopTyping();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && enterSend) {
    e.preventDefault(); sendMessage();
  }
});
messageInput.addEventListener('input', () => {
  socket.emit('typing', { username, chatId: currentChat });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1500);
});
function stopTyping() { socket.emit('stopTyping', { username, chatId: currentChat }); }

// ─── Image Upload ─────────────────────────
$('imageBtn').addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { alert('Image too large. Max 8MB.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    selectedImage = { data: e.target.result, type: file.type, name: file.name };
    imagePreviewImg.src      = e.target.result;
    previewLabel.textContent = file.name;
    imagePreviewWrap.classList.remove('hidden');
    messageInput.focus();
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});
$('cancelImageBtn').addEventListener('click', clearSelectedImage);
function clearSelectedImage() {
  selectedImage = null;
  imagePreviewWrap.classList.add('hidden');
  imagePreviewImg.src = '';
}

// ════════════════════════════════════════
//  EMOJI
// ════════════════════════════════════════

const EMOJI_CATS = {
  '😊':['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  '👋':['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','👏','🙌','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄','💋'],
  '❤️':['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  '🔥':['🔥','💥','✨','⚡','🌪️','🌈','❄️','🌊','💧','🌙','⭐','🌟','💫','☀️','🌤️','⛅','🌦️','🌧️','🌩️','🌨️','🌬️','🌀','🌻','🌺','🌸','🌼','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🍀','🍃'],
  '🎉':['🎉','🎊','🎈','🎁','🎀','🏆','🥇','🥈','🥉','🎪','🎭','🎨','🎬','🎤','🎧','🎵','🎶','🎷','🥁','🎸','🎹','🎺','🎻','🎮','🎲','🎯','🧩'],
  '🍕':['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🍔','🍟','🍕','🌮','🌯','🍜','🍝','🍛','🍣','🍱','🧁','🍰','🎂','🍭','🍬','🍫','🍿','🍩','🍪','☕','🍵','🧋','🍺','🍻','🥂','🍷'],
  '🚗':['🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🚒','🚲','🛴','🚀','🛸','✈️','🚁','⛵','🚢','🗺️','⛰️','🏔️','🌋','🏕️','🏖️','🏜️','🏝️','🏛️','🏙️','🌃','🌄','🌅','🌉','🏠','🏡','🏢','🏥','🏦','🏨'],
};
let currentEmojiCat = '😊';

function buildEmojiPicker() {
  const tabs = document.createElement('div');
  tabs.className = 'emoji-cat-tabs';
  Object.keys(EMOJI_CATS).forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = `emoji-cat-tab${cat === currentEmojiCat ? ' active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', e => {
      e.stopPropagation(); currentEmojiCat = cat; buildEmojiPicker();
    });
    tabs.appendChild(btn);
  });
  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  EMOJI_CATS[currentEmojiCat].forEach(em => {
    const span = document.createElement('span');
    span.className   = 'emoji-btn-item';
    span.textContent = em;
    span.addEventListener('click', e => {
      e.stopPropagation(); messageInput.value += em; messageInput.focus();
    });
    grid.appendChild(span);
  });
  emojiPicker.innerHTML = '';
  emojiPicker.appendChild(tabs);
  emojiPicker.appendChild(grid);
}

$('emojiBtn').addEventListener('click', e => {
  e.stopPropagation();
  if (emojiPicker.classList.toggle('open')) buildEmojiPicker();
});
document.addEventListener('click', e => {
  if (!emojiPicker.contains(e.target) && e.target !== $('emojiBtn'))
    emojiPicker.classList.remove('open');
});

// ════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════

function showToast(name, text, chatId) {
  const user = allUsers.find(u => u.username === name) || {};
  const av   = user.avatar
    ? `<img src="${user.avatar}" alt=""/>`
    : name.charAt(0).toUpperCase();
  const tc = $('toastContainer');
  const t  = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <div class="toast-av">${av}</div>
    <div class="toast-info">
      <div class="toast-name">${escHtml(name)}</div>
      <div class="toast-msg">${escHtml((text || '').slice(0, 60))}</div>
    </div>`;
  t.addEventListener('click', () => {
    if (chatId === 'public') openPublicChat();
    else {
      const u = allUsers.find(x => String(x._id) === chatId);
      if (u) openPrivateChat(chatId, u.username);
    }
    t.remove();
  });
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4000);
}

function showToastSimple(text) {
  const tc = $('toastContainer');
  const t  = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="toast-info"><div class="toast-msg" style="font-weight:500">${escHtml(text)}</div></div>`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}

// ════════════════════════════════════════
//  LIGHTBOX
// ════════════════════════════════════════

function openLightbox(src) { $('lightboxImg').src = src; $('lightbox').classList.remove('hidden'); }
$('lightboxClose').addEventListener('click', () => $('lightbox').classList.add('hidden'));
$('lightbox').addEventListener('click', e => {
  if (e.target === $('lightbox')) $('lightbox').classList.add('hidden');
});

// ════════════════════════════════════════
//  PROFILE MODAL
// ════════════════════════════════════════

function openProfileModal() {
  const av = localStorage.getItem('avatar') || '';
  const ab = localStorage.getItem('about')  || '';
  $('profileUsername').value          = username;
  $('profileAbout').value             = ab;
  $('aboutCharCount').textContent     = ab.length;
  const big = $('profileAvatarBig');
  big.innerHTML = av ? `<img src="${av}" alt=""/>` : '';
  if (!av) big.textContent = username.charAt(0).toUpperCase();
  $('profileModal').classList.remove('hidden');
}

$('editProfileBtn').addEventListener('click',    openProfileModal);
$('myProfileChip').addEventListener('click',     openProfileModal);
$('closeProfileModal').addEventListener('click', () => $('profileModal').classList.add('hidden'));
$('profileAbout').addEventListener('input', () => {
  $('aboutCharCount').textContent = $('profileAbout').value.length;
});

$('avatarInput').addEventListener('change', () => {
  const file = $('avatarInput').files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert('Avatar max 2MB.'); return; }
  const reader = new FileReader();
  reader.onload = e => { $('profileAvatarBig').innerHTML = `<img src="${e.target.result}" alt=""/>`; };
  reader.readAsDataURL(file);
});

$('saveProfileBtn').addEventListener('click', async () => {
  const about  = $('profileAbout').value.trim();
  const imgEl  = $('profileAvatarBig').querySelector('img');
  const avatar = imgEl ? imgEl.src : (localStorage.getItem('avatar') || '');
  $('saveProfileBtn').textContent = 'Saving…';
  $('saveProfileBtn').disabled    = true;
  try {
    const res  = await fetch('/api/auth/profile', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ about, avatar })
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    localStorage.setItem('about',  data.about  || '');
    localStorage.setItem('avatar', data.avatar || '');
    initMyProfile();
    socket.emit('profileUpdated', { userId, username, avatar: data.avatar || '', about: data.about || '' });
    $('profileModal').classList.add('hidden');
  } catch { alert('Save failed. Try again.'); }
  finally {
    $('saveProfileBtn').textContent = 'Save Changes';
    $('saveProfileBtn').disabled    = false;
  }
});

// ─── View profile button in header ────────
$('viewProfileBtn').addEventListener('click', () => {
  if (viewingUser) openUserActionModal(viewingUser);
});

// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════

$('settingsBtn').addEventListener('click', () => {
  if (document.body.classList.contains('light')) $('themeToggle').classList.add('on');
  else $('themeToggle').classList.remove('on');
  $('soundToggle').classList.toggle('on', soundOn);
  $('enterSendToggle').classList.toggle('on', enterSend);
  const dmSel   = $('dmPrivacySelect');
  const aliasIn = $('publicAliasInput');
  if (dmSel)   dmSel.value   = localStorage.getItem('dmPrivacy')   || 'connected';
  if (aliasIn) aliasIn.value = localStorage.getItem('publicAlias') || '';
  $('settingsModal').classList.remove('hidden');
});
$('closeSettingsModal').addEventListener('click', () => $('settingsModal').classList.add('hidden'));

$('themeToggle').addEventListener('click', () => {
  const light = document.body.classList.toggle('light');
  $('themeToggle').classList.toggle('on', light);
  localStorage.setItem('theme', light ? 'light' : 'dark');
});
$('soundToggle').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundToggle').classList.toggle('on', soundOn);
  localStorage.setItem('soundOn', soundOn);
});
$('enterSendToggle').addEventListener('click', () => {
  enterSend = !enterSend;
  $('enterSendToggle').classList.toggle('on', enterSend);
  localStorage.setItem('enterSend', enterSend);
  messageInput.placeholder = enterSend ? 'Type a message...' : 'Type a message (Shift+Enter for newline)...';
});

// DM Privacy select
const dmSel = $('dmPrivacySelect');
if (dmSel) {
  dmSel.addEventListener('change', async () => {
    try {
      const res = await fetch('/api/auth/profile', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ dmPrivacy: dmSel.value })
      });
      if (res.ok) { localStorage.setItem('dmPrivacy', dmSel.value); showToastSimple('✅ Privacy updated'); }
    } catch {}
  });
}

// Public alias
const aliasBtn = $('saveAliasBtn');
if (aliasBtn) {
  aliasBtn.addEventListener('click', async () => {
    const alias = ($('publicAliasInput').value || '').trim();
    try {
      const res = await fetch('/api/auth/profile', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ publicAlias: alias })
      });
      if (res.ok) {
        localStorage.setItem('publicAlias', alias);
        showToastSimple(alias ? `✅ Alias set: ${alias}` : '✅ Alias cleared');
      }
    } catch {}
  });
}

$('clearCacheBtn').addEventListener('click', () => {
  if (confirm('Clear local cache? You will stay logged in.')) {
    const keep = {
      token, userId, username,
      about:       localStorage.getItem('about'),
      avatar:      localStorage.getItem('avatar'),
      theme:       localStorage.getItem('theme'),
      soundOn:     localStorage.getItem('soundOn'),
      enterSend:   localStorage.getItem('enterSend'),
      dmPrivacy:   localStorage.getItem('dmPrivacy'),
      publicAlias: localStorage.getItem('publicAlias')
    };
    localStorage.clear();
    Object.entries(keep).forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); });
    location.reload();
  }
});
$('settingsLogoutBtn').addEventListener('click', logout);

// ════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════

function logout() {
  if (!confirm('Logout?')) return;
  try { socket.disconnect(); } catch {}
  localStorage.clear();
  window.location.href = '/index.html';
}
$('logoutBtn').addEventListener('click', logout);

// ════════════════════════════════════════
//  MISC
// ════════════════════════════════════════

$('searchInput').addEventListener('input', renderUsers);
$('publicRoomBtn').addEventListener('click', openPublicChat);

function showChatOnMobile() {
  if (window.innerWidth <= 768) {
    chatLayout.classList.add('chat-open');
    $('mobileBack').style.display = 'flex';
  }
}
$('mobileBack').addEventListener('click', () => chatLayout.classList.remove('chat-open'));
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) $('mobileBack').style.display = '';
});

['profileModal', 'settingsModal'].forEach(id => {
  $(id).addEventListener('click', e => { if (e.target === $(id)) $(id).classList.add('hidden'); });
});

// ─── Helper ───────────────────────────────
function escHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════

openPublicChat();
loadUsers();
loadRequests();

// Refresh every 30s
setInterval(loadUsers,    30_000);
setInterval(loadRequests, 60_000);


})();
