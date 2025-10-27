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
            
            const title = document.getElementById('exam-title').value.trim();
            const duration = document.getElementById('exam-duration').value.trim();
            const assignedClasses = document.getElementById('exam-classes').value.trim();
            const sourceSheetUrl = document.getElementById('exam-sheet-url').value.trim();
	    const sourceSheetName = document.getElementById('exam-sheet-name').value.trim();

            if (!title || !duration || !assignedClasses || !sourceSheetUrl) {
                alert("Vui lòng điền đầy đủ tất cả các trường bắt buộc.");
                return;
            }

            if (!confirm(`Bạn có chắc chắn muốn import bài tập "${title}" không?`)) return;

            importBtn.disabled = true;
            importBtn.textContent = 'Đang xử lý...';

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        action: 'importExamFromSheet',
                        title, duration, assignedClasses, sourceSheetUrl
			sourceSheetName
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert(`Import thành công! Bài tập "${title}" đã được tạo với mã là: ${result.data.examId}\nBài tập đang ở trạng thái "Bản nháp". Vui lòng vào CSDL để chuyển sang "published".`);
                    importForm.reset();
                } else {
                    throw new Error(result.message);
                }

            } catch (error) {
                console.error("Import thất bại:", error);
                alert("Import thất bại: " + error.message);
            } finally {
                importBtn.disabled = false;
                importBtn.textContent = 'Import Bài tập';
            }
        });
    }
});