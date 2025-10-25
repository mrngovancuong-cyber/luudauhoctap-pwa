// File: /js/studentDetail.js

document.addEventListener('DOMContentLoaded', () => {
    // --- KHAI BÁO CÁC PHẦN TỬ DOM CỦA TRANG CHI TIẾT ---
    const API_URL = '/api/';
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultSection = document.getElementById('result-section');
    
    // Profile
    const studentNameDisplay = document.getElementById('student-name-display');
    const studentClassDisplay = document.getElementById('student-class-display');

    // Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Chart Containers
    const scoreTrendChartContainer = document.getElementById('score-trend-chart');
    const performanceQuadrantChartContainer = document.getElementById('performance-quadrant-chart');
    const topicStrengthChartContainer = document.getElementById('topic-strength-chart');
    const levelStrengthChartContainer = document.getElementById('level-strength-chart');
    const leaveCountChartContainer = document.getElementById('leave-count-chart');
    const deviceUsageChartContainer = document.getElementById('device-usage-chart');
    const studyTimeChartContainer = document.getElementById('study-time-chart');
    
    // Bảng và Modal
    const historyTableBody = document.querySelector('#history table tbody');
    const behaviorModal = document.getElementById('behavior-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    // Card cảnh báo
    const behaviorWarningCard = document.getElementById('behavior-warning-card');
    const behaviorWarningContent = document.getElementById('behavior-warning-content');

    // -- Biến trạng thái và Biểu đồ --
    let scoreTrendChart = null;
    let performanceQuadrantChart = null;
    let topicStrengthChart = null;
    let levelStrengthChart = null;
    let leaveCountChart = null;
    let deviceUsageChart = null;
    let studyTimeChart = null;
    let currentStudentHistoryData = null;


    // =================================================================
    //                    LUỒNG KHỞI TẠO CHÍNH
    // =================================================================

    async function initializeDetailView() {
        // 1. Kiểm tra đăng nhập
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert("Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập.");
            window.location.href = '/login.html';
            return;
        }

        // 2. Lấy studentId từ tham số 'id' trên URL
        const urlParams = new URLSearchParams(window.location.search);
        const studentId = urlParams.get('id');

        if (!studentId) {
            showError("Lỗi: Không tìm thấy mã số học sinh trong đường dẫn.");
            return;
        }
        
        // 3. Gọi API để lấy dữ liệu chi tiết của học sinh đó
        try {
            const url = `${API_URL}?action=getStudentAnalytics&studentId=${studentId}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                // Xử lý các lỗi HTTP như 401, 500...
                if (response.status === 401) throw new Error("Unauthorized");
                throw new Error(`Lỗi server: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            // 4. Hiển thị dữ liệu lên giao diện
            renderData(result.data);
            
            // Ẩn spinner và hiện nội dung
            showLoading(false);
            resultSection.classList.remove('hidden');

        } catch (error) {
            if (error.message.includes("Unauthorized")) {
                alert("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                window.location.href = '/login.html';
            } else {
                showError(`Không thể tải dữ liệu học sinh: ${error.message}`);
            }
        }
    }

    // =================================================================
    //                 CÁC HÀM RENDER DỮ LIỆU VÀ BIỂU ĐỒ
    // =================================================================

// DÁN 6 HÀM NÀY VÀO TRƯỚC HÀM renderData(data)

/**
 * Phân tích dữ liệu xu hướng điểm số và tạo câu tóm tắt.
 */
function generateScoreTrendSummary(scoreData) {
    if (!scoreData || scoreData.length < 2) return "Chưa đủ dữ liệu để nhận xét xu hướng.";
    
    const scores = scoreData.map(d => d.score);
    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    let summary = `Điểm trung bình các bài là <strong>${avgScore.toFixed(2)}</strong>. `;
    if (lastScore > firstScore + 1 && lastScore > avgScore) {
        summary += `Ghi nhận xu hướng <strong>tiến bộ rõ rệt</strong>, với điểm số gần đây cao hơn đáng kể so với trước đây.`;
    } else if (lastScore < firstScore - 1 && lastScore < avgScore) {
        summary += `Cần chú ý xu hướng điểm số đang <strong>đi xuống</strong>. Em cần xem lại các phần kiến thức còn yếu.`;
    } else {
        summary += `Phong độ của em khá <strong>ổn định</strong> qua các bài làm.`;
    }
    return summary;
}

/**
 * Phân tích dữ liệu phong cách làm bài và tạo câu tóm tắt.
 */
function generatePerformanceQuadrantSummary(quadrantData) {
    if (!quadrantData || quadrantData.length === 0) return "Chưa có dữ liệu về phong cách làm bài.";

    const avgTime = quadrantData.reduce((a, item) => a + item.x, 0) / quadrantData.length;
    const avgScore = quadrantData.reduce((a, item) => a + item.y, 0) / quadrantData.length;

    let style = "";
    if (avgTime < 50 && avgScore >= 7.5) style = "<strong>Nhanh và Hiệu quả</strong>. Em có khả năng xử lý bài tốt dưới áp lực thời gian.";
    else if (avgTime < 50 && avgScore < 6) style = "<strong>Nhanh nhưng còn ẩu</strong>. Em có xu hướng hoàn thành bài sớm nhưng cần cẩn thận hơn để tránh lỗi sai không đáng có.";
    else if (avgTime >= 70 && avgScore >= 7.5) style = "<strong>Cẩn thận và Chắc chắn</strong>. Em dành nhiều thời gian để đảm bảo câu trả lời chính xác.";
    else if (avgTime >= 70 && avgScore < 6) style = "<strong>Còn lúng túng</strong>. Em mất khá nhiều thời gian nhưng kết quả chưa cao, cho thấy có thể em đang gặp khó khăn với kiến thức nền tảng.";
    else style = "<strong>Cân bằng</strong>. Em có sự phân bổ thời gian và kết quả ở mức độ hợp lý.";
    return `Nhìn chung, phong cách làm bài của em thuộc nhóm ${style}`;
}

/**
 * Phân tích độ vững kiến thức theo chủ đề và tạo câu tóm tắt.
 */
function generateTopicStrengthSummary(topicData) {
    if (!topicData || topicData.length === 0) return "Chưa có dữ liệu phân tích theo chủ đề.";

    const strongTopics = topicData.filter(t => t.accuracy >= 0.8).map(t => t.topic);
    const weakTopics = topicData.filter(t => t.accuracy < 0.5).map(t => t.topic);

    if (strongTopics.length === 0 && weakTopics.length === 0) {
        return "Kiến thức của em ở các chủ đề khá <strong>đồng đều</strong>, không có phần nào quá yếu hoặc quá mạnh.";
    }

    let summary = "";
    if (strongTopics.length > 0) {
        summary += `Em tỏ ra <strong>rất vững</strong> ở các chủ đề: <strong>${strongTopics.join(', ')}</strong>. `;
    }
    if (weakTopics.length > 0) {
        summary += `Tuy nhiên, em cần <strong>củng cố thêm</strong> kiến thức ở các chủ đề: <strong>${weakTopics.join(', ')}</strong>.`;
    }
    return summary.trim();
}

/**
 * Phân tích số lần rời trang và tạo câu tóm tắt.
 */
function generateLeaveCountSummary(leaveData) {
    if (!leaveData || leaveData.length === 0) return "Chưa có dữ liệu về mức độ tập trung.";

    const totalLeaves = leaveData.reduce((a, item) => a + item.count, 0);
    const avgLeaves = totalLeaves / leaveData.length;

    if (avgLeaves === 0) {
        return "Xuất sắc! Em thể hiện sự <strong>tập trung tuyệt đối</strong> và không rời khỏi màn hình trong suốt quá trình làm bài.";
    } else if (avgLeaves < 2) {
        return `Mức độ tập trung của em <strong>rất tốt</strong>, với trung bình chỉ khoảng ${avgLeaves.toFixed(1)} lần rời trang mỗi bài.`;
    } else if (avgLeaves < 5) {
        return `Em cần cải thiện sự tập trung hơn. Trung bình em rời trang khoảng ${avgLeaves.toFixed(1)} lần mỗi bài, điều này có thể ảnh hưởng đến kết quả.`;
    } else {
        return `Báo động! Mức độ tập trung của em <strong>rất thấp</strong> (trung bình ${avgLeaves.toFixed(1)} lần rời trang). Em cần tìm một không gian yên tĩnh và tránh các yếu tố gây xao nhãng khi làm bài.`;
    }
}

/**
 * Phân tích thói quen sử dụng thiết bị và tạo câu tóm tắt.
 */
function generateDeviceUsageSummary(deviceData) {
    if (!deviceData || deviceData.length === 0) return "Chưa có dữ liệu về thói quen sử dụng thiết bị.";
    
    // Sắp xếp để tìm thiết bị dùng nhiều nhất
    const sortedDevices = [...deviceData].sort((a, b) => b.count - a.count);
    const primaryDevice = sortedDevices[0];
    
    return `Thiết bị học tập chủ yếu của em là <strong>${primaryDevice.device}</strong> (chiếm ${((primaryDevice.count / sortedDevices.reduce((a, d) => a + d.count, 0)) * 100).toFixed(0)}%).`;
}

/**
 * Phân tích thời gian học và tạo câu tóm tắt.
 */
function generateStudyTimeSummary(timeData) {
    if (!timeData || timeData.length === 0) return "Chưa có dữ liệu về thời gian làm bài.";

    const sortedTimes = [...timeData].sort((a, b) => b.count - a.count);
    const favoriteTime = sortedTimes[0];

    let comment = "";
    if (favoriteTime.timeSlot.includes("Khuya") || favoriteTime.timeSlot.includes("Đêm")) {
        comment = "Tuy nhiên, việc thường xuyên thức khuya học bài có thể ảnh hưởng đến sức khỏe. Em nên cố gắng sắp xếp thời gian học sớm hơn.";
    } else if (favoriteTime.timeSlot.includes("Sáng")) {
        comment = "Đây là khung giờ vàng để học tập, rất đáng khen!";
    }

    return `Em có xu hướng làm bài nhiều nhất vào khung giờ <strong>${favoriteTime.timeSlot}</strong>. ${comment}`;
}

    function renderData(data) {
        studentNameDisplay.textContent = data.profile.name;
        studentClassDisplay.textContent = `Lớp: ${data.profile.class}`;
        currentStudentHistoryData = data.history;

        // Kích hoạt việc render cho tất cả các tab
        renderScoreTrendChart(data.overview.scoreTrend);
        renderPerformanceQuadrantChart(data.overview.performanceQuadrant);
        renderHistoryTable(data.history);
        renderTopicStrengthChart(data.skills.byTopic);
        renderLevelStrengthChart(data.skills.byLevel);
        renderBehaviorWarnings(data.behavior.suspiciousNotes);
        renderLeaveCountChart(data.behavior.leaveCountTrend);
        renderDeviceUsageChart(data.behavior.deviceUsage);
        renderStudyTimeChart(data.behavior.studyTimeDistribution);

    // THÊM TOÀN BỘ KHỐI CODE NÀY VÀO CUỐI HÀM
    
    // --- Điền nội dung cho các ô tóm tắt ---
    document.getElementById('score-trend-summary').innerHTML = generateScoreTrendSummary(data.overview.scoreTrend);
    document.getElementById('performance-quadrant-summary').innerHTML = generatePerformanceQuadrantSummary(data.overview.performanceQuadrant);
    document.getElementById('topic-strength-summary').innerHTML = generateTopicStrengthSummary(data.skills.byTopic);
    
    // Hàm này chưa có dữ liệu, sẽ làm sau nếu cần
    // document.getElementById('level-strength-summary').innerHTML = generateLevelStrengthSummary(data.skills.byLevel); 
    
    document.getElementById('leave-count-summary').innerHTML = generateLeaveCountSummary(data.behavior.leaveCountTrend);
    document.getElementById('device-usage-summary').innerHTML = generateDeviceUsageSummary(data.behavior.deviceUsage);
    document.getElementById('study-time-summary').innerHTML = generateStudyTimeSummary(data.behavior.studyTimeDistribution);
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
                <td><button class="action-btn-small" data-index="${index}">Hành vi</button></td>
            `;
            historyTableBody.appendChild(row);
        });
    }

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
        if (!behaviorWarningCard) return;
        if (!warningData || warningData.length === 0) {
            behaviorWarningCard.classList.add('hidden');
            return;
        }
        let content = '<ul>';
        warningData.forEach(item => {
            const analysis = item.analysis;
            let notesHtml = '';
            if (analysis) {
                if (analysis.suspiciousCorrect >= 3) notesHtml += `<li>Có <strong>${analysis.suspiciousCorrect} lần</strong> trả lời đúng ngay sau khi rời trang.</li>`;
                // ... (thêm các logic phân tích khác nếu cần)
            }
            if (notesHtml) {
                 content += `<li><strong>Bài thi "${item.examTitle}":</strong><ul>${notesHtml}</ul></li>`;
            }
        });
        content += '</ul>';

        if (content.includes('<li>')) {
            if(behaviorWarningContent) behaviorWarningContent.innerHTML = content;
            behaviorWarningCard.classList.remove('hidden');
        } else {
            behaviorWarningCard.classList.add('hidden');
        }
    }

    // =================================================================
    //                    HÀM TIỆN ÍCH VÀ SỰ KIỆN
    // =================================================================

    function showLoading(isLoading) {
        loadingSpinner.classList.toggle('hidden', !isLoading);
    }
    
    function showError(message) {
        showLoading(false);
        resultSection.innerHTML = `<div class="card" style="text-align: center; color: var(--bad);"><h3>Lỗi</h3><p>${message}</p></div>`;
        resultSection.classList.remove('hidden');
    }

    function handleTabClick(event) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        const targetTab = event.target.dataset.tab;
        tabPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== targetTab);
        });
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
    
    function attachEventListeners() {
        tabButtons.forEach(btn => btn.addEventListener('click', handleTabClick));
        
        // Gắn sự kiện cho các nút "Hành vi" trong bảng lịch sử
        historyTableBody.addEventListener('click', (event) => {
            if (event.target.classList.contains('action-btn-small')) {
                const itemIndex = event.target.dataset.index;
                showBehaviorModal(currentStudentHistoryData[itemIndex]);
            }
        });

        modalCloseBtn.addEventListener('click', () => behaviorModal.classList.add('hidden'));
        behaviorModal.addEventListener('click', (event) => {
            if (event.target === behaviorModal) behaviorModal.classList.add('hidden');
        });
    }

    // --- KHỞI CHẠY ---
    initializeDetailView();
    attachEventListeners(); // Gắn các sự kiện cho các nút
});