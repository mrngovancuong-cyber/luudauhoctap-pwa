// File: /js/dashboard.js (PHIÊN BẢN HOÀN CHỈNH - HỖ TRỢ 2 CHẾ ĐỘ XEM)

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    //                    KHAI BÁO BIẾN TOÀN CỤC
    // =================================================================
    const API_URL = '/api/';
    let currentUser = null;
    let mainChart = null; // Dùng chung cho cả 2 chế độ xem

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
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    
    // Tìm kiếm HS
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    
    // Khu vực hiển thị
    const overviewLoadingOverlay = document.getElementById('overview-loading-overlay');
    const kpisContainer = document.getElementById('overview-kpis');
    const mainChartContainer = document.getElementById('grade-distribution-chart'); // Tái sử dụng chart container
    const hardestQuestionsList = document.getElementById('hardest-questions-list');
    const topPerformersList = document.getElementById('top-performers-list');
    const bottomPerformersList = document.getElementById('bottom-performers-list');
    const studentViewBtn = document.getElementById('student-view-btn');
    
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
    // Mỗi khi người dùng chọn một lớp, hãy gọi lại checkFilters
    // để kiểm tra xem đã đủ điều kiện bật nút "Xem báo cáo" chưa.
    checkFilters(); 
    
    // Nếu người dùng chọn lại dòng trống ("-- Chọn lớp --"),
    // thì reset giao diện về trạng thái ban đầu.
    if (classSelect.value === "") {
        resetOverviewUI();
    }
});
	classSelect.addEventListener('change', () => {
	    checkFilters(); 
	    if (classSelect.value === "") {
            resetOverviewUI();
    }
});
        classSummarySelect.addEventListener('change', checkFilters);

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

    // --- BẮT ĐẦU PHẦN SỬA LỖI TRIỆT ĐỂ ---
    const params = {
        // Dùng `undefined` để URLSearchParams tự động bỏ qua nếu giá trị rỗng
        startDate: startDateInput.value || undefined,
        endDate: endDateInput.value || undefined,
    };

    if (mode === 'byExam') {
        params.examId = examSelect.value;
        const selectedClass = classSelect.value;
        
        // LOGIC CỐT LÕI:
        // Chỉ thêm thuộc tính 'classId' vào params nếu người dùng đã chọn
        // một lớp cụ thể (khác rỗng và khác "ALL").
        if (selectedClass && selectedClass !== "ALL") {
            params.classId = selectedClass;
        }
        
        // Gọi hàm fetch với params đã được xây dựng cẩn thận
        fetchAndDisplayClassOverview(params);

    } else { // byClass
        params.classId = classSummarySelect.value;
        fetchApi('getClassSummary', params)
            .then(result => renderClassSummary(result.data))
            .catch(error => handleApiError(error, "Không thể tải báo cáo lớp"))
            .finally(() => overviewLoadingOverlay.classList.remove('active'));
    }
    // --- KẾT THÚC PHẦN SỬA LỖI ---
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
        try {
            const kpiResult = await fetchApi('getClassKPIs', params);
            renderKPIsAndLists(kpiResult.data);

            const detailsResult = await fetchApi('getClassDetails', params);
            renderChartsAndDetails(detailsResult.data);
        } catch (error) {
            handleApiError(error, "Không thể tải dữ liệu tổng quan");
            resetOverviewUI();
        } finally {
            overviewLoadingOverlay.classList.remove('active');
        }
    }

    function renderKPIsAndLists(data) {
        kpisContainer.innerHTML = `
            <div class="kpi-card"><h3>Tỷ lệ tham gia</h3><p>${data.kpis.submissionCount} / ${data.kpis.totalStudents}</p></div>
            <div class="kpi-card"><h3>Điểm TB</h3><p>${data.kpis.averageScore}</p></div>
            <div class="kpi-card"><h3>Điểm cao nhất</h3><p>${data.kpis.highestScore}</p></div>
            <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>${data.kpis.lowestScore}</p></div>
        `;
        const createStudentListItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.score}</span></li>`;
        topPerformersList.innerHTML = data.topPerformers.map(createStudentListItem).join('') || '<li>(Không có)</li>';
        bottomPerformersList.innerHTML = data.bottomPerformers.map(createStudentListItem).join('') || '<li>(Không có)</li>';
        attachStudentLinkListeners();
    }

    function renderChartsAndDetails(data) {
        renderGradeDistributionChart(data.gradeDistribution);
        hardestQuestionsList.innerHTML = data.itemAnalysis.hardestQuestions.map(q => `
            <li>
                <span>Câu ${q.id.replace(/.*_/, '')}</span>
                <span class="accuracy">${q.accuracy.toFixed(0)}% đúng</span>
            </li>
        `).join('') || '<li>(Không có)</li>';
    }

    function renderClassSummary(data) {
        resetOverviewUI();
        kpisContainer.innerHTML = `
            <div class="kpi-card"><h3>Mức độ Hoàn thành</h3><p>${data.kpis.totalSubmissions} / ${data.kpis.expectedSubmissions}</p></div>
            <div class="kpi-card"><h3>Điểm TB Chung</h3><p>${data.kpis.overallAvgScore}</p></div>
        `;
        renderClassScoreTrendChart(data.classScoreTrend);
        const createStudentLink = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}">${s.name}</li>`;
        topPerformersList.innerHTML = data.improvingStudents.map(createStudentLink).join('') || '<li>(Không có)</li>';
        bottomPerformersList.innerHTML = data.studentsToWatch.map(createStudentLink).join('') || '<li>(Không có)</li>';
        document.querySelector('#top-performers-list').parentElement.querySelector('h4').innerHTML = '📈 Học sinh Tiến bộ';
        document.querySelector('#bottom-performers-list').parentElement.querySelector('h4').innerHTML = '⚠️ Học sinh Cần quan tâm';
        const hardestQuestionsContainer = hardestQuestionsList.parentElement;
        hardestQuestionsContainer.querySelector('h4').innerHTML = '📉 Các Chủ đề cần Cải thiện nhất';
        hardestQuestionsList.innerHTML = data.topicAnalysis.weakTopics.map(t => `
            <li>
                <span>${t.topic}</span>
                <span class="accuracy">${t.accuracy.toFixed(0)}% đúng</span>
            </li>
        `).join('') || '<li>(Không có)</li>';
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
        else { mainChart = new ApexCharts(mainChartContainer, options); mainChart.render(); }
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
    
    function populateClassesForSummary() {
        if (!currentUser || !currentUser.managedClasses) return;
        if (currentUser.managedClasses === 'ALL') {
            classSummarySelect.innerHTML = '<option value="">-- Tính năng đang phát triển cho Admin --</option>';
            return;
        }
        const managedClasses = currentUser.managedClasses.split(',').map(c => c.trim()).sort();
        classSummarySelect.innerHTML = 
            '<option value="">-- Chọn lớp --</option>' +
            managedClasses.map(c => `<option value="${c}">${c}</option>`).join('');
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
kpisContainer.innerHTML = <div class="kpi-card"><h3>Số HS đã nộp</h3><p>--</p></div> <div class="kpi-card"><h3>Điểm TB</h3><p>--</p></div> <div class="kpi-card"><h3>Điểm cao nhất</h3><p>--</p></div> <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>--</p></div>;
renderGradeDistributionChart(null);
const placeholderText = '<li>Chọn bộ lọc và nhấn "Xem báo cáo"</li>';
hardestQuestionsList.innerHTML = placeholderText;
topPerformersList.innerHTML = placeholderText;
bottomPerformersList.innerHTML = placeholderText;
document.querySelector('#hardest-questions-list').parentElement.querySelector('h4').innerHTML = '💡 5 Câu hỏi cần chú ý nhất';
document.querySelector('#top-performers-list').parentElement.querySelector('h4').innerHTML = '🏆 Top 5 Điểm cao nhất';
document.querySelector('#bottom-performers-list').parentElement.querySelector('h4').innerHTML = '💪 Top 5 Cần cố gắng hơn';
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