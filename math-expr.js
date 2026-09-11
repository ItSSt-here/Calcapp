// Evaluates the LaTeX produced by a MathLive <math-field> boundary input
// down to a number (or Infinity/-Infinity), plus a small helper that turns
// the same LaTeX into a readable plain-text label (√2, e², ∞, 1/2, ...) for
// previews and the number-line axis — so nobody but this file ever has to
// look at raw LaTeX.
//
// Supported: digits, + - * / ^, \frac{}{}, \sqrt{}, \infty, \pi/π, e,
// parentheses, unary +/-, and implicit multiplication (2e, 2\sqrt{3}, ...).

function tokenize(latexInput) {
  let s = latexInput;
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\cdot|\\times/g, "*");
  s = s.replace(/\\,|\\!|\\;|\\:|\\ /g, "");
  s = s.replace(/\s+/g, "");

  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    if (rest.startsWith("\\infty")) { tokens.push({ t: "INFTY" }); i += 6; continue; }
    if (rest.startsWith("\\pi")) { tokens.push({ t: "PI" }); i += 3; continue; }
    if (rest.startsWith("\\sqrt")) { tokens.push({ t: "SQRT" }); i += 5; continue; }
    if (rest.startsWith("\\frac")) { tokens.push({ t: "FRAC" }); i += 5; continue; }
    // MathLive's own virtual keyboard inserts Euler's number as this macro
    // (not a bare "e") — e.g. tapping "e" on a phone's math keypad while
    // typing a boundary value. Without this, that input silently fails to
    // parse (evaluateExpr returns null) even though it looks like valid input.
    if (rest.startsWith("\\exponentialE")) { tokens.push({ t: "E" }); i += 13; continue; }
    // Fallbacks in case a field was typed rather than built with the toolbar
    // and MathLive left a bare word unconverted.
    if (/^infinity(?![a-zA-Z])/.test(rest)) { tokens.push({ t: "INFTY" }); i += 8; continue; }
    if (/^inf(?![a-zA-Z])/.test(rest)) { tokens.push({ t: "INFTY" }); i += 3; continue; }
    if (/^pi(?![a-zA-Z])/.test(rest)) { tokens.push({ t: "PI" }); i += 2; continue; }
    if (/^sqrt(?![a-zA-Z])/.test(rest)) { tokens.push({ t: "SQRT" }); i += 4; continue; }

    const c = s[i];
    if (c === "∞") { tokens.push({ t: "INFTY" }); i++; continue; }
    if (c === "π") { tokens.push({ t: "PI" }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const value = Number(s.slice(i, j));
      if (Number.isNaN(value)) throw new Error("bad number");
      tokens.push({ t: "NUM", v: value });
      i = j;
      continue;
    }
    if (c === "e" || c === "E") { tokens.push({ t: "E" }); i++; continue; }
    if (/[a-zA-Z]/.test(c)) { tokens.push({ t: "IDENT", v: c }); i++; continue; }
    if ("+-*/^(){}".includes(c)) {
      const map = { "(": "LPAREN", ")": "RPAREN", "{": "LBRACE", "}": "RBRACE" };
      tokens.push({ t: map[c] || c });
      i++;
      continue;
    }
    throw new Error(`unexpected character "${c}"`);
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t) => {
    const tok = next();
    if (!tok || tok.t !== t) throw new Error(`expected ${t}`);
    return tok;
  };

  function startsFactor(tok) {
    return !!tok && ["NUM", "E", "PI", "INFTY", "LPAREN", "LBRACE", "SQRT", "FRAC"].includes(tok.t);
  }

  // MathLive only wraps a \sqrt or \frac argument in braces when it has more
  // than one atom (e.g. "\sqrt2" for a bare digit, "\sqrt{12}" for two) —
  // accept either a braced group or a single primary.
  function bracedOrSingle() {
    if (peek() && peek().t === "LBRACE") {
      next();
      const v = expr();
      expect("RBRACE");
      return v;
    }
    return primary();
  }

  function primary() {
    const tok = peek();
    if (!tok) throw new Error("unexpected end of expression");
    if (tok.t === "NUM") { next(); return tok.v; }
    if (tok.t === "E") { next(); return Math.E; }
    if (tok.t === "PI") { next(); return Math.PI; }
    if (tok.t === "INFTY") { next(); return Infinity; }
    if (tok.t === "LPAREN") { next(); const v = expr(); expect("RPAREN"); return v; }
    if (tok.t === "LBRACE") { next(); const v = expr(); expect("RBRACE"); return v; }
    if (tok.t === "SQRT") { next(); return Math.sqrt(bracedOrSingle()); }
    if (tok.t === "FRAC") { next(); const n = bracedOrSingle(); const d = bracedOrSingle(); return n / d; }
    if (tok.t === "IDENT") throw new Error(`unknown identifier "${tok.v}"`);
    throw new Error("unexpected token");
  }

  function factor() {
    let base = primary();
    if (peek() && peek().t === "^") {
      next();
      let e;
      if (peek() && peek().t === "LBRACE") { next(); e = expr(); expect("RBRACE"); }
      else e = factor();
      base = Math.pow(base, e);
    }
    return base;
  }

  function unary() {
    if (peek() && peek().t === "-") { next(); return -unary(); }
    if (peek() && peek().t === "+") { next(); return unary(); }
    return factor();
  }

  function term() {
    let v = unary();
    for (;;) {
      const tok = peek();
      if (!tok) break;
      if (tok.t === "*" || tok.t === "/") {
        next();
        const rhs = unary();
        v = tok.t === "*" ? v * rhs : v / rhs;
      } else if (startsFactor(tok)) {
        // implicit multiplication, e.g. "2e", "2\sqrt{3}", "3\pi"
        v *= unary();
      } else break;
    }
    return v;
  }

  function expr() {
    let v = term();
    for (;;) {
      const tok = peek();
      if (tok && (tok.t === "+" || tok.t === "-")) {
        next();
        const rhs = term();
        v = tok.t === "+" ? v + rhs : v - rhs;
      } else break;
    }
    return v;
  }

  const value = expr();
  if (pos !== tokens.length) throw new Error("unexpected trailing input");
  return value;
}

