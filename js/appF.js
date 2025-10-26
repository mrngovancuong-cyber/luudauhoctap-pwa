console.log("--- PHIÊN BẢN CODE MỚI NHẤT ĐÃ ĐƯỢC TẢI ---");

const API_URL = "/api/";

// ===== Utils =====
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const fmtTime = (sec)=>`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
const getParam = (k, d=null)=> new URLSearchParams(location.search).get(k) ?? d;

// ===== Hàm trợ giúp cho Loading Overlay =====
const loadingOverlay = $('#loading-overlay');
const loadingText = $('#loading-text');

function showLoader(text) {
  // Chúng ta sẽ phải tìm lại các phần tử ở đây vì script có thể chạy trước khi DOM sẵn sàng
  const overlay = document.getElementById('loading-overlay');
  const textEl = document.getElementById('loading-text');
  
  if (overlay && textEl) {
    textEl.textContent = text;
    overlay.classList.remove('hidden');
  }
}

function hideLoader() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// ===== Hàm trợ giúp cho Toast Notification =====
let toastTimeout; // Biến để quản lý việc tự động ẩn

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  if (!toast || !toastMessage) return;

  // Xóa timeout cũ nếu có, để tránh việc toast biến mất sớm
  clearTimeout(toastTimeout);

  // Cập nhật nội dung và loại toast
  toastMessage.textContent = message;
  toast.className = 'toast'; // Reset class
  toast.classList.add(type); // Thêm class loại (success, error, info)
  
  // Hiển thị toast
  toast.classList.add('show');

  // Tự động ẩn sau một khoảng thời gian
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// THAY THẾ HÀM loadExam HIỆN TẠI BẰNG PHIÊN BẢN NÀY
async function loadExam(examId) {
  console.log(`Đang gọi API để lấy đề thi ID: ${examId}`);
  showLoader('Đang tải đề thi...'); // <<--- HIỂN THỊ	  
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
  } finally {
    hideLoader(); // <<--- ẨN
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
  endTime: null, // <<--- THÊM DÒNG NÀY
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

// <<<< THAY THẾ TOÀN BỘ HÀM renderExam() BẰNG PHIÊN BẢN NÀY >>>>

function renderExam() {
  const exam = state.exam;
  if (!exam || !exam.questions) {
    // Xử lý trường hợp không tải được đề
    const questionsContainer = document.getElementById('questions');
    if (questionsContainer) {
      questionsContainer.innerHTML = `
        <div class="card" style="text-align: center; color: var(--bad);">
          <h3>Lỗi: Không tải được câu hỏi.</h3>
          <p>Dữ liệu đề bài nhận về không hợp lệ.</p>
        </div>
      `;
    }
    return;
  }

  // --- Cập nhật thông tin chung của trang ---
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

  // --- Vòng lặp chính để tạo HTML cho từng câu hỏi ---
  exam.questions.forEach((q, idx) => {
    
    // ===== ĐẢM BẢO 3 DÒNG NÀY LUÔN CÓ Ở ĐÂY =====
    let imageHtml = '';
    let audioHtml = '';
    let videoHtml = '';

// Chỉ xử lý nếu q.imageUrl thực sự có giá trị
if (q.imageUrl) {
    const imageUrlFromData = q.imageUrl;
    
    // Kiểm tra xem nó có phải là một URL đầy đủ hay không
    const isFullUrl = imageUrlFromData.startsWith('http://') || imageUrlFromData.startsWith('https://');
    
    // Xây dựng src dựa trên kết quả kiểm tra
    const imageSrc = isFullUrl
      ? imageUrlFromData 
      : `/api/gdrive-proxy/${imageUrlFromData}`;

    // Tạo HTML hoàn chỉnh, vẫn giữ nguyên cơ chế lazy loading
    imageHtml = `
        <div class="media-container">
            <img data-src="${imageSrc}" alt="Hình ảnh minh họa cho câu hỏi" class="q-image lazy-image">
        </div>
    `;
}

// Chỉ xử lý nếu q.audioUrl thực sự có giá trị
if (q.audioUrl) {
    const audioUrlFromData = q.audioUrl;
    
    // Kiểm tra xem nó có phải là một URL đầy đủ hay không
    const isFullUrl = audioUrlFromData.startsWith('http://') || audioUrlFromData.startsWith('https://');
    
    // Xây dựng src dựa trên kết quả kiểm tra
    const audioSrc = isFullUrl
      ? audioUrlFromData 
      : `/api/gdrive-proxy/${audioUrlFromData}`;

    // Tạo HTML hoàn chỉnh
    audioHtml = `
        <div class="media-container">
            <p class="media-instruction">Nghe đoạn âm thanh sau:</p>
            <audio controls class="q-audio" preload="metadata">
                <source src="${audioSrc}" type="audio/mpeg">
                Trình duyệt của bạn không hỗ trợ phát âm thanh.
            </audio>
        </div>
    `;
}
    
if (q.youtubeEmbedUrl) {
  // Ưu tiên 1: Nếu có link nhúng YouTube
  videoHtml = `
    <div class="media-container">
      <p class="media-instruction">Xem đoạn video sau:</p>
      <div class="video-wrapper">
        <iframe 
          class="q-video-iframe" 
          src="${q.youtubeEmbedUrl}" 
          title="YouTube video player for question ${q.id}"
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
    </div>
  `;
} else if (q.videoUrl) {
  // Ưu tiên 2: Nếu có link file video trực tiếp
  videoHtml = `
    <div class="media-container">
      <p class="media-instruction">Xem đoạn video sau:</p>
      <div class="video-wrapper">
        <video controls class="q-video">
          <source src="${q.videoUrl}" type="video/mp4">
          Trình duyệt của bạn không hỗ trợ phát video.
        </video>
      </div>
    </div>
  `;
}

    // --- Tạo HTML cho khối câu trả lời dựa trên loại câu hỏi ---
    let answerBlockHtml = '';
    const questionType = q.questionType || 'multiple_choice';

    switch (questionType) {
      case 'fill_blank':
        answerBlockHtml = `<div class="answer-container-fill-blank"><input type="text" name="${q.id}" id="ans-${q.id}" class="fill-blank-input" placeholder="Nhập câu trả lời..."></div>`;
        break;

      case 'matching':
        const colA = q.answers;
        const colB = q.options || []; // Đảm bảo an toàn nếu không có options
        const shuffledColB = [...colB].sort(() => Math.random() - 0.5);

        answerBlockHtml = `
            <div class="matching-container">
                <div class="matching-column">
                    <strong>Cột A</strong>
                    ${colA.map((item, index) => `<div class="matching-item-a">${['A', 'B', 'C', 'D'][index]}. ${escapeHtml(item)}</div>`).join('')}
                </div>
                <div class="matching-column">
                    <strong>Cột B</strong>
                    {/* Bỏ đi phần (item, index) và ${index + 1} */}
                    ${shuffledColB.map(item => `<div class="matching-item-b">${escapeHtml(item)}</div>`).join('')}
                </div>
            </div>
            <div class="matching-inputs">
                ${colA.map((_, index) => {
                    const optionLetter = ['A', 'B', 'C', 'D'][index];
                    return `
                        <div class="matching-input-row">
                            <span>Ghép ${optionLetter} với:</span>
                            <select class="matching-select" data-col-a-index="${index}">
                                <option value="">Chọn...</option>
                                {/* Sửa cả đoạn này để value là nội dung, không phải số thứ tự */}
                                ${shuffledColB.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}
                            </select>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        break;

      case 'ordering':
    // Xáo trộn các lựa chọn để hiển thị ở cột bên phải
    const shuffledAnswers = [...q.answers].sort(() => Math.random() - 0.5);
    const answerOptions = ['A', 'B', 'C', 'D']; // Giả định ID của các mục

    answerBlockHtml = `
        <p class="ordering-instruction">Kéo và thả các mục từ cột phải vào đúng vị trí ở cột trái:</p>
        <div class="ordering-layout">
            <!-- Cột trái: Các khe cắm cố định -->
            <div id="ordering-slots-${q.id}" class="ordering-slots">
                ${q.answers.map((_, index) => `
                    <div class="ordering-slot">
                        <span class="ordering-slot-number">${index + 1}.</span>
                    </div>
                `).join('')}
            </div>
            <!-- Cột phải: Các mục có thể kéo -->
            <div id="ordering-source-${q.id}" class="ordering-source-container">
                ${shuffledAnswers.map(ans => {
                    const originalIndex = q.answers.indexOf(ans);
                    const optionLetter = answerOptions[originalIndex];
                    return `<div class="ordering-item" data-id="${optionLetter}">${escapeHtml(ans)}</div>`;
                }).join('')}
            </div>
        </div>
    `;
    break;

      case 'multiple_choice':
default:
  // LOGIC MỚI: Xáo trộn các lựa chọn trước khi render
  // 1. Lấy mảng các câu trả lời gốc
  const originalAnswers = q.answers; 
  
  // 2. Xáo trộn mảng đó
  const shuffledAnswers = [...originalAnswers].sort(() => Math.random() - 0.5);

  // 3. Tạo HTML từ mảng đã xáo trộn
  answerBlockHtml = shuffledAnswers.map((ans, ansIdx) => {
    // QUAN TRỌNG:
    // - value của input giờ là NỘI DUNG câu trả lời, không phải 'A', 'B'...
    // - id và for vẫn cần là duy nhất, nên ta dùng index sau khi xáo trộn
    return `<label class="answer" for="ans-${q.id}-${ansIdx}">
              <input type="radio" 
                     name="${q.id}" 
                     id="ans-${q.id}-${ansIdx}" 
                     value="${escapeHtml(ans)}">
              <span>${escapeHtml(ans)}</span>
            </label>`;
  }).join('');
  break;
    }

    // --- Ghép tất cả các mảnh HTML lại ---
    const questionCardHtml = `
      <div class="q-card" id="card-${q.id}" data-question-type="${questionType}">
        <div class="q-head">
          <div class="q-title">Câu ${idx + 1}: ${escapeHtml(q.question)}</div>
          <div class="q-meta">Chủ đề: ${escapeHtml(q.topic)} | Cấp độ: ${escapeHtml(q.level)}</div>
        </div>
        ${imageHtml}
        ${audioHtml}
	${videoHtml}
        <div class="answers">${answerBlockHtml}</div>
        <div class="explain-block" id="exp-${q.id}" hidden>
          <strong>Giải thích:</strong>
          <span class="explain"></span>
        </div>
      </div>
    `;

    questionsContainer.insertAdjacentHTML('beforeend', questionCardHtml);

    // --- Tạo item cho navigator ---
    if(navigatorContainer){
        const navItemHtml = `<div class="nav-item" data-qid="${q.id}">${idx + 1}</div>`;
        navigatorContainer.insertAdjacentHTML('beforeend', navItemHtml);
    }
  });

  // --- Hàm điều phối các tác vụ sau khi render HTML ---
  function finalizeUI() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      console.log("Bắt đầu xử lý công thức toán bằng MathJax...");
      
      const setupInteractions = () => {
          console.log("Bắt đầu khôi phục dữ liệu vào giao diện...");
          restoreLocal();
          console.log("Bắt đầu gắn các event listener...");
          attachDynamicListeners();
          console.log("Kích hoạt Lazy Loading cho hình ảnh...");
          activateLazyLoading();
          console.log("Kích hoạt câu hỏi sắp xếp...");
          activateOrderingQuestions();
          console.log("Giao diện đã sẵn sàng.");
      };

      window.MathJax.typesetPromise()
        .then(() => {
          console.log("MathJax đã hoàn thành.");
          setupInteractions();
        })
        .catch((err) => {
          console.error('Lỗi xảy ra trong quá trình MathJax xử lý:', err);
          setupInteractions(); 
        });

    } else {
      setTimeout(finalizeUI, 150);
    }
  }

  // Bắt đầu chu trình
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

  // Thêm listener cho các select của câu hỏi ghép cặp
  $$('.matching-select').forEach(select => {
    select.addEventListener('change', handleMatchingChange);
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

// Đặt hàm xử lý matching

function handleMatchingChange(e) {
  const selectElement = e.target;
  const qCard = selectElement.closest('.q-card');
  const qid = qCard.id.replace('card-', '');
  
  // Lấy câu hỏi gốc từ state để truy xuất chỉ số
  const questionData = state.questions.find(q => q.id === qid);
  if (!questionData) return;

  const allSelects = qCard.querySelectorAll('.matching-select');
  const pairs = [];

  allSelects.forEach(sel => {
    // Lấy chỉ số của Cột A (0, 1, 2...)
    const colAIndex = parseInt(sel.dataset.colAIndex, 10);
    
    // Lấy NỘI DUNG của mục Cột B mà người dùng đã chọn
    const selectedColBContent = sel.options[sel.selectedIndex]?.text;
    
    if (!isNaN(colAIndex) && selectedColBContent) {
      // Tìm chỉ số GỐC của nội dung Cột B đã chọn trong mảng options ban đầu
      const colBIndex = questionData.options.indexOf(selectedColBContent);
      
      if (colBIndex > -1) {
        // Tạo cặp chỉ số 'chỉ_số_A-chỉ_số_B'
        pairs.push(`${colAIndex}-${colBIndex}`);
      }
    }
  });

  // Nếu đã ghép đủ tất cả các cặp, lưu lại câu trả lời
  if (pairs.length === allSelects.length) {
    // Sắp xếp các cặp để đảm bảo chuỗi luôn nhất quán trước khi lưu
    state.answers[qid] = pairs.sort().join(',');
    handleAnswered(qid);
    paintNavigator();
    updateAnsweredCount();
  } else {
    // Nếu chưa ghép đủ, xóa câu trả lời cũ
    if (state.answers[qid]) {
      delete state.answers[qid];
      handleAnswered(qid);
      paintNavigator();
      updateAnsweredCount();
    }
  }
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
  if (state.timerHandle) clearInterval(state.timerHandle);

  if (!state.started) {
    state.started = true;
    state.startTime = new Date().toISOString();
    // Tính toán và lưu thời điểm kết thúc
    state.endTime = Date.now() + state.timeLeft * 1000;
  }
  
  tick();
  state.timerHandle = setInterval(tick, 1000);
  console.log("Timer đã bắt đầu với cơ chế endTime.");
}

function tick(){
  // Tính toán lại thời gian còn lại dựa trên endTime
  const remainingMillis = state.endTime - Date.now();
  state.timeLeft = Math.max(0, Math.floor(remainingMillis / 1000));
  
  const t = $('#timer');
  if (t) t.textContent = fmtTime(state.timeLeft);
  
  const warn = $('#timeWarn');
  if (warn && state.timeLeft <= 300 && state.timeLeft > 0) warn.hidden = false;
  
  if (state.timeLeft === 0) {
    submitExam(true); // Tự động nộp bài
  }
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
    endTime: state.endTime, // <<--- THÊM DÒNG NÀY
    submitted: state.submitted, // <<--- THÊM DÒNG NÀY
    lastSave: new Date().toISOString()
  };
  try { localStorage.setItem(key, JSON.stringify(payload)); }
  catch(e){ console.warn(e); }
}

// <<<< THAY THẾ HÀM restoreLocal() CŨ BẰNG CỤM 2 HÀM NÀY >>>>
function restoreLocal() {
  if (!state.exam) return;
  
  const key = STORAGE_KEY();
  const raw = localStorage.getItem(key);

  // Nếu không có dữ liệu lưu, không làm gì cả.
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (data.examId !== state.exam.examId) return;
    
    // TRƯỜNG HỢP 1: BÀI THI ĐÃ NỘP
    // Nếu có trạng thái 'submitted' và nó là true
    if (data.submitted) {
    console.log("Phát hiện bài thi đã được nộp.");
    state.submitted = true;
    
    // Lấy chế độ làm bài từ state (đã được API getExamQuestions cung cấp)
    const examMode = state.exam?.defaultMode || 'practice'; 

    if (examMode === 'exam') {
        // Nếu là bài kiểm tra, KHÓA GIAO DIỆN
        console.log("Chế độ kiểm tra, khóa giao diện vì bài đã được nộp.");
        $('#questions').innerHTML = `<div class="card" style="text-align: center;"><h3>Bạn đã nộp bài này.</h3><p>Bài kiểm tra này chỉ cho phép nộp một lần duy nhất.</p></div>`;
        $('#end-controls').hidden = true;
        $('#btn-start').hidden = true;
        $('#guidelines').hidden = true;
    } else {
        // Nếu là bài luyện tập, chỉ hiển thị lại kết quả lần nộp trước
        console.log("Chế độ luyện tập, hiển thị lại kết quả lần nộp trước.");
        submitExam(true); 
    }
    return; // Dừng hàm ở đây
}

    // TRƯỜNG HỢP 2: BÀI THI ĐANG LÀM DỞ
    state.endTime = data.endTime || null; // <<--- THÊM DÒNG NÀY
    state.student = data.student || { name:'', id:'', className:'', email:'' };
    state.answers = data.answers || {};
    state.perQuestion = data.perQuestion || {};
    state.timeLeft = data.timeLeft || state.timeLeft;
    state.started = data.started || false;
    state.startTime = data.startTime || null;

    console.log("Đã khôi phục bài làm dở từ Local Storage.", data);
    
    // Luôn hiển thị form thông tin nếu có dữ liệu đã điền
    if (state.student.name || state.student.id) {
        $('#student-info').hidden = false;
    }
    
    updateUIFromState();
    
    if (state.started) {
      $('#btn-start').hidden = true;
      $('#btn-guidelines').hidden = true;
      $('#questions').hidden = false;
      $('#navigator').hidden = false;
      $('#timer-container').hidden = false;
      $('#answer-progress').hidden = false;
      $('#end-controls').hidden = false;
      startTimer();
    }
  } catch(e) { console.warn('Restore failed', e); }
}

function updateUIFromState() {
  // Cập nhật các ô input
  Object.keys(state.answers).forEach(qid => {
    const answer = state.answers[qid];
    const radioInput = document.querySelector(`input[name="${qid}"][value="${answer}"]`);
    if (radioInput) radioInput.checked = true;
    
    const textInput = document.querySelector(`input[name="${qid}"]`);
    if (textInput && textInput.type === 'text') textInput.value = answer;
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
// ===== Submit - PHIÊN BẢN AN TOÀN & ĐẦY ĐỦ =====
async function submitExam(auto = false) {
  // Logic kiểm tra trạng thái đã nộp (giữ nguyên, đã đúng)
  if (state.submitted && auto) {
      console.log("Đang hiển thị lại trạng thái đã nộp.");
      const resultCard = $('#resultCard');
      const endControls = $('#end-controls');
      const btnStart = $('#btn-start');
      const guidelines = $('#guidelines');

      if(resultCard) {
        resultCard.classList.remove('hidden');
        resultCard.innerHTML = "<h3>Bài thi này đã được nộp.</h3><p>Để làm lại, vui lòng sử dụng nút 'Xoá dữ liệu tạm' và tải lại trang.</p>";
      }
      if(endControls) endControls.hidden = true;
      if(btnStart) btnStart.hidden = true;
      if(guidelines) guidelines.hidden = true;
      return;
  }
  
  if (state.submitted) return;
  if (!auto && !validateBeforeSubmit()) return;

  setButtonsDisabled(true);
  state.submitted = true;
  clearInterval(state.timerHandle);
  persistLocal(); 

  const resultCard = $('#resultCard');
  const resultSummary = $('#resultSummary');
  const feedbackEl = $('#feedback');
  
  if(resultSummary) resultSummary.innerHTML = '<p>Đang nộp bài và chấm điểm, vui lòng chờ...</p>';
  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(submissionPayload),
    });

    if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Server trả về lỗi không xác định.");
    
    const serverData = result.data;
    console.log("Kết quả chi tiết từ server:", serverData);
    
    if (resultSummary) {
      resultSummary.innerHTML = `
        <p>Điểm: <strong>${serverData.score}/10</strong> (${serverData.correctCount}/${serverData.totalQuestions} câu đúng)</p>
      `;
    }

    if (feedbackEl) {
      // SỬA LỖI BẢO MẬT #1: Làm sạch chuỗi HTML nhận xét từ server.
      feedbackEl.innerHTML = DOMPurify.sanitize(serverData.feedback);
    }
    
    if (serverData.fullQuestionsData) {
        const questionsData = serverData.fullQuestionsData;
        Object.keys(questionsData).forEach(qId => {
            const qData = questionsData[qId];
            const card = document.getElementById(`card-${qId}`);
            if (!card) return;

            const exp = card.querySelector(`#exp-${qId}`);
            const qTitleEl = card.querySelector('.q-title');
            
            if (!exp || !qTitleEl) return;

            exp.hidden = false;
            const studentAnswer = state.answers[qId];
            
            // Ngăn việc chèn biểu tượng lặp lại
            if (qTitleEl.querySelector('.result-icon')) {
                return; // Đã xử lý, thoát khỏi vòng lặp cho qId này
            }

            const questionType = qData.questionType || 'multiple_choice';
            let isCorrect = false;

            // ===== BỔ SUNG ĐẦY ĐỦ LOGIC KIỂM TRA ĐÁP ÁN =====
            if (studentAnswer) {
                switch (questionType) {
                    case 'fill_blank': {
                        const studentAnswerNormalized = studentAnswer.toLowerCase().trim();
                        // Đáp án đúng có thể có nhiều lựa chọn, phân tách bằng dấu |
                        const correctOptions = qData.correct.split('|').map(opt => opt.toLowerCase().trim());
                        if (correctOptions.includes(studentAnswerNormalized)) {
                            isCorrect = true;
                        }
                        break;
                    }
                    case 'matching':
                    case 'ordering': {
                        // Chuẩn hóa câu trả lời của học sinh và đáp án đúng để so sánh
                        // Bằng cách loại bỏ các ký tự phân cách, viết hoa, và sắp xếp các ký tự
                        const normalize = (str) => (str || "").replace(/[\s,-]/g, '').toUpperCase().split('').sort().join('');
                        
                        if (normalize(studentAnswer) === normalize(qData.correct)) {
                            isCorrect = true;
                        }
                        break;
                    }
                    case 'multiple_choice':
                    default: {
                        if (studentAnswer === qData.correct) {
                            isCorrect = true;
                        }
                        break;
                    }
                }
            }
            // ===== KẾT THÚC PHẦN BỔ SUNG =====

            if (isCorrect) {
                exp.innerHTML = `<strong>Đúng!</strong> ${escapeHtml(qData.explain)}`;
                card.classList.add('correct');
                qTitleEl.innerHTML = `<span class="result-icon correct-icon">✔</span>` + qTitleEl.innerHTML;
            } else if (studentAnswer) {
                const displayCorrectAnswer = qData.correct.split('|').join(' hoặc ');
                // SỬA LỖI BẢO MẬT #2: Escape đáp án đúng trước khi hiển thị.
                exp.innerHTML = `<strong>Sai.</strong> Đáp án đúng là <strong>${escapeHtml(displayCorrectAnswer)}</strong>. <br><em>Giải thích:</em> ${escapeHtml(qData.explain)}`;
                card.classList.add('incorrect');
                qTitleEl.innerHTML = `<span class="result-icon incorrect-icon">✖</span>` + qTitleEl.innerHTML;
            } else {
                const displayCorrectAnswer = qData.correct.split('|').join(' hoặc ');
                // SỬA LỖI BẢO MẬT #2: Escape đáp án đúng trước khi hiển thị.
                exp.innerHTML = `<strong>Chưa trả lời.</strong> Đáp án đúng là <strong>${escapeHtml(displayCorrectAnswer)}</strong>. <br><em>Giải thích:</em> ${escapeHtml(qData.explain)}`;
                qTitleEl.innerHTML = `<span class="result-icon unanswered-icon">−</span>` + qTitleEl.innerHTML;
            }
        });
    }
    
  } catch (error) {
    console.error('Lỗi khi nộp bài:', error);
    if (resultSummary) {
      resultSummary.innerHTML = `
        <h3>Có lỗi xảy ra!</h3>
        <p>Không thể nộp bài của em. Lỗi: ${error.message}</p>
        <p>Vui lòng kiểm tra lại kết nối mạng và thử lại.</p>
      `;
    }
    setButtonsDisabled(false);
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

// Hàm xử lý câu hỏi dạng Matching

// <<<< THAY THẾ TOÀN BỘ HÀM NÀY >>>>
function activateOrderingQuestions() {
  // Tìm tất cả các container của câu hỏi sắp xếp
  const orderingQuestions = $$('.q-card[data-question-type="ordering"]');
  
  orderingQuestions.forEach(qCard => {
    // ===== SỬA LỖI: KHAI BÁO `qid` Ở ĐÂY =====
    const qid = qCard.id.replace('card-', '');
    const slots = qCard.querySelectorAll('.ordering-slot');
    const sourceContainer = qCard.querySelector(`#ordering-source-${qid}`); // Sửa lại tên biến cho đúng

    if (!slots.length || !sourceContainer) return;

    // --- Hàm chung để xử lý khi có thay đổi ---
    const handleSortEnd = () => {
      const itemsInSlots = qCard.querySelectorAll('.ordering-slots .ordering-item');
      
      if (itemsInSlots.length === slots.length) {
        const sortedItems = Array.from(itemsInSlots).sort((a, b) => {
          const slotA = a.closest('.ordering-slot');
          const slotB = b.closest('.ordering-slot');
          return Array.from(slots).indexOf(slotA) - Array.from(slots).indexOf(slotB);
        });
        
        const newOrderContent = sortedItems.map(item => item.textContent.trim());
        state.answers[qid] = newOrderContent.join('||');
      } else {
        delete state.answers[qid];
      }
      
      handleAnswered(qid);
      paintNavigator();
      updateAnsweredCount();
    };

    // --- Kích hoạt Sortable cho Cột Phải (Nguồn) ---
    new Sortable(sourceContainer, {
      group: {
        name: `group-${qid}`, // Bây giờ biến `qid` đã tồn tại
        pull: true,
        put: true
      },
      animation: 150,
      ghostClass: 'sortable-ghost',
    });

    // --- Kích hoạt Sortable cho TỪNG Khe cắm ở Cột Trái ---
    slots.forEach(slot => {
      new Sortable(slot, {
        group: {
          name: `group-${qid}`, // Bây giờ biến `qid` đã tồn tại
          pull: true,
          put: true
        },
        animation: 150,
        ghostClass: 'sortable-ghost',
        onAdd: function (evt) {
          if (slot.getElementsByClassName('ordering-item').length > 1) {
            const oldItem = (evt.from === sourceContainer) ? slot.children[0] : slot.children[1];
            sourceContainer.appendChild(oldItem);
          }
        },
        onEnd: handleSortEnd
      });
    });
  });
}

// ===== Wire events =====
// <<<< THAY THẾ TOÀN BỘ HÀM wireEvents() >>>>
function wireEvents(){
  $('#btn-start')?.addEventListener('click', ()=>{
    // Luôn đọc thông tin học sinh khi nhấn nút
    readStudent(); 

    // Kiểm tra 3 trường bắt buộc
    if (!state.student.name || !state.student.id || !state.student.className) {
        alert('Vui lòng điền đầy đủ Họ và tên, Mã số học sinh và Lớp để bắt đầu.');
        return; // Dừng lại nếu chưa điền đủ
    }

    // Nếu đã điền đủ, ẩn nút "Bắt đầu làm" và "Hướng dẫn"
    $('#btn-start').hidden = true;
    $('#btn-guidelines').hidden = true;

    // Hiển thị các thành phần làm bài
    $('#questions').hidden = false;
    $('#navigator').hidden = false;
    $('#timer-container').hidden = false;
    $('#answer-progress').hidden = false;
    $('#end-controls').hidden = false;
    
    // Ẩn chính nút "Bắt đầu làm" đi
    $('#btn-start').hidden = true;
    
    startTimer();
  });

  $('#btn-submit')?.addEventListener('click', ()=>{ submitExam(false); });
  $('#btn-save')?.addEventListener('click', ()=>{ 
    readStudent();
    persistLocal(); 
    showToast('Đã lưu tạm thành công!', 'success'); // <<--- THAY THẾ
});
$('#btn-clear')?.addEventListener('click', ()=>{ 
    if (confirm("Bạn có chắc chắn muốn xoá toàn bộ bài vừa làm và bắt đầu lại từ đầu?")) {
        clearLocal(); 
        // Chúng ta không cần toast ở đây nữa vì trang sẽ tải lại ngay lập tức.
        // Nhưng nếu bạn muốn, có thể gọi toast trước khi reload.
        // showToast('Đã xoá dữ liệu tạm. Đang tải lại...', 'info', 2000);
        location.reload();
    }
});
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

// Dán hàm này vào gần cuối file appF.js

/**
 * Tìm tất cả các hình ảnh có class 'lazy-image' và chỉ tải chúng
 * khi người dùng cuộn đến gần.
 */
function activateLazyLoading() {
  // Tìm tất cả các hình ảnh được đánh dấu để lazy load
  const lazyImages = $$('.lazy-image');

  // Nếu trình duyệt không hỗ trợ IntersectionObserver, tải tất cả hình ảnh để đảm bảo an toàn.
  if (!("IntersectionObserver" in window)) {
    console.warn("Trình duyệt không hỗ trợ IntersectionObserver, đang tải tất cả hình ảnh.");
    lazyImages.forEach(image => {
      if (image.dataset.src) {
        image.src = image.dataset.src;
      }
    });
    return;
  }

  // Cấu hình cho Observer: bắt đầu tải hình ảnh khi nó còn cách viewport 200px ở phía dưới.
  const observerOptions = {
    root: null, // Quan sát so với viewport của trình duyệt
    rootMargin: '0px 0px 200px 0px', 
    threshold: 0.01
  };

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      // entry.isIntersecting là true khi phần tử đi vào vùng quan sát
      if (entry.isIntersecting) {
        const image = entry.target;
        
        console.log(`Đang tải lười hình ảnh: ${image.dataset.src}`);

        // Gán URL thật từ data-src vào src để trình duyệt bắt đầu tải
        if (image.dataset.src) {
          image.src = image.dataset.src;
        }
        
        // Xóa class lazy để tránh xử lý lại
        image.classList.remove('lazy-image');
        
        // Dừng quan sát hình ảnh này vì nó đã được tải rồi
        observer.unobserve(image);
      }
    });
  }, observerOptions);

  // Bắt đầu quan sát tất cả các hình ảnh đã tìm thấy
  lazyImages.forEach(image => {
    imageObserver.observe(image);
  });
  
  console.log(`Đã kích hoạt Lazy Loading cho ${lazyImages.length} hình ảnh.`);
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