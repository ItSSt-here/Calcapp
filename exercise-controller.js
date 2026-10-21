// Shared page controller for the practice page. Two kinds of answer, picked
// per exercise by its `kind`:
//   "interval" (default) - domain/image: the student builds a union of
//       intervals/excluded points, checked against a correct answer of the
//       same shape — the segment builder, the number-line preview and the
//       "did you mean all reals?" confirm dialog.
//   "value" - function notation: the student types one number into a
//       single math field, checked against `answer` (any equivalent form).
// Each kind has its own "Your answer" card; only the current one is shown.
// The problem card, check/solution/next buttons and feedback line are
// shared, so a page can mix kinds from one exercise to the next.
import { createDomainBuilder, buildPreviewFragment, renderNumberLineSVG } from "./domain-builder-core.js";
import { domainsEqual } from "./domain-equivalence.js";
import { evaluateExpr } from "./math-expr.js";

export const ALL_REALS = { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: "\\infty" };

export function createExercisePage(pickExercise) {
  const problemCardSlotEl = document.getElementById("problemCardSlot");
  const problemCardEl = document.getElementById("problemCard");
  const problemSignatureEl = document.getElementById("problemSignature"); // optional — not every exercise type sets one
  const problemLevelEl = document.getElementById("problemLevel"); // optional
  const problemTextEl = document.getElementById("problemText");
  const problemLabelEl = document.getElementById("problemLabel");
  const confirmLabelEl = document.getElementById("confirmLabel");
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
  const intervalCardEl = document.getElementById("answerCard");
  const valueCardEl = document.getElementById("valueAnswerCard");
  const valueQuestionEl = document.getElementById("valueQuestion");
  const valueInputEl = document.getElementById("valueInput");
  const valueSolutionEl = document.getElementById("valueSolution");

  // Declared up here, not with the other state below: the builder calls
  // setAnswerState() (which reads it) while it's being created.
  let currentExercise = null;
  const kindOf = (exercise) => exercise.kind ?? "interval";
  // The card for the exercise on screen (the interval one before any loads).
  const activeCard = () => (currentExercise && kindOf(currentExercise) === "value" ? valueCardEl : intervalCardEl);

  // Marks the "Your answer" card itself with one of four states: null
  // (neutral, while working), "solution" (viewing the correct answer),
  // or "correct"/"incorrect" (graded — border glow, a ✓/✗ badge, and a small
  // "Correct"/"Incorrect" label, all on the card itself rather than a
  // separate text banner). Called fresh on every grade, never left stale —
  // editing the answer at all resets it to neutral (see the builder's
  // onChange below), so a second wrong attempt always starts from neutral
  // and gets its own clear signal, not a rehash of the first.
  function setAnswerState(state) {
    const cardEl = activeCard();
    const badgeEl = cardEl.querySelector(".answer-badge");
    const statusTextEl = cardEl.querySelector(".answer-status-text");
    cardEl.classList.remove("correct", "incorrect", "solution");
    badgeEl.classList.remove("show", "correct", "incorrect");
    badgeEl.textContent = "";
    statusTextEl.classList.remove("show", "correct", "incorrect");
    statusTextEl.textContent = "";
    if (!state) return;
    if (state === "solution") {
      cardEl.classList.add("solution");
      return;
    }
    // Force a reflow so the shake animation restarts even if "incorrect" is
    // set twice in a row (e.g. clicking Check again with no edits in between).
    void cardEl.offsetWidth;
    cardEl.classList.add(state);
    badgeEl.classList.add("show", state);
    badgeEl.textContent = state === "correct" ? "✓" : "✗";
    statusTextEl.classList.add("show", state);
    statusTextEl.textContent = state === "correct" ? "Correct" : "Incorrect";
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

  valueInputEl.addEventListener("input", () => setAnswerState(null));
  // Enter checks, as a single-field answer invites (MathLive would
  // otherwise just swallow it).
  valueInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !checkBtn.disabled) {
      e.preventDefault();
      checkBtn.click();
    }
  });

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
    if (problemLevelEl) problemLevelEl.textContent = `Level ${exercise.difficulty}`;
    // A page mixing topics (domain + image) asks a different question per
    // exercise, so the exercise carries its own wording when it has one.
    if (exercise.instruction) problemLabelEl.textContent = exercise.instruction;
    if (exercise.noun && confirmLabelEl) {
      confirmLabelEl.textContent = `The ${exercise.noun} you entered has no interval — did you mean:`;
    }
    if (problemSignatureEl) {
      if (exercise.signature) {
        problemSignatureEl.classList.remove("hidden");
        katex.render(exercise.signature, problemSignatureEl, { throwOnError: false, displayMode: false });
      } else {
        problemSignatureEl.classList.add("hidden");
        problemSignatureEl.textContent = "";
      }
    }
    katex.render(exercise.prompt, problemTextEl, { throwOnError: false, displayMode: true });

    const isValue = kindOf(exercise) === "value";
    intervalCardEl.classList.toggle("hidden", isValue);
    valueCardEl.classList.toggle("hidden", !isValue);
    if (isValue) {
      katex.render(`${exercise.question} =`, valueQuestionEl, { throwOnError: false });
      valueInputEl.value = "";
      valueSolutionEl.classList.add("hidden");
      valueSolutionEl.textContent = "";
    } else {
      builder.setSegments([
        { type: "interval", leftClosed: true, leftVal: "", rightClosed: false, rightVal: "" },
      ]);
    }

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

  // Any equivalent form of the number counts (-1/4, -0.25, -\frac{2}{8}).
  function checkValue() {
    const value = evaluateExpr(valueInputEl.value);
    if (value === null) {
      feedbackEl.className = "feedback info";
      feedbackEl.textContent = valueInputEl.value.trim() === ""
        ? "Type your answer first."
        : "Couldn't read that as a number — enter a single number, like 7, -3 or 1/4.";
      return;
    }
    feedbackEl.className = "feedback";
    feedbackEl.textContent = "";
    const expected = currentExercise.answer;
    if (Math.abs(value - expected) <= 1e-9 * Math.max(1, Math.abs(expected))) {
      setAnswerState("correct");
      resolveExercise();
    } else {
      setAnswerState("incorrect");
    }
  }

  checkBtn.addEventListener("click", () => {
    if (kindOf(currentExercise) === "value") {
      checkValue();
      return;
    }

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

    if (kindOf(currentExercise) === "value") {
      valueSolutionEl.classList.remove("hidden");
      katex.render(`${currentExercise.question} = ${currentExercise.answerLatex}`, valueSolutionEl, { throwOnError: false });
      resolveExercise();
      return;
    }

    // Replace the student's own preview/number-line — not their input rows —
    // with the correct answer's, right where their own would normally render.
    solutionLabelEl.classList.remove("hidden");
    previewEl.classList.remove("empty");
    previewEl.innerHTML = "";
    previewEl.appendChild(buildPreviewFragment(currentExercise.correct));
    renderNumberLineSVG(currentExercise.correct, numberLineEl);

    resolveExercise();
  });

  const next = () => loadExercise(pickExercise(), { animate: true });
  nextBtn.addEventListener("click", next);

  loadExercise(pickExercise());
  return { next };
}
