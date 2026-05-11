// ════════════════════════════════════════
//  AuraTalk — Auth
// ════════════════════════════════════════

// Apply saved theme
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');

// Already logged in? Go to chat
if (localStorage.getItem('token')) window.location.href = '/chat.html';

// ─── Tab switching ────────────────────────
document.getElementById('loginTab').addEventListener('click', () => switchTab('login'));
document.getElementById('registerTab').addEventListener('click', () => switchTab('register'));

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginTab').classList.toggle('active', isLogin);
  document.getElementById('registerTab').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('registerForm').classList.toggle('hidden', isLogin);
  clearErrors();
}

// ─── Email validation ─────────────────────
const ALLOWED = ['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','protonmail.com','live.com','msn.com','rediffmail.com','ymail.com','aol.com','yahoo.in','outlook.in'];
function validEmail(e) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(e)) return false;
  const domain = e.split('@')[1]?.toLowerCase();
  return ALLOWED.includes(domain);
}

// ─── Register ─────────────────────────────
document.getElementById('registerBtn').addEventListener('click', register);
document.getElementById('regConfirm').addEventListener('keydown', e => { if (e.key==='Enter') register(); });

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  clearErrors();

  if (!username || username.length < 3) return showErr('regError', '⚠ Username min 3 characters');
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return showErr('regError', '⚠ Letters, numbers, underscore only');
  if (!validEmail(email)) return showErr('regError', '⚠ Use Gmail, Yahoo, Outlook, iCloud...');
  if (password.length < 6) return showErr('regError', '⚠ Password min 6 characters');
  if (password !== confirm) return showErr('regError', '⚠ Passwords do not match');

  setBtnState('registerBtn', true, 'Creating...');
  try {
    const res  = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, email, password }) });
    const data = await res.json();
    if (!res.ok) return showErr('regError', data.error || 'Registration failed');
    saveAuth(data);
    showOk('regError', '✅ Account created! Redirecting...');
    setTimeout(() => window.location.href = '/chat.html', 800);
  } catch { showErr('regError', '⚠ Server error. Try again.'); }
  finally { setBtnState('registerBtn', false, 'Create Account →'); }
}

// ─── Login ────────────────────────────────
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key==='Enter') login(); });

async function login() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  clearErrors();
  if (!email || !password) return showErr('loginError', '⚠ Fill in all fields');

  setBtnState('loginBtn', true, 'Signing in...');
  try {
    const res  = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) return showErr('loginError', data.error || 'Login failed');
    saveAuth(data);
    showOk('loginError', '✅ Welcome back!');
    setTimeout(() => window.location.href = '/chat.html', 700);
  } catch { showErr('loginError', '⚠ Server error. Try again.'); }
  finally { setBtnState('loginBtn', false, 'Sign In →'); }
}

// ─── Helpers ──────────────────────────────
function saveAuth(data) {
  localStorage.setItem('token',    data.token);
  localStorage.setItem('userId',   String(data.userId));
  localStorage.setItem('username', data.username);
  if (data.about)  localStorage.setItem('about',  data.about);
  if (data.avatar) localStorage.setItem('avatar', data.avatar);
}
function showErr(id, msg) { const el=document.getElementById(id); if(el){el.textContent=msg; el.style.color='#f87171';} }
function showOk(id, msg)  { const el=document.getElementById(id); if(el){el.textContent=msg; el.style.color='#4ade80';} }
function clearErrors() { ['loginError','regError'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=''; }); }
function setBtnState(id, dis, txt) { const b=document.getElementById(id); if(b){b.disabled=dis; b.textContent=txt;} }