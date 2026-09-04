import { createDomainBuilder } from "./domain-builder-core.js";

const builder = createDomainBuilder(
  {
    segmentsEl: document.getElementById("segments"),
    previewEl: document.getElementById("preview"),
    svgEl: document.getElementById("numberLine"),
    debugEl: document.getElementById("debugOut"),
  },
  {
    // Seed with one example interval + excluded point so the UI isn't empty on first load.
    initialSegments: [
      { type: "interval", leftClosed: false, leftVal: "-\\infty", rightClosed: false, rightVal: "2" },
      { type: "point", pointVal: "5" },
    ],
  }
);

document.getElementById("addIntervalBtn").addEventListener("click", () => builder.addInterval());
document.getElementById("addPointBtn").addEventListener("click", () => builder.addPoint());
document.getElementById("clearBtn").addEventListener("click", () => builder.clear());
