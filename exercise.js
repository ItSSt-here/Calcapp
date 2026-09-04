import { createDomainBuilder, buildPreviewFragment, renderNumberLineSVG } from "./domain-builder-core.js";
import { domainsEqual } from "./domain-equivalence.js";

// Hard-coded exercise bank. Domain problems are too varied/structural to
// generate randomly, so each is authored by hand: a prompt (LaTeX, rendered
// with KaTeX) plus a correct answer expressed in the same segment shape the
// builder produces.
const ALL_REALS = { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: "\\infty" };

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randIntExcluding(min, max, exclude) {
  let v;
  do { v = randInt(min, max); } while (v === exclude);
  return v;
}

// Picks one variant at random — for exercises whose prompt differs but the
// correct answer doesn't (e.g. x/|x| vs |x|/x both exclude only 0).
function pick(options) {
  return options[randInt(0, options.length - 1)];
}

// Builds "x^2 + Bx + C" as LaTeX, dropping zero terms and folding signs in
// (e.g. B=-1 -> "- x", C=0 -> nothing) so the denominator always looks like
// a plain expanded quadratic, never a factored one.
function signedTerm(coeff, variable) {
  if (coeff === 0) return "";
  const sign = coeff < 0 ? "-" : "+";
  const abs = Math.abs(coeff);
  const magnitude = variable && abs === 1 ? "" : String(abs);
  return ` ${sign} ${magnitude}${variable}`;
}

function quadraticLatex(b, c) {
  return `x^2${signedTerm(b, "x")}${signedTerm(c, "")}`;
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
    // ln(x²) and ln(|x|) have the identical domain (R\{0}) — one exercise,
    // prompt picked at random each time.
    id: "ln-x2-or-abs-x",
    generate: () => ({
      prompt: pick(["f(x) = \\ln\\left(x^2\\right)", "f(x) = \\ln\\left(|x|\\right)"]),
      correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
    }),
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
  {
    id: "e-to-x",
    prompt: "f(x) = e^x",
    correct: [{ ...ALL_REALS }],
  },
  {
    // arcsin and arccos share the same domain [-1,1] — one exercise, prompt
    // picked at random each time.
    id: "arcsin-or-arccos",
    generate: () => ({
      prompt: pick(["f(x) = \\arcsin(x)", "f(x) = \\arccos(x)"]),
      correct: [{ type: "interval", leftClosed: true, leftVal: "-1", rightClosed: true, rightVal: "1" }],
    }),
  },
  {
    // arctan and arccot share the same domain R — one exercise, prompt
    // picked at random each time.
    id: "arctan-or-arccot",
    generate: () => ({
      prompt: pick(["f(x) = \\arctan(x)", "f(x) = \\operatorname{arccot}(x)"]),
      correct: [{ ...ALL_REALS }],
    }),
  },
  {
    // x/|x| and |x|/x share the same domain R\{0} — one exercise, prompt
    // picked at random each time.
    id: "x-over-abs-x",
    generate: () => ({
      prompt: pick(["f(x) = \\frac{x}{|x|}", "f(x) = \\frac{|x|}{x}"]),
      correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
    }),
  },
  {
    // 1/(x²+Bx+C) with the denominator always shown expanded, never
    // factored — the student has to find the roots (if any) themselves.
    // Which shape it is depends on which case gets rolled:
    //   70% two distinct roots a≠b:   (x-a)(x-b), excludes {a,b}
    //   15% one repeated root:        (x-a)²,      excludes {a}
    //   15% no real root:             (x-a)²+b>0,  excludes nothing (R)
    id: "one-over-quadratic",
    generate: () => {
      const roll = Math.random();
      let b, c, correct;
      if (roll < 0.70) {
        const a1 = randInt(-9, 9);
        const a2 = randIntExcluding(-9, 9, a1);
        b = -(a1 + a2);
        c = a1 * a2;
        const [lo, hi] = a1 < a2 ? [a1, a2] : [a2, a1];
        correct = [
          { ...ALL_REALS },
          { type: "point", pointVal: String(lo) },
          { type: "point", pointVal: String(hi) },
        ];
      } else if (roll < 0.85) {
        const a = randInt(-9, 9);
        b = -2 * a;
        c = a * a;
        correct = [{ ...ALL_REALS }, { type: "point", pointVal: String(a) }];
      } else {
        const a = randIntExcluding(-9, 9, 0);
        const k = randInt(1, 9);
        b = -2 * a;
        c = a * a + k;
        correct = [{ ...ALL_REALS }];
      }
      return {
        prompt: `f(x) = \\frac{1}{${quadraticLatex(b, c)}}`,
        correct,
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
const answerLabelEl = document.getElementById("answerLabel");
const previewEl = document.getElementById("preview");
const numberLineEl = document.getElementById("numberLine");
const confirmOverlayEl = document.getElementById("confirmOverlay");
const confirmTextEl = document.getElementById("confirmText");
const checkBtn = document.getElementById("checkBtn");
const solutionBtn = document.getElementById("solutionBtn");
const nextBtn = document.getElementById("nextBtn");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmBackBtn = document.getElementById("confirmBackBtn");

const builder = createDomainBuilder({
  segmentsEl: document.getElementById("segments"),
  previewEl,
  svgEl: numberLineEl,
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
  answerLabelEl.textContent = "Your answer";
  answerLabelEl.classList.remove("showing-solution");
  confirmOverlayEl.classList.add("hidden");
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
  confirmOverlayEl.classList.remove("hidden");
}

checkBtn.addEventListener("click", () => {
  const segments = builder.getSegments();

  if (segments.length > 0 && !builder.isValid()) {
    feedbackEl.className = "feedback info";
    feedbackEl.textContent = "Some rows are incomplete — fill in every value before checking.";
    confirmOverlayEl.classList.add("hidden");
    return;
  }

  const intervalSegments = segments.filter((s) => s.type === "interval");
  if (intervalSegments.length === 0) {
    // No interval at all — student may have entered only exclusion points
    // (a common shorthand for "all reals except these"), or nothing.
    showRealsSuggestion(segments.filter((s) => s.type === "point"));
    return;
  }

  confirmOverlayEl.classList.add("hidden");
  gradeSegments(segments);
});

confirmYesBtn.addEventListener("click", () => {
  confirmOverlayEl.classList.add("hidden");
  gradeSegments(pendingRealsGuess);
  pendingRealsGuess = null;
});

confirmBackBtn.addEventListener("click", () => {
  confirmOverlayEl.classList.add("hidden");
  pendingRealsGuess = null;
});

solutionBtn.addEventListener("click", () => {
  feedbackEl.className = "feedback";
  feedbackEl.textContent = "";
  confirmOverlayEl.classList.add("hidden");

  // Replace the student's own preview/number-line — not their input rows —
  // with the correct answer's, right where their own would normally render.
  answerLabelEl.textContent = "Solution (not necessarily the only correct form)";
  answerLabelEl.classList.add("showing-solution");
  previewEl.classList.remove("empty");
  previewEl.innerHTML = "";
  previewEl.appendChild(buildPreviewFragment(currentExercise.correct));
  renderNumberLineSVG(currentExercise.correct, numberLineEl);

  resolveExercise();
});

nextBtn.addEventListener("click", () => {
  loadExercise(pickExercise());
});

loadExercise(pickExercise());
