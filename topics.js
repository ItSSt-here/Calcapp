// The practice topics and their exercise banks, shared by the practice
// page (practice.js) and the teacher's link builder (teacher.js). Both are
// driven by the same URL parameters:
//   topics=domain,image  which banks to draw from (default: domain)
//   levels=1,2           which difficulty levels the student sees
//                        (default: all four, remembered per browser)
//   tags=basic,ln        which function families to draw (default: all);
//                        an exercise is drawn if ANY of its tags is
//                        selected, as tags usually work (see domain-bank.js).
//                        The older single ?tag=basic still works.
import { DOMAIN_EXERCISES } from "./domain-bank.js";
import { IMAGE_EXERCISES } from "./image-bank.js";
import { NOTATION_EXERCISES } from "./notation-bank.js";

// `kind` picks the answer card (see exercise-controller.js); `noun` is only
// used by the interval kind's "did you mean all reals?" dialog.
export const TOPICS = {
  notation: {
    name: "Function Notation",
    title: "Function Notation",
    kind: "value",
    instruction: "Find the requested value.",
    bank: NOTATION_EXERCISES,
  },
  domain: {
    name: "Domain",
    title: "Find the Domain",
    kind: "interval",
    noun: "domain",
    instruction: "Determine the domain of the given function.",
    bank: DOMAIN_EXERCISES,
  },
  image: {
    name: "Image",
    title: "Find the Image",
    kind: "interval",
    noun: "image",
    instruction: "Determine the image of the given function.",
    bank: IMAGE_EXERCISES,
  },
};

export const LEVELS = [1, 2, 3, 4];

export const TAGS = {
  basic: "functions from lectures 1-2 (polynomials, roots, e^x, trig, |x|)",
  ln: "exercises with ln",
  "inverse-trig": "exercises with arcsin, arccos, arctan",
};

// `tags` null = no restriction.
export function taggedBank(topic, tags) {
  const bank = TOPICS[topic].bank;
  return tags ? bank.filter((e) => e.tags.some((t) => tags.includes(t))) : bank;
}

export function parsePracticeParams(search) {
  const params = new URLSearchParams(search);
  const listParam = (name) => (params.get(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // Kept in a fixed order (not the link's), so "image,domain" and
  // "domain,image" are the same page.
  const requestedTopics = listParam("topics");
  const topics = Object.keys(TOPICS).filter((t) => requestedTopics.includes(t));
  const requestedLevels = listParam("levels").map(Number);
  const levels = LEVELS.filter((n) => requestedLevels.includes(n));
  const requestedTags = [...listParam("tags"), ...listParam("tag")];
  const tags = Object.keys(TAGS).filter((t) => requestedTags.includes(t));

  return {
    topics: topics.length > 0 ? topics : ["domain"],
    levels: levels.length > 0 ? levels : null, // null = not fixed by the link
    tags: tags.length > 0 ? tags : null, // null = all families
    unknownTags: requestedTags.filter((t) => !(t in TAGS)),
  };
}

export function buildPracticeUrl(base, { topics, levels, tags }) {
  const url = new URL("practice.html", base);
  url.searchParams.set("topics", topics.join(","));
  if (levels) url.searchParams.set("levels", levels.join(","));
  // All families selected is the same as no restriction — keep the link short.
  if (tags && tags.length < Object.keys(TAGS).length) url.searchParams.set("tags", tags.join(","));
  // Commas read better in a link than %2C, and are safe in a query string.
  return url.toString().replace(/%2C/g, ",");
}
