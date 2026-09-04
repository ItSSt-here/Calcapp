// Domain equivalence checking — grades a student's segment list against a
// correct answer regardless of how the domain was decomposed into rows.
//
// Approach: reduce both segment lists to a canonical form (a sorted list of
// maximal, disjoint atomic intervals with exact open/closed boundaries),
// then compare those canonical forms directly. Excluded points are "punched"
// into whichever interval they fall inside, splitting it in two; a point
// outside every interval or already excluded is vacuous and drops out.
// Two domains are mathematically equal iff their canonical forms match.

import { evaluateExpr } from "./math-expr.js";

function toRawPieces(segments) {
  const pieces = [];
  for (const s of segments) {
    if (s.type !== "interval") continue;
    const left = evaluateExpr(s.leftVal);
    const right = evaluateExpr(s.rightVal);
    if (left === null || right === null) continue;
    if (left >= right) continue;
    pieces.push({
      left,
      leftClosed: Number.isFinite(left) ? !!s.leftClosed : false,
      right,
      rightClosed: Number.isFinite(right) ? !!s.rightClosed : false,
    });
  }
  return pieces;
}

function mergePieces(pieces) {
  const sorted = [...pieces].sort((a, b) => {
    if (a.left !== b.left) return a.left - b.left;
    // At the same left value, a closed boundary ([) sorts before open (().
    return (a.leftClosed === b.leftClosed) ? 0 : (a.leftClosed ? -1 : 1);
  });

  const merged = [];
  for (const p of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...p });
      continue;
    }
    const touchesOrOverlaps =
      p.left < last.right || (p.left === last.right && (last.rightClosed || p.leftClosed));
    if (!touchesOrOverlaps) {
      merged.push({ ...p });
      continue;
    }
    if (p.right > last.right) {
      last.right = p.right;
      last.rightClosed = p.rightClosed;
    } else if (p.right === last.right) {
      last.rightClosed = last.rightClosed || p.rightClosed;
    }
    // else p is entirely inside last — nothing to extend.
  }
  return merged;
}

function collectPoints(segments) {
  const pts = new Set();
  for (const s of segments) {
    if (s.type !== "point") continue;
    const v = evaluateExpr(s.pointVal);
    if (v !== null && Number.isFinite(v)) pts.add(v);
  }
  return [...pts];
}

function punchPoints(pieces, points) {
  let result = pieces;
  for (const p of points) {
    const next = [];
    for (const piece of result) {
      if (p > piece.left && p < piece.right) {
        next.push({ left: piece.left, leftClosed: piece.leftClosed, right: p, rightClosed: false });
        next.push({ left: p, leftClosed: false, right: piece.right, rightClosed: piece.rightClosed });
      } else if (p === piece.left && piece.leftClosed) {
        next.push({ ...piece, leftClosed: false });
      } else if (p === piece.right && piece.rightClosed) {
        next.push({ ...piece, rightClosed: false });
      } else {
        next.push(piece); // point doesn't touch this piece — no effect
      }
    }
    result = next;
  }
  return result;
}

export function canonicalize(segments) {
  const merged = mergePieces(toRawPieces(segments));
  const punched = punchPoints(merged, collectPoints(segments));
  return mergePieces(punched).sort((a, b) => a.left - b.left);
}

function boundaryEqual(a, b) {
  if (a === Infinity && b === Infinity) return true;
  if (a === -Infinity && b === -Infinity) return true;
  return Math.abs(a - b) < 1e-9;
}

export function domainsEqual(segmentsA, segmentsB) {
  const a = canonicalize(segmentsA);
  const b = canonicalize(segmentsB);
  if (a.length !== b.length) return false;
  return a.every((piece, i) =>
    boundaryEqual(piece.left, b[i].left) &&
    boundaryEqual(piece.right, b[i].right) &&
    piece.leftClosed === b[i].leftClosed &&
    piece.rightClosed === b[i].rightClosed
  );
}

export function formatCanonical(segments) {
  const pieces = canonicalize(segments);
  if (pieces.length === 0) return "∅";
  const fmt = (v) => (v === Infinity ? "∞" : v === -Infinity ? "-∞" : String(v));
  return pieces
    .map((p) => `${p.leftClosed ? "[" : "("}${fmt(p.left)}, ${fmt(p.right)}${p.rightClosed ? "]" : ")"}`)
    .join("  ∪  ");
}
