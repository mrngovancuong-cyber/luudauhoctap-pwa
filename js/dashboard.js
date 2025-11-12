// File: /js/dashboard.js (PHIÊN BẢN HOÀN CHỈNH - HỖ TRỢ 2 CHẾ ĐỘ XEM)

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    //                    KHAI BÁO BIẾN TOÀN CỤC
    // =================================================================
    const API_URL = '/api/';
    let currentUser = null;
    let mainChart = null;
    let skillChart = null;
    let multiSubjectReportData = null;

    // --- DOM Elements: CHUNG ---
    const overviewLoadingOverlay = document.getElementById('overview-loading-overlay');
    const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
    const filterByExamGroup = document.getElementById('filter-by-exam');
    const filterByClassGroup = document.getElementById('filter-by-class');
    const viewReportBtn = document.getElementById('view-report-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const examSelect = document.getElementById('exam-select');
    const classSelect = document.getElementById('class-select');
    const classSummarySelect = document.getElementById('class-summary-select');
    const subjectSelect = document.getElementById('subject-select');
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    const studentViewBtn = document.getElementById('student-view-btn');

    // --- DOM Elements: BỐ CỤC CHI TIẾT (`detailed-report-layout`) ---
    const kpisContainer = document.getElementById('overview-kpis');
    const detailedChartContainer = document.getElementById('grade-distribution-chart');
    const hardestQuestionsList = document.getElementById('hardest-questions-list');
    const topPerformersList = document.getElementById('top-performers-list');
    const bottomPerformersList = document.getElementById('bottom-performers-list');
    const missingStudentsContainer = document.getElementById('missing-students-container');
    const missingStudentsList = document.getElementById('missing-students-list');

    // --- DOM Elements: BỐ CỤC ĐA MÔN (`multisubject-report-layout`) ---
    const ms_mainChartContainer = document.getElementById('ms-main-chart-container');
    const ms_overallSkillChartContainer = document.getElementById('ms-overall-skill-chart');
    const ms_improvingStudentsList = document.getElementById('ms-improving-students-list');
    const ms_watchingStudentsList = document.getElementById('ms-watching-students-list');
    const ms_weakestTopicsList = document.getElementById('ms-weakest-topics-list');
    const ms_highAttentionIssueList = document.getElementById('ms-high-attention-issue-list');
    const ms_lowParticipationList = document.getElementById('low-participation-list');

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
        resetOverviewUI();

        try {
            const examListResult = await fetchApi('getExamList');
            const publishedExams = examListResult.data.filter(exam => exam.status === 'published');
            if (publishedExams.length > 0) {
                examSelect.innerHTML = `<option value="">-- Chọn bài tập --</option>` + publishedExams.map(exam => `<option value="${exam.examId}">${exam.title}</option>`).join('');
            } else {
                examSelect.innerHTML = `<option value="">-- Không có bài tập --</option>`;
                examSelect.disabled = true;
            }
        } catch (error) {
            handleApiError(error, "Lỗi khi tải danh sách bài tập");
        }
    }

    function attachEventListeners() {
        viewModeRadios.forEach(radio => radio.addEventListener('change', handleViewModeChange));
        examSelect.addEventListener('change', handleExamSelectChange);
        classSelect.addEventListener('change', checkFilters);
        classSummarySelect.addEventListener('change', checkFilters);
        subjectSelect.addEventListener('change', handleSubjectSelectChange);
        viewReportBtn.addEventListener('click', handleViewReportClick);
        resetFiltersBtn.addEventListener('click', handleResetFiltersClick);
        searchBtn.addEventListener('click', searchStudent);
        studentIdInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchStudent(); });
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

    function handleViewModeChange(e) {
        const mode = e.target.value;
        document.querySelectorAll('.view-mode-label').forEach(label => label.classList.remove('active'));
        e.target.closest('.view-mode-label').classList.add('active');

        if (mode === 'byExam') {
            filterByExamGroup.classList.remove('hidden');
            filterByClassGroup.classList.add('hidden');
            if(subjectSelect) subjectSelect.style.display = 'none';
        } else {
            filterByExamGroup.classList.add('hidden');
            filterByClassGroup.classList.remove('hidden');
            populateClassesForSummary();
        }
        resetOverviewUI();
        checkFilters();
    }

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
            fetchAndDisplayClassOverview(params);
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
                        overviewLoadingOverlay.classList.remove('active');
                    } else { // single_subject
                        detailedLayout.classList.remove('hidden');
                        multiSubjectLayout.classList.add('hidden');
                        handleSingleSubjectReportData(result.data.data);
                        overviewLoadingOverlay.classList.remove('active');
                    }
                })
                .catch(error => {
                    handleApiError(error, "Không thể tải báo cáo lớp");
                    overviewLoadingOverlay.classList.remove('active');
                });
        }
    }
    
    function handleSubjectSelectChange() {
        const selectedSubject = subjectSelect.value;
        resetDetailedLayoutContent();
        if (!selectedSubject) return;
        
        if (multiSubjectReportData && multiSubjectReportData[selectedSubject]) {
            overviewLoadingOverlay.classList.add('active');
            setTimeout(() => {
                renderSubjectDetailReport(multiSubjectReportData[selectedSubject]);
                overviewLoadingOverlay.classList.remove('active');
            }, 50);
        }
    }

    function handleResetFiltersClick() {
        startDateInput.value = '';
        endDateInput.value = '';
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

        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === undefined) {
                delete params[key];
            }
        });

        const urlParams = new URLSearchParams({ action, ...params });
        const response = await fetch(`${API_URL}?${urlParams.toString()}`);

        const result = await response.json();
        if (result.success === false) throw new Error(result.message);
        return result;
    }

    async function fetchAndDisplayClassOverview(params) {
        document.getElementById('detailed-report-layout').classList.remove('hidden');
        document.getElementById('multisubject-report-layout').classList.add('hidden');
        
        try {
            overviewLoadingOverlay.classList.add('active');
            
            const kpiResult = await fetchApi('getClassKPIs', params);
            renderKPIsAndLists(kpiResult.data.kpis, kpiResult.data.topPerformers, kpiResult.data.bottomPerformers, kpiResult.data.missingStudents);
            
            const detailsResult = await fetchApi('getClassDetails', params);
            renderChartsAndDetails(detailsResult.data.gradeDistribution, detailsResult.data.itemAnalysis);

        } catch (error) {
            handleApiError(error, "Không thể tải dữ liệu tổng quan");
            resetOverviewUI();
        } finally {
            overviewLoadingOverlay.classList.remove('active');
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
        
        if (topPerformersList) {
            topPerformersList.parentElement.querySelector('h4').innerHTML = '🏆 Top 5 Điểm cao nhất';
            topPerformersList.innerHTML = top.map(createStudentListItem).join('') || '<li>(Không có)</li>';
        }
        
        if (bottomPerformersList) {
            bottomPerformersList.parentElement.querySelector('h4').innerHTML = '💪 Top 5 Cần cố gắng hơn';
            bottomPerformersList.innerHTML = bottom.map(createStudentListItem).join('') || '<li>(Không có)</li>';
        }
        
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

        if(hardestQuestionsList) {
            const hardestQuestionsContainer = hardestQuestionsList.parentElement;
            hardestQuestionsContainer.querySelector('h4').innerHTML = '💡 5 Câu hỏi cần chú ý nhất';
            hardestQuestionsList.style.display = 'block'; // Hiển thị lại danh sách ul
            hardestQuestionsList.innerHTML = itemAnalysis.hardestQuestions.map(q => `
                <li>
                    <span>Câu ${q.id.replace(/.*_/, '')}</span>
                    <span class="accuracy">${q.accuracy.toFixed(0)}% đúng</span>
                </li>
            `).join('') || '<li>(Không có)</li>';
        }
    }

    function handleSingleSubjectReportData(data) {
        multiSubjectReportData = data;
        const subjects = Object.keys(data);
        if (subjects.length > 0) {
            subjectSelect.innerHTML = '<option value="">-- Chọn Môn học --</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
            subjectSelect.style.display = 'block';
        } else {
            subjectSelect.style.display = 'none';
            alert("Không tìm thấy dữ liệu môn học nào cho lớp này.");
        }
    }

    function renderMultiSubjectReport(data) {
        renderSubjectComparisonChart(data.subjectComparison);
        renderOverallSkillChart(data.overallSkillAnalysis.byLevel, ms_overallSkillChartContainer);
        
        const createTrendItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.trend}</span></li>`;
        const createParticipationItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.submitted}/${s.total} bài</span></li>`;
        const createAttentionItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.avgLeaves.toFixed(1)} lần/bài</span></li>`;
        const createTopicItem = t => `<li><span>${t.topic}</span><span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span></li>`;

        if (ms_improvingStudentsList) ms_improvingStudentsList.innerHTML = data.improvingStudents.map(createTrendItem).join('') || '<li class="placeholder-item">Chưa có ghi nhận</li>';
        if (ms_watchingStudentsList) ms_watchingStudentsList.innerHTML = data.studentsToWatch.map(createTrendItem).join('') || '<li class="placeholder-item">Không có ai</li>';
        if (ms_lowParticipationList) ms_lowParticipationList.innerHTML = data.participationAnalysis.lowestParticipation.map(createParticipationItem).join('') || '<li class="placeholder-item">Rất tốt, không có</li>';
        if (ms_weakestTopicsList) ms_weakestTopicsList.innerHTML = data.overallSkillAnalysis.weakestTopics.map(createTopicItem).join('') || '<li class="placeholder-item">Không có chủ đề nào yếu rõ rệt</li>';
        if (ms_highAttentionIssueList) ms_highAttentionIssueList.innerHTML = data.attentionAnalysis.highestAttentionIssue.map(createAttentionItem).join('') || '<li class="placeholder-item">Rất tốt, không có</li>';
        
        attachStudentLinkListeners();
    }

function renderSubjectDetailReport(subjectData) {
    // ... (Phần render KPIs và biểu đồ Xu hướng điểm giữ nguyên)
    const kpis = subjectData.kpis;
    kpisContainer.innerHTML = `...`;
    renderClassScoreTrendChart_forDetailedView(subjectData.classScoreTrend);

    // === BẮT ĐẦU PHẦN GIA CỐ ===
    const topicAnalysisData = subjectData.topicAnalysis || {}; // Tạo đối tượng rỗng nếu không có
    const improvingStudentsData = subjectData.improvingStudents || [];
    const studentsToWatchData = subjectData.studentsToWatch || [];
    
    // Render biểu đồ phụ
    if (hardestQuestionsList) {
        const parentContainer = hardestQuestionsList.parentElement;
        parentContainer.querySelector('h4').innerHTML = '🧠 Năng lực theo Cấp độ';
        hardestQuestionsList.style.display = 'none';
        let skillChartDiv = document.getElementById('subject-skill-chart');
        if (!skillChartDiv) {
            skillChartDiv = document.createElement('div');
            skillChartDiv.id = 'subject-skill-chart';
            parentContainer.appendChild(skillChartDiv);
        }
        // Truyền vào mảng rỗng nếu không có dữ liệu
        renderOverallSkillChart_forDetailedView(topicAnalysisData.byLevel || []);
    }

    // Render các danh sách
    const createStudentLink = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">${s.name}</li>`;
    if (topPerformersList) {
        topPerformersList.parentElement.querySelector('h4').innerHTML = '📈 Học sinh Tiến bộ';
        topPerformersList.innerHTML = improvingStudentsData.map(createStudentLink).join('') || '<li>(Không có)</li>';
    }
    if (bottomPerformersList) {
        bottomPerformersList.parentElement.querySelector('h4').innerHTML = '⚠️ Học sinh Cần quan tâm';
        bottomPerformersList.innerHTML = studentsToWatchData.map(createStudentLink).join('') || '<li>(Không có)</li>';
    }
    if (missingStudentsList) {
        missingStudentsList.parentElement.querySelector('h4').innerHTML = '📉 Các Chủ đề yếu nhất';
        const weakTopicsData = topicAnalysisData.weakTopics || [];
        missingStudentsList.innerHTML = weakTopicsData.map(t => `<li><span>${t.topic}</span><span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span></li>`).join('') || '<li>(Không có)</li>';
    }
    // === KẾT THÚC PHẦN GIA CỐ ===
    attachStudentLinkListeners();
}

    // --- CÁC HÀM VẼ BIỂU ĐỒ (ĐÃ CHUẨN HÓA) ---

    function renderGradeDistributionChart(gradeData) {
        if (!detailedChartContainer) return;
        if (mainChart) { mainChart.destroy(); mainChart = null; }
        
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const options = {
            chart: { type: 'bar', height: 350, foreColor: getChartForeColor(), background: 'transparent', fontFamily: "'Be Vietnam Pro', sans-serif" },
            series: gradeData ? [{ name: 'Số học sinh', data: Object.values(gradeData) }] : [],
            xaxis: { categories: gradeData ? Object.keys(gradeData) : ['0-2', '2-4', '4-6', '6-8', '8-10'], labels: { style: { colors: getChartForeColor() } } },
            yaxis: { title: { text: 'Số lượng học sinh' }, labels: { style: { colors: getChartForeColor() } } },
            title: { text: 'Phân bổ Điểm số', align: 'left', style: { fontSize: '18px', color: getChartForeColor() } },
            noData: { text: 'Vui lòng chọn bộ lọc và nhấn "Xem báo cáo"' },
            tooltip: { theme: currentTheme },
            grid: { borderColor: 'rgba(128, 128, 128, 0.2)' }
        };
        mainChart = new ApexCharts(detailedChartContainer, options);
        mainChart.render();
    }
    
    function renderClassScoreTrendChart(trendData, container) {
        if (!container) return;
        
        const existingChart = ApexCharts.getChartByID(container.id);
        if(existingChart) existingChart.destroy();

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const options = {
            chart: { type: 'line', height: 350, foreColor: getChartForeColor(), background: 'transparent', fontFamily: "'Be Vietnam Pro', sans-serif" },
            series: [{ name: 'Điểm TB Lớp', data: trendData.map(d => d.avgScore) }],
            xaxis: { categories: trendData.map(d => d.examTitle), labels: { style: { colors: getChartForeColor() } } },
            yaxis: { title: { text: 'Điểm trung bình' }, min: 0, max: 10, labels: { style: { colors: getChartForeColor() } } },
            title: { text: 'Xu hướng Điểm trung bình', align: 'left', style: { fontSize: '18px', color: getChartForeColor() } },
            stroke: { curve: 'smooth' },
            noData: { text: 'Không đủ dữ liệu.' },
            tooltip: { theme: currentTheme },
            grid: { borderColor: 'rgba(128, 128, 128, 0.2)' },
            legend: { labels: { colors: getChartForeColor() } }
        };
        const chart = new ApexCharts(container, options);
        chart.render();
    }

    function renderSubjectComparisonChart(comparisonData) {
        if (!ms_mainChartContainer) return; 

        const existingChart = ApexCharts.getChartByID(ms_mainChartContainer.id);
        if(existingChart) existingChart.destroy();
        
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const options = {
            chart: { type: 'bar', height: 350, foreColor: getChartForeColor(), background: 'transparent', fontFamily: "'Be Vietnam Pro', sans-serif" },
            series: [{ name: 'Điểm TB', data: comparisonData.map(s => s.avgScore) }, { name: 'Tỷ lệ Tham gia (%)', data: comparisonData.map(s => s.avgParticipation) }],
            xaxis: { categories: comparisonData.map(s => s.subject), labels: { style: { colors: getChartForeColor() } } },
            yaxis: [
                { seriesName: 'Điểm TB', min: 0, max: 10, title: { text: 'Điểm trung bình' }, labels: { style: { colors: getChartForeColor() } } },
                { seriesName: 'Tỷ lệ Tham gia (%)', opposite: true, min: 0, max: 100, title: { text: 'Tỷ lệ Tham gia (%)' }, labels: { style: { colors: getChartForeColor() } } }
            ],
            title: { text: 'So sánh Hiệu suất các Môn học', align: 'left', style: { fontSize: '18px', color: getChartForeColor() } },
            plotOptions: { bar: { horizontal: false, columnWidth: '50%' } },
            dataLabels: { enabled: false },
            stroke: { show: true, width: 2, colors: ['transparent'] },
            legend: { labels: { colors: getChartForeColor() } },
            tooltip: { theme: currentTheme },
            grid: { borderColor: 'rgba(128, 128, 128, 0.2)' }
        };
        
        const chart = new ApexCharts(ms_mainChartContainer, options);
        chart.render();
    }

    function renderOverallSkillChart(levelData, container) {
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
            title: { text: 'Năng lực Chung của Lớp', align: 'left', style: { fontSize: '16px', color: getChartForeColor() } },
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

function resetOverviewUI() {
        const detailedLayout = document.getElementById('detailed-report-layout');
        const multiSubjectLayout = document.getElementById('multisubject-report-layout');
        
        if (detailedLayout) detailedLayout.classList.add('hidden');
        if (multiSubjectLayout) multiSubjectLayout.classList.add('hidden');
        if (subjectSelect) subjectSelect.style.display = 'none';

        if (mainChart) { mainChart.destroy(); mainChart = null; }
        if (skillChart) { skillChart.destroy(); skillChart = null; }

        if (kpisContainer) kpisContainer.innerHTML = '';
        if (detailedChartContainer) detailedChartContainer.innerHTML = '';
        if (ms_mainChartContainer) ms_mainChartContainer.innerHTML = '';
        if (ms_overallSkillChartContainer) ms_overallSkillChartContainer.innerHTML = '';
        
        const placeholder = '<li>Vui lòng chọn bộ lọc và nhấn "Xem báo cáo"</li>';
        [hardestQuestionsList, topPerformersList, bottomPerformersList, missingStudentsList, 
         ms_improvingStudentsList, ms_watchingStudentsList, ms_lowParticipationList, 
         ms_weakestTopicsList, ms_highAttentionIssueList].forEach(list => {
            if (list) list.innerHTML = placeholder;
        });
    }

    function resetDetailedLayoutContent() {
        const placeholderText = '<li>Vui lòng chọn một môn học</li>';
        kpisContainer.innerHTML = '';
        if(detailedChartContainer) detailedChartContainer.innerHTML = '';
        if(hardestQuestionsList) hardestQuestionsList.parentElement.querySelector('h4').innerHTML = '...';
        if(hardestQuestionsList) hardestQuestionsList.innerHTML = placeholderText;
        if(topPerformersList) topPerformersList.innerHTML = placeholderText;
        if(bottomPerformersList) bottomPerformersList.innerHTML = placeholderText;
        if(missingStudentsList) missingStudentsList.innerHTML = placeholderText;
    }

    function attachStudentLinkListeners() {
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

    // --- BẮT ĐẦU CHẠY ỨNG DỤNG ---
    main();
});