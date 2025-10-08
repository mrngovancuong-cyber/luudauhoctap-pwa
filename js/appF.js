console.log("--- PHIÊN BẢN CODE MỚI NHẤT ĐÃ ĐƯỢC TẢI ---");

const API_URL = "/api/";

// ===== Utils =====
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const fmtTime = (sec)=>`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
const getParam = (k, d=null)=> new URLSearchParams(location.search).get(k) ?? d;

// THAY THẾ HÀM loadExam HIỆN TẠI BẰNG PHIÊN BẢN NÀY
async function loadExam(examId) {
  console.log(`Đang gọi API để lấy đề thi ID: ${examId}`);
  try {
    const res = await fetch(`${API_URL}?action=getExamQuestions&examId=${examId}`);
    if (!res.ok) {
      throw new Error(`Server trả về lỗi HTTP: ${res.status}`);
    }
    
    const response = await res.json();
    if (!response.success) {
      throw new Error(response.message || "Lỗi không xác định từ API.");
    }
    
    const data = response.data;
    if (!data || !data.questions) {
      throw new Error("Dữ liệu trả về từ API không hợp lệ.");
    }
    
    console.log("Tải dữ liệu từ API thành công:", data);
    
    const urlMode = getParam('mode'); 
    const examDefaultMode = data.defaultMode || 'practice';
    state.mode = (urlMode === 'exam' || urlMode === 'practice') ? urlMode : examDefaultMode;
    console.log(`Chế độ làm bài được xác định là: ${state.mode}`);
        
    state.exam = data;
    state.questions = data.questions;
    state.timeLeft = (data.durationMinutes || 10) * 60; 
    
    renderExam();

  } catch (err) {
    console.error("Lỗi khi tải đề từ API:", err);
    // HIỂN THỊ LỖI RÕ RÀNG CHO NGƯỜI DÙNG
    const questionsContainer = document.getElementById('questions');
    if (questionsContainer) {
      questionsContainer.innerHTML = `
        <div class="card" style="text-align: center; color: var(--bad);">
          <h3>Không thể tải được đề bài</h3>
          <p>Lỗi: ${err.message}</p>
          <p>Vui lòng kiểm tra lại đường link hoặc kết nối mạng và thử lại.</p>
          <a href="/" class="action-btn btn-guide" style="text-decoration: none;">Quay về Trang chủ</a>
        </div>
      `;
    }
  }
}

// ===== State =====
let state = {
  mode: (getParam('mode','practice')==='exam') ? 'exam' : 'practice',
  started: false,
  timeLeft: MOCK_EXAM.durationMinutes*60,
  answers: {},
  perQuestion: {},
  leaveCount: 0,
  timerHandle: null,
  startTime: null,   
  student: { name:'', id:'', className:'', email:'' },
  submitted: false, 
  leaveTimestamps: [],
};
const STORAGE_KEY = ()=>`${MOCK_EXAM.examId}-${state.mode}-${state.student.id || 'UNKNOWN'}`;

// ===== Level helpers =====
const LEVEL_CANON = {
  'Nhận biết':'nhan_biet', 'Thông hiểu':'thong_hieu', 'Vận dụng':'van_dung', 'Vận dụng cao':'van_dung_cao',
  'nhan_biet':'nhan_biet','thong_hieu':'thong_hieu','van_dung':'van_dung','van_dung_cao':'van_dung_cao'
};
function levelKey(v){ return LEVEL_CANON[v] || 'khac'; }

// ===== Render =====
function renderExam() {
  const exam = state.exam;
  if (!exam || !exam.questions) {
    document.getElementById('questions').innerHTML = "<p>Lỗi: Không tải được câu hỏi.</p>";
    return;
  }

   // Cập nhật tiêu đề trang và tiêu đề chính
  const pageTitle = exam.title || 'Luyện tập và Kiểm tra';
  document.title = pageTitle;
  const examTitleEl = document.getElementById('examTitle');
  if (examTitleEl) {
    examTitleEl.textContent = pageTitle;
  }
 
  const questionsContainer = document.getElementById('questions');
  const navigatorContainer = document.getElementById('navigator-items');
  questionsContainer.innerHTML = "";
  if(navigatorContainer) navigatorContainer.innerHTML = "";

  const totalCountEl = document.getElementById('totalCount');
  if(totalCountEl) totalCountEl.textContent = exam.questions.length;

  // === THAY THẾ TOÀN BỘ VÒNG LẶP forEach BẰNG ĐOẠN NÀY ===
  exam.questions.forEach((q, idx) => {

    // ----- BƯỚC 1: LẮP RÁP CÁC LINH KIỆN MEDIA (NẾU CÓ) -----
    
    // Tạo HTML cho hình ảnh
    const imageHtml = q.imageUrl 
      ? `<div class="media-container"><img src="${q.imageUrl}" alt="Hình ảnh minh họa" class="q-image"></div>`
      : '';
      
    // Tạo HTML cho âm thanh
    const audioHtml = q.audioUrl
      ? ` <div class="media-container">
            <p class="media-instruction">Nghe đoạn âm thanh sau:</p>
            <audio controls src="${q.audioUrl}" class="q-audio">Trình duyệt không hỗ trợ.</audio>
          </div>`
      : '';

    // ----- BƯỚC 2: LẮP RÁP LINH KIỆN CÂU TRẢ LỜI (DỰA VÀO LOẠI CÂU HỎI) -----
    let answerBlockHtml = '';
    const questionType = q.questionType || 'multiple_choice'; // Mặc định là trắc nghiệm

    switch (questionType) {
      
      case 'fill_blank':
        answerBlockHtml = `
          <div class="answer-container-fill-blank">
            <input type="text" name="${q.id}" id="ans-${q.id}" class="fill-blank-input" placeholder="Nhập câu trả lời...">
          </div>
        `;
        break;

      // Thêm các case khác ở đây trong tương lai (matching, ordering...)
      
      case 'multiple_choice':
      default: // Mặc định sẽ là trắc nghiệm 4 lựa chọn
        const answerOptions = ['A', 'B', 'C', 'D'];
        answerBlockHtml = q.answers.map((ans, ansIdx) => {
          const option = answerOptions[ansIdx];
          return `
            <label class="answer" for="ans-${q.id}-${option}">
              <input type="radio" name="${q.id}" id="ans-${q.id}-${option}" value="${option}">
              <span>${escapeHtml(ans)}</span>
            </label>
          `;
        }).join('');
        break;
    }

    // ----- BƯỚC 3: LẮP RÁP THÀNH THẺ CÂU HỎI HOÀN CHỈNH -----
    const questionCardHtml = `
      <div class="q-card" id="card-${q.id}" data-question-type="${questionType}">
        <div class="q-head">
          <div class="q-title">Câu ${idx + 1}: ${escapeHtml(q.question)}</div>
          <div class="q-meta">Chủ đề: ${escapeHtml(q.topic)} | Cấp độ: ${escapeHtml(q.level)}</div>
        </div>
        
        ${imageHtml}
        ${audioHtml}
        
        <div class="answers">${answerBlockHtml}</div>

        <div class="explain-block" id="exp-${q.id}" hidden>
          <strong>Giải thích:</strong>
          <span class="explain"></span>
        </div>
      </div>
    `;
    
    questionsContainer.insertAdjacentHTML('beforeend', questionCardHtml);

    // Tạo navigator item (giữ nguyên)
    if(navigatorContainer){
        const navItemHtml = `<div class="nav-item" data-qid="${q.id}">${idx + 1}</div>`;
        navigatorContainer.insertAdjacentHTML('beforeend', navItemHtml);
    }
  });
  // =========================================================
  
  attachDynamicListeners(); // Gọi lại hàm để gắn event cho các input mới
// === THÊM ĐOẠN MÃ NÀY VÀO CUỐI HÀM ===
  // Kiểm tra xem MathJax đã được tải và sẵn sàng chưa
  if (typeof MathJax !== 'undefined' && MathJax.typeset) {
    console.log("Kích hoạt MathJax để vẽ lại công thức...");
    // Ra lệnh cho MathJax quét toàn bộ trang và vẽ lại công thức
    MathJax.typeset();
  }
  // =====================================
}

function attachDynamicListeners() {
  // Gắn sự kiện cho các câu hỏi trắc nghiệm
  $$('.q-card[data-question-type="multiple_choice"] input[type="radio"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const qid = e.target.name;
      state.answers[qid] = e.target.value;
      handleAnswered(qid);
      paintNavigator();
      updateAnsweredCount();
    });
  });

  // Gắn sự kiện cho các câu hỏi điền khuyết
  $$('.q-card[data-question-type="fill_blank"] input[type="text"]').forEach(input => {
    // Sự kiện 'blur' được kích hoạt khi người dùng click ra ngoài ô input
    input.addEventListener('blur', (e) => {
      const qid = e.target.name;
      const value = e.target.value.trim();
      if (value) { // Chỉ lưu nếu có nội dung
        state.answers[qid] = value;
        handleAnswered(qid);
        paintNavigator();
        updateAnsweredCount();
      } else { // Nếu xóa hết nội dung thì cũng xóa câu trả lời đã lưu
        delete state.answers[qid];
        paintNavigator();
        updateAnsweredCount();
      }
    });
  });

  $$('#navigator .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const qid = e.target.dataset.qid;
      const card = document.getElementById(`card-${qid}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        markCurrent(qid);
        handleQuestionViewed(qid);
      }
    });
  });
}

