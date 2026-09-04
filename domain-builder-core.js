// Reusable Domain Builder widget — a segment-based UI for entering a
// function's domain as a union of intervals and excluded points.
//
// createDomainBuilder(elements, options) wires the widget up to a set of
// DOM elements and returns a small API for reading/seeding its state.

import "https://esm.run/mathlive@0.110.0"; // registers the <math-field> custom element
import { MathfieldElement } from "https://esm.run/mathlive@0.110.0";
import { evaluateExpr, latexToPlainText } from "./math-expr.js";

// esm.run's asset resolution for MathLive's math fonts is unreliable —
// point it at a CDN path that actually serves them.
MathfieldElement.fontsDirectory = "https://cdn.jsdelivr.net/npm/mathlive@0.110.0/fonts";
MathfieldElement.soundsDirectory = null;

const SEG_COLORS = ["#4f46e5", "#0891b2", "#b45309", "#db2777", "#16a34a", "#7c3aed"];

// A boundary field holds one string that's either a plain number, a math
// expression (e^2, sqrt(2), pi/2, ...), or infinity written as inf /
// infinity / ∞ — evaluateExpr() handles all three the same way, so there's
// no separate "is this infinite" flag to keep in sync.
function isInf(v) {
  return v !== null && !Number.isFinite(v);
}

export function isIntervalValid(s) {
  const l = evaluateExpr(s.leftVal);
  const r = evaluateExpr(s.rightVal);
  if (l === null || r === null) return false;
  return l < r;
}

export function isPointValid(s) {
  const v = evaluateExpr(s.pointVal);
  return v !== null && Number.isFinite(v);
}

export function formatVal(v) {
  if (v === "" || v === null || v === undefined) return "?";
  return latexToPlainText(v) || "?";
}

