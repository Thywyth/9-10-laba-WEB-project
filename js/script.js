const QUESTIONS_SOURCE = "data/questions.json";
const QUESTIONS_PER_GROUP = 2;
const RESULT_STORAGE_PREFIX = "quiz-last-result-";

let selectedQuestions = [];
let currentQuestionIndex = 0;
const userAnswers = {};
const viewedQuestions = new Set();

const questionContainer = document.getElementById("question-container");
const resultContainer = document.getElementById("result-container");
const quizContent = document.getElementById("quiz-content");
const userPanel = document.getElementById("user-panel");
const timerDisplay = document.getElementById("timer-display");
const questionNavigationButtons = Array.from(document.querySelectorAll(".question-number"));
const userNameInput = document.getElementById("user-name-input");
const userPasswordInput = document.getElementById("user-password-input");
const startTestButton = document.getElementById("start-test-btn");
const currentUserLabel = document.getElementById("current-user-label");
const nextQuestionButton = document.getElementById("next-question-btn");
const finishTestButton = document.getElementById("finish-test-btn");
const retryTestButton = document.getElementById("retry-test-btn");

let timerId = null;
let startedAt = null;
let elapsedSeconds = 0;
let currentUserName = "";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shuffleArray(items) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [array[i], array[randomIndex]] = [array[randomIndex], array[i]];
  }

  return array;
}

