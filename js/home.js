// File: /js/home.js (PHIÊN BẢN MỚI - "XEM THEO BÀI")

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "/api/";

    // --- DOM Elements ---
    const studentLoginSection = document.getElementById('student-login-section');
    const teacherControls = document.getElementById('teacher-preview-controls');
    const examListSection = document.getElementById('exam-list-section');
    const welcomeStudentName = document.getElementById('welcome-student-name');
    const examListContainer = document.getElementById('exam-list');
    const loadingMessage = document.getElementById('loading-message');
    const welcomeMessage = document.getElementById('welcome-message');
    const signOutBtn = document.getElementById('sign-out-btn');

    /**
     * HÀM CHÍNH: KIỂM TRA VAI TRÒ VÀ BẮT ĐẦU LUỒNG
     */
    function initialize() {
        const teacherInfoJSON = sessionStorage.getItem('teacherPreviewInfo');
        const studentInfoJSON = sessionStorage.getItem('studentInfo');

        if (teacherInfoJSON) {
            // ---- LUỒNG CỦA GIÁO VIÊN ----
            const teacher = JSON.parse(teacherInfoJSON);
            initializeTeacherView(teacher);
        } else if (studentInfoJSON) {
            // ---- LUỒNG CỦA HỌC SINH (đã khai báo) ----
            const student = JSON.parse(studentInfoJSON);
            initializeStudentView(student);
        } else {
            // ---- LUỒNG CỦA HỌC SINH (chưa khai báo) ----
            setupStudentLogin();
        }
    }

    /**
     * LUỒNG 1: Thiết lập cho Giáo viên xem trước
     */
    function initializeTeacherView(teacher) {
        studentLoginSection.classList.add('hidden');
        teacherControls.classList.remove('hidden');
        examListSection.classList.remove('hidden');

        if (welcomeMessage) {
        welcomeMessage.innerHTML = `Xin chào <strong>${teacher.email.split('@')[0]}</strong>. Chúc thầy/cô một ngày làm việc hiệu quả!`;
    }
        
        // Gắn sự kiện cho nút quay lại
        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.removeItem('teacherPreviewInfo');
                window.location.href = '/Dashboard.html';
            });
        }

        // Tải ngay danh sách bài tập dành cho giáo viên
        fetchAndDisplayExamsForTeacher(teacher);
    }

    /**
     * LUỒNG 2: Thiết lập cho Học sinh đã có thông tin
     */
    function initializeStudentView(student) {
        studentLoginSection.classList.add('hidden');
        examListSection.classList.remove('hidden');
        welcomeStudentName.textContent = student.name;
        fetchAndDisplayExamsForStudent(student.className);
    // THÊM ĐOẠN CODE SAU VÀO CUỐI HÀM NÀY
    if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleSignOut();
        });
    }
}

    /**
     * LUỒNG 3: Thiết lập cho Học sinh chưa có thông tin
     */
    function setupStudentLogin() {
        // ... (Hàm này giữ nguyên từ phiên bản trước)
        const startSessionBtn = document.getElementById('start-session-btn');
        const studentNameInput = document.getElementById('studentName');
        const studentIdInput = document.getElementById('studentId');
        const classNameInput = document.getElementById('className');
        const loginError = document.getElementById('login-error');

        if (startSessionBtn) {
            startSessionBtn.addEventListener('click', () => {
                const student = { name: studentNameInput.value.trim(), id: studentIdInput.value.trim(), className: classNameInput.value.trim().toUpperCase() };
                if (!student.name || !student.id || !student.className) { /* ... xử lý lỗi ... */ return; }
                sessionStorage.setItem('studentInfo', JSON.stringify(student));
                initializeStudentView(student);
            });
        }
    }

function handleSignOut() {
    // Xóa thông tin học sinh khỏi sessionStorage
    sessionStorage.removeItem('studentInfo');
    
    // Tải lại trang. Vì không còn 'studentInfo', trang sẽ tự động hiển thị lại form đăng nhập.
    window.location.reload();
}

    /**
     * TẢI BÀI TẬP CHO GIÁO VIÊN
     */
    async function fetchAndDisplayExamsForTeacher(teacher) {
        // Giáo viên cần gửi token để được xác thực
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert("Không tìm thấy phiên đăng nhập của giáo viên. Đang quay lại Dashboard.");
            window.location.href = '/Dashboard.html';
            return;
        }
        
        // Gọi API với token, không cần className
        await fetchAndDisplayExams(`${API_URL}?action=getExamList`, token);
    }

    /**
     * TẢI BÀI TẬP CHO HỌC SINH
     */
    async function fetchAndDisplayExamsForStudent(className) {
        // Học sinh không cần token, nhưng cần className
        await fetchAndDisplayExams(`${API_URL}?action=getExamList&class=${className}`);
    }

    /**
     * HÀM CHUNG: Tải và hiển thị danh sách bài tập từ một URL cụ thể
     */
    async function fetchAndDisplayExams(url, token = null) {
        loadingMessage.textContent = 'Đang tải danh sách bài tập...';
        loadingMessage.style.display = 'block';
        examListContainer.innerHTML = ''; 
        
        try {
            const options = {};
            if (token) {
                options.headers = { 'Authorization': `Bearer ${token}` };
            }

            const response = await fetch(url, options);
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const exams = result.data;
            loadingMessage.style.display = 'none';

            if (!exams || exams.length === 0) {
                examListContainer.innerHTML = `<p style="text-align: center;">Hiện chưa có bài tập nào phù hợp.</p>`;
                return;
            }

            exams.forEach(exam => {
                const link = document.createElement('a');
                link.className = 'exam-link';
                link.href = `/Exam.html?examId=${exam.examId}`;
                link.innerHTML = `<h3>${exam.title}</h3><p>Thời gian làm bài: ${exam.durationMinutes} phút</p>`;
                examListContainer.appendChild(link);
            });
        } catch (error) {
            loadingMessage.textContent = `Lỗi: ${error.message}.`;
        }
    }

    // --- Bắt đầu luồng chính ---
    initialize();
});