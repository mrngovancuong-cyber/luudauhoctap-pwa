document.addEventListener('DOMContentLoaded', () => {
    // --- KHAI BÁO CÁC PHẦN TỬ DOM ---
    const searchBtn = document.getElementById('search-btn');
    const studentIdInput = document.getElementById('student-id-input');
    const resultSection = document.getElementById('result-section');
    const loadingSpinner = document.getElementById('loading-spinner');
    const studentNameDisplay = document.getElementById('student-name-display');
    const studentClassDisplay = document.getElementById('student-class-display');
    const scoreTrendChartContainer = document.getElementById('score-trend-chart');

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

        // 1. Hiển thị thông tin cá nhân
        studentNameDisplay.textContent = data.profile.name;
        studentClassDisplay.textContent = `Lớp: ${data.profile.class}`;

        // 2. Vẽ biểu đồ xu hướng điểm
        renderScoreTrendChart(data.overview.scoreTrend);
        
        // (Trong các bước sau, chúng ta sẽ render các tab khác ở đây)

        // 3. Hiển thị khu vực kết quả
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
                foreColor: '#e5e7eb' // Màu chữ
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

    // --- GẮN SỰ KIỆN ---
    searchBtn.addEventListener('click', searchStudent);
    
    // Cho phép nhấn Enter để tìm kiếm
    studentIdInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchStudent();
        }
    });
});