function pickRandomQuestions(group, amount) {
  return shuffleArray(group).slice(0, amount);
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getUserStorageKey() {
  return `${RESULT_STORAGE_PREFIX}${currentUserName.trim().toLowerCase()}`;
}

function setQuizVisibility(isVisible) {
  if (quizContent) {
    quizContent.hidden = !isVisible;
  }

  if (userPanel) {
    userPanel.hidden = isVisible;
  }
}

function updateTimerText() {
  if (!timerDisplay) {
    return;
  }

  timerDisplay.textContent = `Час проходження: ${formatDuration(elapsedSeconds)}`;
}

function startTimer() {
  if (timerId) {
    clearInterval(timerId);
  }

  startedAt = Date.now();
  elapsedSeconds = 0;
  updateTimerText();

  timerId = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    updateTimerText();
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  updateTimerText();
}

function buildFinalQuestionSet(questionGroups) {
  const singleQuestions = pickRandomQuestions(questionGroups.single, QUESTIONS_PER_GROUP);
  const multipleQuestions = pickRandomQuestions(questionGroups.multiple, QUESTIONS_PER_GROUP);
  const textQuestions = pickRandomQuestions(questionGroups.text, QUESTIONS_PER_GROUP);

  return shuffleArray([...singleQuestions, ...multipleQuestions, ...textQuestions]);
}

function createSingleChoiceMarkup(question, questionNumber) {
  const savedAnswer = userAnswers[question.id];
  const optionsMarkup = question.options
    .map((option, optionIndex) => {
      const optionId = `q-${question.id}-single-${optionIndex}`;
      const isChecked = savedAnswer === option ? "checked" : "";
      const safeOption = escapeHtml(option);

      return `
        <label for="${optionId}">
          <input type="radio" id="${optionId}" name="question-${question.id}" value="${safeOption}" ${isChecked}>
          ${safeOption}
        </label>
      `;
    })
    .join("");

  return `
    <h2>Питання ${questionNumber}</h2>
    <p>${escapeHtml(question.question)}</p>
    <div>${optionsMarkup}</div>
  `;
}

function createMultipleChoiceMarkup(question, questionNumber) {
  const savedAnswers = Array.isArray(userAnswers[question.id]) ? userAnswers[question.id] : [];
  const optionsMarkup = question.options
    .map((option, optionIndex) => {
      const optionId = `q-${question.id}-multiple-${optionIndex}`;
      const isChecked = savedAnswers.includes(option) ? "checked" : "";
      const safeOption = escapeHtml(option);

      return `
        <label for="${optionId}">
          <input type="checkbox" id="${optionId}" name="question-${question.id}" value="${safeOption}" ${isChecked}>
          ${safeOption}
        </label>
      `;
    })
    .join("");

  return `
    <h2>Питання ${questionNumber}</h2>
    <p>${escapeHtml(question.question)}</p>
    <div>${optionsMarkup}</div>
  `;
}

function createTextMarkup(question, questionNumber) {
  const savedAnswer = userAnswers[question.id] || "";

  return `
    <h2>Питання ${questionNumber}</h2>
    <p>${escapeHtml(question.question)}</p>
    <label for="q-${question.id}-text">Ваша відповідь:</label>
    <input type="text" id="q-${question.id}-text" name="question-${question.id}" autocomplete="off" value="${escapeHtml(savedAnswer)}">
  `;
}

function updateNavigationState() {
  questionNavigationButtons.forEach((button, index) => {
    const isActive = index === currentQuestionIndex;
    button.classList.toggle("is-active", isActive);
  });
}

function updateFinishButtonVisibility() {
  const onLastQuestion = currentQuestionIndex === selectedQuestions.length - 1;

  if (finishTestButton) {
    finishTestButton.hidden = !onLastQuestion;
  }

  if (!nextQuestionButton) {
    return;
  }

  nextQuestionButton.hidden = onLastQuestion;
}

function renderQuestion(index) {
  const question = selectedQuestions[index];

  if (!question || !questionContainer) {
    return;
  }

  const questionNumber = index + 1;
  let markup = "";

  if (question.type === "single") {
    markup = createSingleChoiceMarkup(question, questionNumber);
  } else if (question.type === "multiple") {
    markup = createMultipleChoiceMarkup(question, questionNumber);
  } else {
    markup = createTextMarkup(question, questionNumber);
  }

  questionContainer.innerHTML = markup;
  viewedQuestions.add(index);
  updateNavigationState();
  updateFinishButtonVisibility();
}

function handleQuestionInput() {
  if (!questionContainer) {
    return;
  }

  questionContainer.addEventListener("change", () => {
    const question = selectedQuestions[currentQuestionIndex];

    if (!question) {
      return;
    }

    if (question.type === "single") {
      const selectedOption = questionContainer.querySelector(`input[name="question-${question.id}"]:checked`);
      userAnswers[question.id] = selectedOption ? selectedOption.value : "";
    }

    if (question.type === "multiple") {
      const selectedOptions = Array.from(
        questionContainer.querySelectorAll(`input[name="question-${question.id}"]:checked`)
      ).map((item) => item.value);

      userAnswers[question.id] = selectedOptions;
    }
  });

  questionContainer.addEventListener("input", () => {
    const question = selectedQuestions[currentQuestionIndex];

    if (!question || question.type !== "text") {
      return;
    }

    const textInput = questionContainer.querySelector(`input[name="question-${question.id}"]`);
    userAnswers[question.id] = textInput ? textInput.value.trim() : "";
  });
}

function handleQuestionNavigation() {
  questionNavigationButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      currentQuestionIndex = index;
      renderQuestion(currentQuestionIndex);
    });
  });

  if (nextQuestionButton) {
    nextQuestionButton.addEventListener("click", () => {
      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex >= selectedQuestions.length) {
        return;
      }

      currentQuestionIndex = nextIndex;
      renderQuestion(currentQuestionIndex);
    });
  }
}

function areArraysEqual(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
    return false;
  }

  const firstSorted = [...first].sort();
  const secondSorted = [...second].sort();

  return firstSorted.every((item, index) => item === secondSorted[index]);
}

function isAnswerCorrect(question, userAnswer) {
  if (question.type === "multiple") {
    const selected = Array.isArray(userAnswer) ? userAnswer : [];
    return areArraysEqual(selected, question.answer);
  }

  if (question.type === "text") {
    const normalizedUserAnswer = String(userAnswer || "").trim().toLowerCase();
    const normalizedCorrectAnswer = String(question.answer).trim().toLowerCase();
    return normalizedUserAnswer === normalizedCorrectAnswer;
  }

  return userAnswer === question.answer;
}

