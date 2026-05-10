const QUESTIONS_SOURCE = "data/questions.json";
const QUESTIONS_PER_GROUP = 2;
const RESULT_STORAGE_KEY = "quiz-last-result";

let selectedQuestions = [];
let currentQuestionIndex = 0;
const userAnswers = {};
const viewedQuestions = new Set();

const questionContainer = document.getElementById("question-container");
const resultContainer = document.getElementById("result-container");
const questionNavigationButtons = Array.from(document.querySelectorAll(".question-number"));
const nextQuestionButton = document.getElementById("next-question-btn");
const finishTestButton = document.getElementById("finish-test-btn");

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
    <h2>Question ${questionNumber}</h2>
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
    <h2>Question ${questionNumber}</h2>
    <p>${escapeHtml(question.question)}</p>
    <div>${optionsMarkup}</div>
  `;
}

function createTextMarkup(question, questionNumber) {
  const savedAnswer = userAnswers[question.id] || "";

  return `
    <h2>Question ${questionNumber}</h2>
    <p>${escapeHtml(question.question)}</p>
    <label for="q-${question.id}-text">Your answer:</label>
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
  const allQuestionsViewed = viewedQuestions.size === selectedQuestions.length;

  if (!finishTestButton) {
    return;
  }

  finishTestButton.hidden = !(onLastQuestion || allQuestionsViewed);
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

  const previousResultRaw = localStorage.getItem(RESULT_STORAGE_KEY);
  const previousResult = previousResultRaw ? JSON.parse(previousResultRaw) : null;

  const previousText = previousResult
    ? `${previousResult.score}/${previousResult.total}`
    : "No previous result";

  resultContainer.innerHTML = `
    <p>Current result: <strong>${currentScore}/${selectedQuestions.length}</strong></p>
    <p>Previous result: <strong>${previousText}</strong></p>
  `;
}

function saveResult(currentScore) {
  const resultData = {
    score: currentScore,
    total: selectedQuestions.length,
    date: new Date().toISOString()
  };

  localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultData));
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
    const currentScore = calculateScore();
    showResult(currentScore);
    const resultData = saveResult(currentScore);
    exportResultToJson(resultData);
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
    currentQuestionIndex = 0;
    viewedQuestions.clear();
    renderQuestion(currentQuestionIndex);
  } catch (error) {
    console.error("Unable to load questions.", error);
  }
}

handleQuestionInput();
handleQuestionNavigation();
handleFinishTest();
loadQuestions();
