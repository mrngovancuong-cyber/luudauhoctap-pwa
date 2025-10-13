document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');

    searchBtn.addEventListener('click', () => {
        const studentId = studentIdInput.value.trim();
        if (studentId) {
            console.log(`Bắt đầu tìm kiếm dữ liệu cho học sinh có mã: ${studentId}`);
            // (Trong các bước sau, chúng ta sẽ gọi API tại đây)
        } else {
            alert('Vui lòng nhập Mã số học sinh.');
        }
    });
});