// /js/home.js

document.addEventListener('DOMContentLoaded', () => {
    // API_URL trỏ đến Netlify proxy của chúng ta
    const API_URL = "/api/"; 
    const examListContainer = document.getElementById('exam-list');
    const loadingMessage = document.getElementById('loading-message');

    /**
     * Hàm này sẽ gọi API để lấy danh sách các bài kiểm tra
     * và sau đó hiển thị chúng ra màn hình.
     */
    async function fetchAndDisplayExams() {
        try {
            // Gọi API bằng fetch chuẩn
            const response = await fetch(`${API_URL}?action=getExamList`);
            if (!response.ok) {
                throw new Error('Không thể kết nối đến máy chủ.');
            }
            const result = await response.json();

            // Nếu API trả về lỗi (ví dụ: action không hợp lệ)
            if (!result.success) {
                throw new Error(result.message);
            }

            const exams = result.data;
            loadingMessage.style.display = 'none'; // Ẩn thông báo "Đang tải" khi đã có dữ liệu

            // Nếu không có bài tập nào
            if (exams.length === 0) {
                examListContainer.innerHTML = '<p style="text-align: center;">Hiện chưa có bài tập nào được giao.</p>';
                return;
            }

            // Xóa nội dung cũ trong container (nếu có)
            examListContainer.innerHTML = '';

            // Lặp qua danh sách các bài tập và tạo link cho mỗi bài
            exams.forEach(exam => {
                const link = document.createElement('a');
                link.className = 'exam-link';
                // Tạo link dẫn đến trang làm bài, kèm theo examId
                link.href = `/Exam.html?examId=${exam.examId}`;
                
                // Sử dụng template literal để tạo nội dung HTML bên trong thẻ <a>
                link.innerHTML = `
                    <h3>${exam.title}</h3>
                    <p>Thời gian làm bài: ${exam.durationMinutes} phút</p>
                `;

                // Thêm link vừa tạo vào container
                examListContainer.appendChild(link);
            });

        } catch (error) {
            // Hiển thị thông báo lỗi nếu có vấn đề xảy ra
            console.error("Lỗi khi tải danh sách bài tập:", error);
            loadingMessage.textContent = `Lỗi: ${error.message}. Vui lòng thử tải lại trang.`;
            loadingMessage.style.color = 'red';
        }
    }

    // Gọi hàm để bắt đầu quá trình tải và hiển thị
    fetchAndDisplayExams();
});