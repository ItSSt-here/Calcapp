import { createExercisePage } from "./exercise-controller.js";

// Placeholder exercise bank — a real bank (mirroring the domain one, with
// difficulty levels and generated variants) comes later. For now, just
// enough to exercise the page end to end.
const RANGE_EXERCISES = [
  {
    id: "exp",
    prompt: "f(x) = e^x",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
];

let lastExerciseId = null;

function pickExercise() {
  const pool = RANGE_EXERCISES.length > 1 && lastExerciseId !== null
    ? RANGE_EXERCISES.filter((e) => e.id !== lastExerciseId)
    : RANGE_EXERCISES;
  const def = pool[Math.floor(Math.random() * pool.length)];
  lastExerciseId = def.id;
  return { ...def };
}

createExercisePage(pickExercise);
