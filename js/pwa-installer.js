// File: js/pwa-installer.js (Phiên bản chỉ dành cho Học sinh)

(function() {
    window.addEventListener('load', () => {
        // --- 1. Xác định xem có phải trang của giáo viên không ---
        const isTeacherApp = document.documentElement.id === 'teacher-app';

        // --- 2. Nếu là trang của giáo viên, DỪNG LẠI, không làm gì cả ---
        if (isTeacherApp) {
            console.log("Đây là trang của giáo viên, PWA không được kích hoạt.");
            return; 
        }

        // --- 3. Nếu là trang của học sinh, tiếp tục tạo Manifest ---
        console.log("Đây là trang của học sinh, đang tạo PWA Manifest...");

        const origin = window.location.origin;

        const studentManifest = {
            "name": "Lưu Dấu Học Tập",
            "short_name": "LDHT",
            "description": "Nền tảng Luyện tập và Phân tích Học tập",
            "display": "standalone",
            "orientation": "any",
            "start_url": `${origin}/Index.html?source=pwa`,
            "background_color": "#0b1220",
            "theme_color": "#0b1220",
            "icons": [
                { "src": `${origin}/icons/icon-192x192.png`, "type": "image/png", "sizes": "192x192" },
                { "src": `${origin}/icons/icon-512x512.png`, "type": "image/png", "sizes": "512x512" },
                { "src": `${origin}/icons/maskable_icon_x512.png`, "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
            ]
        };

        const manifestString = JSON.stringify(studentManifest);
        const blob = new Blob([manifestString], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        const linkEl = document.createElement('link');
        linkEl.rel = 'manifest';
        linkEl.href = manifestURL;
        document.head.appendChild(linkEl);
    });
})();