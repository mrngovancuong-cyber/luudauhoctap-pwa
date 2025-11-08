// File: /js/studentDetail.js (PHIÊN BẢN SỬA LỖI CÚ PHÁP)

// Bọc toàn bộ code trong DOMContentLoaded để đảm bảo các phần tử HTML đã tồn tại
document.addEventListener('DOMContentLoaded', () => {

    // ---  KHAI BÁO CÁC PHẦN TỬ DOM CỦA TRANG CHI TIẾT ---
    const API_URL = '/api/';
    const loadingSpinner = document.getElementById('loading-spinner');
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
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
    let currentStudentData = null;

    // =================================================================
    //                    CÁC HÀM TIỆN ÍCH
    // =================================================================

    function getChartForeColor() {
      if (document.documentElement.getAttribute('data-theme') === 'light') {
        return '#431407';
      }
      return '#f3e9e0';
    }

    // =================================================================
    //                    LUỒNG KHỞI TẠO CHÍNH
    // =================================================================

    // =================================================================
//   HÀM initializeDetailView PHIÊN BẢN HOÀN CHỈNH (HỖ TRỢ TIME TRAVEL)
// =================================================================

// THAY THẾ TOÀN BỘ HÀM NÀY TRONG studentDetail.js

async function initializeDetailView() {
    // 1. Kiểm tra đăng nhập
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert("Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập.");
        window.location.href = '/login.html';
        return;
    }

    // 2. Lấy các tham số từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    const startDate = urlParams.get('startDate'); // Lấy ngày bắt đầu
    const endDate = urlParams.get('endDate');   // Lấy ngày kết thúc

    if (!studentId) {
        showError("Lỗi: Không tìm thấy mã số học sinh trong đường dẫn.");
        return;
    }
    
    // Cập nhật giá trị cho ô tìm kiếm để người dùng biết họ đang xem ai
    if (studentIdInput) studentIdInput.value = studentId;

    // 3. Gọi API với đầy đủ tham số
    try {
        const params = {
            action: 'getStudentAnalytics',
            studentId: studentId
        };
        // Chỉ thêm tham số ngày tháng nếu chúng tồn tại
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const url = `${API_URL}?${new URLSearchParams(params).toString()}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("Unauthorized");
            throw new Error(`Lỗi server: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        renderData(result.data);
        
        showLoading(false);
        resultSection.classList.remove('hidden');

    } catch (error) {
        // ... (phần catch giữ nguyên)
    }
}

    // =================================================================
    //                 CÁC HÀM TÓM TẮT DỮ LIỆU
    // =================================================================

    function generateScoreTrendSummary(scoreData) {
        if (!scoreData || scoreData.length < 2) return "Chưa đủ dữ liệu để nhận xét xu hướng.";
        const scores = scoreData.map(d => d.score);
        const firstScore = scores[0];
        const lastScore = scores[scores.length - 1];
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        let summary = `Điểm trung bình các bài là <strong>${avgScore.toFixed(2)}</strong>. `;
        if (lastScore > firstScore + 1 && lastScore > avgScore) summary += `Ghi nhận xu hướng <strong>tiến bộ rõ rệt</strong>.`;
        else if (lastScore < firstScore - 1 && lastScore < avgScore) summary += `Cần chú ý xu hướng điểm số đang <strong>đi xuống</strong>.`;
        else summary += `Phong độ của em khá <strong>ổn định</strong>.`;
        return summary;
    }

    function generatePerformanceQuadrantSummary(quadrantData) {
        if (!quadrantData || quadrantData.length === 0) return "Chưa có dữ liệu.";
        const avgTime = quadrantData.reduce((a, item) => a + item.x, 0) / quadrantData.length;
        const avgScore = quadrantData.reduce((a, item) => a + item.y, 0) / quadrantData.length;
        let style = "";
        if (avgTime < 50 && avgScore >= 7.5) style = "<strong>Nhanh và Hiệu quả</strong>.";
        else if (avgTime < 50 && avgScore < 6) style = "<strong>Nhanh nhưng còn ẩu</strong>.";
        else if (avgTime >= 70 && avgScore >= 7.5) style = "<strong>Cẩn thận và Chắc chắn</strong>.";
        else if (avgTime >= 70 && avgScore < 6) style = "<strong>Còn lúng túng</strong>.";
        else style = "<strong>Cân bằng</strong>.";
        return `Phong cách làm bài của em thuộc nhóm ${style}`;
    }

    function generateTopicStrengthSummary(topicData) {
        if (!topicData || topicData.length === 0) return "Chưa có dữ liệu.";
        const strongTopics = topicData.filter(t => t.accuracy >= 0.8).map(t => t.topic);
        const weakTopics = topicData.filter(t => t.accuracy < 0.5).map(t => t.topic);
        if (strongTopics.length === 0 && weakTopics.length === 0) return "Kiến thức khá <strong>đồng đều</strong>.";
        let summary = "";
        if (strongTopics.length > 0) summary += `Em <strong>rất vững</strong> ở các chủ đề: <strong>${strongTopics.join(', ')}</strong>. `;
        if (weakTopics.length > 0) summary += `Cần <strong>củng cố thêm</strong>: <strong>${weakTopics.join(', ')}</strong>.`;
        return summary.trim();
    }
    
    function generateLeaveCountSummary(leaveData) {
        if (!leaveData || leaveData.length === 0) return "Chưa có dữ liệu.";
        const avgLeaves = leaveData.reduce((a, item) => a + item.count, 0) / leaveData.length;
        if (avgLeaves === 0) return "<strong>Tập trung tuyệt đối</strong>, không rời màn hình.";
        else if (avgLeaves < 2) return `Mức độ tập trung <strong>rất tốt</strong> (trung bình ${avgLeaves.toFixed(1)} lần rời trang).`;
        else if (avgLeaves < 5) return `Cần cải thiện sự tập trung (trung bình ${avgLeaves.toFixed(1)} lần rời trang).`;
        else return `Báo động! Mức độ tập trung <strong>rất thấp</strong> (trung bình ${avgLeaves.toFixed(1)} lần rời trang).`;
    }

    function generateDeviceUsageSummary(deviceData) {
        if (!deviceData || deviceData.length === 0) return "Chưa có dữ liệu.";
        const sortedDevices = [...deviceData].sort((a, b) => b.count - a.count);
        const primaryDevice = sortedDevices[0];
        return `Thiết bị chủ yếu là <strong>${primaryDevice.device}</strong> (${((primaryDevice.count / sortedDevices.reduce((a, d) => a + d.count, 0)) * 100).toFixed(0)}%).`;
    }

    function generateStudyTimeSummary(timeData) {
        if (!timeData || timeData.length === 0) return "Chưa có dữ liệu.";
        const sortedTimes = [...timeData].sort((a, b) => b.count - a.count);
        const favoriteTime = sortedTimes[0];
        let comment = "";
        if (favoriteTime.timeSlot.includes("Khuya") || favoriteTime.timeSlot.includes("Đêm")) comment = "Nên sắp xếp học sớm hơn để bảo vệ sức khỏe.";
        else if (favoriteTime.timeSlot.includes("Sáng")) comment = "Đây là khung giờ vàng để học, rất tốt!";
        return `Thường làm bài vào <strong>${favoriteTime.timeSlot}</strong>. ${comment}`;
    }

    // =================================================================
    //                 CÁC HÀM RENDER DỮ LIỆU VÀ BIỂU ĐỒ
    // =================================================================

    function renderData(data) {
        currentStudentData = data;
        if(studentIdInput) {
            const urlParams = new URLSearchParams(window.location.search);
            studentIdInput.value = urlParams.get('id');
        }
        studentNameDisplay.textContent = data.profile.name;
        studentClassDisplay.textContent = `Lớp: ${data.profile.class}`;
        currentStudentHistoryData = data.history;

        // Render biểu đồ
        renderScoreTrendChart(data.overview.scoreTrend);
        renderPerformanceQuadrantChart(data.overview.performanceQuadrant);
        renderTopicStrengthChart(data.skills.byTopic);
        renderLevelStrengthChart(data.skills.byLevel);
        renderLeaveCountChart(data.behavior.leaveCountTrend);
        renderDeviceUsageChart(data.behavior.deviceUsage);
        renderStudyTimeChart(data.behavior.studyTimeDistribution);
        
        // Render bảng và cảnh báo
        renderHistoryTable(data.history);
        renderBehaviorWarnings(data.behavior.suspiciousNotes);
        
        // Render tóm tắt
        document.getElementById('score-trend-summary').innerHTML = generateScoreTrendSummary(data.overview.scoreTrend);
        document.getElementById('performance-quadrant-summary').innerHTML = generatePerformanceQuadrantSummary(data.overview.performanceQuadrant);
        document.getElementById('topic-strength-summary').innerHTML = generateTopicStrengthSummary(data.skills.byTopic);
        document.getElementById('leave-count-summary').innerHTML = generateLeaveCountSummary(data.behavior.leaveCountTrend);
        document.getElementById('device-usage-summary').innerHTML = generateDeviceUsageSummary(data.behavior.deviceUsage);
        document.getElementById('study-time-summary').innerHTML = generateStudyTimeSummary(data.behavior.studyTimeDistribution);
    }
    
    // ... (Tất cả các hàm render...Chart của bạn nằm ở đây)
    // Tôi sẽ dán lại các hàm này với phiên bản đã tích hợp theme-aware
    
    function renderScoreTrendChart(scoreData) {
    const options = {
        chart: { type: 'line', height: 350, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor() },
        series: [
            { name: 'Điểm của em', data: scoreData.map(item => item.score) },
            { name: 'Điểm TB Lớp', data: scoreData.map(item => item.classAverage) }
        ],
        xaxis: { categories: scoreData.map(item => item.examTitle) },
        yaxis: { min: 0, max: 10 },
        stroke: { curve: 'smooth', width: [4, 2], dashArray: [0, 5] },
        title: { text: 'Xu hướng Điểm số (so với Trung bình lớp)', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } },
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', style: { fontSize: '12px', fontFamily: "'Be Vietnam Pro', sans-serif" }, y: { formatter: (val) => val ? parseFloat(val).toFixed(2) : 'N/A' } },
        grid: { borderColor: '#555' }
    };
    if (scoreTrendChart) { scoreTrendChart.updateOptions(options); } 
    else { scoreTrendChart = new ApexCharts(scoreTrendChartContainer, options); scoreTrendChart.render(); }
}

    function renderPerformanceQuadrantChart(quadrantData) {
    const options = {
        chart: { type: 'scatter', height: 350, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor(), zoom: { enabled: true } },
        series: [{ name: "Bài làm", data: quadrantData.map(item => [item.x, item.y]) }],
        xaxis: { tickAmount: 10, labels: { formatter: (val) => `${val.toFixed(0)}%` }, title: { text: '% Thời gian sử dụng' } },
        yaxis: { tickAmount: 5, min: 0, max: 10, title: { text: 'Điểm số' } },
        title: { text: 'Phân tích Phong cách làm bài', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } },
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
            custom: function({ seriesIndex, dataPointIndex, w }) {
                const data = quadrantData[dataPointIndex];
                const themeClass = document.documentElement.getAttribute('data-theme') === 'light' ? 'apexcharts-tooltip-light' : '';
                return `<div class="apexcharts-tooltip-title ${themeClass}">${data.examTitle}</div>` +
                       `<div class="apexcharts-tooltip-series-group ${themeClass}" style="padding: 5px 10px;">` +
                       `<span>Điểm: <strong>${data.y.toFixed(2)}</strong></span><br>` +
                       `<span>Thời gian: <strong>${data.x.toFixed(0)}%</strong></span></div>`;
            }
        },
        grid: { borderColor: '#555' }
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
	// === BẮT ĐẦU PHẦN GIA CỐ ===

	    // Kiểm tra an toàn cho điểm số. Nếu không có hoặc không phải là số, hiển thị 'N/A'.
	    const scoreDisplay = (typeof item.score === 'number') 
	        ? item.score.toFixed(2) 
        	: 'N/A';

	    // Kiểm tra an toàn cho các giá trị khác để đề phòng
	    const examTitleDisplay = item.examTitle || 'Không có tên';
	    const timeSpentDisplay = item.timeSpent || 'N/A';
	    // Dùng ?? (Nullish Coalescing) để xử lý đúng trường hợp leaveCount = 0
	    const leaveCountDisplay = item.leaveCount ?? 'N/A'; 
    	    const submittedAtDisplay = item.submittedAt || 'N/A';
       	    // === KẾT THÚC PHẦN GIA CỐ ===
    
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
    // Gắn lại sự kiện cho nút bấm một cách an toàn hơn
	historyTableBody.querySelectorAll('.action-btn-small').forEach(button => {
    	    button.addEventListener('click', (event) => {
        	const itemIndex = event.target.dataset.index;
        	// Kiểm tra xem dữ liệu có tồn tại ở index đó không trước khi hiển thị modal
        	if (currentStudentHistoryData && currentStudentHistoryData[itemIndex]) {
            	    showBehaviorModal(currentStudentHistoryData[itemIndex]);
        	}
    	});
});
}

    function renderTopicStrengthChart(topicData) {
    const options = { 
        chart: { type: 'bar', height: 350, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor() }, 
        series: [{ name: 'Tỷ lệ đúng', data: topicData.map(item => (item.accuracy * 100).toFixed(1)) }], 
        xaxis: { categories: topicData.map(item => item.topic) }, 
        yaxis: { min: 0, max: 100, labels: { formatter: (val) => `${val}%` } }, 
        plotOptions: { bar: { horizontal: true } }, 
        title: { text: 'Độ vững kiến thức theo Chủ đề', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } }, 
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', y: { formatter: (val) => `${val}%` } },
        grid: { borderColor: '#555' }
    };
    if (topicStrengthChart) { topicStrengthChart.updateOptions(options); } else { topicStrengthChart = new ApexCharts(topicStrengthChartContainer, options); topicStrengthChart.render(); }
}
    
    function renderLevelStrengthChart(levelData) {
    const levelOrder = ["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"];
    levelData.sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
    const options = { 
        chart: { type: 'radar', height: 500, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor() }, 
        series: [{ name: 'Tỷ lệ đúng', data: levelData.map(item => (item.accuracy * 100).toFixed(1)) }], 
        labels: levelData.map(item => item.level), 
        yaxis: { min: 0, max: 100, labels: { formatter: (val) => `${val}%` } }, 
        title: { text: 'Năng lực tư duy theo Cấp độ', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } }, 
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', y: { formatter: (val) => `${val}%` } },
        grid: { borderColor: '#555' },
        legend: { labels: { colors: getChartForeColor() } }
    };
    if (levelStrengthChart) { levelStrengthChart.updateOptions(options); } else { levelStrengthChart = new ApexCharts(levelStrengthChartContainer, options); levelStrengthChart.render(); }
}
    
    function renderLeaveCountChart(leaveData) {
    const options = { 
        chart: { type: 'bar', height: 350, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor() }, 
        series: [{ name: 'Số lần rời trang', data: leaveData.map(item => item.count) }], 
        xaxis: { categories: leaveData.map(item => item.examTitle) }, 
        yaxis: { labels: { formatter: (val) => Math.round(val) } }, 
        title: { text: 'Mức độ tập trung (Số lần rời trang)', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } }, 
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' },
        grid: { borderColor: '#555' }
    };
    if (leaveCountChart) { leaveCountChart.updateOptions(options); } else { leaveCountChart = new ApexCharts(leaveCountChartContainer, options); leaveCountChart.render(); }
}

    function renderDeviceUsageChart(deviceData) {
    const options = { 
        chart: { type: 'donut', height: 350, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor() }, 
        series: deviceData.map(item => item.count), 
        labels: deviceData.map(item => item.device), 
        title: { text: 'Thói quen sử dụng thiết bị', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } }, 
        legend: { position: 'bottom', labels: { colors: getChartForeColor() } }, 
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', y: { formatter: (val) => `${val} lần` } }
    };
    if (deviceUsageChart) { deviceUsageChart.updateOptions(options); } else { deviceUsageChart = new ApexCharts(deviceUsageChartContainer, options); deviceUsageChart.render(); }
}
    
    function renderStudyTimeChart(timeData) {
    const options = { 
        chart: { type: 'bar', height: 350, fontFamily: "'Be Vietnam Pro', sans-serif", foreColor: getChartForeColor() }, 
        series: [{ name: 'Số bài làm', data: timeData.map(item => item.count) }], 
        xaxis: { categories: timeData.map(item => item.timeSlot) }, 
        yaxis: { labels: { formatter: (val) => Math.round(val) } }, 
        plotOptions: { bar: { distributed: true, borderRadius: 4, horizontal: false, } }, 
        colors: ['#ef4444', '#f59e0b', '#22c55e', '#f59e0b', '#14b8a6', '#4f46e5', '#ef4444'], 
        legend: { show: false }, 
        title: { text: 'Phân bố Thời gian làm bài trong ngày', align: 'left', style: { fontSize: '18px', fontWeight: '600', color: getChartForeColor() } }, 
        tooltip: { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' },
        grid: { borderColor: '#555' }
    };
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

    function searchStudent() {
        const studentId = studentIdInput.value.trim();
        if (!studentId) {
           alert('Vui lòng nhập Mã số học sinh.');
            return;
        }
        window.location.href = `/StudentDetail.html?id=${studentId}`;
    }

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
        if (data.behaviorDetails?.fastWrong?.length > 0) content += `<li>Làm ẩu (sai nhanh): <strong>Câu ${data.behaviorDetails.fastWrong.join(', ')}</strong></li>`;
        if (data.behaviorDetails?.slowWrong?.length > 0) content += `<li>Lúng túng (sai chậm): <strong>Câu ${data.behaviorDetails.slowWrong.join(', ')}</strong></li>`;
        if (data.behaviorDetails?.changedAnswers?.length > 0) content += `<li>Phân vân (đổi đáp án): <strong>Câu ${data.behaviorDetails.changedAnswers.join(', ')}</strong></li>`;
        if (content === '<ul>') content += '<li>Không có ghi nhận hành vi nào đặc biệt.</li>';
        content += '</ul>';
        modalBody.innerHTML = content;
        behaviorModal.classList.remove('hidden');
    }
    
    function attachEventListeners() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        tabButtons.forEach(btn => btn.addEventListener('click', handleTabClick));
        
        historyTableBody.addEventListener('click', (event) => {
            if (event.target.classList.contains('action-btn-small')) {
                const itemIndex = event.target.dataset.index;
                if (currentStudentHistoryData && currentStudentHistoryData[itemIndex]) {
                    showBehaviorModal(currentStudentHistoryData[itemIndex]);
                }
            }
        });

        if(modalCloseBtn) modalCloseBtn.addEventListener('click', () => behaviorModal.classList.add('hidden'));
        if(behaviorModal) behaviorModal.addEventListener('click', (event) => {
            if (event.target === behaviorModal) behaviorModal.classList.add('hidden');
        });
        if(searchBtn) searchBtn.addEventListener('click', searchStudent);
        if(studentIdInput) studentIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchStudent();
        });
        
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                setTimeout(() => {
                    if (currentStudentData) {
                        console.log("Theme đã đổi, đang vẽ lại biểu đồ chi tiết...");
                        renderData(currentStudentData);
                    }
                }, 10);
            });
        }
    }

    // --- KHỞI CHẠY ---
    attachEventListeners();
    initializeDetailView();

}); // <-- DẤU NGOẶC ĐÓNG CUỐI CÙNG QUAN TRỌNG