function markCurrent(qid){ 
  $$('#navigator .nav-item').forEach(el=>el.classList.toggle('current', el.dataset.qid===qid)); 
}

function handleQuestionViewed(qid){ 
  const now = Date.now(); 
  if (!state.perQuestion[qid]) state.perQuestion[qid]={}; 
  if (!state.perQuestion[qid].firstSeen) state.perQuestion[qid].firstSeen = now; 
  state.perQuestion[qid].start = now; 
}

/**
 * Ghi nhận hành vi khi học sinh trả lời một câu hỏi.
 * PHIÊN BẢN TỐI ƯU HÓA
 */
function handleAnswered(qid) {
  const now = Date.now();
  const pq = state.perQuestion[qid] || (state.perQuestion[qid] = {});

  // Khởi tạo các giá trị thời gian nếu chưa có
  if (!pq.firstSeen) pq.firstSeen = now;
  if (!pq.start) pq.start = now;
  
  // Ghi lại thời điểm trả lời (quan trọng cho suy luận "rời đi -> trả lời ngay")
  pq.answerTime = now;

  // Đếm tổng số lần chọn đáp án cho câu này
  pq.answerCount = (pq.answerCount || 0) + 1;
  
  // Từ answerCount, ta có thể suy ra số lần thay đổi
  // Không cần logic 'prev' phức tạp nữa.
  if (pq.answerCount > 1) {
    pq.changedAnswers = pq.answerCount - 1;
  } else {
    pq.changedAnswers = 0;
  }
  
  // Tính và cộng dồn thời gian suy nghĩ (tính từ lần tương tác gần nhất)
  const spentSeconds = Math.max(1, Math.floor((now - pq.start) / 1000));
  pq.timeSpent = (pq.timeSpent || 0) + spentSeconds;
  
  // Reset lại thời gian bắt đầu cho lần tương tác tiếp theo với câu hỏi này
  pq.start = now;
}

