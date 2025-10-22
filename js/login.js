// /js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const errorMessageDiv = document.getElementById('error-message');
    
    // API URL của bạn
    const API_URL = '/api/';

    loginForm.addEventListener('submit', async (event) => {
        // Ngăn chặn hành vi mặc định của form là tải lại trang
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showError("Vui lòng nhập đầy đủ thông tin.");
            return;
        }

        // Vô hiệu hóa nút bấm để tránh người dùng nhấn nhiều lần
        loginButton.disabled = true;
        loginButton.textContent = 'Đang xử lý...';
        hideError();

        try {
            // Chuẩn bị dữ liệu gửi lên backend
            const payload = {
                action: 'login', // Quan trọng: backend cần biết đây là hành động đăng nhập
                email: email,
                password: password
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Chuyển đối tượng JavaScript thành chuỗi JSON
                body: JSON.stringify(payload) 
            });

            const result = await response.json();

            if (result.success) {
                // Đăng nhập thành công!
                // Lưu token và thông tin người dùng vào localStorage
                localStorage.setItem('authToken', result.data.token);
                localStorage.setItem('currentUser', JSON.stringify(result.data.user));
                
                // Chuyển hướng đến trang Dashboard
                window.location.href = '/Dashboard.html';
            } else {
                // Đăng nhập thất bại, hiển thị lỗi từ server
                showError(result.message || 'Có lỗi xảy ra, vui lòng thử lại.');
            }

        } catch (error) {
            // Lỗi mạng hoặc server không phản hồi
            showError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.');
        } finally {
            // Dù thành công hay thất bại, bật lại nút bấm
            loginButton.disabled = false;
            loginButton.textContent = 'Đăng nhập';
        }
    });

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
    }

    function hideError() {
        errorMessageDiv.style.display = 'none';
    }
});