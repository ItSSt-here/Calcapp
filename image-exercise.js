import { createExercisePage } from "./exercise-controller.js";

// Exercise bank — mirrors the domain one's difficulty/estimatedMinutes
// convention (see exercise.js for the full rubric). So far every entry is
// L1: reading off the range of one elementary function directly, no
// algebra or case-split.
//
// Unlike a domain problem, an image problem is only well-posed once the
// function's own domain is pinned down too (restrict the domain and the
// image can change) — so every exercise states the full f: A -> B
// signature as a small caption, kept separate from the (bigger) formula.
const ALL_REALS = { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: "\\infty" };

const IMAGE_EXERCISES = [
  {
    id: "exp",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = e^x",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // x^2 >= 0 always, and hits every non-negative value.
    id: "x-squared",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = x^2",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // |x| >= 0 always, same range shape as x^2.
    id: "abs-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = |x|",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // x^3 is a bijection R -> R (odd, strictly increasing, unbounded both ways).
    id: "x-cubed",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = x^3",
    correct: [{ ...ALL_REALS }],
  },
  {
    // sin and cos share the same range [-1,1] — prompt picked at random
    // each time, same pattern as the domain bank's arcsin-or-arccos.
    id: "sin-or-cos",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    generate: () => ({
      prompt: Math.random() < 0.5 ? "f(x) = \\sin(x)" : "f(x) = \\cos(x)",
      correct: [{ type: "interval", leftClosed: true, leftVal: "-1", rightClosed: true, rightVal: "1" }],
    }),
  },
  {
    // ln maps its whole domain (0,∞) onto all of R.
    id: "ln-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: (0, \\infty) \\to \\mathbb{R}",
    prompt: "f(x) = \\ln(x)",
    correct: [{ ...ALL_REALS }],
  },
  {
    // 1/x hits every real except 0 (never 0 itself, since a fraction with a
    // nonzero numerator can't vanish).
    id: "one-over-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\setminus \\{0\\} \\to \\mathbb{R}",
    prompt: "f(x) = \\frac{1}{x}",
    correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
  },
  {
    // sqrt(x) on its natural domain [0,∞) covers every non-negative value.
    id: "sqrt-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: [0, \\infty) \\to \\mathbb{R}",
    prompt: "f(x) = \\sqrt{x}",
    correct: [{ type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" }],
  },
  {
    // arcsin's range is the closed interval [-pi/2, pi/2].
    id: "arcsin-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: [-1, 1] \\to \\mathbb{R}",
    prompt: "f(x) = \\arcsin(x)",
    correct: [{ type: "interval", leftClosed: true, leftVal: "-\\frac{\\pi}{2}", rightClosed: true, rightVal: "\\frac{\\pi}{2}" }],
  },
  {
    // arccos's range is the closed interval [0, pi].
    id: "arccos-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: [-1, 1] \\to \\mathbb{R}",
    prompt: "f(x) = \\arccos(x)",
    correct: [{ type: "interval", leftClosed: true, leftVal: "0", rightClosed: true, rightVal: "\\pi" }],
  },
  {
    // arctan's range is the open interval (-pi/2, pi/2) — the horizontal
    // asymptotes are approached but never reached.
    id: "arctan-x",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = \\arctan(x)",
    correct: [{ type: "interval", leftClosed: false, leftVal: "-\\frac{\\pi}{2}", rightClosed: false, rightVal: "\\frac{\\pi}{2}" }],
  },
  {
    // x^4 >= 0 always, same range shape as x^2.
    id: "x-to-4",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = x^4",
    correct: [{ type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" }],
  },
  {
    // -x^2 <= 0 always — the mirror image of x^2.
    id: "neg-x-squared",
    difficulty: 1,
    estimatedMinutes: 0.5,
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = -x^2",
    correct: [{ type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: "0" }],
  },
];

function instantiateExercise(def) {
  const rolled = def.generate ? def.generate() : { prompt: def.prompt, correct: def.correct };
  return { id: def.id, difficulty: def.difficulty, estimatedMinutes: def.estimatedMinutes, signature: def.signature, ...rolled };
}

let lastExerciseId = null;

function pickExercise() {
  const pool = IMAGE_EXERCISES.length > 1 && lastExerciseId !== null
    ? IMAGE_EXERCISES.filter((e) => e.id !== lastExerciseId)
    : IMAGE_EXERCISES;
  const def = pool[Math.floor(Math.random() * pool.length)];
  lastExerciseId = def.id;
  return instantiateExercise(def);
}

createExercisePage(pickExercise);
