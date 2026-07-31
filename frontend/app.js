'use strict';

// ── Firebase / Push ───────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCeL152ckUiUzobhJadvwHoj6-dTkCkvIQ",
  authDomain: "technote-clubv.firebaseapp.com",
  projectId: "technote-clubv",
  storageBucket: "technote-clubv.firebasestorage.app",
  messagingSenderId: "625762333694",
  appId: "1:625762333694:web:60b2b7b56c02965fcf46af"
};
const VAPID_KEY = 'BCk3cOcmho0XKti6ziGtw0RXt23OTEOTy8tIBRleIYXBFFlgZUtalK8mAymWsPtfN9djJjaCSxxk3LRNZ2d_H4k';

let _fbMessaging = null;
function getFbMessaging() {
  if (_fbMessaging) return _fbMessaging;
  if (typeof firebase === 'undefined') return null;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _fbMessaging = firebase.messaging();
  } catch (e) {
    // already initialized or not supported
    try { _fbMessaging = firebase.messaging(); } catch { return null; }
  }
  return _fbMessaging;
}

async function initPush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const msg = getFbMessaging();
    if (!msg) return;
    const reg = await navigator.serviceWorker.ready;
    const token = await msg.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    await api('POST', '/devices/register', { fcm_token: token, platform: isIOS ? 'ios' : 'web' });
  } catch (err) {
    console.warn('Push init failed:', err);
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = '#5BA4CF';
const TZ = 'Asia/Ho_Chi_Minh';
const BADGE_COLORS = [
  '#E53E3E','#DD6B20','#D69E2E','#38A169',
  '#319795','#3182CE','#553C9A','#805AD5','#D53F8C','#718096',
];
const HEADER_LABELS = {
  home: 'TechNote', feed: 'Feed', activity: 'Activity (48h)', history: 'History',
};

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('jwt'),
  user: null,
  tab: 'home',
  ws: null,
  wsTimer: null,
  unreadCount: 0,
  selectedColor: ACCENT,
};

// ── API helper ────────────────────────────────────────────────────────────────
async function api(method, path, body = null, signal = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  if (signal) opts.signal = signal;
  const res = await fetch(path, opts);
  if (res.status === 401) { if (!path.startsWith('/auth')) logout(); throw new Error('401'); }
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

function fmtDateLabel(iso) {
  const d = new Date(iso);
  const toVN = dt => dt.toLocaleDateString('vi-VN', { timeZone: TZ });
  const today = new Date();
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const ddmm  = d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', timeZone: TZ });
  if (toVN(d) === toVN(today)) return `Hôm nay, ${ddmm}`;
  if (toVN(d) === toVN(yest))  return `Hôm qua, ${ddmm}`;
  return ddmm;
}

function dateKey(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    year:'numeric', month:'2-digit', day:'2-digit', timeZone: TZ,
  });
}

// ── Report Card ───────────────────────────────────────────────────────────────
function reportCard(r, { unread = false } = {}) {
  const color = r.user?.badge_color || ACCENT;
  return `
    <div class="report-card${unread ? ' unread' : ''}" data-id="${r.id}">
      <div class="card-meta">
        <div class="card-author">
          <span class="badge-dot" style="background:${color}"></span>
          <span class="card-name">${esc(r.user?.display_name || '—')}</span>
        </div>
        <span class="card-time">${fmtTime(r.created_at)}</span>
      </div>
      <div class="card-body">${esc(r.body)}</div>
    </div>`;
}

