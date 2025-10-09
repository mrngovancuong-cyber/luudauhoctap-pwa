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
  exam: null, // Khởi tạo exam là null
  questions: [], // Khởi tạo questions là mảng rỗng
  mode: 'practice', // Mặc định là practice
  started: false,
  timeLeft: 0, // Khởi tạo là 0, sẽ được cập nhật sau
  answers: {},
  perQuestion: {},
  leaveCount: 0,
  timerHandle: null,
  startTime: null,   
  student: { name:'', id:'', className:'', email:'' },
  submitted: false, 
  leaveTimestamps: [],
};

// Sửa lại hàm này để nó lấy examId từ state
const STORAGE_KEY = () => {
  if (!state.exam) return null; // Trả về null nếu chưa có đề
  return `${state.exam.examId}-${state.mode}-${state.student.id || 'UNKNOWN'}`;
};

// ===== Level helpers =====
const LEVEL_CANON = {
  'Nhận biết':'nhan_biet', 'Thông hiểu':'thong_hieu', 'Vận dụng':'van_dung', 'Vận dụng cao':'van_dung_cao',
  'nhan_biet':'nhan_biet','thong_hieu':'thong_hieu','van_dung':'van_dung','van_dung_cao':'van_dung_cao'
};
function levelKey(v){ return LEVEL_CANON[v] || 'khac'; }

// ===== Render =====
// <<<< THAY THẾ TOÀN BỘ HÀM renderExam() BẰNG CÁI NÀY >>>>
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

  // Vòng lặp forEach để tạo HTML
  exam.questions.forEach((q, idx) => {
    const imageHtml = q.imageUrl ? `<div class="media-container"><img src="${q.imageUrl}" alt="Hình ảnh minh họa" class="q-image"></div>` : '';
    const audioHtml = q.audioUrl ? ` <div class="media-container"><p class="media-instruction">Nghe đoạn âm thanh sau:</p><audio controls src="${q.audioUrl}" class="q-audio">Trình duyệt không hỗ trợ.</audio></div>` : '';
    let answerBlockHtml = '';
    const questionType = q.questionType || 'multiple_choice';
    switch (questionType) {
      case 'fill_blank':
        answerBlockHtml = `<div class="answer-container-fill-blank"><input type="text" name="${q.id}" id="ans-${q.id}" class="fill-blank-input" placeholder="Nhập câu trả lời..."></div>`;
        break;
      case 'multiple_choice':
      default:
        const answerOptions = ['A', 'B', 'C', 'D'];
        answerBlockHtml = q.answers.map((ans, ansIdx) => {
          const option = answerOptions[ansIdx];
          return `<label class="answer" for="ans-${q.id}-${option}"><input type="radio" name="${q.id}" id="ans-${q.id}-${option}" value="${option}"><span>${escapeHtml(ans)}</span></label>`;
        }).join('');
        break;
    }
    const questionCardHtml = `<div class="q-card" id="card-${q.id}" data-question-type="${questionType}"><div class="q-head"><div class="q-title">Câu ${idx + 1}: ${escapeHtml(q.question)}</div><div class="q-meta">Chủ đề: ${escapeHtml(q.topic)} | Cấp độ: ${escapeHtml(q.level)}</div></div>${imageHtml}${audioHtml}<div class="answers">${answerBlockHtml}</div><div class="explain-block" id="exp-${q.id}" hidden><strong>Giải thích:</strong><span class="explain"></span></div></div>`;
    questionsContainer.insertAdjacentHTML('beforeend', questionCardHtml);
    if(navigatorContainer){
        const navItemHtml = `<div class="nav-item" data-qid="${q.id}">${idx + 1}</div>`;
        navigatorContainer.insertAdjacentHTML('beforeend', navItemHtml);
    }
  });

  // === PHIÊN BẢN HOÀN CHỈNH: Điều phối tất cả theo đúng thứ tự ===
  function finalizeUI() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      console.log("Bắt đầu xử lý công thức toán bằng MathJax...");
      
      window.MathJax.typesetPromise()
        .then(() => {
          console.log("MathJax đã hoàn thành.");
          console.log("Bắt đầu khôi phục dữ liệu vào giao diện...");
          restoreLocal();
          console.log("Bắt đầu gắn các event listener...");
          attachDynamicListeners();
          console.log("Giao diện đã sẵn sàng.");
        })
        .catch((err) => {
          console.error('Lỗi xảy ra trong quá trình MathJax xử lý:', err);
          restoreLocal();
          attachDynamicListeners();
        });
    } else {
      setTimeout(finalizeUI, 150);
    }
  }
  finalizeUI();
}
  
// ===== EVENT HANDLING & DOM MANIPULATION =====

/**
 * Gắn tất cả các event listener cần thiết sau khi câu hỏi đã được render.
 */
function attachDynamicListeners() {
  console.log("Attaching dynamic event listeners...");

  // Tìm TẤT CẢ các input radio bên trong khu vực câu hỏi
  $$('#questions input[type="radio"]').forEach(input => {
    input.addEventListener('change', handleAnswerChange);
  });

  // Tìm TẤT CẢ các input text bên trong khu vực câu hỏi
  $$('#questions input[type="text"]').forEach(input => {
    // Sử dụng 'change' thay vì 'blur' cho nhất quán.
    // Sự kiện 'change' cho text input sẽ kích hoạt khi người dùng nhập xong và bỏ focus ra khỏi ô.
    input.addEventListener('change', handleAnswerChange);
  });

  // Navigator (giữ nguyên, không thay đổi)
  $$('#navigator .nav-item').forEach(item => {
    item.addEventListener('click', handleNavClick);
  });
}

