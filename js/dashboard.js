document.addEventListener('DOMContentLoaded', () => {
    // --- KHAI BÁO CÁC PHẦN TỬ DOM ---
    const API_URL = '/api/';

    // -- Chế độ xem Tổng quan --
    const examSelect = document.getElementById('exam-select');
    const classSelect = document.getElementById('class-select');
    const classOverviewSection = document.getElementById('class-overview-section');
    const kpisContainer = document.getElementById('overview-kpis');
    const gradeDistributionChartContainer = document.getElementById('grade-distribution-chart');
    const hardestQuestionsList = document.getElementById('hardest-questions-list');
    const topPerformersList = document.getElementById('top-performers-list');
    const bottomPerformersList = document.getElementById('bottom-performers-list');
    const backToOverviewBtn = document.getElementById('back-to-overview-btn');

    // -- Chế độ xem Chi tiết --
    const searchSection = document.querySelector('.search-section');
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    const resultSection = document.getElementById('result-section');
    const studentNameDisplay = document.getElementById('student-name-display');
    const studentClassDisplay = document.getElementById('student-class-display');
    const scoreTrendChartContainer = document.getElementById('score-trend-chart');
    const performanceQuadrantChartContainer = document.getElementById('performance-quadrant-chart');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const historyTableBody = document.querySelector('#history table tbody');
    const topicStrengthChartContainer = document.getElementById('topic-strength-chart');
    const levelStrengthChartContainer = document.getElementById('level-strength-chart');
    const leaveCountChartContainer = document.getElementById('leave-count-chart');
    const deviceUsageChartContainer = document.getElementById('device-usage-chart');
    const studyTimeChartContainer = document.getElementById('study-time-chart');
    const behaviorModal = document.getElementById('behavior-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const behaviorWarningCard = document.getElementById('behavior-warning-card');
    const behaviorWarningContent = document.getElementById('behavior-warning-content');

    const loadingSpinner = document.getElementById('loading-spinner');

    // -- Biến trạng thái và Biểu đồ --
    let gradeDistributionChart = null;
    let scoreTrendChart = null;
    let performanceQuadrantChart = null;
    let topicStrengthChart = null;
    let levelStrengthChart = null;
    let leaveCountChart = null;
    let deviceUsageChart = null;
    let studyTimeChart = null;
    
    let currentStudentHistoryData = null; // Lưu trữ dữ liệu lịch sử của học sinh đang xem

// =================================================================
//                    LUỒNG KHỞI TẠO CHÍNH
// =================================================================

/**
 * Hàm chính để khởi động toàn bộ Dashboard.
 * Đây là điểm bắt đầu duy nhất sau khi DOM đã tải.
 */
async function main() {
    // BƯỚC 1: KIỂM TRA TOKEN. NẾU KHÔNG CÓ, DỪNG MỌI THỨ VÀ CHUYỂN HƯỚNG.
    const token = localStorage.getItem('authToken');
    console.log("Token tìm thấy trong localStorage:", token);
    if (!token) {
        console.log("Không tìm thấy token. Chuyển hướng về /login.html");
        window.location.href = '/login.html';
        return; // Dừng hàm main() ngay lập tức
    }
    
    // BƯỚC 2: NẾU CÓ TOKEN, GẮN CÁC SỰ KIỆN CHO CÁC NÚT
    attachEventListeners();

    // BƯỚC 3: TẢI DỮ LIỆU BAN ĐẦU (DANH SÁCH ĐỀ BÀI VÀ DỮ LIỆU TỔNG QUAN)
    showLoading(true);
    try {
        // Lấy danh sách đề bài
        console.log("Đang gửi request getExamList với token:", token);
        const examListResult = await fetchApi('getExamList');

        const publishedExams = examListResult.data.filter(exam => exam.status === 'published');

        if (publishedExams.length === 0) {
            alert("Hiện không có bài tập nào được xuất bản.");
            classOverviewSection.innerHTML = '<p style="text-align:center;">Không có dữ liệu để hiển thị.</p>';
            return;
        }
        
        // Hiển thị danh sách đề bài lên dropdown
        examSelect.innerHTML = publishedExams.map(exam => `<option value="${exam.examId}">${exam.title}</option>`).join('');
        
        // Tải dữ liệu tổng quan cho đề bài đầu tiên trong danh sách
        await fetchAndDisplayClassOverview(examSelect.value);

    } catch (error) {
        handleApiError(error, "Lỗi khởi tạo Dashboard");
    } finally {
        showLoading(false);
    }
}

// =================================================================
//                    CÁC HÀM API VÀ XỬ LÝ DỮ LIỆU
// =================================================================

/**
 * Hàm trợ giúp để gọi API, tự động đính kèm token.
 * @param {string} action - Tên action cần gọi.
 * @param {object} [params={}] - Các tham số URL khác.
 * @returns {Promise<object>} - Dữ liệu trả về từ API.
 */
async function fetchApi(action, params = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // Đây là một lớp bảo vệ thứ hai
        throw new Error("401 Unauthorized: Missing token");
    }
    
    const urlParams = new URLSearchParams({ action, ...params });
    const url = `${API_URL}?${urlParams.toString()}`;
    
    console.log(`Đang gọi API: ${url}`); // Log URL để debug

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message);
    }
    return result;
}

