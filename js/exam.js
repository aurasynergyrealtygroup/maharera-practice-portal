/* ============================================================
   exam.js — exam engine
   ============================================================ */

let EXAM = {
  sessionId: null,
  questions: [],
  answers: {},   // qid -> "A"|"B"|"C"|"D"
  current: 0,
  secondsLeft: 0,
  timerHandle: null
};

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const loadEl = document.getElementById("examLoading");
  const layoutEl = document.getElementById("examLayout");

  try {
    const data = await api("startExam");
    EXAM.sessionId = data.sessionId;
    EXAM.questions = data.questions;
    EXAM.secondsLeft = (data.timeLimitMinutes || CONFIG.TIME_LIMIT_MINUTES) * 60;

    loadEl.style.display = "none";
    layoutEl.style.display = "grid";

    buildQuestionGrid();
    renderQuestion(0);
    startTimer();
  } catch (err) {
    loadEl.innerHTML = `<div class="form-msg error" style="display:block;max-width:480px;margin:60px auto;">${err.message}</div>`;
  }
});

function startTimer() {
  updateTimerDisplay();
  EXAM.timerHandle = setInterval(() => {
    EXAM.secondsLeft--;
    updateTimerDisplay();
    if (EXAM.secondsLeft <= 0) {
      clearInterval(EXAM.timerHandle);
      submitExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(EXAM.secondsLeft / 60).toString().padStart(2, "0");
  const s = (EXAM.secondsLeft % 60).toString().padStart(2, "0");
  const el = document.getElementById("timerText");
  el.textContent = `${m}:${s}`;
  el.parentElement.classList.toggle("low", EXAM.secondsLeft <= 300);
}

function renderQuestion(idx) {
  EXAM.current = idx;
  const q = EXAM.questions[idx];
  document.getElementById("qMeta").textContent =
    `Question ${idx + 1} of ${EXAM.questions.length} · ${CONFIG.MARKS_PER_QUESTION} marks`;
  document.getElementById("qText").textContent = q.question;

  const optsWrap = document.getElementById("optionsWrap");
  optsWrap.innerHTML = "";
  ["A", "B", "C", "D"].forEach(letter => {
    const div = document.createElement("div");
    const selected = EXAM.answers[q.qid] === letter;
    div.className = "option" + (selected ? " selected" : "");
    div.innerHTML = `<span class="opt-letter">${letter}</span><span>${q["option" + letter] || q[letter.toLowerCase()]}</span>`;
    div.onclick = () => selectOption(letter);
    optsWrap.appendChild(div);
  });

  document.getElementById("prevBtn").disabled = idx === 0;
  const nextBtn = document.getElementById("nextBtn");
  nextBtn.textContent = idx === EXAM.questions.length - 1 ? "Review & submit" : "Next question →";
  nextBtn.onclick = idx === EXAM.questions.length - 1
    ? () => confirmSubmit()
    : () => renderQuestion(idx + 1);

  document.getElementById("progressFill").style.width =
    Math.round(((idx + 1) / EXAM.questions.length) * 100) + "%";
  document.getElementById("progressLabel").textContent = `${idx + 1} / ${EXAM.questions.length} answered so far: ${Object.keys(EXAM.answers).length}`;

  highlightGrid();
}

function selectOption(letter) {
  const q = EXAM.questions[EXAM.current];
  EXAM.answers[q.qid] = letter;
  renderQuestion(EXAM.current);
}

function buildQuestionGrid() {
  const grid = document.getElementById("qGrid");
  grid.innerHTML = "";
  EXAM.questions.forEach((q, i) => {
    const btn = document.createElement("button");
    btn.textContent = i + 1;
    btn.onclick = () => renderQuestion(i);
    btn.id = "qbtn-" + i;
    grid.appendChild(btn);
  });
}

function highlightGrid() {
  EXAM.questions.forEach((q, i) => {
    const btn = document.getElementById("qbtn-" + i);
    btn.classList.toggle("answered", !!EXAM.answers[q.qid]);
    btn.classList.toggle("current", i === EXAM.current);
  });
}

function confirmSubmit() {
  const total = EXAM.questions.length;
  const answered = Object.keys(EXAM.answers).length;
  const unanswered = total - answered;
  const proceed = confirm(
    unanswered > 0
      ? `You have ${unanswered} unanswered question(s). Submit anyway?`
      : "Submit your test now? This cannot be undone."
  );
  if (proceed) submitExam(false);
}

document.getElementById("prevBtn")?.addEventListener("click", () => {
  if (EXAM.current > 0) renderQuestion(EXAM.current - 1);
});

async function submitExam(auto) {
  clearInterval(EXAM.timerHandle);
  const overlay = document.getElementById("submitOverlay");
  overlay.style.display = "flex";
  try {
    const result = await api("submitExam", {
      sessionId: EXAM.sessionId,
      answers: EXAM.answers
    });
    window.location.href = "result.html?examId=" + encodeURIComponent(result.examId);
  } catch (err) {
    overlay.style.display = "none";
    alert("Could not submit: " + err.message + "\nPlease try again — your answers are still saved on screen.");
    startTimer();
  }
}

window.addEventListener("beforeunload", (e) => {
  if (EXAM.questions.length) {
    e.preventDefault();
    e.returnValue = "";
  }
});
