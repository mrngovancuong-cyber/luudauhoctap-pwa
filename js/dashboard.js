// File: /js/dashboard.js (PHIÊN BẢN HOÀN CHỈNH - HỖ TRỢ 2 CHẾ ĐỘ XEM)

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    //                    KHAI BÁO BIẾN TOÀN CỤC
    // =================================================================
    const API_URL = '/api/';
    let currentUser = null;
    let mainChart = null; // Dùng chung cho cả 2 chế độ xem
    let multiSubjectReportData = null; // Cache dữ liệu báo cáo đa môn ở frontend
    // --- DOM Elements ---
    // Chế độ xem
    const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
    const filterByExamGroup = document.getElementById('filter-by-exam');
    const filterByClassGroup = document.getElementById('filter-by-class');
    const viewReportBtn = document.getElementById('view-report-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    // Bộ lọc
    const examSelect = document.getElementById('exam-select');
    const classSelect = document.getElementById('class-select');
    const classSummarySelect = document.getElementById('class-summary-select');
    const subjectSelect = document.getElementById('subject-select');
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    
    // Tìm kiếm HS
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    
    // Khu vực hiển thị
    const overviewLoadingOverlay = document.getElementById('overview-loading-overlay');
    const kpisContainer = document.getElementById('overview-kpis');
    const detailedChartContainer = document.getElementById('grade-distribution-chart');
    const multiSubjectChartContainer = document.getElementById('main-chart-container');
    const hardestQuestionsList = document.getElementById('hardest-questions-list');
    const topPerformersList = document.getElementById('top-performers-list');
    const bottomPerformersList = document.getElementById('bottom-performers-list');
    const missingStudentsContainer = document.getElementById('missing-students-container');
    const missingStudentsList = document.getElementById('missing-students-list');
    const studentViewBtn = document.getElementById('student-view-btn');

    // Bố cục Đa môn
    const ms_mainChartContainer = document.getElementById('ms-main-chart-container');
    const ms_overallSkillChartContainer = document.getElementById('ms-overall-skill-chart');
    const ms_improvingStudentsList = document.getElementById('ms-improving-students-list');
    const ms_watchingStudentsList = document.getElementById('ms-watching-students-list');
    // BỔ SUNG BIẾN CÒN THIẾU
    const ms_weakestTopicsList = document.getElementById('ms-weakest-topics-list');
    const ms_highAttentionIssueList = document.getElementById('ms-high-attention-issue-list');
    // =================================================================
    //                    LUỒNG KHỞI TẠO VÀ SỰ KIỆN
    // =================================================================

    async function main() {
        const token = localStorage.getItem('authToken');
        if (!token) { window.location.href = '/login.html'; return; }
        try {
            currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (!currentUser) throw new Error("Missing user info");
        } catch (error) {
            alert("Thông tin người dùng không hợp lệ. Vui lòng đăng nhập lại.");
            localStorage.clear();
            window.location.href = '/login.html';
            return;
        }

        attachEventListeners();
        renderGradeDistributionChart(null); // Vẽ biểu đồ trống ban đầu

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
            }
        } catch (error) {
            handleApiError(error, "Lỗi khi tải danh sách bài tập");
        }
    }

    function attachEventListeners() {
        // 1. Sự kiện chuyển chế độ xem
        viewModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                document.querySelectorAll('.view-mode-label').forEach(label => label.classList.remove('active'));
                e.target.closest('.view-mode-label').classList.add('active');

                if (mode === 'byExam') {
                    filterByExamGroup.classList.remove('hidden');
                    filterByClassGroup.classList.add('hidden');
                } else {
                    filterByExamGroup.classList.add('hidden');
                    filterByClassGroup.classList.remove('hidden');
                    populateClassesForSummary();
                }
                resetOverviewUI();
                checkFilters();
            });
        });

        // 2. Sự kiện thay đổi các dropdown
        examSelect.addEventListener('change', handleExamSelectChange);
	classSelect.addEventListener('change', () => {
	    checkFilters(); 
	    if (classSelect.value === "") {
            resetOverviewUI();
    }
});
        classSummarySelect.addEventListener('change', checkFilters);
	subjectSelect.addEventListener('change', handleSubjectSelectChange);
        // 3. Sự kiện nhấn nút
        viewReportBtn.addEventListener('click', handleViewReportClick);
        resetFiltersBtn.addEventListener('click', handleResetFiltersClick);
        searchBtn.addEventListener('click', searchStudent);
        
        // 4. Sự kiện phím
        studentIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchStudent();
        });

        // 5. Sự kiện tiện ích
        if (studentViewBtn) {
            studentViewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.setItem('teacherPreviewInfo', JSON.stringify(currentUser));
                window.location.href = '/';
            });
        }
    }

    // =================================================================
    //                    CÁC HÀM XỬ LÝ SỰ KIỆN
    // =================================================================

    async function handleExamSelectChange() {
        const selectedExamId = examSelect.value;
        classSelect.innerHTML = '<option value="">-- Đang tải lớp --</option>';
        classSelect.disabled = true;
        checkFilters();

        if (!selectedExamId) {
            classSelect.innerHTML = '<option value="">-- Chọn bài tập trước --</option>';
            resetOverviewUI();
            return;
        }

        try {
            const classesResult = await fetchApi('getClassesForExam', { examId: selectedExamId });
            populateClassSelect(classesResult.data);
        } catch (error) {
            handleApiError(error, "Không thể tải danh sách lớp");
        }
    }

    function handleViewReportClick() {
    const mode = document.querySelector('input[name="viewMode"]:checked').value;
    overviewLoadingOverlay.classList.add('active');
    resetOverviewUI();

    const params = {
        startDate: startDateInput.value || undefined,
        endDate: endDateInput.value || undefined,
    };

    if (mode === 'byExam') {
        params.examId = examSelect.value;
        const selectedClass = classSelect.value;
        if (selectedClass && selectedClass !== "ALL") {
            params.classId = selectedClass;
        }
        fetchAndDisplayClassOverview(params); // Hàm này có logic spinner riêng
    } else { // byClass
        params.classId = classSummarySelect.value;
        
        fetchApi('get_CLASS_REPORT', params)
            .then(result => {
                const detailedLayout = document.getElementById('detailed-report-layout');
                const multiSubjectLayout = document.getElementById('multisubject-report-layout');

                if (result.data.reportType === 'multi_subject') {
                    detailedLayout.classList.add('hidden');
                    multiSubjectLayout.classList.remove('hidden');
                    renderMultiSubjectReport(result.data.data);
                    overviewLoadingOverlay.classList.remove('active'); // Tắt spinner ngay cho Admin
                } else { // single_subject
                    detailedLayout.classList.remove('hidden');
                    multiSubjectLayout.classList.add('hidden');
                    handleSingleSubjectReportData(result.data.data);
                    // Tắt spinner ngay sau khi dropdown Môn học hiện ra
                    overviewLoadingOverlay.classList.remove('active'); 
                }
            })
            .catch(error => {
                handleApiError(error, "Không thể tải báo cáo lớp");
                overviewLoadingOverlay.classList.remove('active'); // Luôn tắt spinner nếu có lỗi
            });
    }
}
    function handleResetFiltersClick() {
        startDateInput.value = '';
        endDateInput.value = '';
        // Nếu nút xem báo cáo đang hoạt động, tự động tải lại
        if (!viewReportBtn.disabled) {
            viewReportBtn.click();
        }
    }

    // =================================================================
    //                    CÁC HÀM GỌI API & RENDER
    // =================================================================

    async function fetchApi(action, params = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error("401 Unauthorized: Missing token");
    
    params.authToken = `Bearer ${token}`;

    // =============================================================
    // === BẮT ĐẦU PHẦN SỬA LỖI TRIỆT ĐỂ ===
    // =============================================================
    // "Dọn dẹp" đối tượng params trước khi gửi
    // Loại bỏ bất kỳ thuộc tính nào có giá trị là null hoặc undefined
    Object.keys(params).forEach(key => {
        if (params[key] === null || params[key] === undefined) {
            delete params[key];
        }
    });
    // =============================================================
    // === KẾT THÚC PHẦN SỬA LỖI ===
    // =============================================================

    const urlParams = new URLSearchParams({ action, ...params });
    const response = await fetch(`${API_URL}?${urlParams.toString()}`);

    const result = await response.json();
    if (result.success === false) throw new Error(result.message);
    return result;
}

    async function fetchAndDisplayClassOverview(params) {
    // 1. Điều khiển hiển thị layout
    document.getElementById('detailed-report-layout').classList.remove('hidden');
    document.getElementById('multisubject-report-layout').classList.add('hidden');
    
    try {
        overviewLoadingOverlay.classList.add('active');
        
        // 2. Luồng Nhanh (giữ nguyên)
        const kpiResult = await fetchApi('getClassKPIs', params);
        renderKPIsAndLists(kpiResult.data.kpis, kpiResult.data.topPerformers, kpiResult.data.bottomPerformers, kpiResult.data.missingStudents);
        
        // 3. Luồng Chậm (giữ nguyên)
        const detailsResult = await fetchApi('getClassDetails', params);
        renderChartsAndDetails(detailsResult.data.gradeDistribution, detailsResult.data.itemAnalysis);

    } catch (error) {
        handleApiError(error, "Không thể tải dữ liệu tổng quan");
        resetOverviewUI(); // Giữ nguyên xử lý lỗi
    } finally {
        overviewLoadingOverlay.classList.remove('active'); // Giữ nguyên
    }
}
    function renderKPIsAndLists(kpis, top, bottom, missing = []) {
    kpisContainer.innerHTML = `
        <div class="kpi-card"><h3>Tỷ lệ tham gia</h3><p>${kpis.submissionCount} / ${kpis.totalStudents}</p></div>
        <div class="kpi-card"><h3>Điểm TB</h3><p>${kpis.averageScore}</p></div>
        <div class="kpi-card"><h3>Điểm cao nhất</h3><p>${kpis.highestScore}</p></div>
        <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>${kpis.lowestScore}</p></div>
    `;

    const createStudentListItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.score}</span></li>`;
    
    document.querySelector('#top-performers-list').parentElement.querySelector('h4').innerHTML = '🏆 Top 5 Điểm cao nhất';
    topPerformersList.innerHTML = top.map(createStudentListItem).join('') || '<li>(Không có)</li>';
    
    document.querySelector('#bottom-performers-list').parentElement.querySelector('h4').innerHTML = '💪 Top 5 Cần cố gắng hơn';
    bottomPerformersList.innerHTML = bottom.map(createStudentListItem).join('') || '<li>(Không có)</li>';
    
    if (missingStudentsContainer) {
        missingStudentsContainer.style.display = 'block';
        if (missing.length > 0) {
            missingStudentsList.innerHTML = missing.map(s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.class}</span></li>`).join('');
        } else {
            missingStudentsList.innerHTML = '<li class="placeholder-item" style="color: var(--ok);">Tất cả học sinh đã nộp bài!</li>';
        }
    }
    attachStudentLinkListeners();
}

    function renderChartsAndDetails(gradeData, itemAnalysis) {
    renderGradeDistributionChart(gradeData);

    const hardestQuestionsContainer = document.getElementById('hardest-questions-list').parentElement;
    hardestQuestionsContainer.querySelector('h4').innerHTML = '💡 5 Câu hỏi cần chú ý nhất';
    hardestQuestionsList.innerHTML = itemAnalysis.hardestQuestions.map(q => `
        <li>
            <span>Câu ${q.id.replace(/.*_/, '')}</span>
            <span class="accuracy">${q.accuracy.toFixed(0)}% đúng</span>
        </li>
    `).join('') || '<li>(Không có)</li>';
}

    function renderClassSummary(data) {
    // Reset giao diện về trạng thái sạch trước khi render
    resetOverviewUI();

    // --- RENDER CÁC THẺ KPI MỚI ---
    kpisContainer.innerHTML = `
        <div class="kpi-card">
            <h3>Mức độ Hoàn thành</h3>
            <p>${data.kpis.totalSubmissions} / ${data.kpis.expectedSubmissions}</p>
        </div>
        <div class="kpi-card">
            <h3>Điểm TB Chung</h3>
            <p>${data.kpis.overallAvgScore}</p>
        </div>
    `;

    // --- RENDER BIỂU ĐỒ XU HƯỚNG MỚI ---
    renderClassScoreTrendChart(data.classScoreTrend);

    // --- RENDER CÁC DANH SÁCH ---
    const createStudentLink = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">${s.name}</li>`;

    // Cập nhật tiêu đề và nội dung cho 3 cột danh sách
    document.querySelector('#top-performers-list').parentElement.querySelector('h4').innerHTML = '📈 Học sinh Tiến bộ';
    topPerformersList.innerHTML = data.improvingStudents.map(createStudentLink).join('') || '<li>(Không có)</li>';

    document.querySelector('#bottom-performers-list').parentElement.querySelector('h4').innerHTML = '⚠️ Học sinh Cần quan tâm';
    bottomPerformersList.innerHTML = data.studentsToWatch.map(createStudentLink).join('') || '<li>(Không có)</li>';

    // Ẩn cột "5 Câu hỏi" và hiện cột "Học sinh chưa nộp" (nếu có)
    // Tái sử dụng các DOM element đã có
    const hardestQuestionsContainer = document.getElementById('hardest-questions-list').parentElement;
    hardestQuestionsContainer.querySelector('h4').innerHTML = '📉 Các Chủ đề cần Cải thiện nhất';
    hardestQuestionsList.innerHTML = data.topicAnalysis.weakTopics.map(t => `
        <li>
            <span>${t.topic}</span>
            <span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span>
        </li>
    `).join('') || '<li>(Không có)</li>';

    // Ẩn danh sách học sinh chưa nộp bài vì chế độ này không có ý nghĩa
    if (missingStudentsContainer) {
        missingStudentsContainer.style.display = 'none';
    }

    // Gắn lại sự kiện click cho các tên học sinh vừa được render
    attachStudentLinkListeners();
}
    