function paintNavigator(){ 
  const answered = new Set(Object.keys(state.answers)); 
  $$('#navigator .nav-item').forEach(el=>{ 
    const done = answered.has(el.dataset.qid); 
    el.classList.toggle('answered', done); 
  }); 
}

function updateAnsweredCount(){ 
  const el = $('#answeredCount'); 
  if (!el) return; 
  el.textContent = Object.keys(state.answers).length; 
}

function startTimer(){
  if (state.started) return;
  state.started = true;
  state.startTime = new Date().toISOString();
  tick();
  state.timerHandle = setInterval(tick,1000);
  window.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
}

function tick(){
  state.timeLeft = Math.max(0, state.timeLeft-1);
  const t = $('#timer');
  if (t) t.textContent = fmtTime(state.timeLeft);
  const warn = $('#timeWarn');
  if (warn && state.timeLeft === 300) warn.hidden = false;
  if (state.timeLeft === 0) submitExam(true);
}

// ===== LOGIC THEO DÕI RỜI CỬA SỔ (PHIÊN BẢN NÂNG CẤP) =====
let leaveStartTime = 0;

function handleLeave() {
  // Chỉ ghi nhận nếu chưa có lần rời đi nào đang được tính
  if (leaveStartTime === 0) {
    leaveStartTime = Date.now();
    // console.log("Bắt đầu rời cửa sổ...");
  }
}

