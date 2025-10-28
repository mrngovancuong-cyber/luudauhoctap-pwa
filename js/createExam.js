document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/';
    
    // --- KIỂM TRA ĐĂNG NHẬP ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert("Vui lòng đăng nhập để sử dụng chức năng này.");
        window.location.href = '/login.html';
        return;
    }

    // --- GẮN SỰ KIỆN CHO FORM ---
    const importForm = document.getElementById('import-exam-form');
    const importBtn = document.getElementById('import-btn');

    if (importForm) {
        importForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // --- ĐỌC DỮ LIỆU TỪ FORM (ĐÃ CẬP NHẬT) ---
    const title = document.getElementById('exam-title').value.trim();
    const duration = document.getElementById('exam-duration').value.trim();
    const assignedClasses = document.getElementById('exam-classes').value.trim();
    const description = document.getElementById('exam-description').value.trim(); // <-- Thêm
    const scoreScale = document.getElementById('exam-score-scale').value.trim(); // <-- Thêm
    const sourceSheetUrl = document.getElementById('exam-sheet-url').value.trim();
    const sourceSheetName = document.getElementById('exam-sheet-name').value.trim();

    // --- KIỂM TRA INPUT (GIỮ NGUYÊN) ---
    if (!title || !duration || !assignedClasses || !sourceSheetUrl) {
        alert("Vui lòng điền đầy đủ các trường bắt buộc (1, 2, 3, 6).");
        return;
    }

    if (!confirm(`Bạn có chắc chắn muốn import và xuất bản bài tập "${title}" không?`)) return;

    // --- VÔ HIỆU HÓA NÚT (CẬP NHẬT TEXT) ---
    importBtn.disabled = true;
    importBtn.textContent = 'Đang import...';

    try {
        // --- GỬI REQUEST API (ĐÃ CẬP NHẬT BODY) ---
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Proxy sẽ đọc header này và gắn vào URL cho backend
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                action: 'importExamFromSheet',
                title, 
                duration, 
                assignedClasses, 
                description,      // <-- Thêm
                scoreScale,       // <-- Thêm
                sourceSheetUrl, 
                sourceSheetName
            })
        });

        const result = await response.json();

        if (result.success) {
            // --- XỬ LÝ KHI THÀNH CÔNG (CẬP NHẬT THÔNG BÁO) ---
            alert(`Thành công! Bài tập "${result.data.title}" đã được import và xuất bản với mã là: ${result.data.examId}\nSố lượng câu hỏi: ${result.data.questionCount}`);
            importForm.reset(); // Xóa trắng form để chuẩn bị cho lần import tiếp theo
        } else {
            // Ném lỗi để khối catch xử lý
            throw new Error(result.message);
        }

    } catch (error) {
        console.error("Import thất bại:", error);
        alert("Import thất bại:\n" + error.message); // Hiển thị lỗi rõ ràng hơn
    } finally {
        // --- KHÔI PHỤC NÚT (CẬP NHẬT TEXT) ---
        importBtn.disabled = false;
        importBtn.textContent = 'Import và Xuất bản';
    }
});
    }
});