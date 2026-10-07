// Practice page — one page for every topic mix. What it draws from comes
// from the URL (see topics.js), so a teacher's link can drop the student
// straight into e.g. domain + image questions, levels 1-2, #basic only.
import { createExercisePage } from "./exercise-controller.js";
import { TOPICS, LEVELS, taggedBank, parsePracticeParams } from "./topics.js";

const { topics, levels: fixedLevels, tag: requestedTag } = parsePracticeParams(location.search);

// An unknown tag (nothing in the chosen topics has it) is ignored, with a
// note next to the chip, rather than leaving an empty bank — so a typo in
// a link still gives the student something to practice.
const tagMatches = requestedTag && topics.some((t) => taggedBank(t, requestedTag).length > 0);
const activeTag = tagMatches ? requestedTag : null;
const pools = Object.fromEntries(topics.map((t) => [t, taggedBank(t, activeTag)]));

document.title = topics.length === 1 ? `Find the ${TOPICS[topics[0]].name}` : "Domain & Image";
const problemLabelEl = document.getElementById("problemLabel");
problemLabelEl.textContent = topics.length === 1 ? TOPICS[topics[0]].instruction : "";

const tagChipEl = document.getElementById("tagChip");
if (requestedTag) {
  tagChipEl.classList.remove("hidden");
  tagChipEl.textContent = activeTag
    ? `#${activeTag}`
    : `#${requestedTag} — no exercises have this tag, showing all`;
  tagChipEl.classList.toggle("unknown", !activeTag);
}

// Difficulty filter — a row of independently toggleable buttons (at least
// one always stays active). This allows non-contiguous picks like {1, 4},
// which isn't a "real" range but is a deliberate simplicity/UX tradeoff.
// A link that fixes `levels` shows only those buttons, all on, and doesn't
// touch the saved selection; otherwise the selection is remembered per
// topic mix (the single-topic keys predate this page, so keep them).
const allowedLevels = fixedLevels ?? LEVELS;
const storageKey = fixedLevels ? null : `calcapp-${topics.join("-")}-difficulty-v1`;
const difficultyFilterEl = document.getElementById("difficultyFilter");
const difficultyButtons = Array.from(difficultyFilterEl.querySelectorAll(".difficulty-btn"));

function loadSelectedDifficulties() {
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length > 0 && saved.every((n) => allowedLevels.includes(n))) {
        return new Set(saved);
      }
    } catch {}
  }
  return new Set(allowedLevels);
}

const selectedDifficulties = loadSelectedDifficulties();

function saveSelectedDifficulties() {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...selectedDifficulties]));
  } catch {}
}

function levelHasExercises(level) {
  return topics.some((t) => pools[t].some((e) => e.difficulty === level));
}

function renderDifficultyButtons() {
  for (const btn of difficultyButtons) {
    const level = Number(btn.dataset.level);
    btn.classList.toggle("hidden", !allowedLevels.includes(level));
    btn.classList.toggle("active", selectedDifficulties.has(level));
    // A level with no exercises (under this tag/topic mix) is greyed out —
    // still clickable, so the saved selection isn't lost.
    btn.classList.toggle("empty", !levelHasExercises(level));
  }
}

renderDifficultyButtons();

difficultyFilterEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".difficulty-btn");
  if (!btn) return;
  const level = Number(btn.dataset.level);

  if (selectedDifficulties.has(level)) {
    if (selectedDifficulties.size === 1) return; // keep at least one level selected
    selectedDifficulties.delete(level);
  } else {
    selectedDifficulties.add(level);
  }
  renderDifficultyButtons();
  saveSelectedDifficulties();
  // Deliberately does not touch the exercise on screen — the filter only
  // affects what pickExercise() draws from next ("Another exercise"),
  // so an accidental click here can't yank away a problem mid-solve.
});

function instantiateExercise(topic, def) {
  const rolled = def.generate ? def.generate({ tag: activeTag }) : { prompt: def.prompt, correct: def.correct };
  const { instruction, noun } = TOPICS[topic];
  return {
    id: def.id,
    difficulty: def.difficulty,
    estimatedMinutes: def.estimatedMinutes,
    signature: def.signature,
    instruction,
    noun,
    ...rolled,
  };
}

// Ids are only unique within a topic (both banks have e.g. "sqrt-x").
let lastExerciseKey = null;

// With several topics, first pick a topic evenly, then an exercise in it —
// otherwise the much bigger domain bank would crowd out the image one.
function pickExercise() {
  const byLevel = Object.fromEntries(
    topics.map((t) => [t, pools[t].filter((e) => selectedDifficulties.has(e.difficulty))]),
  );
  let candidates = topics.filter((t) => byLevel[t].length > 0);
  // The selected levels might all be empty here — fall back to every
  // exercise of the allowed levels, then to the whole pool, rather than
  // having nothing to draw.
  let source = byLevel;
  if (candidates.length === 0) {
    source = Object.fromEntries(topics.map((t) => [t, pools[t].filter((e) => allowedLevels.includes(e.difficulty))]));
    candidates = topics.filter((t) => source[t].length > 0);
  }
  if (candidates.length === 0) {
    source = pools;
    candidates = topics.filter((t) => source[t].length > 0);
  }

  const topic = candidates[Math.floor(Math.random() * candidates.length)];
  const base = source[topic];
  const pool = base.length > 1 ? base.filter((e) => `${topic}:${e.id}` !== lastExerciseKey) : base;
  const def = pool[Math.floor(Math.random() * pool.length)];
  lastExerciseKey = `${topic}:${def.id}`;
  return instantiateExercise(topic, def);
}

createExercisePage(pickExercise);