function handleReturn() {
  // Chỉ ghi nhận nếu có một lần rời đi đang được tính
  if (leaveStartTime > 0) {
    const leaveDuration = Date.now() - leaveStartTime;
    // console.log(`Quay lại sau ${leaveDuration}ms`);

    // CHỈ TÍNH LÀ "RỜI ĐI" THỰC SỰ NẾU THỜI GIAN VẮNG MẶT > 2 GIÂY
    if (leaveDuration > 2000) { 
      state.leaveCount++;
      state.leaveTimestamps.push({ 
        start: new Date(leaveStartTime).toISOString(),
        durationSeconds: Math.round(leaveDuration / 1000)
      });
      // console.log("Ghi nhận một lần rời cửa sổ hợp lệ. Tổng số: ", state.leaveCount);
    } else {
      // console.log("Rời đi quá ngắn, không tính.");
    }
    
    // Reset lại để có thể theo dõi lần tiếp theo
    leaveStartTime = 0;
  }
}

// Gắn sự kiện
// 'blur' và 'visibilitychange' khi ẩn trang -> Bắt đầu tính giờ
window.addEventListener('blur', handleLeave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    handleLeave();
  } else {
    handleReturn();
  }
});

// 'focus' khi quay lại trang -> Dừng tính giờ
window.addEventListener('focus', handleReturn);

function persistLocal(){
  const payload = {
    examId: MOCK_EXAM.examId, mode: state.mode, student: state.student,
    answers: state.answers, perQuestion: state.perQuestion,
    timeLeft: state.timeLeft, started: state.started, startTime: state.startTime,
    lastSave: new Date().toISOString()
  };
  try { localStorage.setItem(STORAGE_KEY(), JSON.stringify(payload)); }
  catch(e){ console.warn(e); }
}

function restoreLocal(){
  let key = STORAGE_KEY();
  if (!state.student.id){
    const pref = `${MOCK_EXAM.examId}-${state.mode}-`;
    const existing = Object.keys(localStorage).find(k=>k.startsWith(pref));
    if (existing) key = existing;
  }
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try{
    const data = JSON.parse(raw);
    if (data.examId !== MOCK_EXAM.examId) return;
    state.student = data.student || state.student;
    state.answers = data.answers || {};
    state.perQuestion = data.perQuestion || {};
    state.timeLeft = data.timeLeft ?? state.timeLeft;
    state.started = data.started || false;
    state.startTime = data.startTime || null;
    state.mode = data.mode || state.mode;
    if ($('#studentName')) $('#studentName').value = state.student.name || '';
    if ($('#studentId')) $('#studentId').value = state.student.id || '';
    if ($('#className')) $('#className').value = state.student.className || '';
    if ($('#email')) $('#email').value = state.student.email || '';
    Object.entries(state.answers).forEach(([qid,opt])=>{
      const input = document.querySelector(`input[name="${qid}"][value="${opt}"]`);
      if (input) input.checked = true;
    });
    updateAnsweredCount();
    paintNavigator();
  }catch(e){ console.warn('Restore failed', e); }
}

