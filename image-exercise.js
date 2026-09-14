import { createExercisePage } from "./exercise-controller.js";

// Placeholder exercise bank — a real bank (mirroring the domain one, with
// difficulty levels and generated variants) comes later. For now, just
// enough to exercise the page end to end.
//
// Unlike a domain problem, an image problem is only well-posed once the
// function's own domain is pinned down too (restrict the domain and the
// image can change) — so every exercise states the full f: A -> B
// signature as a small caption, kept separate from the (bigger) formula.
const IMAGE_EXERCISES = [
  {
    id: "exp",
    signature: "f: \\mathbb{R} \\to \\mathbb{R}",
    prompt: "f(x) = e^x",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
];

let lastExerciseId = null;

function pickExercise() {
  const pool = IMAGE_EXERCISES.length > 1 && lastExerciseId !== null
    ? IMAGE_EXERCISES.filter((e) => e.id !== lastExerciseId)
    : IMAGE_EXERCISES;
  const def = pool[Math.floor(Math.random() * pool.length)];
  lastExerciseId = def.id;
  return { ...def };
}

createExercisePage(pickExercise);
