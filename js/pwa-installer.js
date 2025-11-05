// File: js/pwa-installer.js

(function() {
    // Chờ cho đến khi trang đã tải xong hoàn toàn
    window.addEventListener('load', () => {
        // --- 1. Xác định loại ứng dụng (học sinh hay giáo viên) ---
        const isTeacherApp = document.documentElement.id === 'teacher-app';

        // --- 2. Tạo đối tượng Manifest cơ bản ---
        const baseManifest = {
    "name": "Lưu Dấu Học Tập",
    "short_name": "LDHT",
    "description": "Nền tảng Luyện tập và Phân tích Học tập",
    "display": "standalone",
    "orientation": "any",
    // THAY THẾ HOÀN TOÀN KHỐI `icons` BẰNG KHỐI NÀY
    "icons": [
        { "src": "/icons/icon-192x192.png", "type": "image/png", "sizes": "192x192" },
        { "src": "/icons/icon-512x512.png", "type": "image/png", "sizes": "512x512" },
        { "src": "/icons/maskable_icon_x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
};

        // --- 3. Tùy chỉnh Manifest dựa trên loại ứng dụng ---
        let finalManifest;

        if (isTeacherApp) {
            finalManifest = {
                ...baseManifest,
                "name": "LDHT - Dashboard Giáo viên",
                "short_name": "GV Dashboard",
                "start_url": "/login.html", // Luôn bắt đầu từ trang đăng nhập
                "background_color": "#1e1a17", // Màu nền theme Coffee
                "theme_color": "#1e1a17"
            };
        } else {
            // Đây là ứng dụng của học sinh
            finalManifest = {
                ...baseManifest,
                "start_url": "/Index.html", // Bắt đầu từ trang chủ HS
                "background_color": "#0b1220", // Màu nền theme Blue
                "theme_color": "#0b1220"
            };
        }

        // --- 4. Tạo và Gắn Manifest "ảo" ---
        const manifestString = JSON.stringify(finalManifest);
        const blob = new Blob([manifestString], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        // Tạo thẻ link và chèn vào <head>
        const linkEl = document.createElement('link');
        linkEl.rel = 'manifest';
        linkEl.href = manifestURL;
        document.head.appendChild(linkEl);

        console.log(`PWA Manifest động đã được tạo cho: ${isTeacherApp ? 'Giáo viên' : 'Học sinh'}`);
    });
})();