// Complex-numbers practice — a standalone sibling of Calcapp's practice page.
// Four "levels", one per operation (add, subtract, multiply, divide). Every
// exercise is rolled fresh from two complex numbers with integer parts in
// ±9; the answer is always a + bi with integer a, b, typed into two boxes.

const OPS = {
  1: { name: "Addition", short: "Add" },
  2: { name: "Subtraction", short: "Subtract" },
  3: { name: "Multiplication", short: "Multiply" },
  4: { name: "Division", short: "Divide" },
};
const LEVELS = [1, 2, 3, 4];
const STORAGE_KEY = "complexapp-operations-v1";

// ---------------------------------------------------------------------------
// Numbers and LaTeX
// ---------------------------------------------------------------------------

// A non-zero integer in [-9, 9] — zero parts would make "3 + 0i" style
// operands that don't look like complex numbers to a beginner.
function randPart() {
  const n = 1 + Math.floor(Math.random() * 9);
  return Math.random() < 0.5 ? -n : n;
}

const randComplex = () => ({ re: randPart(), im: randPart() });

const mul = (z, w) => ({ re: z.re * w.re - z.im * w.im, im: z.re * w.im + z.im * w.re });

// a + bi in its usual written form: 3 - 2i, -i, 4, 5i, 0.
function fmt({ re, im }) {
  if (im === 0) return `${re}`;
  const imAbs = Math.abs(im) === 1 ? "" : `${Math.abs(im)}`;
  if (re === 0) return `${im < 0 ? "-" : ""}${imAbs}i`;
  return `${re} ${im < 0 ? "-" : "+"} ${imAbs}i`;
}

// A number inside a sum/product, bracketed when negative: 3 + (-4).
const p = (n) => (n < 0 ? `(${n})` : `${n}`);

// ---------------------------------------------------------------------------
// Exercises: prompt + correct answer + worked solution
// ---------------------------------------------------------------------------

