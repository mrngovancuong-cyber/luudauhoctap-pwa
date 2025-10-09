// service-worker.js - Chiến lược "Network First, Falling Back to Cache"

const CACHE_NAME = 'ltkt-online-v2'; // Tăng phiên bản cache để xóa cache cũ
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styleD.css',
  '/js/appF.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Sự kiện 'install': Cache các file tĩnh cốt lõi để đảm bảo app có thể chạy offline lần đầu
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); // Kích hoạt Service Worker mới ngay lập tức
});

// Sự kiện 'activate': Dọn dẹp các cache cũ không còn dùng đến
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Giành quyền kiểm soát trang ngay lập tức
});


// Sự kiện 'fetch': Áp dụng chiến lược Network First
self.addEventListener('fetch', event => {
  // Bỏ qua các yêu cầu không phải GET (ví dụ: POST đến API)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Chỉ áp dụng chiến lược này cho các yêu cầu điều hướng (HTML) và các tài nguyên của chính trang web
  // Bỏ qua các yêu cầu đến API của Google
  if (!event.request.url.startsWith(self.location.origin)) {
      return;
  }

  event.respondWith(
    // 1. Thử truy cập mạng trước
    fetch(event.request)
      .then(networkResponse => {
        // 2. Nếu thành công, cập nhật cache và trả về phản hồi từ mạng
        return caches.open(CACHE_NAME).then(cache => {
          // Sao chép phản hồi vì nó chỉ có thể được đọc một lần
          cache.put(event.request, networkResponse.clone()); 
          // console.log('Service Worker: Fetched from network and cached:', event.request.url);
          return networkResponse;
        });
      })
      .catch(() => {
        // 3. Nếu thất bại (mất mạng), tìm trong cache
        // console.log('Service Worker: Network failed, trying cache for:', event.request.url);
        return caches.match(event.request);
      })
  );
});