/**
 * Xử lý chung khi một câu trả lời được thay đổi (cho cả trắc nghiệm và điền khuyết).
 */
function handleAnswerChange(e) {
  const input = e.target;
  const qid = input.name;
  let value;

  if (input.type === 'radio') {
    value = input.value;
  } else if (input.type === 'text') {
    value = input.value.trim();
  }

  if (value) {
    state.answers[qid] = value;
  } else {
    delete state.answers[qid];
  }

  handleAnswered(qid); // Ghi nhận hành vi
  paintNavigator();
  updateAnsweredCount();
}

/**
 * Xử lý khi người dùng nhấp vào một item trong navigator.
 */
function handleNavClick(e) {
  const qid = e.target.dataset.qid;
  const card = document.getElementById(`card-${qid}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    markCurrent(qid); // Đánh dấu câu hiện tại
    handleQuestionViewed(qid); // Ghi nhận hành vi xem câu hỏi
  }
}

/**
 * Đánh dấu câu hỏi hiện tại trong navigator.
 */
function markCurrent(qid){ 
  $$('#navigator .nav-item').forEach(el => {
    el.classList.toggle('current', el.dataset.qid === qid);
  }); 
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
  // Nếu đã có một timer đang chạy, hãy xóa nó đi để tránh chạy nhiều timer cùng lúc
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
  }

  // Nếu đây là LẦN ĐẦU TIÊN bắt đầu, hãy thiết lập trạng thái
  if (!state.started) {
    state.started = true;
    state.startTime = new Date().toISOString();
  }
  
  // Luôn luôn thực hiện việc đếm ngược khi hàm này được gọi
  tick(); // Gọi tick() ngay lập tức để cập nhật giao diện
  state.timerHandle = setInterval(tick, 1000);
  console.log("Timer đã bắt đầu hoặc được khởi động lại.");
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
  const key = STORAGE_KEY();
  if (!key) return; // Không lưu nếu chưa có key

  const payload = {
    examId: state.exam.examId, // Dùng state.exam
    mode: state.mode, student: state.student,
    answers: state.answers, perQuestion: state.perQuestion,
    timeLeft: state.timeLeft, started: state.started, startTime: state.startTime,
    lastSave: new Date().toISOString()
  };
  try { localStorage.setItem(key, JSON.stringify(payload)); }
  catch(e){ console.warn(e); }
}

// <<<< THAY THẾ HÀM restoreLocal() CŨ BẰNG CỤM 2 HÀM NÀY >>>>

// js/appF.js

// <<<< THAY THẾ TOÀN BỘ HÀM restoreLocal() BẰNG PHIÊN BẢN NÀY >>>>

function restoreLocal() {
  if (!state.exam) return;
  
  let key = STORAGE_KEY();
  if (!state.student.id){
    const pref = `${state.exam.examId}-${state.mode}-`;
    const existing = Object.keys(localStorage).find(k=>k.startsWith(pref));
    if (existing) key = existing;
  }
  
  const raw = localStorage.getItem(key);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (data.examId !== state.exam.examId) return;

    // Bước 1: Cập nhật toàn bộ dữ liệu vào state TRƯỚC TIÊN
    state.student = data.student || { name:'', id:'', className:'', email:'' };
    state.answers = data.answers || {};
    state.perQuestion = data.perQuestion || {};
    state.timeLeft = data.timeLeft || state.timeLeft;
    state.started = data.started || false;
    state.startTime = data.startTime || null;

    console.log("Đã khôi phục dữ liệu vào state từ Local Storage.", data);

    // Bước 2: Dựa vào state đã cập nhật, quyết định hiển thị các thành phần giao diện
    // Hiển thị phần thông tin học sinh NẾU có dữ liệu đã lưu
    if (state.student.name || state.student.id || state.student.className || state.student.email) {
        $('#student-info').hidden = false;
    }

    // Hiển thị các phần còn lại của bài thi NẾU bài thi đã bắt đầu
    if (state.started) {
      $('#questions').hidden = false;
      $('#navigator').hidden = false;
      $('#timer').hidden = false;
      $('#answer-progress').hidden = false;
      $('#end-controls').hidden = false;
    }

    // Bước 3: SAU KHI đã đảm bảo các thành phần được hiển thị,
    // gọi hàm để điền dữ liệu vào chúng.
    updateUIFromState();

    // Bước 4: Nếu bài thi đã bắt đầu, khởi động lại timer
    if (state.started) {
      startTimer();
    }

  } catch(e) { console.warn('Restore failed', e); }
}

function updateUIFromState() {
  // Cập nhật các ô input
  Object.keys(state.answers).forEach(qid => {
    const answer = state.answers[qid];
    const radioInput = document.querySelector(`input[name="${qid}"][value="${answer}"]`);
    if (radioInput) {
      radioInput.checked = true;
    }
    const textInput = document.querySelector(`input[name="${qid}"]`);
    if (textInput && textInput.type === 'text') {
      textInput.value = answer;
    }
  });

  // Cập nhật navigator và số câu đã trả lời
  paintNavigator();
  updateAnsweredCount();

  // Cập nhật thông tin học sinh
  if ($('#studentName')) $('#studentName').value = state.student.name;
  if ($('#studentId')) $('#studentId').value = state.student.id;
  if ($('#className')) $('#className').value = state.student.className;
  if ($('#email')) $('#email').value = state.student.email;
}

function clearLocal() {
  if (!state.exam) return; // Không xóa nếu chưa có đề

  try {
    const prefix = state.exam.examId; // Dùng state.exam
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
});