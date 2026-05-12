const QUESTIONS_URL = "data/questions.json";
const PER_GROUP = 2;
const LS_RESULT = "quiz-last-result-";
const LS_USERS = "quiz-users-passwords";

let questions = [];
let index = 0;
const answers = {};
let userName = "";
let timerId = null;
let timerStart = 0;
let seconds = 0;

const el = {
  question: document.getElementById("question-container"),
  result: document.getElementById("result-container"),
  quiz: document.getElementById("quiz-content"),
  panel: document.getElementById("user-panel"),
  timer: document.getElementById("timer-display"),
  nav: Array.from(document.querySelectorAll(".question-number")),
  name: document.getElementById("user-name-input"),
  pass: document.getElementById("user-password-input"),
  start: document.getElementById("start-test-btn"),
  authMsg: document.getElementById("auth-message"),
  userLabel: document.getElementById("current-user-label"),
  next: document.getElementById("next-question-btn"),
  finish: document.getElementById("finish-test-btn"),
  retry: document.getElementById("retry-test-btn")
};

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(group, n) {
  return shuffle(group).slice(0, n);
}

function buildSet(data) {
  return shuffle([
    ...pick(data.single, PER_GROUP),
    ...pick(data.multiple, PER_GROUP),
    ...pick(data.text, PER_GROUP)
  ]);
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function resultKey() {
  return LS_RESULT + userName.trim().toLowerCase();
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || "{}");
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

/** Повертає null якщо ОК, інакше текст помилки */
function checkLogin(name, password) {
  const key = name.trim().toLowerCase();
  const users = readUsers();
  const saved = users[key];

  if (saved && saved !== password) {
    return "Неправильний пароль для цього імені користувача.";
  }
  if (!saved) {
    users[key] = password;
    writeUsers(users);
  }
  return null;
}

function showPanel(showForm) {
  if (el.quiz) el.quiz.hidden = !showForm;
  if (el.panel) {
    el.panel.hidden = showForm;
    el.panel.style.display = showForm ? "none" : "flex";
  }
}

function setAuth(text) {
  if (el.authMsg) el.authMsg.textContent = text || "";
}

function tickTimer() {
  if (el.timer) el.timer.textContent = `Час проходження: ${formatTime(seconds)}`;
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  timerStart = Date.now();
  seconds = 0;
  tickTimer();
  timerId = setInterval(() => {
    seconds = Math.floor((Date.now() - timerStart) / 1000);
    tickTimer();
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  seconds = Math.floor((Date.now() - timerStart) / 1000);
  tickTimer();
}

function choiceHtml(q, num, type) {
  const saved = answers[q.id];
  const checkedList = Array.isArray(saved) ? saved : [];

  const opts = q.options
    .map((opt, i) => {
      const id = `q-${q.id}-${i}`;
      const safe = escapeHtml(opt);
      const checked =
        type === "radio"
          ? saved === opt
            ? "checked"
            : ""
          : checkedList.includes(opt)
            ? "checked"
            : "";

      return `<label for="${id}"><input type="${type}" id="${id}" name="q-${q.id}" value="${safe}" ${checked}> ${safe}</label>`;
    })
    .join("");

  return `
    <h2>Питання ${num}</h2>
    <p>${escapeHtml(q.question)}</p>
    <div>${opts}</div>
  `;
}

function textHtml(q, num) {
  const val = escapeHtml(answers[q.id] || "");
  return `
    <h2>Питання ${num}</h2>
    <p>${escapeHtml(q.question)}</p>
    <label for="t-${q.id}">Ваша відповідь:</label>
    <input type="text" id="t-${q.id}" name="q-${q.id}" autocomplete="off" value="${val}">
  `;
}

function updateNavButtons() {
  el.nav.forEach((btn, i) => btn.classList.toggle("is-active", i === index));
}

function updateButtons() {
  const last = index === questions.length - 1;
  if (el.finish) el.finish.hidden = !last;
  if (el.next) el.next.hidden = last;
}

function render() {
  const q = questions[index];
  if (!q || !el.question) return;

  const n = index + 1;
  if (q.type === "single") el.question.innerHTML = choiceHtml(q, n, "radio");
  else if (q.type === "multiple") el.question.innerHTML = choiceHtml(q, n, "checkbox");
  else el.question.innerHTML = textHtml(q, n);

  updateNavButtons();
  updateButtons();
}

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const x = [...a].sort().join("\0");
  const y = [...b].sort().join("\0");
  return x === y;
}

function correct(q, userVal) {
  if (q.type === "multiple") return sameSet(Array.isArray(userVal) ? userVal : [], q.answer);
  if (q.type === "text")
    return String(userVal || "").trim().toLowerCase() === String(q.answer).trim().toLowerCase();
  return userVal === q.answer;
}

function score() {
  return questions.reduce((s, q) => s + (correct(q, answers[q.id]) ? 1 : 0), 0);
}

function showResults(points) {
  if (!el.result) return;

  let prev = "Немає попереднього результату";
  const raw = localStorage.getItem(resultKey());
  if (raw) {
    const p = JSON.parse(raw);
    prev = `${p.score}/${p.total} (час: ${p.durationFormatted})`;
  }

  el.result.innerHTML = `
    <p>Користувач: <strong>${escapeHtml(userName)}</strong></p>
    <p>Поточний результат: <strong>${points}/${questions.length}</strong></p>
    <p>Час проходження: <strong>${formatTime(seconds)}</strong></p>
    <p>Попередній результат: <strong>${prev}</strong></p>
  `;
}

function saveAndExport(points) {
  const data = {
    user: userName,
    score: points,
    total: questions.length,
    durationSeconds: seconds,
    durationFormatted: formatTime(seconds),
    date: new Date().toISOString()
  };
  localStorage.setItem(resultKey(), JSON.stringify(data));

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "result.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return data;
}

function resetRound() {
  index = 0;
  Object.keys(answers).forEach((k) => delete answers[k]);
  if (el.result) el.result.innerHTML = "";
  if (el.retry) el.retry.hidden = true;
  if (el.finish) el.finish.hidden = true;
}

el.question?.addEventListener("change", () => {
  const q = questions[index];
  if (!q) return;
  if (q.type === "single") {
    const inp = el.question.querySelector(`input[name="q-${q.id}"]:checked`);
    answers[q.id] = inp ? inp.value : "";
  }
  if (q.type === "multiple") {
    answers[q.id] = Array.from(el.question.querySelectorAll(`input[name="q-${q.id}"]:checked`)).map((i) => i.value);
  }
});

el.question?.addEventListener("input", () => {
  const q = questions[index];
  if (!q || q.type !== "text") return;
  const inp = el.question.querySelector(`input[name="q-${q.id}"]`);
  answers[q.id] = inp ? inp.value.trim() : "";
});

el.nav.forEach((btn, i) => {
  btn.addEventListener("click", () => {
    index = i;
    render();
  });
});

el.next?.addEventListener("click", () => {
  if (index + 1 < questions.length) {
    index += 1;
    render();
  }
});

el.finish?.addEventListener("click", () => {
  stopTimer();
  const points = score();
  showResults(points);
  saveAndExport(points);
  if (el.finish) el.finish.hidden = true;
  if (el.next) el.next.hidden = true;
  if (el.retry) el.retry.hidden = false;
});

el.retry?.addEventListener("click", () => loadQuiz());

el.start?.addEventListener("click", () => {
  const name = el.name.value.trim();
  const pass = el.pass.value.trim();

  if (!name) return setAuth("Введіть ім'я користувача перед початком тесту.");
  if (!pass) return setAuth("Введіть пароль перед початком тесту.");

  const err = checkLogin(name, pass);
  if (err) return setAuth(err);

  userName = name;
  setAuth("");
  el.pass.value = "";
  if (el.userLabel) el.userLabel.textContent = `Поточний користувач: ${userName}`;

  showPanel(true);
  loadQuiz();
});

async function loadQuiz() {
  try {
    const res = await fetch(QUESTIONS_URL);
    if (!res.ok) throw new Error(res.status);
    questions = buildSet(await res.json());
    resetRound();
    render();
    startTimer();
  } catch (e) {
    console.error(e);
  }
}
