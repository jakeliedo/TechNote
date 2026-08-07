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
  'linear-gradient(135deg,#FF6B6B,#FFE66D)',
  'linear-gradient(135deg,#4ECDC4,#44A08D)',
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#30cfd0,#330867)',
  'linear-gradient(135deg,#f7971e,#ffd200)',
];
const HEADER_LABELS = {
  home: 'TechNote', feed: 'Feed', activity: 'Activity (48h)', history: 'History',
};

const REACTIONS = [
  { key: 'smile',    icon: '😄' },
  { key: 'surprise', icon: '😮' },
  { key: 'question', icon: '🤔' },
];

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('jwt'),
  user: null,
  tab: 'home',
  ws: null,
  wsTimer: null,
  unreadCount: 0,
  selectedColor: ACCENT,
  allUsers: [],
};

// ── API helper ────────────────────────────────────────────────────────────────
async function api(method, path, body = null, signal = null) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  // Don't set Content-Type for FormData — browser sets it with correct multipart boundary
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = body instanceof FormData ? body : JSON.stringify(body);
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

const MONTH_SHORT = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];

function fmtTime(iso) {
  const d = new Date(iso);
  const p = {};
  new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ, hour12: false,
  }).formatToParts(d).forEach(({ type, value }) => { p[type] = value; });
  return `${p.day} ${MONTH_SHORT[Number(p.month) - 1]} ${p.year} ${p.hour}:${p.minute}`;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDateLabel(iso) {
  const d = new Date(iso);
  const toKey = dt => dt.toLocaleDateString('en-US', { timeZone: TZ });
  const today = new Date();
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const month = d.toLocaleDateString('en-US', { month: 'long', timeZone: TZ });
  const day   = Number(d.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ }));
  const year  = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: TZ });
  const label = `${month} ${ordinal(day)} ${year}`;
  if (toKey(d) === toKey(today)) return `Today, ${label}`;
  if (toKey(d) === toKey(yest))  return `Yesterday, ${label}`;
  return label;
}

function dateKey(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    year:'numeric', month:'2-digit', day:'2-digit', timeZone: TZ,
  });
}

// ── Image resize (client-side, targets 2 MB JPEG) ────────────────────────────
function resizeImageToBlob(file, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1920;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      let quality = 0.92;
      const compress = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          if (blob.size <= maxBytes || quality <= 0.30) { resolve(blob); }
          else { quality -= 0.08; compress(); }
        }, 'image/jpeg', quality);
      };
      compress();
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function openLightbox(url) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${url}" alt="ảnh"><button class="lightbox-close" aria-label="Đóng">✕</button>`;
  lb.addEventListener('click', e => {
    if (e.target === lb || e.target.closest('.lightbox-close')) lb.remove();
  });
  document.body.appendChild(lb);
}

// ── Lazy image loading ────────────────────────────────────────────────────────
const _lazyObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
    _lazyObserver.unobserve(img);
  });
}, { rootMargin: '120px' });

function bindLazyImages(container) {
  container.querySelectorAll('img[data-src]').forEach(img => _lazyObserver.observe(img));
}

function bindCardImages(container) {
  container.querySelectorAll('.card-image[data-url]').forEach(wrap => {
    wrap.addEventListener('click', e => {
      e.stopPropagation();
      openLightbox(wrap.dataset.url);
      // Trigger read + auto-seen when opening an image from an unread feed card (iOS-safe)
      const card = wrap.closest('.report-card.unread');
      if (card) {
        const reportId = Number(card.dataset.id);
        api('POST', `/reports/${reportId}/read`).catch(() => {});
        card.classList.remove('unread');
        setUnread(document.querySelectorAll('#feed-list .report-card.unread').length);
        autoSeenNote(reportId, card.querySelector('.check-btn'));
      }
    });
  });
}

