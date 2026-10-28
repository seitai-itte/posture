const V = 'pose-v3';
const CORE = ['./', 'index.html', 'pose-core.js', 'tf.min.js', 'movenet-lightning.json', 'movenet-lightning.bin', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
const HEAVY = /(tf\.min\.js|movenet-lightning\.(json|bin)|icon-\d+\.png)$/;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const same = u.origin === location.origin;
  /* 重いファイルは保存済みを優先。ページ本体などは、つながるときは常に最新を取りにいく */
  if (same && !HEAVY.test(u.pathname)) {
    e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => {
    if (res.ok && (same || /fonts\.(googleapis|gstatic)\.com/.test(r.url))) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
    return res;
  })));
});
