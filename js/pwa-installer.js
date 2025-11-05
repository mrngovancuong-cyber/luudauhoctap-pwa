// File: js/pwa-installer.js (PHIÊN BẢN SỬA LỖI ĐƯỜNG DẪN)

(function() {
    window.addEventListener('load', () => {
        const isTeacherApp = document.documentElement.id === 'teacher-app';

        // =============================================================
        // === BẮT ĐẦU SỬA LỖI ===
        // =============================================================

        // 1. Lấy gốc của URL trang web một cách an toàn
        const origin = window.location.origin;

        // 2. Định nghĩa các đường dẫn đầy đủ
        const baseManifest = {
            "name": "Lưu Dấu Học Tập",
            "short_name": "LDHT",
            "description": "Nền tảng Luyện tập và Phân tích Học tập",
            "display": "standalone",
            "orientation": "any",
            "icons": [
                // Sử dụng đường dẫn đầy đủ
                { "src": `${origin}/icons/icon-192x192.png`, "type": "image/png", "sizes": "192x192" },
                { "src": `${origin}/icons/icon-512x512.png`, "type": "image/png", "sizes": "512x512" },
                { "src": `${origin}/icons/maskable_icon_x512.png`, "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
            ]
        };

        let finalManifest;

        if (isTeacherApp) {
            finalManifest = {
                ...baseManifest,
                "name": "LDHT - Dashboard Giáo viên",
                "short_name": "GV Dashboard",
                "start_url": `${origin}/login.html`, // Sử dụng đường dẫn đầy đủ
                "background_color": "#1e1a17",
                "theme_color": "#1e1a17"
            };
        } else {
            finalManifest = {
                ...baseManifest,
                "start_url": `${origin}/Index.html`, // Sử dụng đường dẫn đầy đủ
                "background_color": "#0b1220",
                "theme_color": "#0b1220"
            };
        }

        // =============================================================
        // === KẾT THÚC SỬA LỖI ===
        // =============================================================

        // Phần còn lại của code giữ nguyên
        const manifestString = JSON.stringify(finalManifest);
        const blob = new Blob([manifestString], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        // Xóa manifest cũ nếu có để tránh xung đột
        const oldManifest = document.querySelector('link[rel="manifest"]');
        if (oldManifest) {
            oldManifest.remove();
        }

        const linkEl = document.createElement('link');
        linkEl.rel = 'manifest';
        linkEl.href = manifestURL;
        document.head.appendChild(linkEl);

        console.log(`PWA Manifest động đã được tạo cho: ${isTeacherApp ? 'Giáo viên' : 'Học sinh'}`);
    });
})();