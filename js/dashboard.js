// File: /js/dashboard.js (PHIÊN BẢN TINH GỌN)

document.addEventListener('DOMContentLoaded', () => {
    // --- KHAI BÁO CÁC PHẦN TỬ DOM CỦA TRANG TỔNG QUAN ---
    const API_URL = '/api/';

    const examSelect = document.getElementById('exam-select');
    const classSelect = document.getElementById('class-select');
    const classOverviewSection = document.getElementById('class-overview-section');
    const kpisContainer = document.getElementById('overview-kpis');
    const gradeDistributionChartContainer = document.getElementById('grade-distribution-chart');
    const hardestQuestionsList = document.getElementById('hardest-questions-list');
    const topPerformersList = document.getElementById('top-performers-list');
    const bottomPerformersList = document.getElementById('bottom-performers-list');
    
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    const loadingSpinner = document.getElementById('loading-spinner');

    let gradeDistributionChart = null;
    let currentUser = null; // Sẽ lưu thông tin giáo viên đang đăng nhập

// =================================================================
//                    LUỒNG KHỞI TẠO VÀ SỰ KIỆN (PHIÊN BẢN MỚI)
// =================================================================

/**
 * Hàm chính: Tải dữ liệu ban đầu cho các bộ lọc.
 */
async function main() {
    // --- PHẦN KIỂM TRA ĐĂNG NHẬP (GIỮ NGUYÊN TỪ CODE CỦA BẠN) ---
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }
    try {
        currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) throw new Error("Missing user info");
    } catch (error) {
        alert("Thông tin người dùng không hợp lệ. Vui lòng đăng nhập lại.");
        localStorage.clear(); // Xóa hết cho an toàn
        window.location.href = '/login.html';
        return;
    }
    // --- KẾT THÚC PHẦN KIỂM TRA ---

    attachEventListeners();
    renderGradeDistributionChart(null); // Vẽ biểu đồ trống

    // Tải danh sách đề bài ban đầu
    try {
        const examListResult = await fetchApi('getExamList');
        const publishedExams = examListResult.data.filter(exam => exam.status === 'published');

        if (publishedExams.length > 0) {
            examSelect.innerHTML = 
                `<option value="">-- Chọn bài tập --</option>` + 
                publishedExams.map(exam => `<option value="${exam.examId}">${exam.title}</option>`).join('');
        } else {
            examSelect.innerHTML = `<option value="">-- Không có bài tập --</option>`;
            examSelect.disabled = true;
            classSelect.disabled = true;
            viewReportBtn.disabled = true;
        }
    } catch (error) {
        handleApiError(error, "Lỗi khi tải danh sách bài tập");
    }
}


    // =================================================================
    //                    CÁC HÀM API VÀ RENDER
    // =================================================================
    async function fetchApi(action, params = {}) {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error("401 Unauthorized: Missing token");
        
        const urlParams = new URLSearchParams({ action, ...params });
        const url = `${API_URL}?${urlParams.toString()}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        return result;
    }

/**
 * Hàm tải và hiển thị dữ liệu tổng quan sau khi nhấn nút.
 */
async function fetchAndDisplayClassOverview(examId, classId) {
    // Tái sử dụng lại logic Tải nhanh/Tải chậm của bạn
    
    // GIAI ĐOẠN A: TẢI NHANH
    showLoading(true);
    classOverviewSection.classList.remove('hidden');
    // Reset giao diện
    gradeDistributionChartContainer.innerHTML = '<p class="loading-placeholder">Đang tải biểu đồ...</p>';
    hardestQuestionsList.innerHTML = '<li class="loading-placeholder">Đang tải...</li>';
    
    try {
        const paramsKPI = { examId };
        if (classId) paramsKPI.classId = classId;

        const kpiResult = await fetchApi('getClassKPIs', paramsKPI);
        renderKPIsAndLists(kpiResult.data);
        showLoading(false);
    } catch (error) {
        handleApiError(error, "Không thể tải dữ liệu tổng quan");
        showLoading(false);
        return; // Dừng lại nếu lỗi
    }

    // GIAI ĐOẠN B: TẢI NỀN
    try {
        const paramsDetails = { examId };
        if (classId) paramsDetails.classId = classId;
        
        const detailsResult = await fetchApi('getClassDetails', paramsDetails);
        renderChartsAndDetails(detailsResult.data);
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu chi tiết (nền):", error);
        gradeDistributionChartContainer.innerHTML = '<p class="error-placeholder">Lỗi tải biểu đồ.</p>';
    }
}

/**
 * Render các thành phần tải nhanh: KPI và danh sách học sinh.
 */
function renderKPIsAndLists(data) {
    kpisContainer.innerHTML = `
        <div class="kpi-card"><h3>Tỷ lệ tham gia</h3><p>${data.kpis.submissionCount} / ${data.kpis.totalStudents}</p></div>
        <div class="kpi-card"><h3>Điểm TB</h3><p>${data.kpis.averageScore}</p></div>
        <div class="kpi-card"><h3>Điểm cao nhất</h3><p>${data.kpis.highestScore}</p></div>
        <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>${data.kpis.lowestScore}</p></div>
    `;

    const createStudentListItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.score}</span></li>`;
    topPerformersList.innerHTML = data.topPerformers.map(createStudentListItem).join('') || '<li>Không có dữ liệu.</li>';
    bottomPerformersList.innerHTML = data.bottomPerformers.map(createStudentListItem).join('') || '<li>Không có dữ liệu.</li>';
    
    // Gắn lại sự kiện click cho các item học sinh vừa được tạo
    document.querySelectorAll('.student-link').forEach(item => {
        item.addEventListener('click', () => {
            const studentId = item.dataset.studentid;
            if(studentId) {
                studentIdInput.value = studentId;
                searchStudent();
            }
        });
    });
}

