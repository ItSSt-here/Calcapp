// Reusable Domain Builder widget — a segment-based UI for entering a
// function's domain as a union of intervals and excluded points.
//
// createDomainBuilder(elements, options) wires the widget up to a set of
// DOM elements and returns a small API for reading/seeding its state.

const SEG_COLORS = ["#4f46e5", "#0891b2", "#b45309", "#db2777", "#16a34a", "#7c3aed"];

export function parseNum(str) {
  if (str === "" || str === null || str === undefined) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

export function isIntervalValid(s) {
  const l = s.leftInf ? -Infinity : parseNum(s.leftVal);
  const r = s.rightInf ? Infinity : parseNum(s.rightVal);
  if (l === null || r === null) return false;
  return l < r;
}

export function isPointValid(s) {
  return parseNum(s.pointVal) !== null;
}

export function formatVal(v) {
  return v === "" || v === null ? "?" : v;
}

export function segmentText(s) {
  if (s.type === "interval") {
    const lb = s.leftInf ? "(" : (s.leftClosed ? "[" : "(");
    const rb = s.rightInf ? ")" : (s.rightClosed ? "]" : ")");
    const lv = s.leftInf ? "-∞" : formatVal(s.leftVal);
    const rv = s.rightInf ? "∞" : formatVal(s.rightVal);
    return `${lb}${lv}, ${rv}${rb}`;
  }
  return `x ≠ ${formatVal(s.pointVal)}`;
}

// Builds the "(-∞, 2) ∪ [3, ∞),  x ≠ 5" style preview as a DOM fragment, so
// both the live builder preview and a static "show solution" display can
// render the exact same notation from a plain segment list.
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

export function createDomainBuilder(elements, options = {}) {
  const { segmentsEl, previewEl, svgEl, debugEl } = elements;
  const { initialSegments = [], onChange } = options;

  let segments = [];
  let nextId = 1;

  function newInterval() {
    return {
      id: nextId++,
      type: "interval",
      leftInf: false,
      leftClosed: true,
      leftVal: "",
      rightInf: false,
      rightClosed: false,
      rightVal: "",
    };
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
        row.innerHTML = `
          <span class="segment-swatch" style="background:${color}"></span>
          <button class="bracket-btn" data-action="toggle-left-bracket" ${s.leftInf ? "disabled" : ""}>${s.leftInf ? "(" : (s.leftClosed ? "[" : "(")}</button>
          <button class="inf-btn ${s.leftInf ? "active" : ""}" data-action="toggle-left-inf">-∞</button>
          <input class="value-input" type="number" step="any" placeholder="x" data-action="left-val" value="${s.leftVal}" ${s.leftInf ? "disabled" : ""}>
          <span class="comma">,</span>
          <input class="value-input" type="number" step="any" placeholder="x" data-action="right-val" value="${s.rightVal}" ${s.rightInf ? "disabled" : ""}>
          <button class="inf-btn ${s.rightInf ? "active" : ""}" data-action="toggle-right-inf">∞</button>
          <button class="bracket-btn" data-action="toggle-right-bracket" ${s.rightInf ? "disabled" : ""}>${s.rightInf ? ")" : (s.rightClosed ? "]" : ")")}</button>
          <span class="row-spacer"></span>
          <span class="row-preview">${segmentText(s)}</span>
          ${moveBtns}
          <button class="remove-btn" data-action="remove" title="Remove">✕</button>
        `;
      } else {
        if (!isPointValid(s)) row.classList.add("invalid");
        row.innerHTML = `
          <span class="segment-swatch" style="background:${color}"></span>
          <span class="point-label">x ≠</span>
          <input class="value-input" type="number" step="any" placeholder="a" data-action="point-val" value="${s.pointVal}">
          <span class="row-spacer"></span>
          <span class="row-preview">${segmentText(s)}</span>
          ${moveBtns}
          <button class="remove-btn" data-action="remove" title="Remove">✕</button>
        `;
      }
      segmentsEl.appendChild(row);
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
    const width = 600, height = 90, pad = 30, axisY = 55;
    const finiteVals = [];
    segments.forEach((s) => {
      if (s.type === "interval") {
        const l = parseNum(s.leftVal), r = parseNum(s.rightVal);
        if (!s.leftInf && l !== null) finiteVals.push(l);
        if (!s.rightInf && r !== null) finiteVals.push(r);
      } else {
        const p = parseNum(s.pointVal);
        if (p !== null) finiteVals.push(p);
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

      const l = s.leftInf ? min - 1 : parseNum(s.leftVal);
      const r = s.rightInf ? max + 1 : parseNum(s.rightVal);
      if (l === null || r === null) return;
      const x1 = s.leftInf ? pad - 8 : x(Math.max(l, min));
      const x2 = s.rightInf ? width - pad + 8 : x(Math.min(r, max));
      if (x2 <= x1 && !s.leftInf && !s.rightInf) return;

      svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="6" stroke-linecap="butt"/>`;

      if (!s.leftInf) {
        const cx = x(l);
        svg += s.leftClosed
          ? `<circle cx="${cx}" cy="${y}" r="6" fill="${color}"/>`
          : `<circle cx="${cx}" cy="${y}" r="6" fill="white" stroke="${color}" stroke-width="3"/>`;
        svg += `<text x="${cx}" y="${y - 14}" font-size="12" fill="${color}" text-anchor="middle">${l}</text>`;
      }
      if (!s.rightInf) {
        const cx = x(r);
        svg += s.rightClosed
          ? `<circle cx="${cx}" cy="${y}" r="6" fill="${color}"/>`
          : `<circle cx="${cx}" cy="${y}" r="6" fill="white" stroke="${color}" stroke-width="3"/>`;
        svg += `<text x="${cx}" y="${y - 14}" font-size="12" fill="${color}" text-anchor="middle">${r}</text>`;
      }
    });

    segments.forEach((s, i) => {
      if (s.type !== "point") return;
      const color = SEG_COLORS[i % SEG_COLORS.length];
      const y = axisY;

      const p = parseNum(s.pointVal);
      if (p === null || p < min || p > max) return;
      const cx = x(p);
      svg += `<circle cx="${cx}" cy="${y}" r="7" fill="white" stroke="${color}" stroke-width="3"/>`;
      svg += `<line x1="${cx - 5}" y1="${y - 5}" x2="${cx + 5}" y2="${y + 5}" stroke="${color}" stroke-width="2"/>`;
      svg += `<line x1="${cx - 5}" y1="${y + 5}" x2="${cx + 5}" y2="${y - 5}" stroke="${color}" stroke-width="2"/>`;
      svg += `<text x="${cx}" y="${y + 24}" font-size="12" fill="${color}" text-anchor="middle">${p}</text>`;
    });

    svg += `<text x="${width - pad + 14}" y="${axisY + 5}" font-size="13" fill="#9aa0b8">x</text>`;

    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svgEl.innerHTML = svg;
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
      case "toggle-left-inf":
        s.leftInf = !s.leftInf;
        if (s.leftInf) { s.leftClosed = false; s.leftVal = ""; }
        break;
      case "toggle-right-inf":
        s.rightInf = !s.rightInf;
        if (s.rightInf) { s.rightClosed = false; s.rightVal = ""; }
        break;
      case "move-up":
        moveSegment(id, -1);
        return;
      case "move-down":
        moveSegment(id, 1);
        return;
    }
    render();
  });

  segmentsEl.addEventListener("input", (e) => {
    const input = e.target.closest("input[data-action]");
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