/**
 * Tải và hiển thị dữ liệu tổng quan của lớp.
 */
async function fetchAndDisplayClassOverview(examId, classId = null) {
    showLoading(true);
    classOverviewSection.classList.add('hidden');
    try {
        const params = { examId };
        if (classId) params.classId = classId;
        
        const result = await fetchApi('getClassAnalytics', params);
        renderClassOverview(result.data);

    } catch (error) {
        handleApiError(error, "Không thể tải dữ liệu tổng quan");
    } finally {
        showLoading(false);
        classOverviewSection.classList.remove('hidden');
    }
}

/**
 * Tải và hiển thị dữ liệu chi tiết của học sinh.
 */
async function searchStudent() {
    const studentId = studentIdInput.value.trim();
    if (!studentId) {
        alert('Vui lòng nhập Mã số học sinh.');
        return;
    }
    showLoading(true);
    resultSection.classList.add('hidden');
    try {
        const result = await fetchApi('getStudentAnalytics', { studentId });
        switchToDetailView();
        renderData(result.data);
        resultSection.classList.remove('hidden');
    } catch (error) {
        handleApiError(error, "Không thể tải dữ liệu học sinh");
        switchToOverviewView(); // Quay về nếu có lỗi
    } finally {
        showLoading(false);
    }
}

    function renderClassOverview(data) {
        kpisContainer.innerHTML = `
            <div class="kpi-card"><h3>Tỷ lệ tham gia</h3><p>${data.kpis.submissionCount} / ${data.kpis.totalStudents}</p></div>
            <div class="kpi-card"><h3>Điểm TB</h3><p>${data.kpis.averageScore}</p></div>
            <div class="kpi-card"><h3>Điểm cao nhất</h3><p>${data.kpis.highestScore}</p></div>
            <div class="kpi-card"><h3>Điểm thấp nhất</h3><p>${data.kpis.lowestScore}</p></div>
        `;

        renderGradeDistributionChart(data.gradeDistribution);

        hardestQuestionsList.innerHTML = data.itemAnalysis.hardestQuestions.map(q => `
            <li>
                <span>Câu ${q.id.includes('_') ? q.id.split('_').pop() : q.id}</span>
                <span class="accuracy">${q.accuracy.toFixed(0)}% đúng</span>
            </li>
        `).join('') || '<li>Không có dữ liệu.</li>';
        
        const createStudentListItem = s => `<li data-studentid="${s.id}" title="Xem chi tiết ${s.name}"><span>${s.name}</span><span class="score">${s.score}</span></li>`;
        topPerformersList.innerHTML = data.topPerformers.map(createStudentListItem).join('') || '<li>Không có dữ liệu.</li>';
        bottomPerformersList.innerHTML = data.bottomPerformers.map(createStudentListItem).join('') || '<li>Không có dữ liệu.</li>';
        
        document.querySelectorAll('#top-performers-list li, #bottom-performers-list li').forEach(item => {
            item.addEventListener('click', () => {
                const studentId = item.dataset.studentid;
                if(studentId) {
                    studentIdInput.value = studentId;
                    searchStudent();
                }
            });
        });
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

    // --- CÁC HÀM XỬ LÝ CHẾ ĐỘ XEM CHI TIẾT (Lấy từ code gốc của bạn và tích hợp) ---
    function renderData(data) {
        studentNameDisplay.textContent = data.profile.name;
        studentClassDisplay.textContent = `Lớp: ${data.profile.class}`;
        currentStudentHistoryData = data.history; // Lưu lại để dùng cho modal

        // Render các tab
        renderScoreTrendChart(data.overview.scoreTrend);
        renderPerformanceQuadrantChart(data.overview.performanceQuadrant);
        renderHistoryTable(data.history);
        renderTopicStrengthChart(data.skills.byTopic);
        renderLevelStrengthChart(data.skills.byLevel);
        renderBehaviorWarnings(data.behavior.suspiciousNotes);
        renderLeaveCountChart(data.behavior.leaveCountTrend);
        renderDeviceUsageChart(data.behavior.deviceUsage);
        renderStudyTimeChart(data.behavior.studyTimeDistribution);
    }

    function renderScoreTrendChart(scoreData) {
        const options = {
            chart: { type: 'line', height: 350, foreColor: '#e5e7eb' },
            series: [
                { name: 'Điểm của em', data: scoreData.map(item => item.score) },
                { name: 'Điểm TB Lớp', data: scoreData.map(item => item.classAverage) }
            ],
            xaxis: { categories: scoreData.map(item => item.examTitle) },
            yaxis: { min: 0, max: 10 },
            stroke: { curve: 'smooth', width: [4, 2], dashArray: [0, 5] },
            title: { text: 'Xu hướng Điểm số (so với Trung bình lớp)', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
            tooltip: { theme: 'dark', y: { formatter: (val) => val ? parseFloat(val).toFixed(2) : 'N/A' } }
        };
        if (scoreTrendChart) { scoreTrendChart.updateOptions(options); } 
        else { scoreTrendChart = new ApexCharts(scoreTrendChartContainer, options); scoreTrendChart.render(); }
    }

    function renderPerformanceQuadrantChart(quadrantData) {
        const options = {
            chart: { type: 'scatter', height: 350, foreColor: '#e5e7eb', zoom: { enabled: true } },
            series: [{ name: "Bài làm", data: quadrantData.map(item => [item.x, item.y]) }],
            xaxis: { tickAmount: 10, labels: { formatter: (val) => `${val.toFixed(0)}%` }, title: { text: '% Thời gian sử dụng' } },
            yaxis: { tickAmount: 5, min: 0, max: 10, title: { text: 'Điểm số' } },
            title: { text: 'Phân tích Phong cách làm bài', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
            tooltip: {
                theme: 'dark',
                custom: function({ seriesIndex, dataPointIndex, w }) {
                    const data = quadrantData[dataPointIndex];
                    return `<div class="apexcharts-tooltip-title">${data.examTitle}</div>` +
                           `<div><span>Điểm: <strong>${data.y.toFixed(2)}</strong></span><br>` +
                           `<span>Thời gian: <strong>${data.x.toFixed(0)}%</strong></span></div>`;
                }
            }
        };
        if (performanceQuadrantChart) { performanceQuadrantChart.updateOptions(options); } 
        else { performanceQuadrantChart = new ApexCharts(performanceQuadrantChartContainer, options); performanceQuadrantChart.render(); }
    }

    function renderHistoryTable(historyData) {
        if (!historyTableBody) return;
        historyTableBody.innerHTML = '';
        if (!historyData || historyData.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="6">Không có dữ liệu lịch sử.</td></tr>';
            return;
        }
        historyData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.examTitle}</td>
                <td>${item.score.toFixed(2)}</td>
                <td>${item.timeSpent}</td>
                <td>${item.leaveCount}</td>
                <td>${item.submittedAt}</td>
                <td><button class="action-btn-small" data-index="${index}">Xem chi tiết</button></td>
            `;
            historyTableBody.appendChild(row);
        });
        document.querySelectorAll('.action-btn-small').forEach(button => {
            button.addEventListener('click', (event) => {
                const itemIndex = event.target.dataset.index;
                showBehaviorModal(currentStudentHistoryData[itemIndex]);
            });
        });
    }

    // Các hàm render chi tiết khác được giữ nguyên từ code gốc của bạn...
    function renderTopicStrengthChart(topicData) {
        const options = { chart: { type: 'bar', height: 350, foreColor: '#e5e7eb' }, series: [{ name: 'Tỷ lệ đúng', data: topicData.map(item => (item.accuracy * 100).toFixed(1)) }], xaxis: { categories: topicData.map(item => item.topic) }, yaxis: { min: 0, max: 100, labels: { formatter: (val) => `${val}%` } }, plotOptions: { bar: { horizontal: true } }, title: { text: 'Độ vững kiến thức theo Chủ đề', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } }, tooltip: { theme: 'dark', y: { formatter: (val) => `${val}%` } } };
        if (topicStrengthChart) { topicStrengthChart.updateOptions(options); } else { topicStrengthChart = new ApexCharts(topicStrengthChartContainer, options); topicStrengthChart.render(); }
    }
    function renderLevelStrengthChart(levelData) {
        const levelOrder = ["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"];
        levelData.sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
        const options = { chart: { type: 'radar', height: 350, foreColor: '#e5e7eb' }, series: [{ name: 'Tỷ lệ đúng', data: levelData.map(item => (item.accuracy * 100).toFixed(1)) }], labels: levelData.map(item => item.level), yaxis: { min: 0, max: 100, labels: { formatter: (val) => `${val}%` } }, title: { text: 'Năng lực tư duy theo Cấp độ', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } }, tooltip: { theme: 'dark', y: { formatter: (val) => `${val}%` } } };
        if (levelStrengthChart) { levelStrengthChart.updateOptions(options); } else { levelStrengthChart = new ApexCharts(levelStrengthChartContainer, options); levelStrengthChart.render(); }
    }
    function renderLeaveCountChart(leaveData) {
        const options = { chart: { type: 'bar', height: 350, foreColor: '#e5e7eb' }, series: [{ name: 'Số lần rời trang', data: leaveData.map(item => item.count) }], xaxis: { categories: leaveData.map(item => item.examTitle) }, yaxis: { labels: { formatter: (val) => Math.round(val) } }, title: { text: 'Mức độ tập trung (Số lần rời trang)', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } }, tooltip: { theme: 'dark' } };
        if (leaveCountChart) { leaveCountChart.updateOptions(options); } else { leaveCountChart = new ApexCharts(leaveCountChartContainer, options); leaveCountChart.render(); }
    }
    function renderDeviceUsageChart(deviceData) {
        const options = { chart: { type: 'donut', height: 350, foreColor: '#e5e7eb' }, series: deviceData.map(item => item.count), labels: deviceData.map(item => item.device), title: { text: 'Thói quen sử dụng thiết bị', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } }, legend: { position: 'bottom' }, tooltip: { theme: 'dark', y: { formatter: (val) => `${val} lần` } } };
        if (deviceUsageChart) { deviceUsageChart.updateOptions(options); } else { deviceUsageChart = new ApexCharts(deviceUsageChartContainer, options); deviceUsageChart.render(); }
    }
    function renderStudyTimeChart(timeData) {
        const options = { chart: { type: 'bar', height: 350, foreColor: '#e5e7eb' }, series: [{ name: 'Số bài làm', data: timeData.map(item => item.count) }], xaxis: { categories: timeData.map(item => item.timeSlot) }, yaxis: { labels: { formatter: (val) => Math.round(val) } }, plotOptions: { bar: { distributed: true, borderRadius: 4, horizontal: false, } }, colors: ['#ef4444', '#f59e0b', '#22c55e', '#f59e0b', '#14b8a6', '#4f46e5', '#ef4444'], legend: { show: false }, title: { text: 'Phân bố Thời gian làm bài trong ngày', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } }, tooltip: { theme: 'dark' } };
        if (studyTimeChart) { studyTimeChart.updateOptions(options); } else { studyTimeChart = new ApexCharts(studyTimeChartContainer, options); studyTimeChart.render(); }
    }
    function renderBehaviorWarnings(warningData) {
        if (!warningData || warningData.length === 0) {
            behaviorWarningCard.classList.add('hidden');
            return;
        }
        let content = '<ul>';
        warningData.forEach(item => {
            // ... (nội dung hàm này giữ nguyên)
        });
        content += '</ul>';
        if (content.includes('<li>')) {
            behaviorWarningContent.innerHTML = content;
            behaviorWarningCard.classList.remove('hidden');
        } else {
            behaviorWarningCard.classList.add('hidden');
        }
    }
    function showBehaviorModal(data) {
        if (!data) return;
        modalTitle.textContent = `Phân tích Hành vi: ${data.examTitle}`;
        let content = '<ul>';
        if (data.behaviorDetails.fastWrong.length > 0) content += `<li>Làm ẩu (sai nhanh): <strong>Câu ${data.behaviorDetails.fastWrong.join(', ')}</strong></li>`;
        if (data.behaviorDetails.slowWrong.length > 0) content += `<li>Lúng túng (sai chậm): <strong>Câu ${data.behaviorDetails.slowWrong.join(', ')}</strong></li>`;
        if (data.behaviorDetails.changedAnswers.length > 0) content += `<li>Phân vân (đổi đáp án): <strong>Câu ${data.behaviorDetails.changedAnswers.join(', ')}</strong></li>`;
        if (content === '<ul>') content += '<li>Không có ghi nhận hành vi nào đặc biệt.</li>';
        content += '</ul>';
        modalBody.innerHTML = content;
        behaviorModal.classList.remove('hidden');
    }

    // =================================================================
//                    HÀM TIỆN ÍCH VÀ QUẢN LÝ GIAO DIỆN
// =================================================================

/**
 * Hàm xử lý lỗi API tập trung.
 * @param {Error} error - Đối tượng lỗi.
 * @param {string} contextMessage - Thông báo ngữ cảnh.
 */
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

function switchToDetailView() {
    classOverviewSection.classList.add('hidden');
    searchSection.classList.add('hidden');
    backToOverviewBtn.classList.remove('hidden');
    resultSection.classList.remove('hidden');
}

function switchToOverviewView() {
    resultSection.classList.add('hidden');
    backToOverviewBtn.classList.add('hidden');
    classOverviewSection.classList.remove('hidden');
    searchSection.classList.remove('hidden');
    studentIdInput.value = '';
}

function handleTabClick(event) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    const targetTab = event.target.dataset.tab;
    tabPanels.forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== targetTab);
    });
}

/**
 * Gắn tất cả các event listener vào các nút.
 */
function attachEventListeners() {
    examSelect.addEventListener('change', () => fetchAndDisplayClassOverview(examSelect.value));
    searchBtn.addEventListener('click', searchStudent);
    studentIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStudent();
    });
    backToOverviewBtn.addEventListener('click', switchToOverviewView);
    tabButtons.forEach(btn => btn.addEventListener('click', handleTabClick));
    modalCloseBtn.addEventListener('click', () => behaviorModal.classList.add('hidden'));
    behaviorModal.addEventListener('click', (event) => {
        if (event.target === behaviorModal) behaviorModal.classList.add('hidden');
    });
}

// --- BẮT ĐẦU CHẠY ỨNG DỤNG ---
main();
});