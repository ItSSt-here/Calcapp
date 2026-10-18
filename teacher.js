// Teacher's link builder — pick topics, levels and function families, and
// get a practice.html link that drops the student straight into those
// questions. Counts come from the same banks the practice page draws from,
// so the teacher can see e.g. that #basic has no level-3 image exercises.
import { TOPICS, LEVELS, TAGS, taggedBank, buildPracticeUrl } from "./topics.js";

const state = {
  topics: new Set(["domain"]),
  levels: new Set(LEVELS),
  tags: new Set(Object.keys(TAGS)), // all checked = everything
};

const topicPickerEl = document.getElementById("topicPicker");
const levelPickerEl = document.getElementById("levelPicker");
const levelButtons = Array.from(levelPickerEl.querySelectorAll(".difficulty-btn"));
const levelCountsEl = document.getElementById("levelCounts");
const tagPickerEl = document.getElementById("tagPicker");
const summaryEl = document.getElementById("summary");
const linkOutputEl = document.getElementById("linkOutput");
const copyBtn = document.getElementById("copyBtn");
const openLinkEl = document.getElementById("openLink");
const linkWarningEl = document.getElementById("linkWarning");

for (const [tag, desc] of Object.entries(TAGS)) {
  const row = document.createElement("label");
  row.className = "check-row";
  row.innerHTML = `<input type="checkbox"><span><span class="tag-chip"></span> <span class="tag-desc"></span></span>`;
  const box = row.querySelector("input");
  box.dataset.tag = tag;
  box.checked = state.tags.has(tag);
  row.querySelector(".tag-chip").textContent = `#${tag}`;
  row.querySelector(".tag-desc").textContent = desc;
  tagPickerEl.appendChild(row);
}
const tagBoxes = Array.from(tagPickerEl.querySelectorAll("input"));

for (const [key, topic] of Object.entries(TOPICS)) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "choice-btn";
  btn.dataset.topic = key;
  btn.textContent = topic.name;
  topicPickerEl.appendChild(btn);
}
const topicButtons = Array.from(topicPickerEl.querySelectorAll(".choice-btn"));

// Same rule as the student's level filter: at least one stays selected.
function toggle(set, value) {
  if (set.has(value)) {
    if (set.size === 1) return;
    set.delete(value);
  } else {
    set.add(value);
  }
}

topicPickerEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".choice-btn");
  if (!btn) return;
  toggle(state.topics, btn.dataset.topic);
  render();
});

levelPickerEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".difficulty-btn");
  if (!btn) return;
  toggle(state.levels, Number(btn.dataset.level));
  render();
});

tagPickerEl.addEventListener("change", (e) => {
  toggle(state.tags, e.target.dataset.tag);
  render(); // re-syncs the box if toggle() refused to uncheck the last one
});

function countAt(level) {
  const tags = [...state.tags];
  return [...state.topics].reduce(
    (sum, t) => sum + taggedBank(t, tags).filter((e) => e.difficulty === level).length,
    0,
  );
}

function render() {
  const topics = Object.keys(TOPICS).filter((t) => state.topics.has(t));
  const levels = LEVELS.filter((n) => state.levels.has(n));
  const tags = Object.keys(TAGS).filter((t) => state.tags.has(t));
  const allTags = tags.length === Object.keys(TAGS).length;

  for (const btn of topicButtons) btn.classList.toggle("active", state.topics.has(btn.dataset.topic));
  for (const btn of levelButtons) btn.classList.toggle("active", state.levels.has(Number(btn.dataset.level)));
  for (const box of tagBoxes) box.checked = state.tags.has(box.dataset.tag);

  const counts = Object.fromEntries(LEVELS.map((n) => [n, countAt(n)]));
  levelCountsEl.innerHTML = "";
  for (const n of LEVELS) {
    const cell = document.createElement("div");
    cell.className = "level-count" + (counts[n] === 0 ? " zero" : "");
    cell.textContent = `${counts[n]} exercise${counts[n] === 1 ? "" : "s"}`;
    levelCountsEl.appendChild(cell);
  }

  const total = levels.reduce((sum, n) => sum + counts[n], 0);
  const topicNames = topics.map((t) => TOPICS[t].name).join(" + ");
  summaryEl.textContent =
    `${topicNames} · levels ${levels.join(", ")}` +
    (allTags ? " · all functions" : ` · ${tags.map((t) => `#${t}`).join(" ")}`) +
    ` · ${total} exercise${total === 1 ? "" : "s"}`;

  const emptyLevels = levels.filter((n) => counts[n] === 0);
  linkWarningEl.classList.toggle("hidden", emptyLevels.length === 0);
  linkWarningEl.textContent = total === 0
    ? "No exercises match these choices — the students would get exercises from outside them."
    : emptyLevels.length > 0
      ? `Level ${emptyLevels.join(", ")} has no exercises for these choices — students will see ${emptyLevels.length === 1 ? "that button" : "those buttons"} greyed out.`
      : "";

  const url = buildPracticeUrl(location.href, { topics, levels, tags });
  linkOutputEl.value = url;
  openLinkEl.href = url;
  copyBtn.textContent = "Copy";
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(linkOutputEl.value);
  } catch {
    // Clipboard API can be unavailable (e.g. no permission) — fall back to
    // selecting the text so the teacher can copy it by hand.
    linkOutputEl.select();
    document.execCommand("copy");
  }
  copyBtn.textContent = "Copied ✓";
});

linkOutputEl.addEventListener("focus", () => linkOutputEl.select());

render();
