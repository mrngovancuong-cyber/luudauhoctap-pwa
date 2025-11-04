// js/theme-switcher.js - PHIÊN BẢN NÂNG CẤP

(function() {
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon'); // Lấy phần tử icon

    // Hàm để cập nhật icon
    function updateIcon(theme) {
        if (themeIcon) {
            themeIcon.innerHTML = theme === 'light' 
                ? '🌙' // Icon mặt trăng cho chế độ Sáng
                : '☀️'; // Icon mặt trời cho chế độ Tối
        }
    }

    // Đọc theme đã lưu từ localStorage, mặc định là 'dark'
    let currentTheme = localStorage.getItem('theme') || 'dark';

    // Áp dụng theme và cập nhật icon ngay khi trang tải
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateIcon(currentTheme);

    // Gắn sự kiện click cho toàn bộ cụm nút bấm
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            // Đảo ngược theme hiện tại
            let newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            
            // Cập nhật thuộc tính trên thẻ <html>
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Lưu lựa chọn vào localStorage
            localStorage.setItem('theme', newTheme);

            // Cập nhật lại icon
            updateIcon(newTheme);
        });
    }
})();