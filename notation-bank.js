// Function-notation exercise bank — data only (no DOM), like domain-bank.js,
// whose difficulty/estimatedMinutes/tags conventions it mirrors.
//
// Each exercise gives a function by its formula (`prompt`) and asks for a
// value (`question`, e.g. "g(4)" or "f(1) + f(-1)"); the student types one
// number, checked against `answer` — any equivalent form counts (-1/4,
// -0.25, ...). `answerLatex` is how the solution is shown.
//
// The function's name (f/g/h) and variable (x about half the time, else
// t/s/u) are drawn at random every time, so students see that the letters
// don't matter.
//
// So far only level 1: plugging one number into one formula. A student
// doesn't need many of these — the bank is about variety, not volume.

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randNonzero(min, max) {
  let n;
  do { n = randInt(min, max); } while (n === 0);
  return n;
}

function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function randLetters() {
  return {
    f: pick(["f", "g", "h"]),
    v: Math.random() < 0.5 ? "x" : pick(["t", "s", "u"]),
  };
}

// a_n v^n + ... + a_0 as LaTeX, from [a_n, ..., a_0]: zero terms dropped,
// coefficient 1/-1 left implicit, signs folded in ("3t^2 - 5t + 3").
function polyLatex(coeffs, v) {
  const degree = coeffs.length - 1;
  let out = "";
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const power = degree - i;
    const abs = Math.abs(c);
    const varPart = power === 0 ? "" : power === 1 ? v : `${v}^${power}`;
    const coeffPart = abs === 1 && power > 0 ? "" : String(abs);
    if (out === "") out = (c < 0 ? "-" : "") + coeffPart + varPart;
    else out += (c < 0 ? " - " : " + ") + coeffPart + varPart;
  });
  return out === "" ? "0" : out;
}

function polyValue(coeffs, x) {
  return coeffs.reduce((acc, c) => acc * x + c, 0);
}

function gcd(a, b) {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

// num/den in lowest terms as LaTeX ("-\frac{1}{4}", or a plain integer).
function fractionLatex(num, den) {
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  if (d === 1) return String(n);
  return `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
}

// The shared shape of "plug point p into polynomial coeffs".
function polyAt(coeffs, p) {
  const { f, v } = randLetters();
  const answer = polyValue(coeffs, p);
  return {
    prompt: `${f}(${v}) = ${polyLatex(coeffs, v)}`,
    question: `${f}(${p})`,
    answer,
    answerLatex: String(answer),
  };
}

export const NOTATION_EXERCISES = [
  {
    // a*v + b at a positive integer — plain substitution.
    id: "linear-at-positive",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => polyAt([randNonzero(-9, 9), randNonzero(-9, 9)], randInt(1, 6)),
  },
  {
    // Negative slope at a negative point — minus times minus.
    id: "linear-at-negative",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => polyAt([randInt(-9, -2), randNonzero(-9, 9)], randInt(-6, -1)),
  },
  {
    // v^2 + bv + c at a negative point — squaring a negative.
    id: "quadratic-at-negative",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => polyAt([1, randNonzero(-9, 9), randInt(-9, 9)], randInt(-6, -1)),
  },
  {
    // -v^2 + c at a negative point: -(-2)^2 = -4, not 4.
    id: "neg-square-trap",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => polyAt([-1, 0, randNonzero(-9, 9)], randInt(-6, -2)),
  },
  {
    // A full quadratic at 0 — only the constant term survives.
    id: "quadratic-at-zero",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => polyAt([randNonzero(-9, 9), randNonzero(-9, 9), randNonzero(-9, 9)], 0),
  },
  {
    // f(v) = k — no variable in the formula, so every input gives k. A
    // large input makes it obvious there's nothing to compute.
    id: "constant",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => {
      const { f, v } = randLetters();
      const k = randNonzero(-9, 9);
      return {
        prompt: `${f}(${v}) = ${k}`,
        question: `${f}(${pick([randInt(10, 100), randInt(-50, -10)])})`,
        answer: k,
        answerLatex: String(k),
      };
    },
  },
  {
    // f(p) + f(-p) for v^2 + bv + c — two separate values, then added
    // (the bv terms cancel: 2p^2 + 2c).
    id: "sum-of-two-values",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 1,
    generate: () => {
      const { f, v } = randLetters();
      const coeffs = [1, randNonzero(-9, 9), randInt(-9, 9)];
      const p = randInt(1, 4);
      const answer = polyValue(coeffs, p) + polyValue(coeffs, -p);
      return {
        prompt: `${f}(${v}) = ${polyLatex(coeffs, v)}`,
        question: `${f}(${p}) + ${f}(-${p})`,
        answer,
        answerLatex: String(answer),
      };
    },
  },
  {
    // |v - a| at a point left of a, so the inside is negative.
    id: "abs-shifted",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => {
      const { f, v } = randLetters();
      const a = randNonzero(-6, 6);
      const p = randInt(a - 6, a - 1);
      const answer = Math.abs(p - a);
      return {
        prompt: `${f}(${v}) = \\left|${polyLatex([1, -a], v)}\\right|`,
        question: `${f}(${p})`,
        answer,
        answerLatex: String(answer),
      };
    },
  },
  {
    // v^3 + bv at a small negative point — an odd power keeps the sign.
    id: "cubic-at-negative",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 0.5,
    generate: () => polyAt([1, 0, randNonzero(-6, 6), 0], randInt(-3, -1)),
  },
  {
    // v^2 + bv + c at 1/2, -1/2, 1/3 or 2/3 — the answer is a fraction,
    // computed exactly: (n^2 + b*n*d + c*d^2) / d^2 for the point n/d.
    id: "quadratic-at-fraction",
    tags: ["basic"],
    difficulty: 1,
    estimatedMinutes: 1,
    generate: () => {
      const { f, v } = randLetters();
      const b = randNonzero(-5, 5);
      const c = randInt(-5, 5);
      const [n, d] = pick([[1, 2], [-1, 2], [1, 3], [2, 3]]);
      const num = n * n + b * n * d + c * d * d;
      const den = d * d;
      return {
        prompt: `${f}(${v}) = ${polyLatex([1, b, c], v)}`,
        question: `${f}\\left(${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}\\right)`,
        answer: num / den,
        answerLatex: fractionLatex(num, den),
      };
    },
  },
];