// CÁC HÀM XỬ LÝ VÀ RENDER MỚI

function handleSubjectSelectChange() {
    const selectedSubject = subjectSelect.value;
    // Reset nhẹ giao diện chi tiết, chỉ xóa nội dung, không ẩn layout
    resetDetailedLayoutContent(); 

    if (!selectedSubject) {
        return; // Nếu người dùng chọn "--Chọn Môn học--", không làm gì cả
    }
    
    if (multiSubjectReportData && multiSubjectReportData[selectedSubject]) {
        // Không cần spinner ở đây nữa vì render rất nhanh
        const subjectData = multiSubjectReportData[selectedSubject];
        renderSubjectDetailReport(subjectData);
    }
}

// Hàm render cho báo cáo Đa môn của Admin/GVCN
function renderMultiSubjectReport(data) {
    // 1. Dọn dẹp giao diện
    if (subjectSelect) subjectSelect.style.display = 'none';
    if (kpisContainer) kpisContainer.innerHTML = ''; 
    
    // 2. Render các biểu đồ chính
    renderSubjectComparisonChart(data.subjectComparison);
    renderOverallSkillChart(data.overallSkillAnalysis.byLevel);
    
    // 3. Render danh sách Tuyên dương
    if (ms_improvingStudentsList) {
        if (data.improvingStudents && data.improvingStudents.length > 0) {
            ms_improvingStudentsList.innerHTML = data.improvingStudents.map(s => 
                `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                    <span>${s.name}</span><span class="score">${s.trend}</span>
                </li>`).join('');
        } else {
            ms_improvingStudentsList.innerHTML = '<li class="placeholder-item">Chưa có ghi nhận</li>';
        }
    }

    // 4. Render danh sách Cảnh báo
    if (ms_watchingStudentsList) {
        if (data.studentsToWatch && data.studentsToWatch.length > 0) {
            ms_watchingStudentsList.innerHTML = data.studentsToWatch.map(s => 
                `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                    <span>${s.name}</span><span class="score">${s.trend}</span>
                </li>`).join('');
        } else {
            ms_watchingStudentsList.innerHTML = '<li class="placeholder-item">Không có ai</li>';
        }
    }
    
    // 5. Render danh sách Chủ đề yếu
     if (ms_weakestTopicsList) {
        if (data.overallSkillAnalysis && data.overallSkillAnalysis.weakestTopics.length > 0) {
            ms_weakestTopicsList.innerHTML = data.overallSkillAnalysis.weakestTopics.map(t =>
                `<li><span>${t.topic}</span><span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span></li>`
            ).join('');
        } else {
            ms_weakestTopicsList.innerHTML = '<li class="placeholder-item">Không có chủ đề nào yếu rõ rệt</li>';
        }
    }
    
    // 6. Render danh sách Mất tập trung
    if (ms_highAttentionIssueList) {
        if (data.attentionAnalysis && data.attentionAnalysis.highestAttentionIssue.length > 0) {
            ms_highAttentionIssueList.innerHTML = data.attentionAnalysis.highestAttentionIssue.map(s => 
                `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                    <span>${s.name}</span><span class="score">${s.avgLeaves.toFixed(1)} lần/bài</span>
                </li>`).join('');
        } else {
            ms_highAttentionIssueList.innerHTML = '<li class="placeholder-item">Rất tốt, không có</li>';
        }
    }

    // Gắn lại sự kiện click cho các tên học sinh vừa được render
    attachStudentLinkListeners();
}

