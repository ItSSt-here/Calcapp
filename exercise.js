import { createDomainBuilder, buildPreviewFragment } from "./domain-builder-core.js";
import { domainsEqual } from "./domain-equivalence.js";

// Hard-coded exercise bank. Domain problems are too varied/structural to
// generate randomly, so each is authored by hand: a prompt (LaTeX, rendered
// with KaTeX) plus a correct answer expressed in the same segment shape the
// builder produces.
const ALL_REALS = { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: "\\infty" };

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const EXERCISES = [
  {
    id: "ln-x",
    prompt: "f(x) = \\ln(x)",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    id: "ln-x2",
    prompt: "f(x) = \\ln\\left(x^2\\right)",
    correct: [
      { ...ALL_REALS },
      { type: "point", pointVal: "0" },
    ],
  },
  {
    id: "ln-abs-x",
    prompt: "f(x) = \\ln\\left(|x|\\right)",
    correct: [
      { ...ALL_REALS },
      { type: "point", pointVal: "0" },
    ],
  },
  {
    // x²+a is at least a (>0 for any a in [1,10]), so ln is always defined —
    // the domain is all reals regardless of which a gets rolled.
    id: "ln-x2-plus-a",
    generate: () => {
      const a = randInt(1, 10);
      return {
        prompt: `f(x) = \\ln\\left(x^2+${a}\\right)`,
        correct: [{ ...ALL_REALS }],
      };
    },
  },
  {
    // x²-a > 0  <=>  |x| > √a — the boundary depends on the rolled a, so the
    // correct answer is computed fresh alongside the prompt each time.
    id: "ln-x2-minus-a",
    generate: () => {
      const a = randInt(1, 10);
      return {
        prompt: `f(x) = \\ln\\left(x^2-${a}\\right)`,
        correct: [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: `-\\sqrt{${a}}` },
          { type: "interval", leftClosed: false, leftVal: `\\sqrt{${a}}`, rightClosed: false, rightVal: "\\infty" },
        ],
      };
    },
  },
];

function instantiateExercise(def) {
  const rolled = def.generate ? def.generate() : { prompt: def.prompt, correct: def.correct };
  return { id: def.id, ...rolled };
}

const problemTextEl = document.getElementById("problemText");
const feedbackEl = document.getElementById("feedback");
const solutionBoxEl = document.getElementById("solutionBox");
const solutionPreviewEl = document.getElementById("solutionPreview");
const confirmBoxEl = document.getElementById("confirmBox");
const confirmTextEl = document.getElementById("confirmText");
const checkBtn = document.getElementById("checkBtn");
const solutionBtn = document.getElementById("solutionBtn");
const nextBtn = document.getElementById("nextBtn");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmBackBtn = document.getElementById("confirmBackBtn");

const builder = createDomainBuilder({
  segmentsEl: document.getElementById("segments"),
  previewEl: document.getElementById("preview"),
  svgEl: document.getElementById("numberLine"),
}, {
  initialSegments: [
    { type: "interval", leftClosed: true, leftVal: "", rightClosed: false, rightVal: "" },
  ],
});

document.getElementById("addIntervalBtn").addEventListener("click", () => builder.addInterval());
document.getElementById("addPointBtn").addEventListener("click", () => builder.addPoint());
document.getElementById("clearBtn").addEventListener("click", () => builder.clear());

let currentExercise = null;
let pendingRealsGuess = null; // synthetic segments awaiting confirmation via the ℝ-suggestion dialog

function pickExercise() {
  const pool = EXERCISES.length > 1 && currentExercise
    ? EXERCISES.filter((e) => e.id !== currentExercise.id)
    : EXERCISES;
  const def = pool[Math.floor(Math.random() * pool.length)];
  return instantiateExercise(def);
}

function loadExercise(exercise) {
  currentExercise = exercise;
  katex.render(exercise.prompt, problemTextEl, { throwOnError: false, displayMode: true });

  builder.setSegments([
    { type: "interval", leftClosed: true, leftVal: "", rightClosed: false, rightVal: "" },
  ]);

  feedbackEl.className = "feedback";
  feedbackEl.textContent = "";
  solutionBoxEl.classList.add("hidden");
  solutionPreviewEl.innerHTML = "";
  confirmBoxEl.classList.add("hidden");
  pendingRealsGuess = null;

  checkBtn.disabled = false;
  solutionBtn.classList.remove("hidden");
  nextBtn.classList.add("hidden");
}

function resolveExercise() {
  // Exercise is "done" (solved or given up on) — stop further checking,
  // only "Another exercise" moves things forward.
  checkBtn.disabled = true;
  solutionBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
}

function gradeSegments(segments) {
  if (domainsEqual(segments, currentExercise.correct)) {
    feedbackEl.className = "feedback correct";
    feedbackEl.textContent = "✓ Correct!";
    resolveExercise();
  } else {
    feedbackEl.className = "feedback incorrect";
    feedbackEl.textContent = "✗ Not quite — try again.";
  }
}

function showRealsSuggestion(pointSegments) {
  let latex = "\\mathbb{R} = (-\\infty, \\infty)";
  if (pointSegments.length) {
    latex += ",\\quad " + pointSegments.map((p) => `x \\neq ${p.pointVal}`).join(",\\ ");
  }
  katex.render(latex, confirmTextEl, { throwOnError: false });

  pendingRealsGuess = [{ ...ALL_REALS }, ...pointSegments];
  feedbackEl.className = "feedback";
  feedbackEl.textContent = "";
  confirmBoxEl.classList.remove("hidden");
}

checkBtn.addEventListener("click", () => {
  const segments = builder.getSegments();

  if (segments.length > 0 && !builder.isValid()) {
    feedbackEl.className = "feedback info";
    feedbackEl.textContent = "Some rows are incomplete — fill in every value before checking.";
    confirmBoxEl.classList.add("hidden");
    return;
  }

  const intervalSegments = segments.filter((s) => s.type === "interval");
  if (intervalSegments.length === 0) {
    // No interval at all — student may have entered only exclusion points
    // (a common shorthand for "all reals except these"), or nothing.
    showRealsSuggestion(segments.filter((s) => s.type === "point"));
    return;
  }

  confirmBoxEl.classList.add("hidden");
  gradeSegments(segments);
});

confirmYesBtn.addEventListener("click", () => {
  confirmBoxEl.classList.add("hidden");
  gradeSegments(pendingRealsGuess);
  pendingRealsGuess = null;
});

confirmBackBtn.addEventListener("click", () => {
  confirmBoxEl.classList.add("hidden");
  pendingRealsGuess = null;
});

solutionBtn.addEventListener("click", () => {
  feedbackEl.className = "feedback";
  feedbackEl.textContent = "";
  confirmBoxEl.classList.add("hidden");
  solutionBoxEl.classList.remove("hidden");
  solutionPreviewEl.innerHTML = "";
  solutionPreviewEl.appendChild(buildPreviewFragment(currentExercise.correct));
  resolveExercise();
});

nextBtn.addEventListener("click", () => {
  loadExercise(pickExercise());
});

loadExercise(pickExercise());