export function segmentText(s) {
  if (s.type === "interval") {
    const l = evaluateExpr(s.leftVal);
    const r = evaluateExpr(s.rightVal);
    const lInf = isInf(l), rInf = isInf(r);
    const lb = lInf ? "(" : (s.leftClosed ? "[" : "(");
    const rb = rInf ? ")" : (s.rightClosed ? "]" : ")");
    const lv = lInf ? (l < 0 ? "-∞" : "∞") : formatVal(s.leftVal);
    const rv = rInf ? (r < 0 ? "-∞" : "∞") : formatVal(s.rightVal);
    return `${lb}${lv}, ${rv}${rb}`;
  }
  return `x ≠ ${formatVal(s.pointVal)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Builds the "(-∞, 2) ∪ [3, ∞),  x ≠ 5" style preview as a DOM fragment, so
// both the live builder preview and a "show solution" display can render
// the exact same notation from a plain segment list.
export function buildPreviewFragment(segments) {
  const frag = document.createDocumentFragment();
  if (segments.length === 0) {
    frag.appendChild(document.createTextNode("∅"));
    return frag;
  }
  const intervals = segments.filter((s) => s.type === "interval");
  const points = segments.filter((s) => s.type === "point");
  const intervalText = intervals.map(segmentText).join("  ∪  ");
  const pointsText = points.map(segmentText).join(",  ");

  if (intervalText) {
    const unionSpan = document.createElement("span");
    unionSpan.textContent = intervalText;
    frag.appendChild(unionSpan);
  }
  if (pointsText) {
    if (intervalText) frag.appendChild(document.createTextNode(",  "));
    const exSpan = document.createElement("span");
    exSpan.className = "excluded-list";
    exSpan.textContent = pointsText;
    frag.appendChild(exSpan);
  }
  return frag;
}

// Draws the same axis-with-intervals-and-points picture the live builder
// uses, into any target <svg> — so a "show solution" display can render
// the correct answer's number line without needing its own builder instance.
export function renderNumberLineSVG(segments, svgEl) {
  const width = 600, height = 90, pad = 30, axisY = 55;
  const finiteVals = [];
  segments.forEach((s) => {
    if (s.type === "interval") {
      const l = evaluateExpr(s.leftVal), r = evaluateExpr(s.rightVal);
      if (l !== null && Number.isFinite(l)) finiteVals.push(l);
      if (r !== null && Number.isFinite(r)) finiteVals.push(r);
    } else {
      const p = evaluateExpr(s.pointVal);
      if (p !== null && Number.isFinite(p)) finiteVals.push(p);
    }
  });

  let min = -5, max = 5;
  if (finiteVals.length) {
    min = Math.min(...finiteVals);
    max = Math.max(...finiteVals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.25 + 0.5;
    max += span * 0.25 + 0.5;
  }
  // The origin is always a visible reference point, even if every
  // entered value is far from it.
  min = Math.min(min, 0);
  max = Math.max(max, 0);

  const x = (v) => pad + ((v - min) / (max - min)) * (width - 2 * pad);

  let svg = "";
  svg += `<line x1="${pad - 8}" y1="${axisY}" x2="${width - pad + 8}" y2="${axisY}" stroke="#c7cbe0" stroke-width="2" marker-end="url(#arrowEnd)" marker-start="url(#arrowStart)"/>`;

  svg += `<defs>
    <marker id="arrowEnd" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#c7cbe0"/>
    </marker>
    <marker id="arrowStart" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M8,0 L0,4 L8,8 Z" fill="#c7cbe0"/>
    </marker>
  </defs>`;

  // zero tick — always shown, since it's now always kept in range
  if (min <= 0 && max >= 0) {
    const zx = x(0);
    svg += `<line x1="${zx}" y1="${axisY - 9}" x2="${zx}" y2="${axisY + 9}" stroke="#111318" stroke-width="2.5"/>`;
    svg += `<text x="${zx}" y="${axisY + 24}" font-size="13" font-weight="700" fill="#111318" text-anchor="middle">0</text>`;
  }

  // Draw intervals first (background layer), then excluded points on top —
  // regardless of row order, so a point is never hidden under an interval bar.
  segments.forEach((s, i) => {
    if (s.type !== "interval") return;
    const color = SEG_COLORS[i % SEG_COLORS.length];
    const y = axisY;

    const lRaw = evaluateExpr(s.leftVal);
    const rRaw = evaluateExpr(s.rightVal);
    if (lRaw === null || rRaw === null) return;
    const lInf = !Number.isFinite(lRaw), rInf = !Number.isFinite(rRaw);
    const l = lInf ? min - 1 : lRaw;
    const r = rInf ? max + 1 : rRaw;
    const x1 = lInf ? pad - 8 : x(Math.max(l, min));
    const x2 = rInf ? width - pad + 8 : x(Math.min(r, max));
    if (x2 <= x1 && !lInf && !rInf) return;

    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="6" stroke-linecap="butt"/>`;

    if (!lInf) {
      const cx = x(l);
      const label = escapeHtml(latexToPlainText(s.leftVal));
      svg += s.leftClosed
        ? `<circle cx="${cx}" cy="${y}" r="6" fill="${color}"/>`
        : `<circle cx="${cx}" cy="${y}" r="6" fill="white" stroke="${color}" stroke-width="3"/>`;
      svg += `<text x="${cx}" y="${y - 14}" font-size="12" fill="${color}" text-anchor="middle">${label}</text>`;
    }
    if (!rInf) {
      const cx = x(r);
      const label = escapeHtml(latexToPlainText(s.rightVal));
      svg += s.rightClosed
        ? `<circle cx="${cx}" cy="${y}" r="6" fill="${color}"/>`
        : `<circle cx="${cx}" cy="${y}" r="6" fill="white" stroke="${color}" stroke-width="3"/>`;
      svg += `<text x="${cx}" y="${y - 14}" font-size="12" fill="${color}" text-anchor="middle">${label}</text>`;
    }
  });

  segments.forEach((s, i) => {
    if (s.type !== "point") return;
    const color = SEG_COLORS[i % SEG_COLORS.length];
    const y = axisY;

    const p = evaluateExpr(s.pointVal);
    if (p === null || !Number.isFinite(p) || p < min || p > max) return;
    const cx = x(p);
    const label = escapeHtml(latexToPlainText(s.pointVal));
    svg += `<circle cx="${cx}" cy="${y}" r="7" fill="white" stroke="${color}" stroke-width="3"/>`;
    svg += `<line x1="${cx - 5}" y1="${y - 5}" x2="${cx + 5}" y2="${y + 5}" stroke="${color}" stroke-width="2"/>`;
    svg += `<line x1="${cx - 5}" y1="${y + 5}" x2="${cx + 5}" y2="${y - 5}" stroke="${color}" stroke-width="2"/>`;
    svg += `<text x="${cx}" y="${y + 24}" font-size="12" fill="${color}" text-anchor="middle">${label}</text>`;
  });

  svg += `<text x="${width - pad + 14}" y="${axisY + 5}" font-size="13" fill="#9aa0b8">x</text>`;

  svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgEl.innerHTML = svg;
}

// LaTeX snippets the per-field menu inserts into that field. "#0"/"#1" are
// MathLive placeholder slots the cursor lands in.
const SYMBOL_INSERTS = {
  sqrt: "\\sqrt{#0}",
  pow: "^{#0}",
  frac: "\\frac{#0}{#1}",
  pi: "\\pi",
  e: "e",
  infty: "\\infty",
};

