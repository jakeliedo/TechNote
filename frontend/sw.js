importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCeL152ckUiUzobhJadvwHoj6-dTkCkvIQ",
  authDomain: "technote-clubv.firebaseapp.com",
  projectId: "technote-clubv",
  storageBucket: "technote-clubv.firebasestorage.app",
  messagingSenderId: "625762333694",
  appId: "1:625762333694:web:60b2b7b56c02965fcf46af"
});
const messaging = firebase.messaging();

const CACHE = 'technote-v7';
const PRECACHE = ['/manifest.json'];
const CACHE_FIRST = ['/icons/', '/manifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/ws')) return;

  const url = e.request.url;
  const isCacheFirst = CACHE_FIRST.some(p => url.includes(p));

  if (isCacheFirst) {
    // Cache-first: icons, manifest — rarely change
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
  } else {
    // Network-first: HTML, JS, CSS, API — always get fresh, fall back to cache offline
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && PRECACHE.some(p => url.includes(p))) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached =>
          cached || (e.request.mode === 'navigate' ? caches.match('/') : Response.error())
        )
      )
    );
  }
});

// Firebase automatically shows notification from payload.notification field.
// onBackgroundMessage is kept for future data-only messages.
messaging.onBackgroundMessage(_payload => {});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