function makeExercise(level) {
  if (level === 4) {
    // Roll the divisor and the quotient, then multiply them to get the
    // dividend — so the answer always comes out with integer parts.
    const w = randComplex();
    const answer = randComplex();
    const z = mul(answer, w);
    const conj = { re: w.re, im: -w.im };
    const norm = w.re * w.re + w.im * w.im;
    const top = mul(z, conj); // = answer · norm
    return {
      level,
      prompt: `\\dfrac{${fmt(z)}}{${fmt(w)}}`,
      answer,
      steps: [
        { note: `Multiply top and bottom by the conjugate of the denominator, ${fmt(conj).replace(/-/g, "−")}:` },
        { latex: `\\dfrac{${fmt(z)}}{${fmt(w)}} = \\dfrac{(${fmt(z)})(${fmt(conj)})}{(${fmt(w)})(${fmt(conj)})}` },
        { note: "The denominator becomes a real number (real part² + imaginary part²):" },
        { latex: `(${fmt(w)})(${fmt(conj)}) = ${p(w.re)}^2 + ${p(w.im)}^2 = ${norm}` },
        { note: "The numerator, multiplied out (using i² = −1):" },
        { latex: `(${fmt(z)})(${fmt(conj)}) = ${fmt(top)}` },
        { note: "Divide each part by the denominator:" },
        { latex: `\\dfrac{${fmt(top)}}{${norm}} = \\dfrac{${top.re}}{${norm}} + \\dfrac{${top.im}}{${norm}}\\,i = ${fmt(answer)}` },
      ],
    };
  }

  const z = randComplex();
  const w = randComplex();

  if (level === 1) {
    const answer = { re: z.re + w.re, im: z.im + w.im };
    return {
      level,
      prompt: `(${fmt(z)}) + (${fmt(w)})`,
      answer,
      steps: [
        { note: "Add the real parts together and the imaginary parts together:" },
        { latex: `(${z.re} + ${p(w.re)}) + (${z.im} + ${p(w.im)})\\,i = ${fmt(answer)}` },
      ],
    };
  }

  if (level === 2) {
    const answer = { re: z.re - w.re, im: z.im - w.im };
    return {
      level,
      prompt: `(${fmt(z)}) - (${fmt(w)})`,
      answer,
      steps: [
        { note: "Subtract the real parts and the imaginary parts separately:" },
        { latex: `(${z.re} - ${p(w.re)}) + (${z.im} - ${p(w.im)})\\,i = ${fmt(answer)}` },
      ],
    };
  }

  const answer = mul(z, w);
  const { re: a, im: b } = z;
  const { re: c, im: d } = w;
  return {
    level,
    prompt: `(${fmt(z)})(${fmt(w)})`,
    answer,
    steps: [
      { note: "Open the brackets — every term times every term:" },
      { latex: `${a}\\cdot${p(c)} + ${p(a)}\\cdot${p(d)}\\,i + ${p(b)}\\cdot${p(c)}\\,i + ${p(b)}\\cdot${p(d)}\\,i^2` },
      { latex: `= ${a * c} + ${p(a * d)}\\,i + ${p(b * c)}\\,i + ${p(b * d)}\\,i^2` },
      { note: "Replace i² by −1, then collect the real and imaginary parts:" },
      { latex: `= (${a * c} - ${p(b * d)}) + (${a * d} + ${p(b * c)})\\,i = ${fmt(answer)}` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Operation filter (same behavior as Calcapp's difficulty filter)
// ---------------------------------------------------------------------------

const difficultyFilterEl = document.getElementById("difficultyFilter");
const difficultyButtons = Array.from(difficultyFilterEl.querySelectorAll(".difficulty-btn"));
const levelChangeNoteEl = document.getElementById("levelChangeNote");

function loadSelected() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0 && saved.every((n) => LEVELS.includes(n))) {
      return new Set(saved);
    }
  } catch {}
  return new Set(LEVELS);
}

const selected = loadSelected();

function renderFilter() {
  for (const btn of difficultyButtons) {
    btn.classList.toggle("active", selected.has(Number(btn.dataset.level)));
  }
}
renderFilter();

difficultyFilterEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".difficulty-btn");
  if (!btn) return;
  const level = Number(btn.dataset.level);
  if (selected.has(level)) {
    if (selected.size === 1) return; // keep at least one operation on
    selected.delete(level);
  } else {
    selected.add(level);
  }
  renderFilter();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
  } catch {}
  // The exercise on screen stays — the selection applies from the next one.
  levelChangeNoteEl.hidden = false;
});

document.getElementById("newExerciseNowBtn").addEventListener("click", () => next());

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const problemCardSlotEl = document.getElementById("problemCardSlot");
const problemCardEl = document.getElementById("problemCard");
const problemLevelEl = document.getElementById("problemLevel");
const problemLabelEl = document.getElementById("problemLabel");
const problemTextEl = document.getElementById("problemText");
const answerCardEl = document.getElementById("answerCard");
const badgeEl = answerCardEl.querySelector(".answer-badge");
const statusTextEl = answerCardEl.querySelector(".answer-status-text");
const reInput = document.getElementById("reInput");
const imInput = document.getElementById("imInput");
const solutionLabelEl = document.getElementById("solutionLabel");
const solutionEl = document.getElementById("solution");
const checkBtn = document.getElementById("checkBtn");
const solutionBtn = document.getElementById("solutionBtn");
const nextBtn = document.getElementById("nextBtn");
const feedbackEl = document.getElementById("feedback");

let current = null;

// null (working), "solution", "correct" or "incorrect" — see Calcapp's
// exercise-controller.js, which this mirrors.
function setAnswerState(state) {
  answerCardEl.classList.remove("correct", "incorrect", "solution");
  badgeEl.className = "answer-badge";
  badgeEl.textContent = "";
  statusTextEl.className = "answer-status-text";
  statusTextEl.textContent = "";
  if (!state) return;
  if (state === "solution") {
    answerCardEl.classList.add("solution");
    return;
  }
  void answerCardEl.offsetWidth; // restart the shake on a repeated wrong answer
  answerCardEl.classList.add(state);
  badgeEl.classList.add("show", state);
  badgeEl.textContent = state === "correct" ? "✓" : "✗";
  statusTextEl.classList.add("show", state);
  statusTextEl.textContent = state === "correct" ? "Correct" : "Incorrect";
}