export function evaluateExpr(latex) {
  if (typeof latex !== "string") return null;
  const trimmed = latex.trim();
  if (trimmed === "") return null;
  try {
    const value = parse(tokenize(trimmed));
    return Number.isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

const SUPERSCRIPT = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };

function toSuperscript(str) {
  if ([...str].every((c) => c in SUPERSCRIPT)) return [...str].map((c) => SUPERSCRIPT[c]).join("");
  return `^(${str})`;
}

// Index of the "}" matching the "{" at s[start], or -1 if unbalanced.
function matchingBrace(s, start) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Reads one \sqrt/\frac argument starting at index i: a full {...} group
// (MathLive's normal form), or — since it drops the braces for a single
// atom, e.g. "\sqrt2", "\frac12" — just the next bare character.
function readArg(s, i) {
  if (s[i] === "{") {
    const close = matchingBrace(s, i);
    if (close === -1) return { text: s.slice(i + 1), next: s.length };
    return { text: s.slice(i + 1, close), next: close + 1 };
  }
  return { text: s[i] ?? "", next: i + 1 };
}

// A single number or bare identifier (already past the infty/pi/e symbol
// substitutions above) never needs disambiguating parens around it.
function isAtomicTerm(text) {
  return /^-?(\d+(\.\d+)?|[a-zA-Zπ∞])$/.test(text.trim());
}

// Replaces \sqrt{...} and \frac{...}{...} with √(...) and .../..., recursing
// into each argument first so nesting (e.g. a sqrt inside a frac's
// numerator) converts correctly at any depth. A frac's numerator/denominator
// only gets wrapped in parens when it isn't already a single atom — so
// \frac{1}{e} reads as "1/e", not the noisier "(1)/(e)".
function convertRadicalsAndFracs(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("\\sqrt", i)) {
      const arg = readArg(s, i + 5);
      out += `√(${convertRadicalsAndFracs(arg.text)})`;
      i = arg.next;
      continue;
    }
    if (s.startsWith("\\frac", i)) {
      const num = readArg(s, i + 5);
      const den = readArg(s, num.next);
      const numOut = convertRadicalsAndFracs(num.text);
      const denOut = convertRadicalsAndFracs(den.text);
      out += `${isAtomicTerm(num.text) ? numOut : `(${numOut})`}/${isAtomicTerm(den.text) ? denOut : `(${denOut})`}`;
      i = den.next;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

// Best-effort LaTeX -> readable text, for display only (evaluateExpr is the
// source of truth for correctness). Doesn't need to be a full LaTeX parser —
// just cover what the toolbar/typing can actually produce.
export function latexToPlainText(latex) {
  if (!latex) return "";
  let s = latex;
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\cdot|\\times/g, "·");
  s = s.replace(/\\,|\\!|\\;|\\:|\\ /g, "");
  s = s.replace(/\\infty/g, "∞");
  s = s.replace(/\\pi/g, "π");
  s = s.replace(/\\exponentialE/g, "e"); // MathLive's virtual-keyboard macro for Euler's number

  s = convertRadicalsAndFracs(s);

  s = s.replace(/\^\{([^{}]*)\}/g, (_, e) => toSuperscript(e));
  s = s.replace(/\^([0-9])/g, (_, d) => toSuperscript(d));
  s = s.replace(/[{}]/g, "");
  // Euler's number reads better in math italic than a plain letter — but
  // only a standalone "e", never part of a longer identifier or number.
  s = s.replace(/(?<![a-zA-Z0-9])e(?![a-zA-Z0-9])/g, "𝑒");
  return s.trim();
}