// Hàm xử lý "kho" dữ liệu trả về cho GVBM
function handleSingleSubjectReportData(data) {
    multiSubjectReportData = data;
    const subjects = Object.keys(data);
    if (subjects.length > 0) {
        subjectSelect.innerHTML = 
            '<option value="">-- Chọn Môn học --</option>' +
            subjects.map(s => `<option value="${s}">${s}</option>`).join('');
        subjectSelect.style.display = 'block';
    } else {
        subjectSelect.style.display = 'none';
        alert("Không tìm thấy dữ liệu môn học nào cho lớp này.");
    }
}

// Hàm render báo cáo chi tiết cho MỘT môn học (dành cho GVBM)
// THAY THẾ TOÀN BỘ HÀM NÀY
// THAY THẾ TOÀN BỘ HÀM NÀY
function renderSubjectDetailReport(subjectData) {
    // 1. Render KPIs
    const kpis = subjectData.kpis;
    kpisContainer.innerHTML = `
        <div class="kpi-card"><h3>Mức độ Hoàn thành</h3><p>${kpis.totalSubmissions} / ${kpis.expectedSubmissions}</p></div>
        <div class="kpi-card"><h3>Điểm TB Chung</h3><p>${kpis.overallAvgScore}</p></div>
        <div class="kpi-card"><h3>Điểm cao nhất</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>--</p></div>
    `;

    // 2. Render Biểu đồ chính: Xu hướng điểm
    renderClassScoreTrendChart_forDetailedView(subjectData.classScoreTrend);

    // 3. Render Biểu đồ phụ: Năng lực (thay thế danh sách câu hỏi khó)
    if (hardestQuestionsList) {
        const parentContainer = hardestQuestionsList.parentElement;
        parentContainer.querySelector('h4').innerHTML = '🧠 Năng lực theo Cấp độ';
        hardestQuestionsList.style.display = 'none'; // Ẩn danh sách ul
        let skillChartDiv = document.getElementById('subject-skill-chart');
        if (!skillChartDiv) {
            skillChartDiv = document.createElement('div');
            skillChartDiv.id = 'subject-skill-chart';
            parentContainer.appendChild(skillChartDiv);
        }
        renderOverallSkillChart_forDetailedView(subjectData.topicAnalysis.byLevel);
    }

    // 4. Render các danh sách vào đúng 3 cột
    const createStudentLink = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">${s.name}</li>`;
    
    if (topPerformersList) {
        topPerformersList.parentElement.querySelector('h4').innerHTML = '📈 Học sinh Tiến bộ';
        topPerformersList.innerHTML = subjectData.improvingStudents.map(createStudentLink).join('') || '<li>(Không có)</li>';
    }
    if (bottomPerformersList) {
        bottomPerformersList.parentElement.querySelector('h4').innerHTML = '⚠️ Học sinh Cần quan tâm';
        bottomPerformersList.innerHTML = subjectData.studentsToWatch.map(createStudentLink).join('') || '<li>(Không có)</li>';
    }
    if (missingStudentsList) {
        missingStudentsList.parentElement.querySelector('h4').innerHTML = '📉 Các Chủ đề yếu nhất';
        missingStudentsList.innerHTML = subjectData.topicAnalysis.weakTopics.map(t => `<li><span>${t.topic}</span><span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span></li>`).join('') || '<li>(Không có)</li>';
    }

    attachStudentLinkListeners();
}