function setFeedback(text = "") {
  feedbackEl.className = text ? "feedback info" : "feedback";
  feedbackEl.textContent = text;
}

function pickLevel() {
  const levels = [...selected];
  return levels[Math.floor(Math.random() * levels.length)];
}

let outgoingClone = null;

function slideOutCurrentCard() {
  if (outgoingClone) outgoingClone.remove();
  const rect = problemCardEl.getBoundingClientRect();
  const slotRect = problemCardSlotEl.getBoundingClientRect();
  const clone = problemCardEl.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  clone.classList.add("problem-card-outgoing");
  clone.style.left = `${rect.left - slotRect.left}px`;
  clone.style.top = `${rect.top - slotRect.top}px`;
  clone.style.width = `${rect.width}px`;
  problemCardSlotEl.appendChild(clone);
  outgoingClone = clone;
  void clone.offsetWidth;
  clone.classList.add("animate-out");
  clone.addEventListener("transitionend", () => {
    clone.remove();
    if (outgoingClone === clone) outgoingClone = null;
  }, { once: true });
}

function loadExercise({ animate = false } = {}) {
  if (animate && current) slideOutCurrentCard();
  levelChangeNoteEl.hidden = true;
  current = makeExercise(pickLevel());

  problemCardEl.dataset.level = current.level;
  problemLevelEl.textContent = OPS[current.level].name;
  problemLabelEl.textContent = "Compute and write the result as a + bi:";
  katex.render(current.prompt, problemTextEl, { throwOnError: false, displayMode: true });

  reInput.value = "";
  imInput.value = "";
  reInput.disabled = false;
  imInput.disabled = false;
  solutionLabelEl.classList.add("hidden");
  solutionEl.classList.add("hidden");
  solutionEl.innerHTML = "";
  setFeedback();
  setAnswerState(null);

  checkBtn.disabled = false;
  solutionBtn.classList.remove("hidden");
  nextBtn.classList.add("hidden");
}

function resolveExercise() {
  checkBtn.disabled = true;
  solutionBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
  nextBtn.focus();
}

// A whole number, allowing a leading +/− (and the Unicode minus sign).
function readPart(input) {
  const text = input.value.replace(/\s+/g, "").replace(/[−–]/g, "-");
  if (text === "") return { empty: true };
  if (!/^[+-]?\d+$/.test(text)) return { invalid: true };
  return { value: Number(text) };
}

checkBtn.addEventListener("click", () => {
  const re = readPart(reInput);
  const im = readPart(imInput);
  if (re.empty || im.empty) {
    setFeedback("Fill in both boxes — write 0 if a part is zero.");
    return;
  }
  if (re.invalid || im.invalid) {
    setFeedback("Each box takes one whole number, like 7 or -3.");
    return;
  }
  setFeedback();
  if (re.value === current.answer.re && im.value === current.answer.im) {
    setAnswerState("correct");
    reInput.disabled = true;
    imInput.disabled = true;
    resolveExercise();
  } else {
    setAnswerState("incorrect");
  }
});

solutionBtn.addEventListener("click", () => {
  setFeedback();
  setAnswerState("solution");
  solutionLabelEl.classList.remove("hidden");
  solutionEl.classList.remove("hidden");
  solutionEl.innerHTML = "";
  for (const step of current.steps) {
    const el = document.createElement("div");
    if (step.note) {
      el.className = "step-note";
      el.textContent = step.note;
    } else {
      katex.render(step.latex, el, { throwOnError: false, displayMode: true });
    }
    solutionEl.appendChild(el);
  }
  resolveExercise();
});

const next = () => loadExercise({ animate: true });
nextBtn.addEventListener("click", next);

for (const input of [reInput, imInput]) {
  input.addEventListener("input", () => {
    setAnswerState(null);
    setFeedback();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (input === reInput && imInput.value.trim() === "") imInput.focus();
    else if (!checkBtn.disabled) checkBtn.click();
  });
}

loadExercise();