function calculateScore() {
  return selectedQuestions.reduce((score, question) => {
    const userAnswer = userAnswers[question.id];
    return isAnswerCorrect(question, userAnswer) ? score + 1 : score;
  }, 0);
}

function showResult(currentScore) {
  if (!resultContainer) {
    return;
  }

  const previousResultRaw = localStorage.getItem(getUserStorageKey());
  const previousResult = previousResultRaw ? JSON.parse(previousResultRaw) : null;

  const previousText = previousResult
    ? `${previousResult.score}/${previousResult.total} (час: ${previousResult.durationFormatted})`
    : "Немає попереднього результату";

  resultContainer.innerHTML = `
    <p>Користувач: <strong>${escapeHtml(currentUserName)}</strong></p>
    <p>Поточний результат: <strong>${currentScore}/${selectedQuestions.length}</strong></p>
    <p>Час проходження: <strong>${formatDuration(elapsedSeconds)}</strong></p>
    <p>Попередній результат: <strong>${previousText}</strong></p>
  `;
}

function saveResult(currentScore) {
  const resultData = {
    user: currentUserName,
    score: currentScore,
    total: selectedQuestions.length,
    durationSeconds: elapsedSeconds,
    durationFormatted: formatDuration(elapsedSeconds),
    date: new Date().toISOString()
  };

  localStorage.setItem(getUserStorageKey(), JSON.stringify(resultData));
  return resultData;
}

function exportResultToJson(resultData) {
  const jsonString = JSON.stringify(resultData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "result.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(downloadUrl);
}

function handleFinishTest() {
  if (!finishTestButton) {
    return;
  }

  finishTestButton.addEventListener("click", () => {
    stopTimer();
    const currentScore = calculateScore();
    showResult(currentScore);
    const resultData = saveResult(currentScore);
    exportResultToJson(resultData);

    finishTestButton.hidden = true;
    if (nextQuestionButton) {
      nextQuestionButton.hidden = true;
    }
    if (retryTestButton) {
      retryTestButton.hidden = false;
    }
  });
}

function resetQuizState() {
  currentQuestionIndex = 0;
  viewedQuestions.clear();
  Object.keys(userAnswers).forEach((key) => delete userAnswers[key]);

  if (resultContainer) {
    resultContainer.innerHTML = "";
  }

  if (retryTestButton) {
    retryTestButton.hidden = true;
  }

  if (finishTestButton) {
    finishTestButton.hidden = true;
  }
}

function handleRetryTest() {
  if (!retryTestButton) {
    return;
  }

  retryTestButton.addEventListener("click", () => {
    loadQuestions();
  });
}

function handleStartTest() {
  if (!startTestButton || !userNameInput || !userPasswordInput) {
    return;
  }

  startTestButton.addEventListener("click", () => {
    const enteredName = userNameInput.value.trim();
    const enteredPassword = userPasswordInput.value.trim();

    if (!enteredName) {
      alert("Введіть ім'я користувача перед початком тесту.");
      return;
    }

    if (!enteredPassword) {
      alert("Введіть пароль перед початком тесту.");
      return;
    }

    currentUserName = enteredName;

    if (currentUserLabel) {
      currentUserLabel.textContent = `Поточний користувач: ${currentUserName}`;
    }

    setQuizVisibility(true);
    loadQuestions();
  });
}

async function loadQuestions() {
  try {
    const response = await fetch(QUESTIONS_SOURCE);

    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.status}`);
    }

    const questionGroups = await response.json();
    selectedQuestions = buildFinalQuestionSet(questionGroups);
    resetQuizState();
    renderQuestion(currentQuestionIndex);
    startTimer();
  } catch (error) {
    console.error("Unable to load questions.", error);
  }
}

handleQuestionInput();
handleQuestionNavigation();
handleFinishTest();
handleRetryTest();
handleStartTest();
