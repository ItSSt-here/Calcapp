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

// "v +- sqrt(n)" as LaTeX (sign = -1 or +1) — collapses to a plain integer
// when n is a perfect square, and drops the leading "v" when it's 0.
function offsetRadical(v, sign, n) {
  const r = Math.sqrt(n);
  if (Number.isInteger(r)) return String(v + sign * r);
  const radical = `\\sqrt{${n}}`;
  if (v === 0) return sign < 0 ? `-${radical}` : radical;
  return sign < 0 ? `${v}-${radical}` : `${v}+${radical}`;
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
    difficulty: 1,
    prompt: "f(x) = \\ln(x)",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // ln(x²) and ln(|x|) have the identical domain (R\{0}) — one exercise,
    // prompt picked at random each time.
    id: "ln-x2-or-abs-x",
    difficulty: 1,
    generate: () => ({
      prompt: pick(["f(x) = \\ln\\left(x^2\\right)", "f(x) = \\ln\\left(|x|\\right)"]),
      correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
    }),
  },
  {
    // x²+a is at least a (>0 for any a in [1,10]), so ln is always defined —
    // the domain is all reals regardless of which a gets rolled.
    id: "ln-x2-plus-a",
    difficulty: 1,
    generate: () => {
      const a = randInt(1, 10);
      return {
        prompt: `f(x) = \\ln\\left(x^2+${a}\\right)`,
        correct: [{ ...ALL_REALS }],
      };
    },
  },
  {
    // x²-a > 0 <=> |x| > √a, and |x|-a > 0 <=> |x| > a directly — the same
    // "outside two symmetric rays" shape, reached by different algebra (the
    // x² form needs a square root to isolate the boundary, the |x| form
    // gives it straight away as a clean integer). Merged as two prompt
    // variants of one exercise, each keeping its own boundary formula and
    // parameter range rather than forcing a shared a.
    id: "ln-x2-or-abs-minus-a",
    difficulty: 2,
    generate: () => {
      if (Math.random() < 0.5) {
        const a = randInt(1, 10);
        return {
          prompt: `f(x) = \\ln\\left(x^2-${a}\\right)`,
          correct: [
            { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: `-\\sqrt{${a}}` },
            { type: "interval", leftClosed: false, leftVal: `\\sqrt{${a}}`, rightClosed: false, rightVal: "\\infty" },
          ],
        };
      }
      const a = randInt(1, 9);
      return {
        prompt: `f(x) = \\ln\\left(|x|-${a}\\right)`,
        correct: [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(-a) },
          { type: "interval", leftClosed: false, leftVal: String(a), rightClosed: false, rightVal: "\\infty" },
        ],
      };
    },
  },
  {
    // ln(ax+b): needs ax+b > 0 — same root/sign logic as sqrt-linear, but
    // strict since ln(0) is undefined too.
    id: "ln-linear",
    difficulty: 2,
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
    difficulty: 3,
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
    difficulty: 4,
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
    difficulty: 4,
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
    difficulty: 3,
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
    difficulty: 2,
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
    difficulty: 1,
    prompt: "f(x) = e^x",
    correct: [{ ...ALL_REALS }],
  },
  {
    id: "sqrt-x",
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 2,
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
    difficulty: 1,
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
    difficulty: 3,
    generate: () => ({
      prompt: pick(["f(x) = \\arcsin\\left(\\ln(x)\\right)", "f(x) = \\arccos\\left(\\ln(x)\\right)"]),
      correct: [{ type: "interval", leftClosed: true, leftVal: "e^{-1}", rightClosed: true, rightVal: "e" }],
    }),
  },
  {
    // ln(ln(x)): needs ln(x) defined (x>0) AND positive, since it's now
    // the outer ln's own argument — ln(x)>0 <=> x>1, the stronger bound.
    id: "ln-of-ln",
    difficulty: 3,
    prompt: "f(x) = \\ln\\left(\\ln(x)\\right)",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "1", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // ln(arccos(x)): needs arccos(x) defined (x in [-1,1]) AND positive.
    // arccos decreases from pi (x=-1) to 0 (x=1), hitting 0 only at x=1.
    id: "ln-of-arccos",
    difficulty: 3,
    prompt: "f(x) = \\ln\\left(\\arccos(x)\\right)",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "-1", rightClosed: false, rightVal: "1" },
    ],
  },
  {
    // ln(arcsin(x)): needs arcsin(x) defined (x in [-1,1]) AND positive.
    // arcsin increases from -pi/2 (x=-1) to pi/2 (x=1), hitting 0 only at x=0.
    id: "ln-of-arcsin",
    difficulty: 3,
    prompt: "f(x) = \\ln\\left(\\arcsin(x)\\right)",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: true, rightVal: "1" },
    ],
  },
  {
    // ln(arctan(x)): arctan is defined everywhere, so the only condition
    // is positivity — arctan(x)>0 <=> x>0 (arctan is increasing, arctan(0)=0).
    id: "ln-of-arctan",
    difficulty: 2,
    prompt: "f(x) = \\ln\\left(\\arctan(x)\\right)",
    correct: [
      { type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // sqrt(ln(x)): needs ln(x) defined (x>0) AND non-negative (for the
    // sqrt) — ln(x)>=0 <=> x>=1, the stronger bound. Sibling of ln-of-ln
    // with the two functions swapped.
    id: "sqrt-of-ln",
    difficulty: 3,
    prompt: "f(x) = \\sqrt{\\ln(x)}",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "1", rightClosed: false, rightVal: "\\infty" },
    ],
  },
  {
    // sqrt(arcsin(x)): needs arcsin(x) defined (x in [-1,1]) AND >=0.
    // arcsin increases from -pi/2 (x=-1) to pi/2 (x=1), so it's >=0 only
    // on [0,1] — a genuine extra restriction.
    id: "sqrt-of-arcsin",
    difficulty: 3,
    prompt: "f(x) = \\sqrt{\\arcsin(x)}",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "0", rightClosed: true, rightVal: "1" },
    ],
  },
  {
    // sqrt(arccos(x)): needs arccos(x) defined (x in [-1,1]) AND >=0 — but
    // arccos ranges over [0,pi] on that whole domain, so it's ALWAYS >=0.
    // The sqrt wrapper adds no restriction at all: domain stays [-1,1],
    // a nice contrast with sqrt-of-arcsin right above.
    id: "sqrt-of-arccos",
    difficulty: 3,
    prompt: "f(x) = \\sqrt{\\arccos(x)}",
    correct: [
      { type: "interval", leftClosed: true, leftVal: "-1", rightClosed: true, rightVal: "1" },
    ],
  },
  {
    // arctan and arccot share the same domain R — one exercise, prompt
    // picked at random each time.
    id: "arctan-or-arccot",
    difficulty: 1,
    generate: () => ({
      prompt: pick(["f(x) = \\arctan(x)", "f(x) = \\operatorname{arccot}(x)"]),
      correct: [{ ...ALL_REALS }],
    }),
  },
  {
    // sin(x) and cos(x) are defined everywhere — the plain trig functions,
    // as opposed to every other trig-flavored exercise in the bank, which
    // only ever uses their inverses (arcsin, arccos, arctan, arccot).
    id: "sin-or-cos",
    difficulty: 1,
    generate: () => ({
      prompt: pick(["f(x) = \\sin(x)", "f(x) = \\cos(x)"]),
      correct: [{ ...ALL_REALS }],
    }),
  },
  {
    // arcsin(1/x) or arccos(1/x): need 1/x in [-1,1] (x!=0 comes along for
    // free). Solving separately for x>0 and x<0 — 1/x<=1 is the binding
    // constraint when x>0 (giving x>=1), 1/x>=-1 is the binding constraint
    // when x<0 (giving x<=-1) — gives a clean two-ray domain.
    id: "arcsin-or-arccos-of-reciprocal",
    difficulty: 3,
    generate: () => ({
      prompt: pick(["f(x) = \\arcsin\\left(\\frac{1}{x}\\right)", "f(x) = \\arccos\\left(\\frac{1}{x}\\right)"]),
      correct: [
        { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: "-1" },
        { type: "interval", leftClosed: true, leftVal: "1", rightClosed: false, rightVal: "\\infty" },
      ],
    }),
  },
  {
    // arcsin(ax+b) or arccos(ax+b): need -1 <= ax+b <= 1. Solving gives a
    // closed interval centered on v (where ax+b=0) with half-width 1/|a| —
    // regardless of a's sign, since the two boundary x-values always sort
    // to [v-1/|a|, v+1/|a|]. |a| in {1,2} keeps the half-width a clean 1
    // or 0.5.
    id: "arcsin-or-arccos-of-linear",
    difficulty: 2,
    generate: () => {
      const fn = pick(["\\arcsin", "\\arccos"]);
      const a = pick([-2, -1, 1, 2]);
      const v = randInt(-9, 9);
      const b = -a * v;
      const w = 1 / Math.abs(a);
      return {
        prompt: `f(x) = ${fn}\\left(${linearLatex(a, b)}\\right)`,
        correct: [
          { type: "interval", leftClosed: true, leftVal: String(v - w), rightClosed: true, rightVal: String(v + w) },
        ],
      };
    },
  },
  {
    // arcsin(|x|-a) or arccos(|x|-a): both need -1 <= |x|-a <= 1, i.e.
    // a-1 <= |x| <= a+1. Since |x| is never negative, the lower bound only
    // bites once a>1 — below that it's automatically satisfied and the
    // domain is one interval centered on 0:
    //   a<=1 (a-1<=0): |x|<=a+1     -> single interval [-(a+1), a+1]
    //   a>1  (a-1>0):  a-1<=|x|<=a+1 -> two disjoint intervals
    //                  [-(a+1),-(a-1)] u [(a-1),(a+1)]
    // a<0 is skipped: a<-1 makes the domain empty (this builder has no way
    // to answer "no x works"), and a=-1 collapses to the lone point {0} —
    // a domain shape it can't represent either (its point rows mean
    // "excluded", not "the only value allowed").
    id: "arcsin-or-arccos-of-abs",
    difficulty: 3,
    generate: () => {
      const fn = pick(["\\arcsin", "\\arccos"]);
      const twoIntervals = Math.random() < 0.5;
      const a = twoIntervals ? randInt(2, 9) : pick([0, 1]);
      const arg = a === 0 ? "|x|" : `|x|-${a}`;
      const prompt = `f(x) = ${fn}\\left(${arg}\\right)`;
      return {
        prompt,
        correct: twoIntervals
          ? [
              { type: "interval", leftClosed: true, leftVal: String(-(a + 1)), rightClosed: true, rightVal: String(-(a - 1)) },
              { type: "interval", leftClosed: true, leftVal: String(a - 1), rightClosed: true, rightVal: String(a + 1) },
            ]
          : [
              { type: "interval", leftClosed: true, leftVal: String(-(a + 1)), rightClosed: true, rightVal: String(a + 1) },
            ],
      };
    },
  },
  {
    // arcsin(sqrt(x)/a) or arccos(sqrt(x)/a): needs sqrt(x) defined (x>=0)
    // AND sqrt(x)/a in [-1,1]. Since sqrt(x)>=0 and a>0, the ratio is
    // already >=0, so only the upper bound bites: sqrt(x)/a<=1 <=> x<=a^2
    // (squaring is safe, both sides non-negative) — always a single closed
    // interval [0, a^2], no case split.
    id: "arcsin-or-arccos-of-sqrt-over-a",
    difficulty: 2,
    generate: () => {
      const fn = pick(["\\arcsin", "\\arccos"]);
      const a = randInt(2, 9);
      return {
        prompt: `f(x) = ${fn}\\left(\\frac{\\sqrt{x}}{${a}}\\right)`,
        correct: [
          { type: "interval", leftClosed: true, leftVal: "0", rightClosed: true, rightVal: String(a * a) },
        ],
      };
    },
  },
  {
    // arctan(1/x): arctan is defined for every real input, so the only
    // real constraint comes from 1/x itself needing x!=0 — the outer
    // arctan adds nothing, same "don't overthink it" flavor as
    // sqrt(arccos(x)).
    id: "arctan-of-reciprocal",
    difficulty: 2,
    prompt: "f(x) = \\arctan\\left(\\frac{1}{x}\\right)",
    correct: [
      { ...ALL_REALS },
      { type: "point", pointVal: "0" },
    ],
  },
  {
    // x/|x| and |x|/x share the same domain R\{0} — one exercise, prompt
    // picked at random each time.
    id: "x-over-abs-x",
    difficulty: 2,
    generate: () => ({
      prompt: pick(["f(x) = \\frac{x}{|x|}", "f(x) = \\frac{|x|}{x}"]),
      correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
    }),
  },
  {
    // sqrt((x-a)/(x-b)): the classic sign-chart rational exercise — needs
    // (x-a)/(x-b) >= 0 and x!=b. The ratio is positive outside [lo,hi] and
    // negative inside it regardless of which root is the numerator, but
    // WHICH endpoint is closed depends on that labeling: closed at the
    // numerator's root (ratio=0 there, sqrt(0) fine), open/excluded at the
    // denominator's root.
    id: "sqrt-of-linear-ratio",
    difficulty: 4,
    generate: () => {
      const { lo, hi } = randTwoRoots();
      const aIsLo = Math.random() < 0.5;
      const a = aIsLo ? lo : hi;
      const b = aIsLo ? hi : lo;
      return {
        prompt: `f(x) = \\sqrt{\\frac{${linearLatex(1, -a)}}{${linearLatex(1, -b)}}}`,
        correct: aIsLo
          ? [
              { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: String(lo) },
              { type: "interval", leftClosed: false, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" },
            ]
          : [
              { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(lo) },
              { type: "interval", leftClosed: true, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" },
            ],
      };
    },
  },
  {
    // 1/sqrt((x-a)/(x-b)) or ln((x-a)/(x-b)): both need the SAME thing —
    // (x-a)/(x-b) > 0 strictly — so they're merged as prompt variants of
    // one exercise, like arcsin-or-arccos. Strict positivity always gives
    // (-inf,lo) u (hi,inf), open at both ends, regardless of which root is
    // labeled the numerator vs denominator (unlike sqrt-of-linear-ratio).
    id: "strict-of-linear-ratio",
    difficulty: 4,
    generate: () => {
      const { lo, hi } = randTwoRoots();
      const aIsLo = Math.random() < 0.5;
      const a = aIsLo ? lo : hi;
      const b = aIsLo ? hi : lo;
      const ratio = `\\frac{${linearLatex(1, -a)}}{${linearLatex(1, -b)}}`;
      return {
        prompt: pick([`f(x) = \\frac{1}{\\sqrt{${ratio}}}`, `f(x) = \\ln\\left(${ratio}\\right)`]),
        correct: [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: String(lo) },
          { type: "interval", leftClosed: false, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" },
        ],
      };
    },
  },
  {
    // arcsin((x-a)/(x-b)) or arccos((x-a)/(x-b)), x!=b: needs -1 <=
    // (x-a)/(x-b) <= 1, which is really TWO rational inequalities to sign-
    // chart and intersect — r<=1 <=> (b-a)/(x-b)<=0, and r>=-1 <=>
    // (x-c)/(x-b)>=0 where c=(a+b)/2 is the midpoint of a and b. Working
    // through both (c always sits strictly between a and b) collapses to a
    // single closed ray at the midpoint, on whichever side b falls:
    //   b>a: (b-a)/(x-b)<=0 <=> x<b, and (x-c)/(x-b)>=0 <=> x<=c or x>b
    //        (c<b here) -> intersecting the two gives (-inf, c]
    //   b<a: symmetric derivation (c>b here) -> intersecting gives [c, inf)
    id: "arcsin-or-arccos-of-linear-ratio",
    difficulty: 4,
    generate: () => {
      const fn = pick(["\\arcsin", "\\arccos"]);
      const a = randInt(-9, 9);
      const b = randIntExcluding(-9, 9, a);
      const m = (a + b) / 2;
      return {
        prompt: `f(x) = ${fn}\\left(\\frac{${linearLatex(1, -a)}}{${linearLatex(1, -b)}}\\right)`,
        correct: [
          b > a
            ? { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: String(m) }
            : { type: "interval", leftClosed: true, leftVal: String(m), rightClosed: false, rightVal: "\\infty" },
        ],
      };
    },
  },
  {
    // sqrt((x-n1)(x-n2)/(x-c)): a quadratic numerator (roots n1<n2) over a
    // linear denominator (root c) — a real 4-region sign chart instead of
    // just one flip. For large x this behaves like x (degree 2 - degree 1
    // = 1, odd), so the sign is always POSITIVE in the rightmost region and
    // alternates leftward from there, regardless of where c falls — which
    // gives exactly 3 clean cases depending on c's position relative to
    // n1, n2 (built solution-first: the case and critical points are
    // chosen first, then b, c of the quadratic are derived from n1, n2):
    //   c < n1:      (c, n1] u [n2, inf)
    //   n1 < c < n2: [n1, c) u [n2, inf)
    //   c > n2:      [n1, n2] u (c, inf)  -- a closed bounded interval
    //                plus an open ray
    id: "sqrt-quadratic-over-linear-ratio",
    difficulty: 4,
    generate: () => {
      const roll = Math.random();
      let n1, n2, c, correct;
      if (roll < 1 / 3) {
        ({ lo: n1, hi: n2 } = randTwoRoots());
        c = n1 - randInt(1, 5);
        correct = [
          { type: "interval", leftClosed: false, leftVal: String(c), rightClosed: true, rightVal: String(n1) },
          { type: "interval", leftClosed: true, leftVal: String(n2), rightClosed: false, rightVal: "\\infty" },
        ];
      } else if (roll < 2 / 3) {
        const gap = randInt(2, 9);
        n1 = randInt(-9, 9 - gap);
        n2 = n1 + gap;
        c = randInt(n1 + 1, n2 - 1);
        correct = [
          { type: "interval", leftClosed: true, leftVal: String(n1), rightClosed: false, rightVal: String(c) },
          { type: "interval", leftClosed: true, leftVal: String(n2), rightClosed: false, rightVal: "\\infty" },
        ];
      } else {
        ({ lo: n1, hi: n2 } = randTwoRoots());
        c = n2 + randInt(1, 5);
        correct = [
          { type: "interval", leftClosed: true, leftVal: String(n1), rightClosed: true, rightVal: String(n2) },
          { type: "interval", leftClosed: false, leftVal: String(c), rightClosed: false, rightVal: "\\infty" },
        ];
      }
      const qb = -(n1 + n2);
      const qc = n1 * n2;
      return {
        prompt: `f(x) = \\sqrt{\\frac{${quadraticLatex(qb, qc)}}{${linearLatex(1, -c)}}}`,
        correct,
      };
    },
  },
  {
    // sqrt((x-a)/((x-n1)(x-n2))): the mirror of the exercise above — a
    // linear numerator (root a) over a quadratic denominator (roots
    // n1<n2, both always excluded). Same alternating-sign logic (this
    // time behaving like 1/x for large x, still positive at the rightmost
    // region), giving 3 cases by where a falls:
    //   a < n1:      [a, n1) u (n2, inf)
    //   n1 < a < n2: (n1, a] u (n2, inf)
    //   a > n2:      (n1, n2) u [a, inf)  -- an open bounded interval
    //                plus a closed ray
    id: "sqrt-linear-over-quadratic-ratio",
    difficulty: 4,
    generate: () => {
      const roll = Math.random();
      let n1, n2, a, correct;
      if (roll < 1 / 3) {
        ({ lo: n1, hi: n2 } = randTwoRoots());
        a = n1 - randInt(1, 5);
        correct = [
          { type: "interval", leftClosed: true, leftVal: String(a), rightClosed: false, rightVal: String(n1) },
          { type: "interval", leftClosed: false, leftVal: String(n2), rightClosed: false, rightVal: "\\infty" },
        ];
      } else if (roll < 2 / 3) {
        const gap = randInt(2, 9);
        n1 = randInt(-9, 9 - gap);
        n2 = n1 + gap;
        a = randInt(n1 + 1, n2 - 1);
        correct = [
          { type: "interval", leftClosed: false, leftVal: String(n1), rightClosed: true, rightVal: String(a) },
          { type: "interval", leftClosed: false, leftVal: String(n2), rightClosed: false, rightVal: "\\infty" },
        ];
      } else {
        ({ lo: n1, hi: n2 } = randTwoRoots());
        a = n2 + randInt(1, 5);
        correct = [
          { type: "interval", leftClosed: false, leftVal: String(n1), rightClosed: false, rightVal: String(n2) },
          { type: "interval", leftClosed: true, leftVal: String(a), rightClosed: false, rightVal: "\\infty" },
        ];
      }
      const qb = -(n1 + n2);
      const qc = n1 * n2;
      return {
        prompt: `f(x) = \\sqrt{\\frac{${linearLatex(1, -a)}}{${quadraticLatex(qb, qc)}}}`,
        correct,
      };
    },
  },
  {
    // 1/(x²+Bx+C) with the denominator always shown expanded, never
    // factored — the student has to find the roots (if any) themselves.
    // Which shape it is depends on which case gets rolled:
    //   70% two distinct roots a≠b:   (x-a)(x-b), excludes {a,b}
    //   15% one repeated root:        (x-a)²,      excludes {a}
    //   15% no real root:             (x-a)²+b>0,  excludes nothing (R)
    // Also shown, at random, as 1/cbrt(x^2+Bx+C) — a cube root only needs
    // its argument nonzero (never negative-averse like a square root), so
    // the domain condition is exactly the same x^2+Bx+C != 0, just reached
    // by different reasoning.
    id: "one-over-quadratic",
    difficulty: 3,
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
        prompt: pick([
          `f(x) = \\frac{1}{${quadraticLatex(b, c)}}`,
          `f(x) = \\frac{1}{\\sqrt[3]{${quadraticLatex(b, c)}}}`,
        ]),
        correct,
      };
    },
  },
  {
    // sqrt(ax+b): needs ax+b >= 0. Which side of the root is included flips
    // with the sign of a.
    id: "sqrt-linear",
    difficulty: 2,
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
    difficulty: 3,
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
    difficulty: 2,
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
    // x²-a >= 0 <=> |x| >= √a, and |x|-a >= 0 <=> |x| >= a directly — the
    // closed-boundary mirror of ln-x2-or-abs-minus-a (sqrt(0) is fine, so
    // both boundaries are included here instead of excluded).
    id: "sqrt-x2-or-abs-minus-a",
    difficulty: 2,
    generate: () => {
      if (Math.random() < 0.5) {
        const a = randInt(1, 10);
        return {
          prompt: `f(x) = \\sqrt{x^2-${a}}`,
          correct: [
            { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: `-\\sqrt{${a}}` },
            { type: "interval", leftClosed: true, leftVal: `\\sqrt{${a}}`, rightClosed: false, rightVal: "\\infty" },
          ],
        };
      }
      const a = randInt(1, 9);
      return {
        prompt: `f(x) = \\sqrt{|x|-${a}}`,
        correct: [
          { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: true, rightVal: String(-a) },
          { type: "interval", leftClosed: true, leftVal: String(a), rightClosed: false, rightVal: "\\infty" },
        ],
      };
    },
  },
  {
    // a-|x| > 0 <=> |x| < a (ln, needs strictly positive) and a-|x| >= 0
    // <=> |x| <= a (sqrt, zero is fine) — the same bounded "inside" domain
    // centered on 0, just open for ln vs closed for sqrt. The inside
    // mirror of the outside-rays pair above, and the same
    // open-for-ln/closed-for-sqrt pairing sum-bounded-interval uses.
    id: "ln-or-sqrt-of-a-minus-abs",
    difficulty: 2,
    generate: () => {
      const a = randInt(1, 9);
      if (Math.random() < 0.5) {
        return {
          prompt: `f(x) = \\ln\\left(${a}-|x|\\right)`,
          correct: [{ type: "interval", leftClosed: false, leftVal: String(-a), rightClosed: false, rightVal: String(a) }],
        };
      }
      return {
        prompt: `f(x) = \\sqrt{${a}-|x|}`,
        correct: [{ type: "interval", leftClosed: true, leftVal: String(-a), rightClosed: true, rightVal: String(a) }],
      };
    },
  },
  {
    // 1/sqrt(ax+b): same root as sqrt-linear, but now strict since x=root
    // itself would make the denominator 0.
    id: "one-over-sqrt-linear",
    difficulty: 2,
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
    difficulty: 3,
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
  {
    // sqrt(x^2+Bx+C) / ln(x-a): the first "combine two independent domain
    // conditions" exercise — needs x^2+Bx+C >= 0 (sqrt) AND x-a > 0 and
    // != 1 (ln, and it's a denominator). Always uses the two-distinct-root
    // case for the quadratic (lo < hi) so the composition is never trivial.
    //
    // Built solution-first: lo, hi, and a are chosen directly so their
    // relative position determines the final shape, then b, c are derived
    // from lo, hi — going the other way (random b,c,a first, then working
    // out the intersection) would make the resulting shape unpredictable.
    //   40% a > hi:            ln's own bound is strictly tighter than hi,
    //                          so the quadratic's shape becomes irrelevant:
    //                          (a, inf), minus {a+1}
    //   20% a = hi - 1:        forced by integers — a+1 then lands EXACTLY
    //                          on the closed boundary hi, punching it open:
    //                          (hi, inf), no separate excluded point
    //   20% lo+1 <= a <= hi-2: both a and a+1 already sit inside the
    //                          quadratic's own excluded gap (lo,hi) — both
    //                          ln conditions are entirely redundant, domain
    //                          is just [hi, inf), same as sqrt alone
    //   20% a = hi - 0.5:      a half-integer, so a+1 = hi + 0.5 lands
    //                          STRICTLY inside [hi,inf) (unlike the a=hi-1
    //                          case, which lands exactly on its boundary):
    //                          [hi, hi+0.5) u (hi+0.5, inf)
    id: "sqrt-quadratic-over-ln-linear",
    difficulty: 4,
    generate: () => {
      const roll = Math.random();
      let lo, hi, a, correct;
      if (roll < 0.40) {
        ({ lo, hi } = randTwoRoots());
        a = hi + randInt(1, 5);
        correct = [
          { type: "interval", leftClosed: false, leftVal: String(a), rightClosed: false, rightVal: "\\infty" },
          { type: "point", pointVal: String(a + 1) },
        ];
      } else if (roll < 0.60) {
        const gap = randInt(2, 9);
        lo = randInt(-9, 9 - gap);
        hi = lo + gap;
        a = hi - 1;
        correct = [{ type: "interval", leftClosed: false, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" }];
      } else if (roll < 0.80) {
        const gap = randInt(3, 9);
        lo = randInt(-9, 9 - gap);
        hi = lo + gap;
        a = randInt(lo + 1, hi - 2);
        correct = [{ type: "interval", leftClosed: true, leftVal: String(hi), rightClosed: false, rightVal: "\\infty" }];
      } else {
        ({ lo, hi } = randTwoRoots());
        a = hi - 0.5;
        correct = [
          { type: "interval", leftClosed: true, leftVal: String(hi), rightClosed: false, rightVal: String(hi + 0.5) },
          { type: "interval", leftClosed: false, leftVal: String(hi + 0.5), rightClosed: false, rightVal: "\\infty" },
        ];
      }
      const b = -(lo + hi);
      const c = lo * hi;
      return {
        prompt: `f(x) = \\frac{\\sqrt{${quadraticLatex(b, c)}}}{\\ln\\left(${linearLatex(1, -a)}\\right)}`,
        correct,
      };
    },
  },
  {
    // arccos(x^2+bx+c) or arcsin(x^2+bx+c): both share the exact same
    // domain requirement, -1 <= q(x) <= 1, since arcsin and arccos have
    // the same domain [-1,1] (only their values differ) — so the prompt
    // is picked at random just like the plain arcsin-or-arccos exercise.
    //
    // Writing q in vertex form q(x)=(x-v)^2+m (v=vertex x, m=minimum
    // value), both q=1 and q=-1 are symmetric around the SAME center v
    // (only c shifts between them, not b), giving two regimes on m:
    //   -1<=m<=1: q>=-1 holds everywhere -> a single bounded closed
    //             interval [v-w1, v+w1], same shape as sqrt-neg-quadratic
    //   m<-1:     q=-1's roots v+-w2 sit STRICTLY INSIDE q=1's roots
    //             v+-w1 (w2<w1) -> TWO disjoint bounded closed intervals
    //             [v-w1,v-w2] u [v+w2,v+w1] — a shape that doesn't exist
    //             anywhere else in the bank
    // Built solution-first: v and m are chosen directly, then b=-2v,
    // c=v^2+m come out as clean integers, and the boundaries are
    // v +- sqrt(1-m), v +- sqrt(-1-m).
    //   80% m in [-9,-2]: two disjoint intervals (the interesting case)
    //   20% m in {-1,0}:  single interval (m=1 would collapse to a
    //       single point, so it's excluded as degenerate)
    id: "arccos-or-arcsin-of-quadratic",
    difficulty: 3,
    generate: () => {
      const fn = pick(["\\arccos", "\\arcsin"]);
      const v = randInt(-9, 9);
      const m = Math.random() < 0.80 ? randInt(-9, -2) : pick([-1, 0]);
      const b = -2 * v;
      const c = v * v + m;
      let correct;
      if (m < -1) {
        correct = [
          { type: "interval", leftClosed: true, leftVal: offsetRadical(v, -1, 1 - m), rightClosed: true, rightVal: offsetRadical(v, -1, -1 - m) },
          { type: "interval", leftClosed: true, leftVal: offsetRadical(v, 1, -1 - m), rightClosed: true, rightVal: offsetRadical(v, 1, 1 - m) },
        ];
      } else {
        correct = [{ type: "interval", leftClosed: true, leftVal: offsetRadical(v, -1, 1 - m), rightClosed: true, rightVal: offsetRadical(v, 1, 1 - m) }];
      }
      return {
        prompt: `f(x) = ${fn}\\left(${quadraticLatex(b, c)}\\right)`,
        correct,
      };
    },
  },
  {
    // ln(x-a)+ln(b-x) or sqrt(x-a)+sqrt(b-x): genuinely merged this time —
    // not because the two forms share a domain (they don't), but because
    // they're the SAME underlying exercise (sum of two independent
    // one-sided conditions, x>a and x<b, intersected) with a different
    // boundary rule for each: ln needs each factor strictly positive
    // (open interval (a,b)), sqrt only needs each factor non-negative
    // (closed interval [a,b], since sqrt(0) is fine).
    id: "sum-bounded-interval",
    difficulty: 2,
    generate: () => {
      const { lo, hi } = randTwoRoots();
      const rightTerm = hi === 0 ? "-x" : `${hi}-x`;
      const leftTerm = linearLatex(1, -lo);
      if (Math.random() < 0.5) {
        return {
          prompt: `f(x) = \\sqrt{${leftTerm}} + \\sqrt{${rightTerm}}`,
          correct: [{ type: "interval", leftClosed: true, leftVal: String(lo), rightClosed: true, rightVal: String(hi) }],
        };
      }
      return {
        prompt: `f(x) = \\ln\\left(${leftTerm}\\right) + \\ln\\left(${rightTerm}\\right)`,
        correct: [{ type: "interval", leftClosed: false, leftVal: String(lo), rightClosed: false, rightVal: String(hi) }],
      };
    },
  },
  {
    // ln(sqrt(x)-a): needs x>=0 (sqrt defined) AND sqrt(x)>a.
    //   a>0 (50%): sqrt(x)>a <=> x>a^2 (squaring is safe, both sides
    //              non-negative) -> (a^2, inf)
    //   a<0 (25%): sqrt(x)>=0>a always holds -> [0, inf) unchanged
    //   a=0 (25%): sqrt(x)>0 <=> x>0 -> (0, inf)
    id: "ln-of-shifted-sqrt",
    difficulty: 4,
    generate: () => {
      const roll = Math.random();
      if (roll < 0.50) {
        const a = randInt(1, 9);
        return {
          prompt: `f(x) = \\ln\\left(\\sqrt{x}${signedTerm(-a, "")}\\right)`,
          correct: [{ type: "interval", leftClosed: false, leftVal: String(a * a), rightClosed: false, rightVal: "\\infty" }],
        };
      }
      if (roll < 0.75) {
        const a = randInt(-9, -1);
        return {
          prompt: `f(x) = \\ln\\left(\\sqrt{x}${signedTerm(-a, "")}\\right)`,
          correct: [{ type: "interval", leftClosed: true, leftVal: "0", rightClosed: false, rightVal: "\\infty" }],
        };
      }
      return {
        prompt: "f(x) = \\ln\\left(\\sqrt{x}\\right)",
        correct: [{ type: "interval", leftClosed: false, leftVal: "0", rightClosed: false, rightVal: "\\infty" }],
      };
    },
  },
  {
    // sqrt(ln(x)-a): needs ln(x)-a>=0 <=> ln(x)>=a <=> x>=e^a. Since e^a>0
    // for every real a, this bound is always at least as strong as ln's
    // own x>0 requirement — unlike ln(sqrt(x)-a) above, there's no case
    // split: the domain is always the single ray [e^a, inf). a=0 is
    // skipped since it's exactly the plain sqrt-of-ln exercise above.
    id: "sqrt-of-shifted-ln",
    difficulty: 3,
    generate: () => {
      const a = randIntExcluding(-9, 9, 0);
      const boundary = a === 1 ? "e" : `e^{${a}}`;
      return {
        prompt: `f(x) = \\sqrt{\\ln(x)${signedTerm(-a, "")}}`,
        correct: [{ type: "interval", leftClosed: true, leftVal: boundary, rightClosed: false, rightVal: "\\infty" }],
      };
    },
  },
  {
    // 1/(|x|-a): needs |x| != a.
    //   a>0 (50%): |x|=a at x=+-a -> excludes two points, R\{-a,a}
    //   a=0 (25%): |x|=0 only at x=0 -> R\{0}
    //   a<0 (25%): |x|>=0>a always, |x|-a is never 0 -> R unchanged
    id: "one-over-abs-minus-a",
    difficulty: 2,
    generate: () => {
      const roll = Math.random();
      if (roll < 0.50) {
        const a = randInt(1, 9);
        return {
          prompt: `f(x) = \\frac{1}{|x|-${a}}`,
          correct: [{ ...ALL_REALS }, { type: "point", pointVal: String(-a) }, { type: "point", pointVal: String(a) }],
        };
      }
      if (roll < 0.75) {
        return {
          prompt: "f(x) = \\frac{1}{|x|}",
          correct: [{ ...ALL_REALS }, { type: "point", pointVal: "0" }],
        };
      }
      const a = randInt(-9, -1);
      return {
        prompt: `f(x) = \\frac{1}{|x|${signedTerm(-a, "")}}`,
        correct: [{ ...ALL_REALS }],
      };
    },
  },
];

function instantiateExercise(def) {
  const rolled = def.generate ? def.generate() : { prompt: def.prompt, correct: def.correct };
  return { id: def.id, difficulty: def.difficulty, ...rolled };
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
