const QUESTIONS_SOURCE = "data/questions.json";
const QUESTIONS_PER_GROUP = 2;

let selectedQuestions = [];
let currentQuestionIndex = 0;
const userAnswers = {};

const questionContainer = document.getElementById("question-container");

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
  const optionsMarkup = question.options
    .map((option, optionIndex) => {
      const optionId = `q-${question.id}-single-${optionIndex}`;

      return `
        <label for="${optionId}">
          <input type="radio" id="${optionId}" name="question-${question.id}" value="${option}">
          ${option}
        </label>
      `;
    })
    .join("");

  return `
    <h2>Question ${questionNumber}</h2>
    <p>${question.question}</p>
    <div>${optionsMarkup}</div>
  `;
}

function createMultipleChoiceMarkup(question, questionNumber) {
  const optionsMarkup = question.options
    .map((option, optionIndex) => {
      const optionId = `q-${question.id}-multiple-${optionIndex}`;

      return `
        <label for="${optionId}">
          <input type="checkbox" id="${optionId}" name="question-${question.id}" value="${option}">
          ${option}
        </label>
      `;
    })
    .join("");

  return `
    <h2>Question ${questionNumber}</h2>
    <p>${question.question}</p>
    <div>${optionsMarkup}</div>
  `;
}

function createTextMarkup(question, questionNumber) {
  return `
    <h2>Question ${questionNumber}</h2>
    <p>${question.question}</p>
    <label for="q-${question.id}-text">Your answer:</label>
    <input type="text" id="q-${question.id}-text" name="question-${question.id}" autocomplete="off">
  `;
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

async function loadQuestions() {
  try {
    const response = await fetch(QUESTIONS_SOURCE);

    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.status}`);
    }

    const questionGroups = await response.json();
    selectedQuestions = buildFinalQuestionSet(questionGroups);
    currentQuestionIndex = 0;
    renderQuestion(currentQuestionIndex);
  } catch (error) {
    console.error("Unable to load questions.", error);
  }
}

handleQuestionInput();
loadQuestions();