// --- CÁC HÀM VẼ BIỂU ĐỒ ---
    function renderGradeDistributionChart(gradeData) {
        const options = {
            chart: { type: 'bar', height: 350, foreColor: getChartForeColor(), background: 'transparent', fontFamily: "'Be Vietnam Pro', sans-serif" },
            series: gradeData ? [{ name: 'Số học sinh', data: Object.values(gradeData) }] : [],
            xaxis: { categories: gradeData ? Object.keys(gradeData) : ['0-2', '2-4', '4-6', '6-8', '8-10'] },
            yaxis: { title: { text: 'Số lượng học sinh' } },
            title: { text: 'Phân bổ Điểm số', align: 'left', style: { fontSize: '18px', color: getChartForeColor() } },
            noData: { text: 'Vui lòng chọn bộ lọc và nhấn "Xem báo cáo"' },
            tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' }
        };
        if (mainChart) { mainChart.updateOptions(options, true, true, true); }
        else { mainChart = new ApexCharts(detailedChartContainer, options); mainChart.render(); }
    }
    
function renderClassScoreTrendChart(trendData) {
    if (!mainChartContainer) return;

    if (mainChart) mainChart.destroy();
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    const options = {
        chart: { 
            type: 'line', 
            height: 350, 
            foreColor: getChartForeColor(), 
            background: 'transparent', 
            fontFamily: "'Be Vietnam Pro', sans-serif" 
        },
        series: [{ 
            name: 'Điểm TB Lớp', 
            data: trendData.map(d => d.avgScore) 
        }],
        xaxis: { 
            categories: trendData.map(d => d.examTitle),
            labels: { style: { colors: getChartForeColor() } }
        },
        yaxis: { 
            title: { text: 'Điểm trung bình' }, 
            min: 0, 
            max: 10,
            labels: { style: { colors: getChartForeColor() } }
        },
        title: { 
            text: 'Xu hướng Điểm trung bình của Lớp', 
            align: 'left', 
            style: { fontSize: '18px', color: getChartForeColor() } 
        },
        stroke: { curve: 'smooth' },
        noData: { text: 'Không đủ dữ liệu để vẽ biểu đồ.' },
        tooltip: { theme: currentTheme },
        grid: { borderColor: 'rgba(128, 128, 128, 0.2)' },
        legend: { labels: { colors: getChartForeColor() } }
    };
    
    mainChart = new ApexCharts(mainChartContainer, options);
    mainChart.render();
}
function renderSubjectComparisonChart(comparisonData) {
    // Luôn kiểm tra an toàn
    if (!ms_mainChartContainer) return; 

    // Hủy biểu đồ cũ nếu có
    const existingChart = ApexCharts.getChartByID(ms_mainChartContainer.id);
    if(existingChart) existingChart.destroy();
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    const options = {
        chart: { 
            type: 'bar', 
            height: 350, 
            foreColor: getChartForeColor(), 
            background: 'transparent', 
            fontFamily: "'Be Vietnam Pro', sans-serif" 
        },
        series: [{
            name: 'Điểm TB',
            data: comparisonData.map(s => s.avgScore)
        }, {
            name: 'Tỷ lệ Tham gia (%)',
            data: comparisonData.map(s => s.avgParticipation)
        }],
        xaxis: {
            categories: comparisonData.map(s => s.subject),
            labels: {
                style: {
                    colors: getChartForeColor()
                }
            }
        },
        yaxis: [
            { 
                seriesName: 'Điểm TB', 
                min: 0, 
                max: 10, 
                title: { text: 'Điểm trung bình' },
                labels: {
                    style: {
                        colors: getChartForeColor()
                    }
                }
            },
            { 
                seriesName: 'Tỷ lệ Tham gia (%)', 
                opposite: true, 
                min: 0, 
                max: 100, 
                title: { text: 'Tỷ lệ Tham gia (%)' },
                labels: {
                    style: {
                        colors: getChartForeColor()
                    }
                }
            }
        ],
        title: { 
            text: 'So sánh Hiệu suất các Môn học', 
            align: 'left', 
            style: {
                fontSize: '18px',
                color: getChartForeColor() 
            } 
        },
        plotOptions: { bar: { horizontal: false, columnWidth: '50%' } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        legend: {
            labels: {
                colors: getChartForeColor()
            }
        },
        tooltip: {
            theme: currentTheme
        },
        grid: {
            borderColor: 'rgba(128, 128, 128, 0.2)'
        }
    };
    
    // Vẽ biểu đồ vào đúng container có ID 'ms-main-chart-container'
    const chart = new ApexCharts(ms_mainChartContainer, options);
    chart.render();
}

function renderOverallSkillChart(levelData) {
    // Luôn kiểm tra an toàn
    if (!ms_overallSkillChartContainer) return;

    const existingChart = ApexCharts.getChartByID(ms_overallSkillChartContainer.id);
    if(existingChart) existingChart.destroy();

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const levelOrder = ["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"];
    const sortedData = [...levelData].sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
    
    const options = {
        chart: { 
            type: 'radar', 
            height: 280, 
            foreColor: getChartForeColor(), 
            background: 'transparent', 
            toolbar: { show: false }, 
            fontFamily: "'Be Vietnam Pro', sans-serif" 
        },
        series: [{
            name: 'Tỷ lệ đúng',
            data: sortedData.map(l => l.accuracy.toFixed(0))
        }],
        labels: sortedData.map(l => l.level),
        yaxis: { 
            min: 0, 
            max: 100, 
            tickAmount: 5, 
            labels: { 
                formatter: (val) => `${val}%`,
                style: {
                    colors: getChartForeColor()
                }
            } 
        },
        title: {
            text: 'Năng lực Chung của Lớp',
            align: 'left',
            style: {
                fontSize: '16px',
                color: getChartForeColor()
            }
        },
        stroke: { width: 2 },
        fill: { opacity: 0.2 },
        markers: { size: 3 },
        tooltip: {
            theme: currentTheme
        },
        plotOptions: {
            radar: {
                polygons: {
                    strokeColors: 'rgba(128, 128, 128, 0.2)',
                    connectorColors: 'rgba(128, 128, 128, 0.2)'
                }
            }
        }
    };

    // Vẽ biểu đồ vào đúng container có ID 'ms-overall-skill-chart'
    const chart = new ApexCharts(ms_overallSkillChartContainer, options);
    chart.render();
}
// HÀM VẼ BIỂU ĐỒ XU HƯỚNG CHO GVBM
function renderClassScoreTrendChart_forDetailedView(trendData) {
    if (!detailedChartContainer) return;

    const existingChart = ApexCharts.getChartByID(detailedChartContainer.id);
    if(existingChart) existingChart.destroy();
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    const options = {
        chart: { type: 'line', height: 350, foreColor: getChartForeColor(), background: 'transparent', fontFamily: "'Be Vietnam Pro', sans-serif" },
        series: [{ name: 'Điểm TB Lớp', data: trendData.map(d => d.avgScore) }],
        xaxis: { categories: trendData.map(d => d.examTitle), labels: { style: { colors: getChartForeColor() } } },
        yaxis: { title: { text: 'Điểm trung bình' }, min: 0, max: 10, labels: { style: { colors: getChartForeColor() } } },
        title: { text: 'Xu hướng Điểm trung bình của Môn học', align: 'left', style: { fontSize: '18px', color: getChartForeColor() } },
        stroke: { curve: 'smooth' },
        noData: { text: 'Không đủ dữ liệu.' },
        tooltip: { theme: currentTheme },
        grid: { borderColor: 'rgba(128, 128, 128, 0.2)' },
        legend: { labels: { colors: getChartForeColor() } }
    };
    
    const chart = new ApexCharts(detailedChartContainer, options);
    chart.render();
}

// HÀM VẼ BIỂU ĐỒ RADAR CHO GVBM
function renderOverallSkillChart_forDetailedView(levelData) {
    const container = document.getElementById('subject-skill-chart');
    if (!container) return;

    const existingChart = ApexCharts.getChartByID(container.id);
    if(existingChart) existingChart.destroy();

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const levelOrder = ["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"];
    const sortedData = [...levelData].sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
    
    const options = {
        chart: { type: 'radar', height: 280, foreColor: getChartForeColor(), background: 'transparent', toolbar: { show: false }, fontFamily: "'Be Vietnam Pro', sans-serif" },
        series: [{ name: 'Tỷ lệ đúng', data: sortedData.map(l => l.accuracy.toFixed(0)) }],
        labels: sortedData.map(l => l.level),
        yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (val) => `${val}%`, style: { colors: getChartForeColor() } } },
        title: { text: 'Năng lực theo Cấp độ', align: 'left', style: { fontSize: '16px', color: getChartForeColor() } },
        stroke: { width: 2 },
        fill: { opacity: 0.2 },
        markers: { size: 3 },
        tooltip: { theme: currentTheme },
        plotOptions: { radar: { polygons: { strokeColors: 'rgba(128, 128, 128, 0.2)', connectorColors: 'rgba(128, 128, 128, 0.2)' } } }
    };

    const chart = new ApexCharts(container, options);
    chart.render();
}
    // =================================================================
    //                    HÀM TIỆN ÍCH
    // =================================================================
    function getChartForeColor() {
        if (document.documentElement.getAttribute('data-theme') === 'light') return '#431407';
        return '#f3e9e0';
    }
    
    function searchStudent() {
        const studentId = studentIdInput.value.trim();
        if (!studentId) { alert('Vui lòng nhập Mã số học sinh.'); return; }
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        let url = `/StudentDetail.html?id=${studentId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        window.location.href = url;
    }

    function handleApiError(error, contextMessage) {
        console.error(`${contextMessage}:`, error);
        if (error.message.includes("401 Unauthorized")) {
            alert("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
            localStorage.clear();
            window.location.href = '/login.html';
        } else {
            alert(`${contextMessage}: ${error.message}`);
        }
    }
    
// THAY THẾ TOÀN BỘ HÀM NÀY
async function populateClassesForSummary() {
    if (!currentUser) return;

    // Vô hiệu hóa dropdown trong khi tải (giữ nguyên)
    classSummarySelect.innerHTML = '<option value="">-- Đang tải các lớp --</option>';
    classSummarySelect.disabled = true;
    if (subjectSelect) subjectSelect.style.display = 'none'; // Thêm dòng này để ẩn dropdown môn học

    try {
        let classesToDisplay = [];

        if (currentUser.role === 'admin') {
            // === LOGIC CHO ADMIN (GIỮ NGUYÊN) ===
            // Gọi API để lấy TẤT CẢ các lớp trong hệ thống
            const result = await fetchApi('getAllClasses');
            classesToDisplay = result.data;
        } else {
            // === LOGIC CHO GIÁO VIÊN (SỬA LẠI) ===
            // Thay vì đọc từ localStorage, gọi API để lấy các lớp MÀ GV ĐÓ QUẢN LÝ
            // API getClassesForSummaryReport đã có sẵn logic này ở backend
            const result = await fetchApi('getClassesForSummaryReport');
            classesToDisplay = result.data;
        }

        // Logic hiển thị kết quả (giữ nguyên)
        if (classesToDisplay && classesToDisplay.length > 0) {
            classSummarySelect.innerHTML =
                '<option value="">-- Chọn lớp để xem --</option>' +
                classesToDisplay.map(c => `<option value="${c}">${c}</option>`).join('');
            classSummarySelect.disabled = false;
        } else {
            classSummarySelect.innerHTML = '<option value="">-- Không có lớp nào để báo cáo --</option>';
        }

    } catch (error) {
        handleApiError(error, "Không thể tải danh sách lớp");
        classSummarySelect.innerHTML = '<option value="">-- Lỗi tải lớp --</option>';
    }
}

    function populateClassSelect(allAssignedClasses) {
        let classesToShow = allAssignedClasses;
        if (currentUser && currentUser.role !== 'admin' && currentUser.managedClasses !== 'ALL') {
            const managedClassesSet = new Set(currentUser.managedClasses.split(',').map(c => c.trim()));
            classesToShow = allAssignedClasses.filter(c => managedClassesSet.has(c));
        }
        if (classesToShow.length === 0) {
            classSelect.innerHTML = '<option value="">-- Không có lớp --</option>';
            classSelect.disabled = true; return;
        }
        let optionsHtml = '<option value="">-- Chọn lớp (Tùy chọn) --</option><option value="ALL">Tất cả các lớp</option>';
        classesToShow.sort().forEach(className => {
            optionsHtml += `<option value="${className}">${className}</option>`;
        });
        classSelect.innerHTML = optionsHtml;
        classSelect.disabled = false;
    }
    
    function checkFilters() {
    const mode = document.querySelector('input[name="viewMode"]:checked').value;
    let isReady = false;

    if (mode === 'byExam') {
        // Ở chế độ "Theo bài tập", phải chọn BÀI TẬP và LỚP
        const examSelected = examSelect.value !== "";
        const classSelected = classSelect.value !== "";
        isReady = examSelected && classSelected;
    } else { // byClass
        // Ở chế độ "Theo lớp", chỉ cần chọn LỚP
        isReady = classSummarySelect.value !== "";
    }
    
    viewReportBtn.disabled = !isReady;
}

function resetDetailedLayoutContent() {
    kpisContainer.innerHTML = `
        <div class="kpi-card"><h3>Số HS đã nộp</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm TB</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm cao nhất</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>--</p></div>
    `;
    if (detailedChartContainer) detailedChartContainer.innerHTML = '<div class="placeholder-text">Vui lòng chọn bộ lọc và nhấn "Xem báo cáo"</div>';
    
    const placeholderText = '<li>Chọn bộ lọc và nhấn "Xem báo cáo"</li>';
    if(hardestQuestionsList) hardestQuestionsList.innerHTML = placeholderText;
    if(topPerformersList) topPerformersList.innerHTML = placeholderText;
    if(bottomPerformersList) bottomPerformersList.innerHTML = placeholderText;
    if(missingStudentsList) missingStudentsList.innerHTML = placeholderText;
}
    
function resetOverviewUI() {
    // === PHẦN 1: ĐIỀU KHIỂN ẨN/HIỆN CÁC BỐ CỤC (BỔ SUNG) ===
    const detailedLayout = document.getElementById('detailed-report-layout');
    const multiSubjectLayout = document.getElementById('multisubject-report-layout');
    
    // Luôn hiển thị layout chi tiết và ẩn layout đa môn khi reset
    if (detailedLayout) detailedLayout.classList.remove('hidden');
    if (multiSubjectLayout) multiSubjectLayout.classList.add('hidden');
    
    // Ẩn dropdown chọn môn học (nếu nó đang hiện)
    if (subjectSelect) subjectSelect.style.display = 'none';

    // === PHẦN 2: RESET NỘI DUNG BỐ CỤC CHI TIẾT (GIỮ NGUYÊN CODE CỦA BẠN) ===
    kpisContainer.innerHTML = `
        <div class="kpi-card"><h3>Số HS đã nộp</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm TB</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm cao nhất</h3><p>--</p></div>
        <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>--</p></div>
    `;
    
    renderGradeDistributionChart(null); // Giữ nguyên cách reset biểu đồ chính
    
    const placeholderText = '<li>Chọn bộ lọc và nhấn "Xem báo cáo"</li>';
    hardestQuestionsList.innerHTML = placeholderText;
    topPerformersList.innerHTML = placeholderText;
    bottomPerformersList.innerHTML = placeholderText;
    if (missingStudentsList) {
        missingStudentsList.innerHTML = placeholderText;
    }
    
    // Đặt lại các tiêu đề về mặc định
    document.querySelector('#hardest-questions-list').parentElement.querySelector('h4').innerHTML = '💡 5 Câu hỏi cần chú ý nhất';
    document.querySelector('#top-performers-list').parentElement.querySelector('h4').innerHTML = '🏆 Top 5 Điểm cao nhất';
    document.querySelector('#bottom-performers-list').parentElement.querySelector('h4').innerHTML = '💪 Top 5 Cần cố gắng hơn';

    // === PHẦN 3: RESET NỘI DUNG BỐ CỤC ĐA MÔN ===
    if (ms_mainChartContainer) ms_mainChartContainer.innerHTML = '';
    if (ms_overallSkillChartContainer) ms_overallSkillChartContainer.innerHTML = ''; // <-- DÒNG SỬA LỖI CHÍNH
    
    const multiSubjectPlaceholder = '<li>Vui lòng chọn bộ lọc và nhấn "Xem báo cáo"</li>';
    if (ms_improvingStudentsList) ms_improvingStudentsList.innerHTML = multiSubjectPlaceholder;
    if (ms_watchingStudentsList) ms_watchingStudentsList.innerHTML = multiSubjectPlaceholder;
    // Bỏ qua ms_lowParticipationList vì nó không có trong HTML mới của bạn
    if (ms_weakestTopicsList) ms_weakestTopicsList.innerHTML = multiSubjectPlaceholder;
    if (ms_highAttentionIssueList) ms_highAttentionIssueList.innerHTML = multiSubjectPlaceholder;
}
    function attachStudentLinkListeners() {
        document.querySelectorAll('.student-link').forEach(item => {
            item.addEventListener('click', () => {
                const studentId = item.dataset.studentid;
                if(studentId) {
                    studentIdInput.value = studentId;
                    searchStudent(); // Tái sử dụng hàm search đã có logic date range
                }
            });
        });
    }

    // --- BẮT ĐẦU CHẠY ỨNG DỤNG ---
    main();
});