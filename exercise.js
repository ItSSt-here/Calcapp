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

// "-x^2 + Bx + C" — the same quadratic with every coefficient's sign flipped,
// for the downward-opening-parabola exercises.
function negQuadraticLatex(b, c) {
  return `-x^2${signedTerm(-b, "x")}${signedTerm(-c, "")}`;
}

// "Ax + B", A guaranteed nonzero so it's always a genuine linear term.
function linearLatex(a, b) {
  const abs = Math.abs(a);
  const magnitude = abs === 1 ? "" : String(abs);
  return `${a < 0 ? "-" : ""}${magnitude}x${signedTerm(b, "")}`;
}

// Two distinct integer roots -9..9, and the (b, c) of the expanded
// x^2 + bx + c that has them — shared by every "quadratic with two roots"
// exercise case.
function randTwoRoots() {
  const a1 = randInt(-9, 9);
  const a2 = randIntExcluding(-9, 9, a1);
  const [lo, hi] = a1 < a2 ? [a1, a2] : [a2, a1];
  return { lo, hi, b: -(a1 + a2), c: a1 * a2 };
}

// A nonzero coefficient (|a| >= 2, so it's never invisible in the prompt)
// and the b that puts ax+b's root at a clean integer.
function randLinearWithRoot() {
  const r = randInt(-6, 6);
  let a;
  do { a = randInt(-5, 5); } while (Math.abs(a) < 2);
  return { a, b: -a * r, r };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// a/b already in lowest terms, b >= 2 (never an integer exponent in disguise).
function randCoprimeFraction() {
  let a, b;
  do {
    b = randInt(2, 6);
    a = randInt(1, 9);
  } while (gcd(a, b) !== 1);
  return { a, b };
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
    // ln(ax+b): needs ax+b > 0 — same root/sign logic as sqrt-linear, but
    // strict since ln(0) is undefined too.
    id: "ln-linear",
    generate: () => {
      const { a, b, r } = randLinearWithRoot();
      return {
        prompt: `f(x) = \\ln\\left(${linearLatex(a, b)}\\right)`,
        correct: [
          a > 0
            ? { type: "interval", leftClosed: false, leftVal: String(r), rightClosed: false, rightVal: "\\infty" }
            : { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(r) },
        ],
      };
    },
  },
  {
    // 1/ln(ax+b): needs ax+b > 0 (ln defined) AND ax+b != 1 (ln != 0, so the
    // reciprocal is defined). Two boundary x-values, r0 where ax+b=0 and r1
    // where ax+b=1 — for BOTH to land on clean integers we need a = ±1,
    // since r1 - r0 = 1/a forces a to divide 1. With a = ±1, r1 = r0 + a.
    id: "one-over-ln-linear",
    generate: () => {
      const r0 = randInt(-6, 6);
      const a = Math.random() < 0.5 ? 1 : -1;
      const b = -a * r0;
      const r1 = r0 + a;
      return {
        prompt: `f(x) = \\frac{1}{\\ln\\left(${linearLatex(a, b)}\\right)}`,
        correct: [
          a > 0
            ? { type: "interval", leftClosed: false, leftVal: String(r0), rightClosed: false, rightVal: "\\infty" }
            : { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(r0) },
          { type: "point", pointVal: String(r1) },
        ],
      };
    },
  },
  {
    // 1/ln(x^2+Bx+C): needs the quadratic > 0 (ln defined) AND != 1 (ln !=
    // 0). The two boundary discriminants always differ by exactly 4
    // (D1 = D0 + 4, from completing q(x)=1 as q(x)-1=0), which rules out
    // ever having two *distinct* clean integer roots at both levels — that
    // would need D0=k^2 and D0+4=m^2 simultaneously, forcing the
    // degenerate k=0. Two other families stay clean though:
    //   - perfect square (x-p)^2 (D0=0): q=1 factors as (x-p-1)(x-p+1),
    //     excluding 3 consecutive integers {p-1, p, p+1}.
    //   - no real root (D0<0) but q=1 has two roots: those roots are only
    //     integers when they're consecutive m, m+1 (any wider gap forces
    //     D0>=0), excluding 2 consecutive integers {m, m+1}.
    id: "one-over-ln-quadratic",
    generate: () => {
      if (Math.random() < 0.5) {
        const p = randInt(-8, 8);
        return {
          prompt: `f(x) = \\frac{1}{\\ln\\left(${quadraticLatex(-2 * p, p * p)}\\right)}`,
          correct: [
            { ...ALL_REALS },
            { type: "point", pointVal: String(p - 1) },
            { type: "point", pointVal: String(p) },
            { type: "point", pointVal: String(p + 1) },
          ],
        };
      }
      const m = randInt(-8, 7);
      return {
        prompt: `f(x) = \\frac{1}{\\ln\\left(${quadraticLatex(-(2 * m + 1), m * m + m + 1)}\\right)}`,
        correct: [
          { ...ALL_REALS },
          { type: "point", pointVal: String(m) },
          { type: "point", pointVal: String(m + 1) },
        ],
      };
    },
  },
  {
    // 1/ln(x^2+c), the symmetric b=0 case: unlike the general quadratic,
    // x^2+c=1 always solves in closed form as x=+-sqrt(1-c) regardless of
    // c, so every range of c stays clean (irrational boundaries are fine —
    // no need to hunt for perfect squares here):
    //   70% c<0 (c=-a):    (-inf,-sqrt(a)) u (sqrt(a),inf), minus +-sqrt(a+1)
    //   20% 0<c<1:         R, minus +-sqrt(1-c)
    //    5% c>1:           R (x^2+c never dips to 1 or below)
    //    5% c=1:           R, minus {0}
    id: "one-over-ln-x2-plus-c",
    generate: () => {
      const roll = Math.random();
      if (roll < 0.70) {
        const a = randInt(1, 9);
        return {
          prompt: `f(x) = \\frac{1}{\\ln\\left(x^2-${a}\\right)}`,
          correct: [
            { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: `-\\sqrt{${a}}` },
            { type: "interval", leftClosed: false, leftVal: `\\sqrt{${a}}`, rightClosed: false, rightVal: "\\infty" },
            { type: "point", pointVal: `-\\sqrt{${a + 1}}` },
            { type: "point", pointVal: `\\sqrt{${a + 1}}` },
          ],
        };
      }
      if (roll < 0.90) {
        const k = randInt(1, 9);
        const c = k / 10;
        const boundary = (10 - k) / 10;
        return {
          prompt: `f(x) = \\frac{1}{\\ln\\left(x^2+${c}\\right)}`,
          correct: [
            { ...ALL_REALS },
            { type: "point", pointVal: `-\\sqrt{${boundary}}` },
            { type: "point", pointVal: `\\sqrt{${boundary}}` },
          ],
        };
      }
      if (roll < 0.95) {
        const c = randInt(2, 9);
        return {
          prompt: `f(x) = \\frac{1}{\\ln\\left(x^2+${c}\\right)}`,
          correct: [{ ...ALL_REALS }],
        };
      }
      return {
        prompt: "f(x) = \\frac{1}{\\ln\\left(x^2+1\\right)}",
        correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
      };
    },
  },
  {
    // ln(x^2+Bx+C): needs the quadratic > 0 — same case split and brackets
    // as one-over-sqrt-quadratic (strict throughout, since ln(0) is also
    // undefined, not just negative values):
    //   70% two distinct roots a<b:  outside [a,b], open -> (-inf,a) u (b,inf)
    //   15% one repeated root:       (x-a)^2 = 0 at a -> excludes just {a}
    //   15% no real root:            always > 0 already -> R
    id: "ln-quadratic-3cases",
    generate: () => {
      const roll = Math.random();
      let b, c, correct;
      if (roll < 0.70) {
        const { lo, hi, b: rb, c: rc } = randTwoRoots();
        b = rb;
        c = rc;
        correct = [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(lo) },
          { type: "interval", leftClosed: false, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" },
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
        prompt: `f(x) = \\ln\\left(${quadraticLatex(b, c)}\\right)`,
        correct,
      };
    },
  },
  {
    // ln(-x^2-Bx-C): only the two-distinct-roots case, where -(quadratic) > 0
    // strictly between the roots — an open bounded interval (the mirror of
    // sqrt-neg-quadratic's closed one, since 0 itself is now excluded).
    id: "ln-neg-quadratic",
    generate: () => {
      const { lo, hi, b, c } = randTwoRoots();
      return {
        prompt: `f(x) = \\ln\\left(${negQuadraticLatex(b, c)}\\right)`,
        correct: [
          { type: "interval", leftClosed: false, leftVal: String(lo), rightClosed: false, rightVal: String(hi) },
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
    id: "sqrt-x",
    prompt: "f(x) = \\sqrt{x}",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // x^(a/b), a/b in lowest terms: domain hinges only on the parity of the
    // (already reduced) denominator b — even b needs x>=0, odd b allows all
    // reals, regardless of a's own parity.
    id: "x-to-frac-pos",
    generate: () => {
      const { a, b } = randCoprimeFraction();
      const evenDenominator = b % 2 === 0;
      return {
        prompt: `f(x) = x^{\\frac{${a}}{${b}}}`,
        correct: evenDenominator
          ? [{ type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" }]
          : [{ ...ALL_REALS }],
      };
    },
  },
  {
    // x^(-a/b) = 1/x^(a/b): same parity rule as above, but x=0 is always
    // excluded since it's now a denominator.
    id: "x-to-frac-neg",
    generate: () => {
      const { a, b } = randCoprimeFraction();
      const evenDenominator = b % 2 === 0;
      return {
        prompt: `f(x) = x^{-\\frac{${a}}{${b}}}`,
        correct: evenDenominator
          ? [{ type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" }]
          : [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
      };
    },
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
    // arcsin(ln(x)) and arccos(ln(x)) share the same domain: ln(x) needs to
    // be defined (x>0) AND land inside arcsin/arccos's own domain [-1,1],
    // i.e. -1 <= ln(x) <= 1  <=>  e^-1 <= x <= e.
    id: "arcsin-or-arccos-of-ln",
    generate: () => ({
      prompt: pick(["f(x) = \\arcsin\\left(\\ln(x)\\right)", "f(x) = \\arccos\\left(\\ln(x)\\right)"]),
      correct: [{ type: "interval", leftClosed: true, leftVal: "e^{-1}", rightClosed: true, rightVal: "e" }],
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
        const { lo, hi, b: rb, c: rc } = randTwoRoots();
        b = rb;
        c = rc;
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
  {
    // sqrt(ax+b): needs ax+b >= 0. Which side of the root is included flips
    // with the sign of a.
    id: "sqrt-linear",
    generate: () => {
      const { a, b, r } = randLinearWithRoot();
      return {
        prompt: `f(x) = \\sqrt{${linearLatex(a, b)}}`,
        correct: [
          a > 0
            ? { type: "interval", leftClosed: true, leftVal: String(r), rightClosed: false, rightVal: "\\infty" }
            : { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: String(r) },
        ],
      };
    },
  },
  {
    // sqrt(x^2+Bx+C): needs the quadratic >= 0. Same 3-way case split as
    // one-over-quadratic, but unlike a denominator, a root value of 0 is
    // fine under a square root — so both the repeated-root and no-root
    // cases give plain R, with nothing excluded.
    //   70% two distinct roots a<b:  outside [a,b]     -> (-inf,a] u [b,inf)
    //   15% one repeated root:       always >= 0        -> R
    //   15% no real root:            always > 0          -> R
    id: "sqrt-quadratic-3cases",
    generate: () => {
      const roll = Math.random();
      let b, c, correct;
      if (roll < 0.70) {
        const { lo, hi, b: rb, c: rc } = randTwoRoots();
        b = rb;
        c = rc;
        correct = [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: String(lo) },
          { type: "interval", leftClosed: true, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" },
        ];
      } else if (roll < 0.85) {
        const a = randInt(-9, 9);
        b = -2 * a;
        c = a * a;
        correct = [{ ...ALL_REALS }];
      } else {
        const a = randIntExcluding(-9, 9, 0);
        const k = randInt(1, 9);
        b = -2 * a;
        c = a * a + k;
        correct = [{ ...ALL_REALS }];
      }
      return {
        prompt: `f(x) = \\sqrt{${quadraticLatex(b, c)}}`,
        correct,
      };
    },
  },
  {
    // sqrt(-x^2-Bx-C), i.e. sqrt(-(x^2+Bx+C)): only the two-distinct-roots
    // case, where -(quadratic) >= 0 exactly between the roots (inclusive) —
    // a bounded closed interval, the mirror image of the "excluded middle"
    // case above.
    id: "sqrt-neg-quadratic",
    generate: () => {
      const { lo, hi, b, c } = randTwoRoots();
      return {
        prompt: `f(x) = \\sqrt{${negQuadraticLatex(b, c)}}`,
        correct: [
          { type: "interval", leftClosed: true, leftVal: String(lo), rightClosed: true, rightVal: String(hi) },
        ],
      };
    },
  },
  {
    // 1/sqrt(ax+b): same root as sqrt-linear, but now strict since x=root
    // itself would make the denominator 0.
    id: "one-over-sqrt-linear",
    generate: () => {
      const { a, b, r } = randLinearWithRoot();
      return {
        prompt: `f(x) = \\frac{1}{\\sqrt{${linearLatex(a, b)}}}`,
        correct: [
          a > 0
            ? { type: "interval", leftClosed: false, leftVal: String(r), rightClosed: false, rightVal: "\\infty" }
            : { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(r) },
        ],
      };
    },
  },
  {
    // 1/sqrt(x^2+Bx+C): same 3 cases as sqrt-quadratic-3cases, but every
    // boundary tightens to strict since the quadratic can no longer be 0:
    //   70% two distinct roots a<b:  outside [a,b], open -> (-inf,a) u (b,inf)
    //   15% one repeated root:       (x-a)^2 = 0 at a -> excludes just {a}
    //   15% no real root:            always > 0 already -> R
    id: "one-over-sqrt-quadratic",
    generate: () => {
      const roll = Math.random();
      let b, c, correct;
      if (roll < 0.70) {
        const { lo, hi, b: rb, c: rc } = randTwoRoots();
        b = rb;
        c = rc;
        correct = [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(lo) },
          { type: "interval", leftClosed: false, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" },
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
        prompt: `f(x) = \\frac{1}{\\sqrt{${quadraticLatex(b, c)}}}`,
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
const solutionLabelEl = document.getElementById("solutionLabel");
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
  solutionLabelEl.classList.add("hidden");
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
  solutionLabelEl.classList.remove("hidden");
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
