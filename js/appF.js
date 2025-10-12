// ==========================================================
// === START OF CLEANED AND FINAL appF.js FILE ===
// ==========================================================

console.log("--- PHIÊN BẢN CODE MỚI NHẤT ĐÃ ĐƯỢC TẢI ---");

const API_URL = "/api/";

// ===== Utils =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmtTime = (sec) => `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
const getParam = (k, d = null) => new URLSearchParams(location.search).get(k) ?? d;

async function loadExam(examId) {
    console.log(`Đang gọi API để lấy đề thi ID: ${examId}`);
    try {
        const res = await fetch(`${API_URL}?action=getExamQuestions&examId=${examId}`);
        if (!res.ok) throw new Error(`Server trả về lỗi HTTP: ${res.status}`);
        
        const response = await res.json();
        if (!response.success) throw new Error(response.message || "Lỗi không xác định từ API.");
        
        const data = response.data;
        if (!data || !data.questions) throw new Error("Dữ liệu trả về từ API không hợp lệ.");
        
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
        const questionsContainer = document.getElementById('questions');
        if (questionsContainer) {
            questionsContainer.innerHTML = `
                <div class="card" style="text-align: center; color: var(--bad);">
                    <h3>Không thể tải được đề bài</h3>
                    <p>Lỗi: ${err.message}</p>
                    <p>Vui lòng kiểm tra lại đường link hoặc kết nối mạng và thử lại.</p>
                    <a href="/" class="action-btn btn-guide" style="text-decoration: none;">Quay về Trang chủ</a>
                </div>`;
        }
    }
}

// ===== State =====
let state = {
    exam: null,
    questions: [],
    mode: 'practice',
    started: false,
    timeLeft: 0,
    answers: {},
    perQuestion: {},
    leaveCount: 0,
    timerHandle: null,
    startTime: null,
    student: { name: '', id: '', className: '', email: '' },
    submitted: false,
    leaveTimestamps: [],
};

const STORAGE_KEY = () => {
    if (!state.exam) return null;
    return `${state.exam.examId}-${state.mode}-${state.student.id || 'UNKNOWN'}`;
};

// ===== Render =====
function renderExam() {
    const exam = state.exam;
    if (!exam || !exam.questions) {
        document.getElementById('questions').innerHTML = "<p>Lỗi: Không tải được câu hỏi.</p>";
        return;
    }

    const pageTitle = exam.title || 'Luyện tập và Kiểm tra';
    document.title = pageTitle;
    $('#examTitle').textContent = pageTitle;
    
    const questionsContainer = $('#questions');
    const navigatorContainer = $('#navigator-items');
    questionsContainer.innerHTML = "";
    if (navigatorContainer) navigatorContainer.innerHTML = "";
    if ($('#totalCount')) $('#totalCount').textContent = exam.questions.length;

    exam.questions.forEach((q, idx) => {
        const imageHtml = q.imageUrl ? `<div class="media-container"><img src="${q.imageUrl}" alt="Hình ảnh minh họa" class="q-image"></div>` : '';
        const audioHtml = q.audioUrl ? `<div class="media-container"><p class="media-instruction">Nghe đoạn âm thanh sau:</p><audio controls src="${q.audioUrl}" class="q-audio">Trình duyệt không hỗ trợ.</audio></div>` : '';
        let answerBlockHtml = '';
        const questionType = q.questionType || 'multiple_choice';
        switch (questionType) {
            case 'fill_blank':
                answerBlockHtml = `<div class="answer-container-fill-blank"><input type="text" name="${q.id}" class="fill-blank-input" placeholder="Nhập câu trả lời..."></div>`;
                break;
            default:
                answerBlockHtml = q.answers.map((ans, ansIdx) => {
                    const option = ['A', 'B', 'C', 'D'][ansIdx];
                    return `<label class="answer"><input type="radio" name="${q.id}" value="${option}"><span>${escapeHtml(ans)}</span></label>`;
                }).join('');
                break;
        }
        const questionCardHtml = `<div class="q-card" id="card-${q.id}" data-question-type="${questionType}"><div class="q-head"><div class="q-title">Câu ${idx + 1}: ${escapeHtml(q.question)}</div><div class="q-meta">Chủ đề: ${escapeHtml(q.topic)} | Cấp độ: ${escapeHtml(q.level)}</div></div>${imageHtml}${audioHtml}<div class="answers">${answerBlockHtml}</div><div class="explain-block" id="exp-${q.id}" hidden><strong>Giải thích:</strong><span class="explain"></span></div></div>`;
        questionsContainer.insertAdjacentHTML('beforeend', questionCardHtml);
        if (navigatorContainer) {
            navigatorContainer.insertAdjacentHTML('beforeend', `<div class="nav-item" data-qid="${q.id}">${idx + 1}</div>`);
        }
    });

    finalizeUI();
}