// ── Report Card ───────────────────────────────────────────────────────────────
function rxnBadgesHtml(reportId, reactions, myReaction) {
  return REACTIONS
    .filter(({ key }) => (reactions[key] || 0) > 0 || myReaction === key)
    .map(({ key, icon }) => {
      const count = reactions[key] || 0;
      const mine = myReaction === key;
      return `<button class="rxn-badge${mine ? ' mine' : ''}" data-id="${reportId}" data-reaction="${key}">${icon}<span class="rxn-count">${count > 0 ? count : ''}</span></button>`;
    }).join('');
}

function reportCard(r, { unread = false } = {}) {
  const color = r.user?.badge_color || ACCENT;
  const isOwn = r.user_id === state.user?.id;
  const checkCount = r.check_count || 0;
  const checkedByMe = r.checked_by_me || false;
  const rxns = r.reactions || {};
  const myRxn = r.my_reaction || null;

  const checkPartHtml = isOwn
    ? `<span class="check-indicator seen-count-${checkCount > 0 ? 'active' : 'zero'}">✓ ${checkCount}</span>`
    : `<button class="check-btn${checkedByMe ? ' checked-by-me' : ''}"
               data-id="${r.id}" data-checked="${checkedByMe ? '1' : '0'}" title="Noted">
         ✓<span class="check-count">${checkCount > 0 ? ' ' + checkCount : ''}</span>
       </button>`;

  const imgHtml = r.image_url
    ? `<div class="card-image" data-url="${r.image_url}" data-report-id="${r.id}">
         <img data-src="${r.image_url}" alt="ảnh đính kèm">
       </div>`
    : '';

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
      ${imgHtml}
      <div class="card-footer">
        <div class="rxn-cluster" data-report-id="${r.id}" data-my-reaction="${myRxn || ''}">
          <div class="rxn-badges">${rxnBadgesHtml(r.id, rxns, myRxn)}</div>
          <button class="rxn-trigger" data-id="${r.id}" title="Ấn giữ để chọn cảm xúc">😊</button>
        </div>
        ${checkPartHtml}
      </div>
    </div>`;
}

function bindCardRead(container) {
  container.querySelectorAll('.report-card.unread:not([data-read-bound])').forEach(card => {
    card.dataset.readBound = '1';
    card.addEventListener('click', async e => {
      if (e.target.closest('.check-btn')) return;
      if (e.target.closest('.rxn-badge')) return;
      if (e.target.closest('.rxn-trigger')) return;
      const id = Number(card.dataset.id);
      await api('POST', `/reports/${id}/read`).catch(() => {});
      card.classList.remove('unread');
      setUnread(document.querySelectorAll('#feed-list .report-card.unread').length);
      autoSeenNote(id, card.querySelector('.check-btn'));
    });
  });
}

function bindCheckBtns(container) {
  container.querySelectorAll('.check-btn:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const reportId = Number(btn.dataset.id);
      try {
        const res = await api('POST', `/reports/${reportId}/check`);
        btn.dataset.checked = res.checked ? '1' : '0';
        btn.classList.toggle('checked-by-me', res.checked);
        btn.querySelector('.check-count').textContent = res.check_count > 0 ? ' ' + res.check_count : '';
      } catch {
        toast('Lỗi', 'error');
      }
    });
  });
}

// Auto-seen: mark a note as seen (check) without toggling off if already checked.
// Uses optimistic data-checked='1' lock to prevent duplicate API calls.
function autoSeenNote(reportId, btn) {
  if (!btn || btn.dataset.checked !== '0') return;
  btn.dataset.checked = '1'; // optimistic — blocks any concurrent call
  btn.classList.add('checked-by-me');
  api('POST', `/reports/${reportId}/check`).then(res => {
    if (res) btn.querySelector('.check-count').textContent = res.check_count > 0 ? ' ' + res.check_count : '';
  }).catch(() => {
    btn.dataset.checked = '0';
    btn.classList.remove('checked-by-me');
  });
}

// ── Reaction Picker ───────────────────────────────────────────────────────────
let rxnPickerEl = null;

function openRxnPicker(anchorEl, reportId, myReaction) {
  closeRxnPicker();
  const picker = document.createElement('div');
  picker.className = 'rxn-picker';
  REACTIONS.forEach(({ key, icon }) => {
    const btn = document.createElement('button');
    btn.className = `rxn-picker-btn${myReaction === key ? ' mine' : ''}`;
    btn.textContent = icon;
    btn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      closeRxnPicker();
      doReact(reportId, key);
    });
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  rxnPickerEl = picker;

  // Position above anchor button
  const rect = anchorEl.getBoundingClientRect();
  const pw = 138; // approx picker width
  let left = rect.left + rect.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  picker.style.left = `${left}px`;
  picker.style.top  = `${rect.top - 54}px`;

  setTimeout(() => {
    document.addEventListener('pointerdown', _rxnOutside, { capture: true, once: true });
  }, 0);
}

function _rxnOutside(e) {
  if (rxnPickerEl && !rxnPickerEl.contains(e.target)) closeRxnPicker();
  else if (rxnPickerEl) {
    // re-attach if click was inside picker (picker handles itself)
    setTimeout(() => {
      document.addEventListener('pointerdown', _rxnOutside, { capture: true, once: true });
    }, 0);
  }
}

function closeRxnPicker() {
  rxnPickerEl?.remove();
  rxnPickerEl = null;
}

async function doReact(reportId, reaction) {
  try {
    const res = await api('POST', `/reports/${reportId}/react`, { reaction });
    updateRxnClusters(reportId, res.counts, res.reaction);
  } catch {
    toast('Lỗi', 'error');
  }
}

function updateRxnClusters(reportId, counts, myReaction) {
  document.querySelectorAll(`.rxn-cluster[data-report-id="${reportId}"]`).forEach(cluster => {
    cluster.dataset.myReaction = myReaction || '';
    const badgesDiv = cluster.querySelector('.rxn-badges');
    if (!badgesDiv) return;
    badgesDiv.innerHTML = rxnBadgesHtml(reportId, counts, myReaction || null);
    badgesDiv.querySelectorAll('.rxn-badge').forEach(b => bindRxnBadge(b));
  });
}

function _attachLongPress(el, onLong) {
  let timer = null;
  let fired = false;
  const start = () => { fired = false; timer = setTimeout(() => { fired = true; onLong(); }, 450); };
  const cancel = () => clearTimeout(timer);
  const end = e => { cancel(); if (fired) e.preventDefault(); };
  el.addEventListener('touchstart',   start,  { passive: true });
  el.addEventListener('touchend',     end,    { passive: false });
  el.addEventListener('touchmove',    cancel, { passive: true });
  el.addEventListener('mousedown',    start);
  el.addEventListener('mouseup',      cancel);
  el.addEventListener('mouseleave',   cancel);
  el.addEventListener('contextmenu',  e => e.preventDefault());
}

function bindRxnBadge(badge) {
  let longFired = false;
  let timer = null;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => {
      longFired = true;
      const cluster = badge.closest('.rxn-cluster');
      openRxnPicker(badge, Number(badge.dataset.id), cluster?.dataset.myReaction || null);
    }, 450);
  };
  const cancel = () => clearTimeout(timer);
  const end = e => {
    cancel();
    if (longFired) { e.preventDefault?.(); return; }
    e.stopPropagation();
    doReact(Number(badge.dataset.id), badge.dataset.reaction);
  };
  badge.addEventListener('touchstart',  start,  { passive: true });
  badge.addEventListener('touchend',    end,    { passive: false });
  badge.addEventListener('touchmove',   cancel, { passive: true });
  badge.addEventListener('mousedown',   start);
  badge.addEventListener('mouseup',     end);
  badge.addEventListener('mouseleave',  cancel);
  badge.addEventListener('contextmenu', e => e.preventDefault());
}

function bindRxnCluster(container) {
  // Long-press on trigger → open picker
  container.querySelectorAll('.rxn-trigger:not([data-bound])').forEach(trigger => {
    trigger.dataset.bound = '1';
    _attachLongPress(trigger, () => {
      const cluster = trigger.closest('.rxn-cluster');
      openRxnPicker(trigger, Number(trigger.dataset.id), cluster?.dataset.myReaction || null);
    });
    // Prevent short-click from doing anything (long-press only)
    trigger.addEventListener('click', e => e.stopPropagation());
  });
  // Short-click badge = toggle, long-press badge = open picker
  container.querySelectorAll('.rxn-badge:not([data-bound])').forEach(badge => {
    badge.dataset.bound = '1';
    bindRxnBadge(badge);
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login(nickname, password) {
  const data = await api('POST', '/auth/login', { nickname, password });
  state.token = data.access_token;
  localStorage.setItem('jwt', state.token);
  localStorage.setItem('device_owner', nickname);
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('jwt');
  localStorage.removeItem('device_owner');
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
  } catch (e) {
    if (e.message === '401') { showLogin(); return; }
    // Network error (server chưa sẵn sàng) — thử lại sau 3 giây
    await new Promise(r => setTimeout(r, 3000));
    try {
      state.user = await api('GET', '/users/me');
      showApp();
    } catch {
      showLogin();
    }
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

async function autoAssignColor() {
  try {
    const users = await api('GET', '/users');
    state.allUsers = users || [];
    const myColor = state.user?.badge_color;
    const takenByOthers = new Set(
      state.allUsers.filter(u => u.id !== state.user?.id).map(u => u.badge_color)
    );
    if (!takenByOthers.has(myColor)) return;
    const free = BADGE_COLORS.find(c => !takenByOthers.has(c));
    if (!free) return;
    state.user = await api('PUT', '/users/me', {
      display_name: state.user.display_name,
      badge_color: free,
    });
    const idx = state.allUsers.findIndex(u => u.id === state.user.id);
    if (idx >= 0) state.allUsers[idx] = { ...state.allUsers[idx], badge_color: free };
  } catch (e) {
    console.warn('autoAssignColor failed:', e);
  }
}

async function onAppStart() {
  updateNetworkBanner();
  await autoAssignColor();
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
  const awayList = document.getElementById('away-list');
  awayList.innerHTML = reports.map(r => reportCard(r)).join('');
  bindCheckBtns(awayList);
  bindRxnCluster(awayList);
  bindLazyImages(awayList);
  bindCardImages(awayList);
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
  bindRxnCluster(list);
  bindLazyImages(list);
  bindCardImages(list);
  // Auto-seen: all notes visible in feed are counted as seen (increments ✓ count for sender)
  list.querySelectorAll('.check-btn[data-checked="0"]').forEach(btn => {
    autoSeenNote(Number(btn.dataset.id), btn);
  });
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
  bindCheckBtns(list);
  bindRxnCluster(list);
  bindLazyImages(list);
  bindCardImages(list);
}

// ── History ───────────────────────────────────────────────────────────────────
const HISTORY_PAGE = 100;
const HISTORY_FROM = () => new Date(Date.now() - 60 * 86_400_000).toISOString();
let _historyOffset = 0;
let _historyLoading = false;

async function loadHistory(append = false) {
  if (_historyLoading) return;
  _historyLoading = true;

  if (!append) {
    _historyOffset = 0;
    document.getElementById('history-list').innerHTML = '';
  }

  const from = HISTORY_FROM();
  const reports = await api('GET',
    `/reports?from=${encodeURIComponent(from)}&limit=${HISTORY_PAGE}&offset=${_historyOffset}`
  ).catch(() => []) || [];

  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const more  = document.getElementById('history-load-more');

  if (!append && !reports.length) {
    empty.classList.remove('hidden');
    more.classList.add('hidden');
    _historyLoading = false;
    return;
  }
  empty.classList.add('hidden');

  const groups = {}, order = [];
  for (const r of reports) {
    const k = dateKey(r.created_at);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(r);
  }

  const frag = document.createDocumentFragment();
  for (const k of order) {
    const sep = document.createElement('div');
    sep.className = 'date-sep';
    sep.innerHTML = `<span>${fmtDateLabel(groups[k][0].created_at)}</span>`;
    frag.appendChild(sep);
    groups[k].forEach(r => {
      const tmp = document.createElement('div');
      tmp.innerHTML = reportCard(r);
      frag.appendChild(tmp.firstElementChild);
    });
  }
  list.appendChild(frag);
  bindCheckBtns(list);
  bindRxnCluster(list);
  bindLazyImages(list);
  bindCardImages(list);

  _historyOffset += reports.length;
  more.classList.toggle('hidden', reports.length < HISTORY_PAGE);
  _historyLoading = false;
}

document.getElementById('history-load-more-btn').addEventListener('click', () => loadHistory(true));

// ── Image attachment state ────────────────────────────────────────────────────
let _pendingBlob = null;
let _pendingName = '';

function _genUUID() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function clearImage() {
  _pendingBlob = null; _pendingName = '';
  document.getElementById('img-preview-bar').classList.add('hidden');
  document.getElementById('report-input').classList.remove('has-image');
  document.getElementById('camera-btn').classList.remove('used');
  document.getElementById('img-input').value = '';
  const thumb = document.getElementById('img-preview-thumb');
  if (thumb.src) { URL.revokeObjectURL(thumb.src); thumb.src = ''; }
}

async function handleImagePicked(file) {
  if (!file) return;
  const cameraBtn = document.getElementById('camera-btn');
  cameraBtn.classList.add('used');
  try {
    const blob = await resizeImageToBlob(file);
    _pendingBlob = blob;
    _pendingName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    const thumb = document.getElementById('img-preview-thumb');
    const objUrl = URL.createObjectURL(blob);
    thumb.src = objUrl;
    document.getElementById('img-preview-name').textContent = _pendingName;
    document.getElementById('img-preview-size').textContent =
      (blob.size / (1024 * 1024)).toFixed(1) + ' MB';
    document.getElementById('img-preview-bar').classList.remove('hidden');
    document.getElementById('report-input').classList.add('has-image');
  } catch {
    cameraBtn.classList.remove('used');
    toast('Không thể xử lý ảnh', 'error');
  }
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
    const client_uuid = _genUUID();
    const fd = new FormData();
    fd.append('body', text);
    fd.append('client_uuid', client_uuid);
    if (_pendingBlob) fd.append('image', _pendingBlob, _pendingName || 'image.jpg');

    const controller = new AbortController();
    // Allow longer timeout when uploading an image
    const timeout = setTimeout(() => controller.abort(), _pendingBlob ? 30000 : 15000);
    await api('POST', '/reports', fd, controller.signal);
    clearTimeout(timeout);

    input.value = '';
    input.style.height = '';
    clearImage();
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
    if (isOffline && !_pendingBlob) {
      // Text-only notes can be queued offline; images cannot
      const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
      q.push({ body: text, client_uuid: _genUUID() });
      localStorage.setItem('offline_queue', JSON.stringify(q));
      input.value = '';
      input.style.height = '';
      toast('📡 Đã lưu — sẽ gửi khi có mạng', 'warning');
    } else if (isOffline && _pendingBlob) {
      toast('📡 Offline — không thể gửi ảnh', 'error');
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
      const fd = new FormData();
      fd.append('body', item.body);
      fd.append('client_uuid', item.client_uuid);
      await api('POST', '/reports', fd);
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
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'check') onCheckUpdate(msg);
      else if (msg.type === 'reaction') onReactionUpdate(msg);
      else onNewReport(msg);
    } catch {}
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
    bindRxnCluster(list);
    bindLazyImages(list);
    bindCardImages(list);
    autoSeenNote(r.id, list.querySelector(`.report-card[data-id="${r.id}"] .check-btn`));
  }
}

function onCheckUpdate({ report_id, check_count, user_id }) {
  // Skip echo of own action — UI already updated by API response
  if (user_id === state.user?.id) return;
  const countText = check_count > 0 ? ' ' + check_count : '';
  document.querySelectorAll(`.report-card[data-id="${report_id}"] .check-btn .check-count`)
    .forEach(el => { el.textContent = countText; });
  document.querySelectorAll(`.report-card[data-id="${report_id}"] .check-indicator`)
    .forEach(el => {
      el.textContent = '✓ ' + check_count;
      el.classList.toggle('seen-count-active', check_count > 0);
      el.classList.toggle('seen-count-zero', check_count === 0);
    });
}

function onReactionUpdate({ report_id, user_id, counts }) {
  if (user_id === state.user?.id) return; // skip own echo
  // Don't know the other user's myReaction, only update counts (keep local active state)
  document.querySelectorAll(`.rxn-cluster[data-report-id="${report_id}"]`).forEach(cluster => {
    const myReaction = cluster.dataset.myReaction || null;
    const badgesDiv = cluster.querySelector('.rxn-badges');
    if (!badgesDiv) return;
    badgesDiv.innerHTML = rxnBadgesHtml(report_id, counts, myReaction);
    badgesDiv.querySelectorAll('.rxn-badge').forEach(b => bindRxnBadge(b));
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openSettings() {
  state.selectedColor = state.user?.badge_color || ACCENT;
  const fixed = state.user?.username || state.user?.display_name || '';
  const current = state.user?.display_name || '';
  const suffix = current.startsWith(fixed + ' | ') ? current.slice(fixed.length + 3) : '';
  document.getElementById('settings-username-prefix').textContent = fixed;
  document.getElementById('settings-suffix').value = suffix;
  // Refresh allUsers for accurate taken list
  api('GET', '/users').then(users => {
    if (users) { state.allUsers = users; renderColorPicker(); }
  }).catch(() => {});
  renderColorPicker();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function renderColorPicker() {
  const myId = state.user?.id;
  const taken = new Set(
    (state.allUsers || []).filter(u => u.id !== myId).map(u => u.badge_color)
  );
  document.getElementById('color-picker').innerHTML = BADGE_COLORS.map(c => {
    const sel = c === state.selectedColor;
    const isTaken = taken.has(c);
    const tick = sel ? '✓' : (isTaken ? '✕' : '');
    return `<button class="color-swatch${sel ? ' selected' : ''}${isTaken ? ' taken' : ''}"
               style="background:${c}" data-color="${c}" aria-label="${c}"
               ${isTaken ? 'disabled' : ''}>${tick}</button>`;
  }).join('');
  document.getElementById('color-picker').querySelectorAll('.color-swatch:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedColor = btn.dataset.color;
      renderColorPicker();
    });
  });
}

async function saveSettings() {
  const suffix = document.getElementById('settings-suffix').value.trim();
  const fixed = state.user?.username || state.user?.display_name || '';
  const displayName = suffix ? `${fixed} | ${suffix}` : fixed;
  try {
    state.user = await api('PUT', '/users/me', {
      display_name: displayName,
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

  const owner = localStorage.getItem('device_owner');
  if (owner && owner.toLowerCase() !== nickname.toLowerCase()) {
    err.textContent = `Thiết bị này thuộc về "${owner}". Liên hệ quản trị để đổi.`;
    err.classList.remove('hidden');
    return;
  }

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
    err.textContent = 'Nickname hoặc mật khẩu không đúng';
    err.classList.remove('hidden');
    btn.innerHTML = 'ĐĂNG NHẬP';
    btn.disabled = false;
  }
});

document.getElementById('send-btn').addEventListener('click', sendReport);

// ── Camera / image attachment ─────────────────────────────────────────────────
document.getElementById('camera-btn').addEventListener('click', () => {
  if (_pendingBlob) return; // already has image
  document.getElementById('img-input').click();
});

document.getElementById('img-input').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) handleImagePicked(file);
});

document.getElementById('img-clear-btn').addEventListener('click', e => {
  e.stopPropagation();
  clearImage();
});

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

// iOS PWA: reload khi trang được phục hồi từ back-forward cache
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });

// Reload sau khi app bị ẩn > 1 giờ (tránh stale state trên iOS)
let _hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    _hiddenAt = Date.now();
  } else if (document.visibilityState === 'visible' && _hiddenAt) {
    if (Date.now() - _hiddenAt > 60 * 60 * 1000) window.location.reload();
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initAuth();
