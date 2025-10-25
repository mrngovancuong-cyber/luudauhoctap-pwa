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
    //                    LUỒNG KHỞI TẠO CHÍNH
    // =================================================================
    async function main() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }
        try {
	    currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (!currentUser) throw new Error("Missing user info");
    	} catch (error) {
            alert("Thông tin người dùng không hợp lệ. Vui lòng đăng nhập lại.");
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = '/login.html';
            return;
	}
        attachEventListeners();

        showLoading(true);
        try {
            const examListResult = await fetchApi('getExamList');
            const publishedExams = examListResult.data.filter(exam => exam.status === 'published');

            if (publishedExams.length === 0) {
                alert("Hiện không có bài tập nào được xuất bản.");
                classOverviewSection.innerHTML = '<p style="text-align:center;">Không có dữ liệu để hiển thị.</p>';
                return;
            }
            
            examSelect.innerHTML = publishedExams.map(exam => `<option value="${exam.examId}">${exam.title}</option>`).join('');
            await fetchAndDisplayClassOverview();

        } catch (error) {
            handleApiError(error, "Lỗi khởi tạo Dashboard");
        } finally {
            showLoading(false);
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

async function fetchAndDisplayClassOverview() {
    // Lấy giá trị hiện tại từ các dropdown
    const examId = examSelect.value;
    const classId = classSelect.value || null; // Nếu là "ALL", giá trị sẽ là null
    
    // --- GIAI ĐOẠN A: TẢI DỮ LIỆU NHANH VÀ HIỂN THỊ KHUNG SƯỜN ---
    showLoading(true);
    classOverviewSection.classList.remove('hidden');
    gradeDistributionChartContainer.innerHTML = '<p class="loading-placeholder">Đang tải biểu đồ...</p>';
    hardestQuestionsList.innerHTML = '<li class="loading-placeholder">Đang tải...</li>';
    kpisContainer.innerHTML = ''; // Xóa KPI cũ
    topPerformersList.innerHTML = '<li class="loading-placeholder">Đang tải...</li>';
    bottomPerformersList.innerHTML = '<li class="loading-placeholder">Đang tải...</li>';

    try {
        // Tải đồng thời cả KPI và danh sách lớp để tăng tốc
        const paramsKPI = { examId };
        if (classId) paramsKPI.classId = classId;

        const [kpiResult, classesResult] = await Promise.all([
            fetchApi('getClassKPIs', paramsKPI),
            fetchApi('getClassesForExam', { examId })
        ]);
        
        populateClassSelect(classesResult.data, classId);
        renderKPIsAndLists(kpiResult.data);
        showLoading(false);
        
    } catch (error) {
        handleApiError(error, "Không thể tải dữ liệu tổng quan");
        showLoading(false);
        return;
    }

    // --- GIAI ĐOẠN B: TẢI NỀN DỮ LIỆU CHI TIẾT ---
    try {
        const paramsDetails = { examId };
        if (classId) paramsDetails.classId = classId;
        
        const detailsResult = await fetchApi('getClassDetails', paramsDetails);
        renderChartsAndDetails(detailsResult.data);

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu chi tiết (nền):", error);
        gradeDistributionChartContainer.innerHTML = '<p class="error-placeholder">Lỗi tải biểu đồ.</p>';
        hardestQuestionsList.innerHTML = '<li class="error-placeholder">Lỗi tải dữ liệu.</li>';
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
            chart: { type: 'bar', height: 350, foreColor: '#e5e7eb' },
            series: [{ name: 'Số học sinh', data: Object.values(gradeData) }],
            xaxis: { categories: Object.keys(gradeData) },
            yaxis: { title: { text: 'Số lượng học sinh' } },
            title: { text: 'Phân bổ Điểm số', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
            tooltip: { theme: 'dark' }
        };
        if (gradeDistributionChart) { gradeDistributionChart.updateOptions(options); } 
        else { gradeDistributionChart = new ApexCharts(gradeDistributionChartContainer, options); gradeDistributionChart.render(); }
    }
    
    function searchStudent() {
        const studentId = studentIdInput.value.trim();
        if (!studentId) {
            alert('Vui lòng nhập Mã số học sinh.');
            return;
        }
        window.location.href = `/StudentDetail.html?id=${studentId}`;
    }

/**
 * "Đổ" danh sách các lớp vào dropdown, lọc theo quyền và tối ưu hóa giao diện.
 * @param {string[]} allAssignedClasses - Mảng tất cả các lớp được giao cho đề bài.
 * @param {string} currentClassId - Lớp đang được chọn (nếu có).
 */
function populateClassSelect(allAssignedClasses, currentClassId) {
    let classesToShow = allAssignedClasses;
    
    // Lọc danh sách lớp dựa trên quyền của giáo viên
    if (currentUser && currentUser.role !== 'admin' && currentUser.managedClasses !== 'ALL') {
        const managedClassesSet = new Set(currentUser.managedClasses.split(',').map(c => c.trim()));
        classesToShow = allAssignedClasses.filter(c => managedClassesSet.has(c));
    }

    let optionsHtml = '';
    
    // Xử lý trường hợp chỉ có 1 lớp hoặc không có lớp nào
    if (classesToShow.length > 1) {
        optionsHtml += '<option value="">Tất cả các lớp</option>';
        classSelect.disabled = false;
    } else {
        classSelect.disabled = true;
    }

    classesToShow.forEach(className => {
        optionsHtml += `<option value="${className}">${className}</option>`;
    });

    classSelect.innerHTML = optionsHtml;
    
    // Tự động chọn giá trị
    if (currentClassId && classesToShow.includes(currentClassId)) {
        classSelect.value = currentClassId;
    } else if (classesToShow.length === 1) {
        classSelect.value = classesToShow[0];
    } else {
        classSelect.value = "";
    }
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

function attachEventListeners() {
    examSelect.addEventListener('change', () => {
        // Khi đổi đề, reset dropdown lớp và tải lại
        classSelect.value = ""; // Đặt về "Tất cả các lớp"
        fetchAndDisplayClassOverview();
    });
    classSelect.addEventListener('change', fetchAndDisplayClassOverview);

    searchBtn.addEventListener('click', searchStudent);
    studentIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStudent();
    });
}

    // --- BẮT ĐẦU CHẠY ỨNG DỤNG ---
    main();
});