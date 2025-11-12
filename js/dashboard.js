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
    const overallSkillChartContainer = document.getElementById('overall-skill-chart');
    const improvingStudentsList = document.getElementById('improving-students-list');
    const watchingStudentsList = document.getElementById('watching-students-list');
    const lowParticipationList = document.getElementById('low-participation-list');
    const weakestTopicsList = document.getElementById('weakest-topics-list');
    const highAttentionIssueList = document.getElementById('high-attention-issue-list');
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
    resetOverviewUI(); // Reset giao diện trước khi tải mới

    const params = {
        startDate: startDateInput.value || undefined,
        endDate: endDateInput.value || undefined,
    };

    if (mode === 'byExam') {
        // --- BÁO CÁO THEO BÀI TẬP (LOGIC CŨ) ---
        params.examId = examSelect.value;
        const selectedClass = classSelect.value;
        if (selectedClass && selectedClass !== "ALL") {
            params.classId = selectedClass;
        }

        // Đảm bảo đúng layout được hiển thị
        document.getElementById('detailed-report-layout').classList.remove('hidden');
        document.getElementById('multisubject-report-layout').classList.add('hidden');
        
        fetchAndDisplayClassOverview(params);

    } else { // byClass - BÁO CÁO THEO LỚP (LOGIC MỚI)
        params.classId = classSummarySelect.value;
        
        fetchApi('get_CLASS_REPORT', params)
            .then(result => {
                const detailedLayout = document.getElementById('detailed-report-layout');
                const multiSubjectLayout = document.getElementById('multisubject-report-layout');

                if (result.data.reportType === 'multi_subject') {
                    // === Luồng Admin/GVCN ===
                    // 1. Chuyển đổi layout
                    detailedLayout.classList.add('hidden');
                    multiSubjectLayout.classList.remove('hidden');
                    // 2. Render báo cáo đa môn
                    renderMultiSubjectReport(result.data.data);

                } else { // single_subject
                    // === Luồng GVBM ===
                    // 1. Chuyển đổi layout
                    detailedLayout.classList.remove('hidden');
                    multiSubjectLayout.classList.add('hidden');
                    // 2. Xử lý "kho" dữ liệu để tạo dropdown Môn học
                    handleSingleSubjectReportData(result.data.data);
                }
            })
            .catch(error => {
                handleApiError(error, "Không thể tải báo cáo lớp");
                // Đảm bảo tắt spinner nếu có lỗi
                overviewLoadingOverlay.classList.remove('active');
            })
            .finally(() => {
                // Tắt spinner chỉ khi là báo cáo đa môn (vì báo cáo chi tiết có luồng riêng)
                const reportType = document.querySelector('#multisubject-report-layout.hidden') ? 'detailed' : 'multisubject';
                if (reportType === 'multisubject') {
                    overviewLoadingOverlay.classList.remove('active');
                }
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
    if (!selectedSubject) {
        resetOverviewUI(true); // Reset nhẹ, không reset dropdown
        return;
    }
    
    if (multiSubjectReportData && multiSubjectReportData[selectedSubject]) {
        overviewLoadingOverlay.classList.add('active');
        setTimeout(() => {
            const subjectData = multiSubjectReportData[selectedSubject];
            // Render dữ liệu chi tiết của môn học đã chọn
            renderSubjectDetailReport(subjectData);
            overviewLoadingOverlay.classList.remove('active');
        }, 50);
    }
}

// Hàm render cho báo cáo Đa môn của Admin/GVCN
// THAY THẾ TOÀN BỘ HÀM NÀY
function renderMultiSubjectReport(data) {
    // 1. Dọn dẹp giao diện (giữ nguyên)
    if (subjectSelect) subjectSelect.style.display = 'none';
    if (kpisContainer) kpisContainer.innerHTML = ''; 
    
    // === BẮT ĐẦU PHẦN SỬA LỖI VÀ NÂNG CẤP ===
    
    // 2. Render Biểu đồ So sánh Môn học (thay vì bảng tĩnh)
    renderSubjectComparisonChart(data.subjectComparison);

    // 3. Render Biểu đồ Radar Năng lực chung
    renderOverallSkillChart(data.overallSkillAnalysis.byLevel);
    
    // 4. Render danh sách Tuyên dương
if (improvingStudentsList) { // Kiểm tra an toàn
    if (data.improvingStudents && data.improvingStudents.length > 0) {
        improvingStudentsList.innerHTML = data.improvingStudents.map(s => 
            `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                <span>${s.name}</span><span class="score">${s.trend}</span>
            </li>`).join('');
    } else {
        improvingStudentsList.innerHTML = '<li class="placeholder-item">Chưa có ghi nhận</li>';
    }

    // 5. Render danh sách Cảnh báo
if (watchingStudentsList) { // Kiểm tra an toàn
    if (data.studentsToWatch && data.studentsToWatch.length > 0) {
        watchingStudentsList.innerHTML = data.studentsToWatch.map(s => 
            `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                <span>${s.name}</span><span class="score">${s.trend}</span>
            </li>`).join('');
    } else {
        watchingStudentsList.innerHTML = '<li class="placeholder-item">Không có ai</li>';
    }
    
    // 6. Render danh sách Chuyên cần thấp
if (lowParticipationList) { // Kiểm tra an toàn
    if (data.participationAnalysis && data.participationAnalysis.lowestParticipation.length > 0) {
        lowParticipationList.innerHTML = data.participationAnalysis.lowestParticipation.map(s => 
            `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                <span>${s.name}</span><span class="score">${s.submitted}/${s.total} bài</span>
            </li>`).join('');
    } else {
        lowParticipationList.innerHTML = '<li class="placeholder-item">Rất tốt, không có</li>';
    }
    
    // 7. Render danh sách Chủ đề yếu
if (weakestTopicsList) { // Kiểm tra an toàn
    if (data.overallSkillAnalysis && data.overallSkillAnalysis.weakestTopics.length > 0) {
        weakestTopicsList.innerHTML = data.overallSkillAnalysis.weakestTopics.map(t =>
            `<li><span>${t.topic}</span><span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span></li>`
        ).join('');
    } else {
        weakestTopicsList.innerHTML = '<li class="placeholder-item">Không có chủ đề nào yếu rõ rệt</li>';
    }
    
    // 8. Render danh sách Mất tập trung
if (highAttentionIssueList) { // Kiểm tra an toàn
    if (data.attentionAnalysis && data.attentionAnalysis.highestAttentionIssue.length > 0) {
        highAttentionIssueList.innerHTML = data.attentionAnalysis.highestAttentionIssue.map(s => 
            `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">
                <span>${s.name}</span><span class="score">${s.avgLeaves.toFixed(1)} lần/bài</span>
            </li>`).join('');
    } else {
        highAttentionIssueList.innerHTML = '<li class="placeholder-item">Rất tốt, không có</li>';
    }

    // Gắn lại sự kiện click cho các tên học sinh vừa được render
    attachStudentLinkListeners();
    
    // === KẾT THÚC PHẦN SỬA LỖI VÀ NÂNG CẤP ===
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
function renderSubjectDetailReport(subjectData) {
    // Render KPIs
    const kpis = subjectData.kpis;
    kpisContainer.innerHTML = `
        <div class="kpi-card"><h3>Mức độ Hoàn thành</h3><p>${kpis.totalSubmissions} / ${kpis.expectedSubmissions}</p></div>
        <div class="kpi-card"><h3>Điểm TB Chung</h3><p>${kpis.overallAvgScore}</p></div>
    `;

    // Render biểu đồ Xu hướng điểm
    renderClassScoreTrendChart(subjectData.classScoreTrend);

    // Render danh sách học sinh
    const createStudentLink = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">${s.name}</li>`;
    
    document.querySelector('#top-performers-list').parentElement.querySelector('h4').innerHTML = '📈 Học sinh Tiến bộ';
    topPerformersList.innerHTML = subjectData.improvingStudents.map(createStudentLink).join('') || '<li>(Không có)</li>';
    
    document.querySelector('#bottom-performers-list').parentElement.querySelector('h4').innerHTML = '⚠️ Học sinh Cần quan tâm';
    bottomPerformersList.innerHTML = subjectData.studentsToWatch.map(createStudentLink).join('') || '<li>(Không có)</li>';
    
    // Render danh sách chủ đề yếu
    const hardestQuestionsContainer = document.getElementById('hardest-questions-list').parentElement;
    hardestQuestionsContainer.querySelector('h4').innerHTML = '📉 Các Chủ đề cần Cải thiện nhất';
    hardestQuestionsList.innerHTML = subjectData.topicAnalysis.weakTopics.map(t => `
        <li>
            <span>${t.topic}</span>
            <span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span>
        </li>
    `).join('') || '<li>(Không có)</li>';

    if (missingStudentsContainer) {
        missingStudentsContainer.style.display = 'none';
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
        const options = {
            chart: { type: 'line', height: 350, foreColor: getChartForeColor(), background: 'transparent', fontFamily: "'Be Vietnam Pro', sans-serif" },
            series: [{ name: 'Điểm TB Lớp', data: trendData.map(d => d.avgScore) }],
            xaxis: { categories: trendData.map(d => d.examTitle) },
            yaxis: { title: { text: 'Điểm trung bình' }, min: 0, max: 10 },
            title: { text: 'Xu hướng Điểm trung bình của Lớp', align: 'left', style: { fontSize: '18px', color: getChartForeColor() } },
            stroke: { curve: 'smooth' },
            noData: { text: 'Không đủ dữ liệu để vẽ biểu đồ.' },
            tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' }
        };
        if (mainChart) { mainChart.updateOptions(options, true, true, true); }
        else { mainChart = new ApexCharts(mainChartContainer, options); mainChart.render(); }
    }

function renderSubjectComparisonChart(comparisonData) {
    // An toàn hơn: kiểm tra xem container có tồn tại không
    if (!multiSubjectChartContainer) return; 

    // Hủy biểu đồ cũ nếu có
    const existingChart = ApexCharts.getChartByID(multiSubjectChartContainer.id);
    if(existingChart) existingChart.destroy();
    
    const options = {
        chart: { type: 'bar', height: 350, foreColor: getChartForeColor(), background: 'transparent' },
        series: [{
            name: 'Điểm TB',
            data: comparisonData.map(s => s.avgScore)
        }, {
            name: 'Tỷ lệ Tham gia (%)',
            data: comparisonData.map(s => s.avgParticipation)
        }],
        xaxis: {
            categories: comparisonData.map(s => s.subject)
        },
        yaxis: [
            { seriesName: 'Điểm TB', min: 0, max: 10, title: { text: 'Điểm trung bình' } },
            { seriesName: 'Tỷ lệ Tham gia (%)', opposite: true, min: 0, max: 100, title: { text: 'Tỷ lệ Tham gia (%)' } }
        ],
        title: { text: 'So sánh Hiệu suất các Môn học', align: 'left' },
        plotOptions: { bar: { horizontal: false, columnWidth: '50%' } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] }
    };
    
    const chart = new ApexCharts(multiSubjectChartContainer, options);
    chart.render();
}

function renderOverallSkillChart(levelData) {
    if (!overallSkillChartContainer) return;

    const existingChart = ApexCharts.getChartByID(overallSkillChartContainer.id);
    if(existingChart) existingChart.destroy();

    const levelOrder = ["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"];
    const sortedData = [...levelData].sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
    
    const options = {
        chart: { type: 'radar', height: 280, foreColor: getChartForeColor(), background: 'transparent', toolbar: { show: false } },
        series: [{
            name: 'Tỷ lệ đúng',
            data: sortedData.map(l => l.accuracy.toFixed(0))
        }],
        labels: sortedData.map(l => l.level),
        yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (val) => `${val}%` } },
        stroke: { width: 2 },
        fill: { opacity: 0.2 },
        markers: { size: 3 }
    };

    const chart = new ApexCharts(overallSkillChartContainer, options);
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
    
    async function populateClassesForSummary() {
    if (!currentUser) return;

    // Vô hiệu hóa dropdown trong khi tải
    classSummarySelect.innerHTML = '<option value="">-- Đang tải các lớp --</option>';
    classSummarySelect.disabled = true;

    try {
        let classesToDisplay = [];

        if (currentUser.role === 'admin') {
            // *** LOGIC MỚI CHO ADMIN ***
            // Gọi API mới để lấy tất cả các lớp trong hệ thống
            const result = await fetchApi('getAllClasses');
            classesToDisplay = result.data;
        } else {
            // Logic cũ cho giáo viên thông thường
            if (currentUser.managedClasses && currentUser.managedClasses !== 'ALL') {
                classesToDisplay = currentUser.managedClasses.split(',').map(c => c.trim()).sort();
            }
        }

        if (classesToDisplay.length > 0) {
            classSummarySelect.innerHTML =
                '<option value="">-- Chọn lớp để xem --</option>' +
                classesToDisplay.map(c => `<option value="${c}">${c}</option>`).join('');
            classSummarySelect.disabled = false; // Bật lại dropdown
        } else {
            classSummarySelect.innerHTML = '<option value="">-- Không có lớp nào --</option>';
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

    // THAY THẾ TOÀN BỘ HÀM NÀY
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

    // === PHẦN 3: RESET NỘI DUNG BỐ CỤC ĐA MÔN (BỔ SUNG) ===
    // Đảm bảo các thành phần của layout mới cũng được dọn dẹp
    if (multiSubjectChartContainer) multiSubjectChartContainer.innerHTML = ''; // Xóa bảng so sánh môn học
    if (overallSkillChartContainer) overallSkillChartContainer.innerHTML = ''; // Xóa biểu đồ radar
    
    const multiSubjectPlaceholder = '<li>Vui lòng chọn bộ lọc và nhấn "Xem báo cáo"</li>';
    if (improvingStudentsList) improvingStudentsList.innerHTML = multiSubjectPlaceholder;
    if (watchingStudentsList) watchingStudentsList.innerHTML = multiSubjectPlaceholder;
    if (lowParticipationList) lowParticipationList.innerHTML = multiSubjectPlaceholder;
    if (weakestTopicsList) weakestTopicsList.innerHTML = multiSubjectPlaceholder;
    if (highAttentionIssueList) highAttentionIssueList.innerHTML = multiSubjectPlaceholder;
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