document.addEventListener('DOMContentLoaded', () => {
    // --- KHAI BÁO CÁC PHẦN TỬ DOM ---
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    const resultSection = document.getElementById('result-section');
    const loadingSpinner = document.getElementById('loading-spinner');
    const studentNameDisplay = document.getElementById('student-name-display');
    const studentClassDisplay = document.getElementById('student-class-display');
    const scoreTrendChartContainer = document.getElementById('score-trend-chart');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const historyTableBody = document.querySelector('#history table tbody');
    // ... ngay sau historyTableBody ...
    const topicStrengthChartContainer = document.getElementById('topic-strength-chart');
    const levelStrengthChartContainer = document.getElementById('level-strength-chart');
    const leaveCountChartContainer = document.getElementById('leave-count-chart');
    const deviceUsageChartContainer = document.getElementById('device-usage-chart');
    const behaviorModal = document.getElementById('behavior-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    // Khai báo các biến để giữ đối tượng biểu đồ
    let topicStrengthChart = null;
    let levelStrengthChart = null;
    let leaveCountChart = null;
    let deviceUsageChart = null;

    // Khởi tạo biểu đồ, nhưng chưa có dữ liệu
    let scoreTrendChart = null;

    // --- API URL ---
    const API_URL = '/api/';

    // --- CÁC HÀM XỬ LÝ ---

    /**
     * Hàm chính để tìm kiếm và hiển thị dữ liệu
     */
    async function searchStudent() {
        const studentId = studentIdInput.value.trim();
        if (!studentId) {
            alert('Vui lòng nhập Mã số học sinh.');
            return;
        }

        console.log(`Bắt đầu tìm kiếm dữ liệu cho học sinh có mã: ${studentId}`);
        showLoading(true); // Hiển thị spinner
        resultSection.classList.add('hidden'); // Ẩn kết quả cũ (nếu có)

        try {
            const response = await fetch(`${API_URL}?action=getStudentAnalytics&studentId=${studentId}`);
            if (!response.ok) {
                throw new Error(`Lỗi mạng: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message);
            }

            console.log("Dữ liệu nhận được từ API:", result.data);
            renderData(result.data); // Gọi hàm để hiển thị dữ liệu

        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu phân tích:", error);
            alert(`Không thể tải dữ liệu: ${error.message}`);
        } finally {
            showLoading(false); // Luôn ẩn spinner sau khi xong
        }
    }

    /**
     * Hiển thị hoặc ẩn spinner
     * @param {boolean} isLoading 
     */
    function showLoading(isLoading) {
        if (isLoading) {
            loadingSpinner.classList.remove('hidden');
        } else {
            loadingSpinner.classList.add('hidden');
        }
    }
    
    /**
     * Hiển thị dữ liệu nhận được lên giao diện
     * @param {object} data - Dữ liệu phân tích từ API
     */
    function renderData(data) {
        if (!data || !data.profile) {
            alert("Dữ liệu trả về không hợp lệ.");
            return;
        }

        // 1. Hiển thị thông tin cá nhân ----
        studentNameDisplay.textContent = data.profile.name;
        studentClassDisplay.textContent = `Lớp: ${data.profile.class}`;

        // 2. Vẽ biểu đồ xu hướng điểm ----
        renderScoreTrendChart(data.overview.scoreTrend);
        
        // (Trong các bước sau, chúng ta sẽ render các tab khác ở đây)
	// 3. Hiển thị bảng Lịch sử làm bài ----
    	renderHistoryTable(data.history);
        
	// 4. Tab Phân tích Năng lực ----
 	renderTopicStrengthChart(data.skills.byTopic);
	renderLevelStrengthChart(data.skills.byLevel);

        // 5. Tab Phân tích Hành vi ----
	renderLeaveCountChart(data.behavior.leaveCountTrend);
	renderDeviceUsageChart(data.behavior.deviceUsage);

	// 6. Hiển thị khu vực kết quả
        resultSection.classList.remove('hidden');
    }

    /**
     * Vẽ biểu đồ đường thể hiện xu hướng điểm số
     * @param {Array} scoreData - Mảng dữ liệu điểm [{examTitle, score}]
     */
    function renderScoreTrendChart(scoreData) {
        const options = {
            chart: {
                type: 'line',
                height: 350,
                foreColor: '#e5e7eb', // Màu chữ
		zoom: { enabled: true }
            },
            series: [{
                name: 'Điểm số',
                data: scoreData.map(item => item.score) // Chỉ lấy mảng điểm số
            }],
            xaxis: {
                categories: scoreData.map(item => item.examTitle) // Tên các bài thi
            },
            yaxis: {
                min: 0,
                max: 10
            },
            stroke: {
                curve: 'smooth',
            },
            title: {
                text: 'Xu hướng Điểm số qua các bài làm',
                align: 'left',
                style: {
                    fontSize: '18px',
                    color: '#f3e9e0' // Màu text tiêu đề
                }
            },
            grid: {
                borderColor: '#374151' // Màu đường lưới
            },
            tooltip: {
              theme: 'dark'
            }
        };

        // Nếu biểu đồ đã tồn tại, cập nhật nó. Nếu chưa, tạo mới.
        if (scoreTrendChart) {
            scoreTrendChart.updateOptions(options);
        } else {
            scoreTrendChart = new ApexCharts(scoreTrendChartContainer, options);
            scoreTrendChart.render();
        }
    }

/**
 * Xử lý sự kiện khi click vào một nút tab
 * @param {Event} event 
 */
function handleTabClick(event) {
    // Xóa class 'active' khỏi tất cả các nút
    tabButtons.forEach(btn => btn.classList.remove('active'));
    // Thêm class 'active' vào nút vừa được click
    event.target.classList.add('active');

    // Lấy data-tab của nút được click (ví dụ: "history")
    const targetTab = event.target.dataset.tab;

    // Ẩn tất cả các panel nội dung
    tabPanels.forEach(panel => {
        if (panel.id === targetTab) {
            panel.classList.remove('hidden'); // Hiển thị panel tương ứng
        } else {
            panel.classList.add('hidden');    // Ẩn các panel khác
        }
    });
}

/**
 * Điền dữ liệu vào bảng Lịch sử làm bài
 * @param {Array} historyData - Mảng dữ liệu lịch sử từ API
 */
function renderHistoryTable(historyData) {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';
    if (!historyData || historyData.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="6">Không có dữ liệu lịch sử.</td></tr>';
        return;
    }

    historyData.forEach((item, index) => {
        const row = document.createElement('tr');
        // Thêm một cột mới cho nút "Hành động"
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

    // Gắn sự kiện cho các nút "Xem chi tiết" vừa được tạo
    document.querySelectorAll('.action-btn-small').forEach(button => {
        button.addEventListener('click', (event) => {
            const itemIndex = event.target.dataset.index;
            const behaviorData = historyData[itemIndex];
            showBehaviorModal(behaviorData);
        });
    });
}

/**
 * Vẽ biểu đồ cột thể hiện độ vững kiến thức theo Chủ đề
 * @param {Array} topicData - Mảng dữ liệu [{topic, accuracy}]
 */
function renderTopicStrengthChart(topicData) {
    const options = {
        chart: { type: 'bar', height: 350, foreColor: '#e5e7eb', zoom: { enabled: true } },
        series: [{ name: 'Tỷ lệ đúng', data: topicData.map(item => (item.accuracy * 100).toFixed(1)) }],
        xaxis: { categories: topicData.map(item => item.topic) },
        yaxis: { min: 0, max: 100, labels: { formatter: (val) => `${val}%` } },
        plotOptions: { bar: { horizontal: true } }, // Biểu đồ cột ngang dễ đọc hơn khi có nhiều chủ đề
        title: { text: 'Độ vững kiến thức theo Chủ đề', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
        grid: { borderColor: '#374151' },
        tooltip: { theme: 'dark', y: { formatter: (val) => `${val}%` } }
    };
    if (topicStrengthChart) { topicStrengthChart.updateOptions(options); } 
    else { topicStrengthChart = new ApexCharts(topicStrengthChartContainer, options); topicStrengthChart.render(); }
}

/**
 * Vẽ biểu đồ radar thể hiện năng lực theo Cấp độ
 * @param {Array} levelData - Mảng dữ liệu [{level, accuracy}]
 */
function renderLevelStrengthChart(levelData) {
    // Sắp xếp lại cấp độ cho đúng logic: Nhận biết -> Vận dụng cao
    const levelOrder = ["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"];
    levelData.sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));

    const options = {
        chart: { type: 'radar', height: 350, foreColor: '#e5e7eb', zoom: { enabled: true } },
        series: [{ name: 'Tỷ lệ đúng', data: levelData.map(item => (item.accuracy * 100).toFixed(1)) }],
        labels: levelData.map(item => item.level),
        yaxis: { min: 0, max: 100, labels: { formatter: (val) => `${val}%` } },
        title: { text: 'Năng lực tư duy theo Cấp độ', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
        stroke: { width: 2 },
        fill: { opacity: 0.1 },
        markers: { size: 4 },
        tooltip: { theme: 'dark', y: { formatter: (val) => `${val}%` } }
    };
    if (levelStrengthChart) { levelStrengthChart.updateOptions(options); }
    else { levelStrengthChart = new ApexCharts(levelStrengthChartContainer, options); levelStrengthChart.render(); }
}

/**
 * Vẽ biểu đồ cột thể hiện số lần rời trang qua các bài
 * @param {Array} leaveData - Mảng dữ liệu [{examTitle, count}]
 */
function renderLeaveCountChart(leaveData) {
    const options = {
        chart: { type: 'bar', height: 350, foreColor: '#e5e7eb', zoom: { enabled: true } },
        series: [{ name: 'Số lần rời trang', data: leaveData.map(item => item.count) }],
        xaxis: { categories: leaveData.map(item => item.examTitle) },
        yaxis: { labels: { formatter: (val) => Math.round(val) } }, // Chỉ hiển thị số nguyên
        title: { text: 'Mức độ tập trung (Số lần rời trang)', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
        grid: { borderColor: '#374151' },
        tooltip: { theme: 'dark' }
    };
    if (leaveCountChart) { leaveCountChart.updateOptions(options); }
    else { leaveCountChart = new ApexCharts(leaveCountChartContainer, options); leaveCountChart.render(); }
}

/**
 * Vẽ biểu đồ tròn thể hiện tỷ lệ sử dụng thiết bị
 * @param {Array} deviceData - Mảng dữ liệu [{device, count}]
 */
function renderDeviceUsageChart(deviceData) {
    const options = {
        chart: { type: 'donut', height: 350, foreColor: '#e5e7eb', zoom: { enabled: true }, toolbar: { show: true } },
        series: deviceData.map(item => item.count),
        labels: deviceData.map(item => item.device),
        title: { text: 'Thói quen sử dụng thiết bị', align: 'left', style: { fontSize: '18px', color: '#f3e9e0' } },
        legend: { position: 'bottom' },
        tooltip: { theme: 'dark', y: { formatter: (val) => `${val} lần` } }
    };
    if (deviceUsageChart) { deviceUsageChart.updateOptions(options); }
    else { deviceUsageChart = new ApexCharts(deviceUsageChartContainer, options); deviceUsageChart.render(); }
}

function showBehaviorModal(data) {
    modalTitle.textContent = `Phân tích Hành vi: ${data.examTitle}`;
    
    let content = '<ul>';
    if (data.behaviorDetails.fastWrong.length > 0) {
        content += `<li>Làm ẩu (sai nhanh): <strong>Câu ${data.behaviorDetails.fastWrong.join(', ')}</strong></li>`;
    }
    if (data.behaviorDetails.slowWrong.length > 0) {
        content += `<li>Lúng túng (sai chậm): <strong>Câu ${data.behaviorDetails.slowWrong.join(', ')}</strong></li>`;
    }
    if (data.behaviorDetails.changedAnswers.length > 0) {
        content += `<li>Phân vân (đổi đáp án): <strong>Câu ${data.behaviorDetails.changedAnswers.join(', ')}</strong></li>`;
    }
    if (content === '<ul>') {
        content += '<li>Không có ghi nhận hành vi nào đặc biệt.</li>';
    }
    content += '</ul>';
    
    modalBody.innerHTML = content;
    behaviorModal.classList.remove('hidden');
}
    // --- GẮN SỰ KIỆN ---
    searchBtn.addEventListener('click', searchStudent);
    
    // Gắn sự kiện cho các nút tab
    tabButtons.forEach(btn => {
        btn.addEventListener('click', handleTabClick);
    });

    // Cho phép nhấn Enter để tìm kiếm
    studentIdInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchStudent();
        }
    });

// Dán vào khu vực GẮN SỰ KIỆN ở cuối file
modalCloseBtn.addEventListener('click', () => {
    behaviorModal.classList.add('hidden');
});

// Cho phép đóng modal khi click ra ngoài
behaviorModal.addEventListener('click', (event) => {
    if (event.target === behaviorModal) {
        behaviorModal.classList.add('hidden');
    }
});