const SYMBOL_MENU_HTML = `
  <div class="field-menu hidden">
    <button type="button" class="field-menu-item" data-action="insert" data-insert="sqrt" title="Square root">√</button>
    <button type="button" class="field-menu-item" data-action="insert" data-insert="pow" title="Exponent">x²</button>
    <button type="button" class="field-menu-item" data-action="insert" data-insert="frac" title="Fraction">a⁄b</button>
    <button type="button" class="field-menu-item" data-action="insert" data-insert="pi" title="Pi">π</button>
    <button type="button" class="field-menu-item" data-action="insert" data-insert="e" title="Euler's number">e</button>
    <button type="button" class="field-menu-item" data-action="insert" data-insert="infty" title="Infinity">∞</button>
  </div>`;

// A math-field plus a small dropdown caret (bottom-right) that opens a
// symbol menu scoped to that one field, instead of one shared toolbar.
function fieldWrapHTML(action, placeholder) {
  return `
    <span class="field-wrap">
      <math-field class="value-input" data-action="${action}" placeholder="${placeholder}" virtual-keyboard-mode="onfocus"></math-field>
      <button type="button" class="field-menu-btn" data-action="toggle-menu" title="Insert symbol">▾</button>
      ${SYMBOL_MENU_HTML}
    </span>`;
}