function clearLocal() {
  try {
    const prefix = MOCK_EXAM.examId;
    for (let k in localStorage) {
      if (k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch(e) {}
}

function readStudent(){
  if ($('#studentName')) state.student.name = $('#studentName').value.trim();
  if ($('#studentId')) state.student.id = $('#studentId').value.trim();
  if ($('#className')) state.student.className = $('#className').value.trim();
  if ($('#email')) state.student.email = $('#email').value.trim();
}

function validateBeforeSubmit(){
  readStudent();
  const missing=[];
  if (!state.student.name) missing.push('Họ và tên');
  if (!state.student.id) missing.push('Mã học sinh');
  if (!state.student.className) missing.push('Lớp');
  if (missing.length){
    alert('Vui lòng điền: '+missing.join(', '));
    return false;
  }
  
  // SỬA DÒNG NÀY: Dùng state.exam.questions thay vì MOCK_EXAM.questions
  const total = state.exam.questions.length;
  const answered = Object.keys(state.answers).length;
  
  if (answered < total){
    return confirm(`Em còn ${total - answered} câu chưa trả lời. Em vẫn muốn nộp luôn?`);
  }
  return true;
}


function getSimpleDeviceInfo(){
  const ua = navigator.userAgent || '';
  let os = 'khác', browser = 'khác';
  if (/Windows/i.test(ua)) os='Windows';
  else if (/Android/i.test(ua)) os='Android';
  else if (/iPhone|iPad|iOS/i.test(ua)) os='iOS';
  else if (/Mac OS X/i.test(ua)) os='macOS';
  else if (/Linux/i.test(ua)) os='Linux';
  if (/Edg\//i.test(ua)) browser='Edge';
  else if (/Chrome\//i.test(ua)) browser='Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser='Safari';
  else if (/Firefox\//i.test(ua)) browser='Firefox';
  return `${browser} trên ${os}`;
}

// ===== Submit - PHIÊN BẢN CUỐI CÙNG =====
async function submitExam(auto = false) {
  if (state.submitted) return;
  if (!auto && !validateBeforeSubmit()) return;

  setButtonsDisabled(true);
  state.submitted = true;
  clearInterval(state.timerHandle);

  const resultCard = $('#resultCard');
  const resultSummary = $('#resultSummary');
  const feedbackEl = $('#feedback');
  
  if(resultSummary) resultSummary.innerHTML = '<p>Đang nộp bài và chấm điểm, vui lòng chờ...</p>';
  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Thu thập dữ liệu để gửi đi (giữ nguyên)
  const elapsed = (state.exam.durationMinutes * 60 - state.timeLeft);
  const device = getSimpleDeviceInfo();
  const submissionPayload = {
    examId: state.exam.examId,
    student: state.student,
    answers: state.answers,
    perQuestion: state.perQuestion,
    leaveCount: state.leaveCount,
    leaveTimestamps: state.leaveTimestamps,
    timeSpent: elapsed,
    device: device,
    startTime: state.startTime
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      // KHÔNG CÒN 'mode: no-cors' nữa
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(submissionPayload),
    });

    if (!response.ok) {
      throw new Error(`Lỗi mạng: ${response.statusText}`);
    }
    
    const result = await response.json(); // Bây giờ có thể đọc được JSON
    if (!result.success) {
      throw new Error(result.message || "Server trả về lỗi không xác định.");
    }
    
    const serverData = result.data;
    console.log("Kết quả chi tiết từ server:", serverData);
    
    // Hiển thị điểm số
    if (resultSummary) {
      resultSummary.innerHTML = `
        <p>Điểm: <strong>${serverData.score}/10</strong> (${serverData.correctCount}/${serverData.totalQuestions} câu đúng)</p>
      `;
    }

    // Hiển thị nhận xét chi tiết
    if (feedbackEl) {
      feedbackEl.innerHTML = serverData.feedback;
    }
    
    // Hiển thị đáp án và lời giải
    if (serverData.fullQuestionsData) {
        const questionsData = serverData.fullQuestionsData;
        Object.keys(questionsData).forEach(qId => {
            const qData = questionsData[qId];
            const exp = document.getElementById(`exp-${qId}`);
            const card = document.getElementById(`card-${qId}`);
            if (!exp || !card) return;

            exp.hidden = false;
            const studentAnswer = state.answers[qId];
            
            if (studentAnswer === qData.correct) {
                exp.innerHTML = `<strong>Đúng!</strong> ${escapeHtml(qData.explain)}`;
                card.classList.add('correct');
            } else if (studentAnswer) {
                exp.innerHTML = `<strong>Sai.</strong> Đáp án đúng là <strong>${qData.correct}</strong>. <br><em>Giải thích:</em> ${escapeHtml(qData.explain)}`;
                card.classList.add('incorrect');
            } else {
                exp.innerHTML = `<strong>Chưa trả lời.</strong> Đáp án đúng là <strong>${qData.correct}</strong>. <br><em>Giải thích:</em> ${escapeHtml(qData.explain)}`;
            }
        });
    }
    
    clearLocal();

  } catch (error) {
    console.error('Lỗi khi nộp bài:', error);
    if (resultSummary) {
      resultSummary.innerHTML = `
        <h3>Có lỗi xảy ra!</h3>
        <p>Không thể nộp bài của em. Lỗi: ${error.message}</p>
        <p>Vui lòng kiểm tra lại kết nối mạng và thử lại.</p>
      `;
    }
    setButtonsDisabled(false); // Cho phép thử lại nếu lỗi
    state.submitted = false;
  }
}

// Dán hàm này vào ngay sau hàm submitExam
function setButtonsDisabled(disabled) {
  ['#btn-submit', '#btn-save', '#btn-clear', '#btn-start'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      if (disabled) {
        el.setAttribute('disabled', 'disabled');
      } else {
        el.removeAttribute('disabled');
      }
    }
  });
}

// ===== Wire events =====
function wireEvents(){
  $('#btn-start')?.addEventListener('click', ()=>{
    $('#student-info').hidden = false;
    $('#questions').hidden = false;
    $('#navigator').hidden = false;
    $('#timer').hidden = false;
    $('#answer-progress').hidden = false;
    $('#end-controls').hidden = false;
    startTimer();
  });

  $('#btn-submit')?.addEventListener('click', ()=>{ submitExam(false); });
  $('#btn-save')?.addEventListener('click', ()=>{ persistLocal(); alert('Đã lưu tạm.'); });
  $('#btn-clear')?.addEventListener('click', ()=>{ clearLocal(); alert('Đã xoá dữ liệu tạm.'); });
  $('#btn-guidelines')?.addEventListener('click', ()=>{
    const g = $('#guidelines');
    if(g) g.hidden = !g.hidden;
  });
}

function escapeHtml(str){
  if (typeof str !== 'string') return '';
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
  // initMode(); // <-- Dòng này được xóa là ĐÚNG, vì logic đã chuyển vào loadExam

  const examId = getParam("examId"); // Lấy examId từ URL

  if (examId) {
    loadExam(examId); // Chỉ tải đề khi có examId
  } else {
    // Xử lý trường hợp không có examId trên URL
    const questionsContainer = document.getElementById('questions');
    if (questionsContainer) {
      questionsContainer.innerHTML = `
        <div class="card" style="text-align: center;">
          <h3>Lỗi: Không tìm thấy mã đề bài.</h3>
          <p>Vui lòng kiểm tra lại đường link hoặc quay trở lại trang chủ.</p>
          <a href="/" class="action-btn btn-start" style="text-decoration: none;">Về Trang chủ</a>
        </div>
      `;
    }
  }

  wireEvents(); // <-- Dòng này BẮT BUỘC phải có để các nút hoạt động
  
  restoreLocal(); // Bạn có thể bật lại dòng này nếu muốn có tính năng phục hồi bài làm dở dang
});