/**
 * Render các thành phần tải chậm: Biểu đồ và danh sách câu hỏi.
 */
function renderChartsAndDetails(data) {
    // Xóa placeholder trước khi vẽ
    gradeDistributionChartContainer.innerHTML = ''; 
    renderGradeDistributionChart(data.gradeDistribution);

    hardestQuestionsList.innerHTML = data.itemAnalysis.hardestQuestions.map(q => `
        <li>
            <span>Câu ${q.id.includes('_') ? q.id.split('_').pop() : q.id}</span>
            <span class="accuracy">${q.accuracy.toFixed(0)}% đúng</span>
        </li>
    `).join('') || '<li>Không có dữ liệu.</li>';
}

    function renderGradeDistributionChart(gradeData) {
    const options = {
        chart: { 
            type: 'bar', 
            height: 350, 
            foreColor: '#e5e7eb',
            background: 'transparent'
        },
        // SỬA LỖI Ở ĐÂY: Dùng toán tử ba ngôi để kiểm tra gradeData
        series: gradeData ? [{ name: 'Số học sinh', data: Object.values(gradeData) }] : [],
        xaxis: { 
            categories: gradeData ? Object.keys(gradeData) : ['0-2', '2-4', '4-6', '6-8', '8-10']
        },
        yaxis: { 
            title: { text: 'Số lượng học sinh' } 
        },
        title: { 
            text: 'Phân bổ Điểm số', 
            align: 'left', 
            style: { fontSize: '18px', color: '#f3e9e0' } 
        },
        // Thêm trạng thái "Không có dữ liệu" để hướng dẫn người dùng
        noData: {
            text: 'Vui lòng chọn bài tập và lớp để xem biểu đồ',
            align: 'center',
            verticalAlign: 'middle',
            style: {
                color: '#9CA3AF', // Màu xám mờ
                fontSize: '14px',
            }
        },
        tooltip: { theme: 'dark' }
    };
    
    // Logic render/update giữ nguyên
    if (gradeDistributionChart) { 
        gradeDistributionChart.updateOptions(options); 
    } else { 
        gradeDistributionChart = new ApexCharts(gradeDistributionChartContainer, options); 
        gradeDistributionChart.render(); 
    }
}
/**
 * "Đổ" danh sách các lớp vào dropdown, lọc theo quyền và tối ưu hóa giao diện.
 * @param {string[]} allAssignedClasses - Mảng tất cả các lớp được giao cho đề bài.
 * @param {string} currentClassId - Lớp đang được chọn (nếu có).
 */