function bindCardRead(container) {
  container.querySelectorAll('.report-card.unread').forEach(card => {
    card.addEventListener('click', async () => {
      const id = Number(card.dataset.id);
      await api('POST', `/reports/${id}/read`).catch(() => {});
      card.classList.remove('unread');
      setUnread(document.querySelectorAll('#feed-list .report-card.unread').length);
    });
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login(nickname, password) {
  const data = await api('POST', '/auth/login', { nickname, password });
  state.token = data.access_token;
  localStorage.setItem('jwt', state.token);
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('jwt');
  if (state.ws) { state.ws.close(); state.ws = null; }
  clearTimeout(state.wsTimer);
  closeSettings();
  showLogin();
}

async function initAuth() {
  if (!state.token) { showLogin(); return; }
  try {
    state.user = await api('GET', '/users/me');
    showApp();
  } catch {
    showLogin();
  }
}

// ── Screen routing ────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  const btn = document.getElementById('login-btn');
  btn.innerHTML = 'ĐĂNG NHẬP';
  btn.disabled = false;
}

function showApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  onAppStart();
  initPush();
}

async function onAppStart() {
  updateNetworkBanner();
  await checkAwayLogic();
  connectWS();
  processOfflineQueue();
  loadTab(state.tab);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Away logic ────────────────────────────────────────────────────────────────
async function checkAwayLogic() {
  const last = localStorage.getItem('last_opened');
  const now  = Date.now();
  localStorage.setItem('last_opened', now);
  if (!last) return;

  const diffH = (now - Number(last)) / 3_600_000;
  if (diffH <= 2) return;

  let reports = await api('GET', '/reports/unread').catch(() => []) || [];
  reports = reports.filter(r => r.user_id !== state.user?.id);
  if (!reports.length) return;

  const hours = Math.floor(diffH);
  document.getElementById('away-title').textContent = `Bạn đã vắng mặt ${hours} giờ`;
  document.getElementById('away-subtitle').textContent =
    `Có ${reports.length} báo cáo mới trong lúc bạn vắng`;
  document.getElementById('away-list').innerHTML = reports.map(r => reportCard(r)).join('');
  document.getElementById('away-overlay').classList.remove('hidden');
}

// ── Tab navigation ────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab-screen').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('header-title').textContent = HEADER_LABELS[tab];
  document.getElementById('settings-btn').style.visibility =
    tab === 'home' ? 'visible' : 'hidden';
  loadTab(tab);
}

function loadTab(tab) {
  if (tab === 'feed')     loadFeed();
  if (tab === 'activity') loadActivity();
  if (tab === 'history')  loadHistory();
}

// ── Feed ──────────────────────────────────────────────────────────────────────
async function loadFeed() {
  let reports = await api('GET', '/reports/unread').catch(() => []) || [];
  reports = reports.filter(r => r.user_id !== state.user?.id);

  const list = document.getElementById('feed-list');
  const empty = document.getElementById('feed-empty');
  const markAllBtn = document.getElementById('mark-all-btn');

  if (!reports.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    markAllBtn.classList.add('hidden');
    setUnread(0);
    return;
  }

  empty.classList.add('hidden');
  markAllBtn.classList.remove('hidden');
  list.innerHTML = reports.map(r => reportCard(r, { unread: true })).join('');
  setUnread(reports.length);
  bindCardRead(list);
}

function setUnread(n) {
  state.unreadCount = n;
  const badge = document.getElementById('feed-badge');
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

// ── Activity ──────────────────────────────────────────────────────────────────
async function loadActivity() {
  const from = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const reports = await api('GET',
    `/reports?mine=true&from=${encodeURIComponent(from)}&limit=200`
  ).catch(() => []) || [];

  const list  = document.getElementById('activity-list');
  const empty = document.getElementById('activity-empty');

  if (!reports.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  list.innerHTML = reports.map(r => reportCard(r)).join('');
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  const from = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const reports = await api('GET',
    `/reports?from=${encodeURIComponent(from)}&limit=200`
  ).catch(() => []) || [];

  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  if (!reports.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  const groups = {}, order = [];
  for (const r of reports) {
    const k = dateKey(r.created_at);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(r);
  }

  let html = '';
  for (const k of order) {
    html += `<div class="date-sep"><span>${fmtDateLabel(groups[k][0].created_at)}</span></div>`;
    html += groups[k].map(r => reportCard(r)).join('');
  }
  list.innerHTML = html;
}

// ── Send report ───────────────────────────────────────────────────────────────
async function sendReport() {
  const input = document.getElementById('report-input');
  const btn   = document.getElementById('send-btn');
  const text  = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const client_uuid = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    await api('POST', '/reports', { body: text, client_uuid }, controller.signal);
    clearTimeout(timeout);

    input.value = '';
    input.style.height = '';
    btn.textContent = '✓';
    btn.classList.add('btn-success');
    toast('✓ Đã gửi');
    setTimeout(() => {
      btn.textContent = 'GỬI';
      btn.classList.remove('btn-success');
      btn.disabled = false;
    }, 1200);
  } catch (err) {
    const isOffline = !navigator.onLine || err?.name === 'AbortError';
    if (isOffline) {
      const client_uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
      q.push({ body: text, client_uuid });
      localStorage.setItem('offline_queue', JSON.stringify(q));
      input.value = '';
      input.style.height = '';
      toast('📡 Đã lưu — sẽ gửi khi có mạng', 'warning');
    } else {
      toast(`✗ Lỗi: ${err?.message || err}`, 'error');
    }
    btn.textContent = 'GỬI';
    btn.disabled = false;
  }
}

// ── Offline queue ─────────────────────────────────────────────────────────────
async function processOfflineQueue() {
  const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
  if (!q.length) return;
  const failed = [];
  for (const item of q) {
    try {
      await api('POST', '/reports', { body: item.body, client_uuid: item.client_uuid });
    } catch {
      failed.push(item);
    }
  }
  localStorage.setItem('offline_queue', JSON.stringify(failed));
  if (failed.length < q.length) toast(`✓ Đã gửi ${q.length - failed.length} note offline`);
}

// ── Network ───────────────────────────────────────────────────────────────────
function updateNetworkBanner() {
  document.getElementById('offline-banner').classList.toggle('hidden', navigator.onLine);
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectWS() {
  if (!state.token) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws?token=${state.token}`);
  state.ws = ws;

  ws.onmessage = e => {
    try { onNewReport(JSON.parse(e.data)); } catch {}
  };
  ws.onclose = () => {
    state.ws = null;
    state.wsTimer = setTimeout(connectWS, 3000);
  };
  ws.onerror = () => ws.close();
}

function onNewReport(r) {
  if (r.user_id === state.user?.id) return;
  setUnread(state.unreadCount + 1);

  if (state.tab === 'feed') {
    const list = document.getElementById('feed-list');
    document.getElementById('feed-empty').classList.add('hidden');
    document.getElementById('mark-all-btn').classList.remove('hidden');
    list.insertAdjacentHTML('afterbegin', reportCard(r, { unread: true }));
    bindCardRead(list);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openSettings() {
  state.selectedColor = state.user?.badge_color || ACCENT;
  document.getElementById('settings-name').value = state.user?.display_name || '';
  renderColorPicker();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function renderColorPicker() {
  document.getElementById('color-picker').innerHTML = BADGE_COLORS.map(c => {
    const sel = c === state.selectedColor;
    return `<button class="color-swatch${sel ? ' selected' : ''}"
               style="background:${c};${sel ? `color:${c}` : ''}"
               data-color="${c}" aria-label="${c}">${sel ? '✓' : ''}</button>`;
  }).join('');
  document.getElementById('color-picker').querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedColor = btn.dataset.color;
      renderColorPicker();
    });
  });
}

async function saveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  if (!name) { toast('Nickname không được để trống', 'error'); return; }
  try {
    state.user = await api('PUT', '/users/me', {
      display_name: name,
      badge_color: state.selectedColor,
    });
    closeSettings();
    toast('✓ Đã lưu');
  } catch {
    toast('Lưu thất bại', 'error');
  }
}

// ── Pull-to-refresh (Feed) ────────────────────────────────────────────────────
let ptY = 0;
const appMain = () => document.querySelector('.app-main');
document.addEventListener('touchstart', e => { ptY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', async e => {
  if (state.tab !== 'feed') return;
  const main = appMain();
  if (!main || main.scrollTop !== 0) return;
  if (e.changedTouches[0].clientY - ptY > 60) await loadFeed();
}, { passive: true });

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const nickname = document.getElementById('login-nickname').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  err.classList.add('hidden');

  try {
    await login(nickname, password);
    state.user = await api('GET', '/users/me');
    btn.innerHTML = 'ĐĂNG NHẬP';
    btn.disabled = false;
    showApp();
  } catch {
    err.classList.remove('hidden');
    btn.innerHTML = 'ĐĂNG NHẬP';
    btn.disabled = false;
  }
});

document.getElementById('send-btn').addEventListener('click', sendReport);

document.getElementById('report-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.max(180, this.scrollHeight) + 'px';
});

document.getElementById('report-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReport();
});

document.getElementById('send-btn').addEventListener('mousedown', () => {
  document.getElementById('send-btn').style.transform = 'scale(0.97)';
});
['mouseup','mouseleave'].forEach(ev =>
  document.getElementById('send-btn').addEventListener(ev, () => {
    document.getElementById('send-btn').style.transform = '';
  })
);

document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
);

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('settings-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
});
document.getElementById('settings-save').addEventListener('click', saveSettings);
document.getElementById('settings-logout').addEventListener('click', logout);

document.getElementById('mark-all-btn').addEventListener('click', async () => {
  const cards = [...document.querySelectorAll('#feed-list .report-card.unread')];
  await Promise.all(cards.map(c =>
    api('POST', `/reports/${Number(c.dataset.id)}/read`).catch(() => {})
  ));
  cards.forEach(c => c.classList.remove('unread'));
  setUnread(0);
  document.getElementById('mark-all-btn').classList.add('hidden');
});

document.getElementById('away-close').addEventListener('click', async () => {
  const cards = [...document.querySelectorAll('#away-list .report-card')];
  await Promise.all(cards.map(c =>
    api('POST', `/reports/${Number(c.dataset.id)}/read`).catch(() => {})
  ));
  document.getElementById('away-overlay').classList.add('hidden');
  setUnread(0);
});

window.addEventListener('online', () => { updateNetworkBanner(); processOfflineQueue(); });
window.addEventListener('offline', updateNetworkBanner);

// ── Boot ──────────────────────────────────────────────────────────────────────
initAuth();