function finalizeUI() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        console.log("Bắt đầu xử lý công thức toán bằng MathJax...");
        window.MathJax.typesetPromise()
            .then(() => {
                console.log("MathJax đã hoàn thành.");
                restoreLocal();
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

// ===== Event Handling & DOM Manipulation =====
function attachDynamicListeners() {
    console.log("Attaching dynamic event listeners...");
    $$('#questions input[type="radio"]').forEach(input => input.addEventListener('change', handleAnswerChange));
    $$('#questions input[type="text"]').forEach(input => input.addEventListener('change', handleAnswerChange));
    $$('#navigator .nav-item').forEach(item => item.addEventListener('click', handleNavClick));
}

function handleAnswerChange(e) {
    const input = e.target;
    const qid = input.name;
    let value = (input.type === 'radio') ? input.value : input.value.trim();
    if (value) state.answers[qid] = value;
    else delete state.answers[qid];
    handleAnswered(qid);
    paintNavigator();
    updateAnsweredCount();
}

function handleNavClick(e) {
    const qid = e.target.dataset.qid;
    const card = $(`#card-${qid}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $$('#navigator .nav-item').forEach(el => el.classList.toggle('current', el.dataset.qid === qid));
    }
}

function handleAnswered(qid) {
    const now = Date.now();
    const pq = state.perQuestion[qid] || (state.perQuestion[qid] = { firstSeen: now, start: now, answerCount: 0, timeSpent: 0 });
    pq.answerTime = now;
    pq.answerCount++;
    const spentSeconds = Math.max(1, Math.floor((now - pq.start) / 1000));
    pq.timeSpent += spentSeconds;
    pq.start = now;
}

function paintNavigator() {
    const answered = new Set(Object.keys(state.answers));
    $$('#navigator .nav-item').forEach(el => el.classList.toggle('answered', answered.has(el.dataset.qid)));
}

function updateAnsweredCount() {
    const el = $('#answeredCount');
    if (el) el.textContent = Object.keys(state.answers).length;
}

function startTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    if (!state.started) {
        state.started = true;
        state.startTime = new Date().toISOString();
    }
    tick();
    state.timerHandle = setInterval(tick, 1000);
    console.log("Timer đã bắt đầu hoặc được khởi động lại.");
}

function tick() {
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    const t = $('#timer');
    if (t) t.textContent = fmtTime(state.timeLeft);
    if (state.timeLeft === 300 && $('#timeWarn')) $('#timeWarn').hidden = false;
    if (state.timeLeft === 0) submitExam(true);
}

// ===== Leave Tracking =====
let leaveStartTime = 0;
function handleLeave() { if (leaveStartTime === 0) leaveStartTime = Date.now(); }
function handleReturn() {
    if (leaveStartTime > 0) {
        const leaveDuration = Date.now() - leaveStartTime;
        if (leaveDuration > 2000) {
            state.leaveCount++;
            state.leaveTimestamps.push({ start: new Date(leaveStartTime).toISOString(), durationSeconds: Math.round(leaveDuration / 1000) });
        }
        leaveStartTime = 0;
    }
}
window.addEventListener('blur', handleLeave);
document.addEventListener('visibilitychange', () => document.hidden ? handleLeave() : handleReturn());
window.addEventListener('focus', handleReturn);

// ===== Local Storage =====
function persistLocal() {
    const key = STORAGE_KEY();
    if (!key) return;
    const payload = { ...state, exam: undefined, questions: undefined }; // Don't save full exam data
    try { localStorage.setItem(key, JSON.stringify(payload)); }
    catch (e) { console.warn(e); }
}

function restoreLocal() {
    if (!state.exam) return;
    const key = STORAGE_KEY();
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
        const data = JSON.parse(raw);
        if (data.examId !== state.exam.examId) return;

        if (data.submitted) {
            console.log("Phát hiện bài thi đã được nộp. Hiển thị lại kết quả.");
            state.submitted = true;
            submitExam(true);
            return;
        }

        Object.assign(state, data); // Restore state
        console.log("Đã khôi phục bài làm dở.", data);
        
        if (state.student.name || state.student.id) $('#student-info').hidden = false;
        
        updateUIFromState();
        
        if (state.started) {
            $('#questions').hidden = false;
            $('#navigator').hidden = false;
            $('#timer').hidden = false;
            $('#answer-progress').hidden = false;
            $('#end-controls').hidden = false;
            $('#btn-start').hidden = true;
            startTimer();
        }
    } catch (e) { console.warn('Restore failed', e); }
}

function updateUIFromState() {
    Object.keys(state.answers).forEach(qid => {
        const answer = state.answers[qid];
        const radioInput = $(`input[name="${qid}"][value="${answer}"]`);
        if (radioInput) radioInput.checked = true;
        const textInput = $(`input[name="${qid}"]`);
        if (textInput && textInput.type === 'text') textInput.value = answer;
    });
    paintNavigator();
    updateAnsweredCount();
    if ($('#studentName')) $('#studentName').value = state.student.name;
    if ($('#studentId')) $('#studentId').value = state.student.id;
    if ($('#className')) $('#className').value = state.student.className;
    if ($('#email')) $('#email').value = state.student.email;
}

function clearLocal() {
    if (!state.exam) return;
    const prefix = state.exam.examId;
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith(prefix)) localStorage.removeItem(k);
    });
}

// ===== Student Info & Validation =====
function readStudent() {
    if ($('#studentName')) state.student.name = $('#studentName').value.trim();
    if ($('#studentId')) state.student.id = $('#studentId').value.trim();
    if ($('#className')) state.student.className = $('#className').value.trim();
    if ($('#email')) state.student.email = $('#email').value.trim();
}

function validateBeforeSubmit() {
    readStudent();
    const missing = [];
    if (!state.student.name) missing.push('Họ và tên');
    if (!state.student.id) missing.push('Mã học sinh');
    if (!state.student.className) missing.push('Lớp');
    if (missing.length) {
        alert('Vui lòng điền: ' + missing.join(', '));
        return false;
    }
    const total = state.questions.length;
    const answered = Object.keys(state.answers).length;
    if (answered < total) {
        return confirm(`Em còn ${total - answered} câu chưa trả lời. Em vẫn muốn nộp luôn?`);
    }
    return true;
}

// ===== Submit =====
async function submitExam(auto = false) {
    if (state.submitted && auto) {
        console.log("Đang hiển thị lại trạng thái đã nộp.");
        $('#resultCard').classList.remove('hidden');
        $('#resultCard').innerHTML = "<h3>Bài thi này đã được nộp.</h3><p>Để làm lại, vui lòng sử dụng nút 'Xoá dữ liệu tạm' và tải lại trang.</p>";
        $('#end-controls').hidden = true;
        $('#btn-start').hidden = true;
        $('#guidelines').hidden = true;
        return;
    }
    if (state.submitted) return;
    if (!auto && !validateBeforeSubmit()) return;

    setButtonsDisabled(true);
    state.submitted = true;
    clearInterval(state.timerHandle);
    persistLocal();

    const resultCard = $('#resultCard');
    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth' });
    $('#resultSummary').innerHTML = '<p>Đang nộp bài và chấm điểm, vui lòng chờ...</p>';

    const submissionPayload = {
        examId: state.exam.examId,
        student: state.student,
        answers: state.answers,
        perQuestion: state.perQuestion,
        leaveCount: state.leaveCount,
        leaveTimestamps: state.leaveTimestamps,
        timeSpent: (state.exam.durationMinutes * 60) - state.timeLeft,
        startTime: state.startTime,
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionPayload),
        });
        if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || "Lỗi server không xác định.");
        
        const serverData = result.data;
        $('#resultSummary').innerHTML = `<p>Điểm: <strong>${serverData.score}/10</strong> (${serverData.correctCount}/${serverData.totalQuestions} câu đúng)</p>`;
        $('#feedback').innerHTML = serverData.feedback;

        if (serverData.fullQuestionsData) {
            Object.keys(serverData.fullQuestionsData).forEach(qId => {
                const qData = serverData.fullQuestionsData[qId];
                const card = $(`#card-${qId}`);
                const exp = $(`#exp-${qId}`);
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
    } catch (error) {
        console.error('Lỗi khi nộp bài:', error);
        $('#resultSummary').innerHTML = `<h3>Có lỗi xảy ra!</h3><p>Không thể nộp bài. Lỗi: ${error.message}</p>`;
        setButtonsDisabled(false);
        state.submitted = false;
    }
}

function setButtonsDisabled(disabled) {
    $$('#btn-submit, #btn-save, #btn-clear, #btn-start').forEach(el => el.disabled = disabled);
}

// ===== Wire events =====
function wireEvents() {
    $('#btn-start')?.addEventListener('click', () => {
        readStudent();
        $('#student-info').hidden = false;
        $('#questions').hidden = false;
        $('#navigator').hidden = false;
        $('#timer').hidden = false;
        $('#answer-progress').hidden = false;
        $('#end-controls').hidden = false;
        $('#btn-start').hidden = true;
        startTimer();
    });

    $('#btn-submit')?.addEventListener('click', () => submitExam(false));
    $('#btn-save')?.addEventListener('click', () => {
        readStudent();
        persistLocal();
        alert('Đã lưu tạm.');
    });
    $('#btn-clear')?.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn xoá toàn bộ bài làm tạm và bắt đầu lại từ đầu?")) {
            clearLocal();
            alert('Đã xoá dữ liệu tạm. Trang sẽ được tải lại.');
            location.reload();
        }
    });
    $('#btn-guidelines')?.addEventListener('click', () => {
        $('#guidelines').hidden = !$('#guidelines').hidden;
    });
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (m) => map[m]);
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
    const examId = getParam("examId");
    if (examId) {
        loadExam(examId);
    } else {
        const questionsContainer = $('#questions');
        if(questionsContainer) questionsContainer.innerHTML = `
            <div class="card" style="text-align: center;">
                <h3>Lỗi: Không tìm thấy mã đề bài.</h3>
                <p>Vui lòng kiểm tra lại đường link hoặc quay trở lại trang chủ.</p>
                <a href="/" class="action-btn btn-start" style="text-decoration: none;">Về Trang chủ</a>
            </div>`;
    }
    wireEvents();
});

// ========================================================
// === END OF CLEANED AND FINAL appF.js FILE ===
// ========================================================