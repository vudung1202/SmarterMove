// Service worker của Nước Hay — vite.config.ts điền phiên bản cache và danh sách file lúc build.
// Chiến lược: lưu sẵn toàn bộ file khi cài, sau đó luôn trả từ bộ nhớ đệm (cache-first) nên chạy được khi tắt mạng.
const CACHE = 'nuoc-hay-__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nuoc-hay-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Mọi trang (kể cả #/play khi mở từ màn hình chính) đều là index.html. ignoreVary: script có crossorigin gửi kèm Origin,
  // server trả Vary: Origin, nếu không bỏ qua Vary thì cache.match trượt và offline sẽ hỏng.
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(CACHE).then((c) => c.match(key, { ignoreSearch: true, ignoreVary: true })).then((hit) => hit || fetch(req)));
});
