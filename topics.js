// The practice topics and their exercise banks, shared by the practice
// page (practice.js) and the teacher's link builder (teacher.js). Both are
// driven by the same URL parameters:
//   topics=domain,image  which banks to draw from (default: domain)
//   levels=1,2           which difficulty levels the student sees
//                        (default: all four, remembered per browser)
//   tag=basic            only entries tagged with it (see domain-bank.js)
import { DOMAIN_EXERCISES } from "./domain-bank.js";
import { IMAGE_EXERCISES } from "./image-bank.js";

export const TOPICS = {
  domain: {
    name: "Domain",
    noun: "domain",
    instruction: "Determine the domain of the given function.",
    bank: DOMAIN_EXERCISES,
  },
  image: {
    name: "Image",
    noun: "image",
    instruction: "Determine the image of the given function.",
    bank: IMAGE_EXERCISES,
  },
};

export const LEVELS = [1, 2, 3, 4];

export const TAGS = {
  basic: "functions from lectures 1-2 (no ln, no inverse trig)",
};

export function taggedBank(topic, tag) {
  const bank = TOPICS[topic].bank;
  return tag ? bank.filter((e) => e.tags?.includes(tag)) : bank;
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

  return {
    topics: topics.length > 0 ? topics : ["domain"],
    levels: levels.length > 0 ? levels : null, // null = not fixed by the link
    tag: params.get("tag") || null,
  };
}

export function buildPracticeUrl(base, { topics, levels, tag }) {
  const url = new URL("practice.html", base);
  url.searchParams.set("topics", topics.join(","));
  if (levels) url.searchParams.set("levels", levels.join(","));
  if (tag) url.searchParams.set("tag", tag);
  // Commas read better in a link than %2C, and are safe in a query string.
  return url.toString().replace(/%2C/g, ",");
}
