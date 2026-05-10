const QUESTIONS_SOURCE = "data/questions.json";
const QUESTIONS_PER_GROUP = 2;

let selectedQuestions = [];

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

async function loadQuestions() {
  try {
    const response = await fetch(QUESTIONS_SOURCE);

    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.status}`);
    }

    const questionGroups = await response.json();
    selectedQuestions = buildFinalQuestionSet(questionGroups);

    console.log("Loaded questions:", selectedQuestions);
  } catch (error) {
    console.error("Unable to load questions.", error);
  }
}

loadQuestions();
