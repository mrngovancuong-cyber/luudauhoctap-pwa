// File: /js/home.js (PHIÊN BẢN HOÀN CHỈNH - HỖ TRỢ CẢ HS VÀ GV)

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "/api/";

    // --- CÁC PHẦN TỬ DOM ---
    
    // Khu vực của Học sinh
    const studentLoginSection = document.getElementById('student-login-section');
    const startSessionBtn = document.getElementById('start-session-btn');
    const loginError = document.getElementById('login-error');
    const studentNameInput = document.getElementById('studentName');
    const studentIdInput = document.getElementById('studentId');
    const classNameInput = document.getElementById('className');
    
    // Khu vực của Giáo viên (phải tồn tại trong Index.html)
    const teacherControls = document.getElementById('teacher-preview-controls');
    const teacherClassSelect = document.getElementById('teacher-class-select');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');

    // Khu vực chung
    const examListSection = document.getElementById('exam-list-section');
    const welcomeStudentName = document.getElementById('welcome-student-name');
    const examListContainer = document.getElementById('exam-list');
    const loadingMessage = document.getElementById('loading-message');

    /**
     * HÀM CHÍNH: KIỂM TRA VAI TRÒ VÀ BẮT ĐẦU LUỒNG PHÙ HỢP
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
        // Ẩn form HS, hiện khu vực điều khiển của GV và danh sách bài tập
        if (studentLoginSection) studentLoginSection.classList.add('hidden');
        if (teacherControls) teacherControls.classList.remove('hidden');
        if (examListSection) examListSection.classList.remove('hidden');

        // Chào mừng giáo viên
        if (welcomeStudentName) {
            welcomeStudentName.textContent = `${teacher.email.split('@')[0]} (Giáo viên)`;
        }
        
        // Điền vào dropdown các lớp mà giáo viên quản lý
        if (teacherClassSelect) {
            let classes = [];
            if (teacher.role === 'admin' || teacher.managedClasses === 'ALL') {
                // TODO: Admin cần API riêng để lấy tất cả các lớp. Tạm thời để trống.
                // Chúng ta sẽ giải quyết việc này sau khi luồng cơ bản hoạt động.
                teacherClassSelect.innerHTML = '<option value="">-- Admin: Chọn lớp để xem --</option>';
                // Cần một API `getAllClasses` ở đây.
            } else {
                classes = teacher.managedClasses.split(',');
            }
            
            teacherClassSelect.innerHTML = `<option value="">-- Chọn lớp để xem --</option>` +
                                           classes.map(c => `<option value="${c}">${c}</option>`).join('');
            
            // Gắn sự kiện cho dropdown của giáo viên
            teacherClassSelect.addEventListener('change', () => {
                const selectedClass = teacherClassSelect.value;
                
                // Lưu lớp đang chọn vào sessionStorage để trang Exam có thể sử dụng
                sessionStorage.setItem('teacherSelectedClass', selectedClass);

                if (selectedClass) {
                    fetchAndDisplayExams(selectedClass);
                } else {
                    if (examListContainer) examListContainer.innerHTML = '<p style="text-align: center;">Vui lòng chọn một lớp để xem danh sách bài tập.</p>';
                }
            });
        }

        // Gắn sự kiện cho nút quay lại Dashboard
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.removeItem('teacherPreviewInfo');
                sessionStorage.removeItem('teacherSelectedClass');
                window.location.href = '/Dashboard.html';
            });
        }
        
        // Hiển thị thông báo ban đầu
        if (examListContainer) examListContainer.innerHTML = '<p style="text-align: center;">Vui lòng chọn một lớp để xem danh sách bài tập.</p>';
    }

    /**
     * LUỒNG 2: Thiết lập cho Học sinh đã có thông tin
     */
    function initializeStudentView(student) {
        if (studentLoginSection) studentLoginSection.classList.add('hidden');
        if (examListSection) examListSection.classList.remove('hidden');
        if (welcomeStudentName) welcomeStudentName.textContent = student.name;
        
        fetchAndDisplayExams(student.className);
    }

    /**
     * LUỒNG 3: Thiết lập cho Học sinh chưa có thông tin
     */
    function setupStudentLogin() {
        if (studentLoginSection) studentLoginSection.classList.remove('hidden');
        if (examListSection) examListSection.classList.add('hidden');

        if (startSessionBtn) {
            startSessionBtn.addEventListener('click', () => {
                const student = {
                    name: studentNameInput.value.trim(),
                    id: studentIdInput.value.trim(),
                    className: classNameInput.value.trim().toUpperCase()
                };

                if (!student.name || !student.id || !student.className) {
                    if (loginError) {
                        loginError.textContent = 'Vui lòng điền đầy đủ cả ba thông tin.';
                        loginError.style.display = 'block';
                    }
                    return;
                }
                sessionStorage.setItem('studentInfo', JSON.stringify(student));
                initializeStudentView(student);
            });
        }
    }

    /**
     * HÀM CHUNG: Tải và hiển thị danh sách bài tập
     */
    async function fetchAndDisplayExams(className) {
        if (loadingMessage) {
            loadingMessage.textContent = `Đang tải bài tập cho lớp ${className}...`;
            loadingMessage.style.display = 'block';
        }
        if (examListContainer) examListContainer.innerHTML = ''; 
        
        try {
            const response = await fetch(`${API_URL}?action=getExamList&class=${className}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const exams = result.data;
            if (loadingMessage) loadingMessage.style.display = 'none';

            if (!exams || exams.length === 0) {
                if (examListContainer) examListContainer.innerHTML = `<p style="text-align: center;">Hiện chưa có bài tập nào được giao cho lớp ${className}.</p>`;
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
            if (loadingMessage) loadingMessage.textContent = `Lỗi: ${error.message}.`;
        }
    }

    // --- Bắt đầu luồng chính ---
    initialize();
});