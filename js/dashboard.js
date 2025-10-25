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

    // =================================================================
    //                    LUỒNG KHỞI TẠO CHÍNH
    // =================================================================
    async function main() {
        const token = localStorage.getItem('authToken');
        if (!token) {
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
            await fetchAndDisplayClassOverview(examSelect.value);

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

    async function fetchAndDisplayClassOverview(examId, classId = null) {
        showLoading(true);
        classOverviewSection.classList.add('hidden');
        try {
            const params = { examId };
            if (classId) params.classId = classId;
            const result = await fetchApi('getClassAnalytics', params);
            renderClassOverview(result.data);
            classOverviewSection.classList.remove('hidden');
        } catch (error) {
            handleApiError(error, "Không thể tải dữ liệu tổng quan");
        } finally {
            showLoading(false);
        }
    }

    function renderClassOverview(data) {
        // 1. Xây dựng HTML cho thẻ KPI "Tham gia" một cách linh hoạt
let participationHtml = `<div class="kpi-card"><h3>Số HS đã nộp</h3><p>${data.kpis.participantCount}</p>`;
if (data.kpis.totalAssignedStudents !== null) {
    // Nếu có mẫu số, hiển thị nó
    participationHtml += `<span class="kpi-subtext">/ ${data.kpis.totalAssignedStudents} em được giao</span>`;
}
participationHtml += `</div>`;

// 2. Ghép với các thẻ KPI khác
kpisContainer.innerHTML = `
    ${participationHtml}
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
        
        const createStudentListItem = s => `<li data-studentid="${s.id}" class="student-link" title="Xem chi tiết ${s.name}"><span>${s.name} (${s.id})</span><span class="score">${s.score}</span></li>`;
        topPerformersList.innerHTML = data.topPerformers.map(createStudentListItem).join('') || '<li>Không có dữ liệu.</li>';
        bottomPerformersList.innerHTML = data.bottomPerformers.map(createStudentListItem).join('') || '<li>Không có dữ liệu.</li>';
        
        // Gắn sự kiện click cho các item học sinh vừa được tạo
        document.querySelectorAll('.student-link').forEach(item => {
            item.addEventListener('click', () => {
                const studentId = item.dataset.studentid;
                if (studentId) {
                    window.location.href = `/StudentDetail.html?id=${studentId}`;
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
    
    function searchStudent() {
        const studentId = studentIdInput.value.trim();
        if (!studentId) {
            alert('Vui lòng nhập Mã số học sinh.');
            return;
        }
        window.location.href = `/StudentDetail.html?id=${studentId}`;
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
        examSelect.addEventListener('change', () => fetchAndDisplayClassOverview(examSelect.value));
        searchBtn.addEventListener('click', searchStudent);
        studentIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchStudent();
        });
    }

    // --- BẮT ĐẦU CHẠY ỨNG DỤNG ---
    main();
});