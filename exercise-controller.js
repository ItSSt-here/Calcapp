// Shared page controller for a "describe the correct set of reals"
// exercise page. Both the domain page and the range (image) page ask the
// student to build a union of intervals/excluded points and check it
// against a correct answer of the same shape — this wires up the segment
// builder, the number-line preview, the check/solution/next buttons, and
// the "did you mean all reals?" confirm dialog around whatever exercise
// bank the caller supplies via pickExercise(). Only the bank itself (and
// the static label text baked into each page's own HTML) differs between
// pages.
import { createDomainBuilder, buildPreviewFragment, renderNumberLineSVG } from "./domain-builder-core.js";
import { domainsEqual } from "./domain-equivalence.js";

export const ALL_REALS = { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: "\\infty" };

export function createExercisePage(pickExercise) {
  const problemCardSlotEl = document.getElementById("problemCardSlot");
  const problemCardEl = document.getElementById("problemCard");
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
  const answerCardEl = document.getElementById("answerCard");
  const answerBadgeEl = document.getElementById("answerBadge");
  const answerStatusTextEl = document.getElementById("answerStatusText");

  // Marks the "Your answer" card itself with one of four states: null
  // (neutral, while working), "solution" (viewing the correct answer),
  // or "correct"/"incorrect" (graded — border glow, a ✓/✗ badge, and a small
  // "Correct"/"Incorrect" label, all on the card itself rather than a
  // separate text banner). Called fresh on every grade, never left stale —
  // editing the answer at all resets it to neutral (see the builder's
  // onChange below), so a second wrong attempt always starts from neutral
  // and gets its own clear signal, not a rehash of the first.
  function setAnswerState(state) {
    answerCardEl.classList.remove("correct", "incorrect", "solution");
    answerBadgeEl.classList.remove("show", "correct", "incorrect");
    answerBadgeEl.textContent = "";
    answerStatusTextEl.classList.remove("show", "correct", "incorrect");
    answerStatusTextEl.textContent = "";
    if (!state) return;
    if (state === "solution") {
      answerCardEl.classList.add("solution");
      return;
    }
    // Force a reflow so the shake animation restarts even if "incorrect" is
    // set twice in a row (e.g. clicking Check again with no edits in between).
    void answerCardEl.offsetWidth;
    answerCardEl.classList.add(state);
    answerBadgeEl.classList.add("show", state);
    answerBadgeEl.textContent = state === "correct" ? "✓" : "✗";
    answerStatusTextEl.classList.add("show", state);
    answerStatusTextEl.textContent = state === "correct" ? "Correct" : "Incorrect";
  }

  const builder = createDomainBuilder({
    segmentsEl: document.getElementById("segments"),
    previewEl,
    svgEl: numberLineEl,
  }, {
    initialSegments: [
      { type: "interval", leftClosed: true, leftVal: "", rightClosed: false, rightVal: "" },
    ],
    onChange: () => setAnswerState(null),
  });

  document.getElementById("addIntervalBtn").addEventListener("click", () => builder.addInterval());
  document.getElementById("addPointBtn").addEventListener("click", () => builder.addPoint());
  document.getElementById("clearBtn").addEventListener("click", () => builder.clear());

  let currentExercise = null;
  let pendingRealsGuess = null; // synthetic segments awaiting confirmation via the ℝ-suggestion dialog
  let outgoingProblemClone = null;

  function removeOutgoingProblemClone() {
    if (outgoingProblemClone) {
      outgoingProblemClone.remove();
      outgoingProblemClone = null;
    }
  }

  function loadExercise(exercise, { animate = false } = {}) {
    currentExercise = exercise;

    if (animate && problemTextEl.firstChild) {
      removeOutgoingProblemClone(); // in case a previous transition is still mid-flight
      // Clone the whole card -- frame and all, not just its content -- so it
      // reads as the entire page sliding aside, with the next one already
      // waiting in place underneath. A future exercise type may use a
      // different instruction than this one, so the label rides along with
      // the formula rather than staying fixed while only the formula moves.
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
      outgoingProblemClone = clone;
      void clone.offsetWidth; // force a reflow so the transition below actually animates
      clone.classList.add("animate-out");
      clone.addEventListener("transitionend", removeOutgoingProblemClone, { once: true });
    }

    problemCardEl.dataset.level = exercise.difficulty;
    katex.render(exercise.prompt, problemTextEl, { throwOnError: false, displayMode: true });

    builder.setSegments([
      { type: "interval", leftClosed: true, leftVal: "", rightClosed: false, rightVal: "" },
    ]);

    feedbackEl.className = "feedback";
    feedbackEl.textContent = "";
    solutionLabelEl.classList.add("hidden");
    confirmOverlayEl.classList.add("hidden");
    pendingRealsGuess = null;
    setAnswerState(null);

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
      setAnswerState("correct");
      resolveExercise();
    } else {
      setAnswerState("incorrect");
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
    setAnswerState(null);
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
    setAnswerState("solution");

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
    loadExercise(pickExercise(), { animate: true });
  });

  loadExercise(pickExercise());
}