export function createDomainBuilder(elements, options = {}) {
  const { segmentsEl, previewEl, svgEl, debugEl } = elements;
  const { initialSegments = [], onChange } = options;

  let segments = [];
  let nextId = 1;

  function closeAllMenus() {
    segmentsEl.querySelectorAll(".field-menu").forEach((m) => m.classList.add("hidden"));
  }

  // Close any open symbol menu when clicking outside its field-wrap.
  document.addEventListener("click", (e) => {
    if (e.target.closest(".field-wrap")) return;
    closeAllMenus();
  });

  // Keep the field focused while using its toggle/menu — a plain button
  // click would otherwise steal focus and insert() needs the field active.
  segmentsEl.addEventListener("mousedown", (e) => {
    if (e.target.closest('[data-action="toggle-menu"], [data-action="insert"]')) e.preventDefault();
  });

  function newInterval() {
    return { id: nextId++, type: "interval", leftClosed: true, leftVal: "", rightClosed: false, rightVal: "" };
  }

  function newPoint() {
    return { id: nextId++, type: "point", pointVal: "" };
  }

  function moveSegment(id, direction) {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= segments.length) return;
    [segments[idx], segments[newIdx]] = [segments[newIdx], segments[idx]];
    render();
  }

  // ---------------------------------------------------------------------
  // Rendering: segment rows
  // ---------------------------------------------------------------------

  function render() {
    renderRows();
    renderPreview();
    if (svgEl) renderNumberLine();
    if (debugEl) renderDebug();
    if (onChange) onChange(getSegments());
  }

  function renderRows() {
    segmentsEl.innerHTML = "";
    segments.forEach((s, i) => {
      const color = SEG_COLORS[i % SEG_COLORS.length];
      const row = document.createElement("div");
      row.className = "segment-row";
      row.dataset.id = s.id;

      const moveBtns = `
          <span class="move-btns">
            <button class="move-btn" data-action="move-up" title="Move up" ${i === 0 ? "disabled" : ""}>▲</button>
            <button class="move-btn" data-action="move-down" title="Move down" ${i === segments.length - 1 ? "disabled" : ""}>▼</button>
          </span>`;

      if (s.type === "interval") {
        if (!isIntervalValid(s)) row.classList.add("invalid");
        const lInf = isInf(evaluateExpr(s.leftVal));
        const rInf = isInf(evaluateExpr(s.rightVal));
        row.innerHTML = `
          <span class="segment-swatch" style="background:${color}"></span>
          <button class="bracket-btn" data-action="toggle-left-bracket" ${lInf ? "disabled" : ""}>${lInf ? "(" : (s.leftClosed ? "[" : "(")}</button>
          ${fieldWrapHTML("left-val", "x")}
          <span class="comma">,</span>
          ${fieldWrapHTML("right-val", "x")}
          <button class="bracket-btn" data-action="toggle-right-bracket" ${rInf ? "disabled" : ""}>${rInf ? ")" : (s.rightClosed ? "]" : ")")}</button>
          <span class="row-spacer"></span>
          <span class="row-preview">${escapeHtml(segmentText(s))}</span>
          ${moveBtns}
          <button class="remove-btn" data-action="remove" title="Remove">✕</button>
        `;
      } else {
        if (!isPointValid(s)) row.classList.add("invalid");
        row.innerHTML = `
          <span class="segment-swatch" style="background:${color}"></span>
          <span class="point-label">x ≠</span>
          ${fieldWrapHTML("point-val", "a")}
          <span class="row-spacer"></span>
          <span class="row-preview">${escapeHtml(segmentText(s))}</span>
          ${moveBtns}
          <button class="remove-btn" data-action="remove" title="Remove">✕</button>
        `;
      }
      segmentsEl.appendChild(row);

      // Set initial content via the .value property (LaTeX) rather than an
      // HTML attribute — the reliable way to seed a math-field's content.
      row.querySelectorAll("math-field[data-action]").forEach((mf) => {
        const action = mf.dataset.action;
        if (action === "left-val") mf.value = s.leftVal;
        else if (action === "right-val") mf.value = s.rightVal;
        else if (action === "point-val") mf.value = s.pointVal;
      });
    });
  }

  // ---------------------------------------------------------------------
  // Preview text
  // ---------------------------------------------------------------------

  function renderPreview() {
    if (segments.length === 0) {
      previewEl.textContent = "No segments yet — add an interval or an excluded point below.";
      previewEl.classList.add("empty");
      return;
    }
    previewEl.classList.remove("empty");
    previewEl.innerHTML = "";
    previewEl.appendChild(buildPreviewFragment(segments));
  }

  // ---------------------------------------------------------------------
  // Number line visualization
  // ---------------------------------------------------------------------

  function renderNumberLine() {
    renderNumberLineSVG(segments, svgEl);
  }

  function renderDebug() {
    debugEl.textContent = JSON.stringify(segments, null, 2);
  }

  // ---------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------

  segmentsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const row = e.target.closest(".segment-row");
    const id = Number(row.dataset.id);
    const s = segments.find((x) => x.id === id);
    if (!s) return;

    switch (btn.dataset.action) {
      case "remove":
        segments = segments.filter((x) => x.id !== id);
        break;
      case "toggle-left-bracket":
        s.leftClosed = !s.leftClosed;
        break;
      case "toggle-right-bracket":
        s.rightClosed = !s.rightClosed;
        break;
      case "move-up":
        moveSegment(id, -1);
        return;
      case "move-down":
        moveSegment(id, 1);
        return;
      case "toggle-menu": {
        const menu = btn.nextElementSibling;
        const wasHidden = menu.classList.contains("hidden");
        closeAllMenus();
        if (wasHidden) menu.classList.remove("hidden");
        return;
      }
      case "insert": {
        const mf = btn.closest(".field-wrap").querySelector("math-field");
        mf.focus();
        mf.insert(SYMBOL_INSERTS[btn.dataset.insert]);
        mf.dispatchEvent(new Event("input", { bubbles: true }));
        closeAllMenus();
        return;
      }
    }
    render();
  });

  segmentsEl.addEventListener("input", (e) => {
    const input = e.target.closest("math-field[data-action]");
    if (!input) return;
    const row = e.target.closest(".segment-row");
    const id = Number(row.dataset.id);
    const s = segments.find((x) => x.id === id);
    if (!s) return;

    if (input.dataset.action === "left-val") s.leftVal = input.value;
    if (input.dataset.action === "right-val") s.rightVal = input.value;
    if (input.dataset.action === "point-val") s.pointVal = input.value;

    // Re-render preview/debug/svg but avoid rebuilding rows (would steal focus).
    renderPreview();
    if (svgEl) renderNumberLine();
    if (debugEl) renderDebug();
    const rowNow = segmentsEl.querySelector(`.segment-row[data-id="${id}"]`);
    if (rowNow) {
      const valid = s.type === "interval" ? isIntervalValid(s) : isPointValid(s);
      rowNow.classList.toggle("invalid", !valid);
      const previewSpan = rowNow.querySelector(".row-preview");
      if (previewSpan) previewSpan.textContent = segmentText(s);

      if (s.type === "interval") {
        const lInf = isInf(evaluateExpr(s.leftVal));
        const rInf = isInf(evaluateExpr(s.rightVal));
        const leftBtn = rowNow.querySelector('[data-action="toggle-left-bracket"]');
        const rightBtn = rowNow.querySelector('[data-action="toggle-right-bracket"]');
        if (leftBtn) { leftBtn.disabled = lInf; leftBtn.textContent = lInf ? "(" : (s.leftClosed ? "[" : "("); }
        if (rightBtn) { rightBtn.disabled = rInf; rightBtn.textContent = rInf ? ")" : (s.rightClosed ? "]" : ")"); }
      }
    }
    if (onChange) onChange(getSegments());
  });

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  function getSegments() {
    return segments.map((s) => ({ ...s }));
  }

  function setSegments(newSegments) {
    segments = newSegments.map((s) => ({ ...s, id: nextId++ }));
    render();
  }

  function addInterval() {
    segments.push(newInterval());
    render();
  }

  function addPoint() {
    segments.push(newPoint());
    render();
  }

  function clear() {
    segments = [];
    render();
  }

  function isValid() {
    if (segments.length === 0) return false;
    return segments.every((s) => (s.type === "interval" ? isIntervalValid(s) : isPointValid(s)));
  }

  setSegments(initialSegments);

  return { getSegments, setSegments, addInterval, addPoint, clear, isValid, render };
}