function populateClassSelect(allAssignedClasses) {
    let classesToShow = allAssignedClasses;
    
    if (currentUser && currentUser.role !== 'admin' && currentUser.managedClasses !== 'ALL') {
        const managedClassesSet = new Set(currentUser.managedClasses.split(',').map(c => c.trim()));
        classesToShow = allAssignedClasses.filter(c => managedClassesSet.has(c));
    }

    if (classesToShow.length === 0) {
        classSelect.innerHTML = '<option value="">-- Không có lớp --</option>';
        classSelect.disabled = true;
        return;
    }

    // Luôn có lựa chọn "Tất cả"
    let optionsHtml = '<option value="">-- Chọn lớp --</option>';
    if (currentUser.role === 'admin' || currentUser.managedClasses === 'ALL' || classesToShow.length > 1) {
        optionsHtml += '<option value="ALL">Tất cả các lớp</option>';
    }

    classesToShow.forEach(className => {
        optionsHtml += `<option value="${className}">${className}</option>`;
    });

    classSelect.innerHTML = optionsHtml;
    classSelect.disabled = false;
}

    // =================================================================
    //                    HÀM TIỆN ÍCH VÀ SỰ KIỆN
    // =================================================================

    function handleApiError(error, contextMessage) {
        console.error(`${contextMessage}:`, error);
        if (error.message.includes("401 Unauthorized") || error.message.includes("hết hạn")) {
            alert("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = '/login.html';
        } else {
            alert(`${contextMessage}: ${error.message}`);
        }
    }

    function showLoading(isLoading) {
        loadingSpinner.classList.toggle('hidden', !isLoading);
    }

/**
 * Gắn tất cả các sự kiện và xử lý logic kích hoạt nút.
 */
function attachEventListeners() {
    const viewReportBtn = document.getElementById('view-report-btn');

    // Hàm kiểm tra và kích hoạt nút "Xem báo cáo"
    const checkFilters = () => {
        const examSelected = examSelect.value !== "";
        const classSelected = classSelect.value !== "";
        viewReportBtn.disabled = !(examSelected && classSelected);
    };

    // Khi người dùng chọn một BÀI TẬP
    examSelect.addEventListener('change', async () => {
        const selectedExamId = examSelect.value;
        classSelect.innerHTML = '<option value="">-- Đang tải lớp --</option>'; // Reset dropdown lớp
        classSelect.disabled = true;
        checkFilters(); // Cập nhật trạng thái nút

        if (!selectedExamId) {
            classSelect.innerHTML = '<option value="">-- Chọn bài tập trước --</option>';
            return;
        }

        // Gọi API để lấy danh sách lớp tương ứng với bài tập
        try {
            const classesResult = await fetchApi('getClassesForExam', { examId: selectedExamId });
            populateClassSelect(classesResult.data); // Gọi hàm populate của bạn
        } catch (error) {
            handleApiError(error, "Không thể tải danh sách lớp");
        }
    });

    // Khi người dùng chọn một LỚP
    classSelect.addEventListener('change', checkFilters);
    
    // Khi người dùng nhấn nút "XEM BÁO CÁO"
    viewReportBtn.addEventListener('click', () => {
        const selectedExamId = examSelect.value;
        const selectedClassId = classSelect.value === "ALL" ? null : classSelect.value;
        
        fetchAndDisplayClassOverview(selectedExamId, selectedClassId);
    });

    // Các event listener cũ
    searchBtn.addEventListener('click', searchStudent);
    studentIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStudent();
    });
}

    // --- BẮT ĐẦU CHẠY ỨNG DỤNG ---
    main();
});