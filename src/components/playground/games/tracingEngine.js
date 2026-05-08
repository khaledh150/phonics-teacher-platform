// ═════════════════════════════════════════════════════════════════════════
//  TRACING ENGINE  —  pure path extraction + runtime projection
// ═════════════════════════════════════════════════════════════════════════
//
//  This module owns EVERY rule that makes the Magic Sand tracing game feel
//  correct across all 52 letters. It is intentionally UI-free: it parses a
//  letter SVG, produces an ordered list of strokes in canvas coordinates,
//  and exposes the runtime helpers used to decide "is the finger on the
//  dotted line?" and "has this stroke finished?".
//
//  The React game component (MagicSandTracing.jsx) only handles rendering,
//  pointer events, audio, and animations. All tracing correctness lives
//  here. If you are porting this to Flutter/Dart, this file is the spec —
//  the browser-DOM bits (DOMParser, getPointAtLength, DOMMatrix, Path2D)
//  have direct equivalents in `package:xml` + `package:path_parsing` +
//  `Path.computeMetrics()` + `Matrix4`.
//
//  ─────────────────────────────────────────────────────────────────────
//  INPUT: SVG FILE FORMAT (src/assets/materials/tracing-letter/*.svg)
//  ─────────────────────────────────────────────────────────────────────
//  Every letter SVG is authored with a fixed convention:
//
//    • fill="#FFFFFF"  → letter body outlines used as a clip mask.
//                        Paths wider/taller than 1500px are the background
//                        rect and are ignored. Paths < 20×20 are noise.
//
//    • fill="#59595C"  → dashed guide lines AND arrow triangles.
//                        - A <path> whose area < 500 and has ≤1 `z` is an
//                          arrow endpoint (one per stroke).
//                        - A <path> with multiple `z` closepaths contains
//                          ALL dashes for exactly ONE stroke. We MUST keep
//                          each element's dashes as a separate group and
//                          NEVER pool them globally — otherwise at an
//                          intersection (T, P, K, R, k) a dash from the
//                          horizontal stroke would get stolen by the
//                          vertical stroke's chain-growth.
//
//    • fill="#FCFDFF"  → numbered digit outlines (1, 2, 3, ...).
//                        These mark stroke start points AND stroke order.
//                        Multi-part digits (e.g. "4") are clustered into
//                        one position. DOCUMENT ORDER is authoritative —
//                        the author placed them in pedagogical order, and
//                        reading-order sorting fails for letters like W
//                        where strokes alternate between top and bottom.
//
//  ─────────────────────────────────────────────────────────────────────
//  ALGORITHM: extractTracingPaths(char, isUppercase, canvasW, canvasH)
//  ─────────────────────────────────────────────────────────────────────
//  Phase 1 — collect #FFFFFF outlines → letter clip mask + viewBox source.
//  Phase 2 — for each #59595C <path>, sample it with getPointAtLength at
//            1.5px intervals, split samples into "segments" at any jump
//            > 10px (= gap between dashes), and take the centroid of each
//            segment as one dash position. Small closed shapes become
//            arrows. Dash groups are stored PER ELEMENT (isolation rule).
//  Phase 3 — collect #FCFDFF digit centroids, cluster sub-paths within
//            30px of each other into composite digits (the "4" problem),
//            preserve document order.
//  Phase 4 — greedy 1:1 assignment:
//              (a) each digit start → nearest unused arrow
//              (b) each digit start → nearest unused dash group
//            Then inside each group, chain-grow from the digit outward by
//            picking the nearest unclaimed dash:
//              • first hop allows up to 120px (digit text → first dash)
//              • subsequent hops only 50px
//              • once ≥3 dashes are ordered, reject a candidate if the
//                new segment's direction deviates more than 0.45π from the
//                running heading (lookback of 5) — keeps the chain from
//                jumping onto a crossing stroke at intersections.
//              • stop when we've placed ≥6 dashes AND are within 35px of
//                this stroke's assigned arrow.
//            If a stroke ends up with zero dashes it becomes a DOT stroke
//            (the tittle on "i", "j"). Dot centers prefer the nearest
//            small outline bbox within 200px.
//            After chaining we (1) extend 15px backwards past the first
//            dash so the trace start is easy to grab, and (2) extend
//            forward to the arrow point (or 15px further along the last
//            heading). Finally interpolatePoints() subdivides the
//            polyline at INTERP_STEP=8px so projection is smooth.
//  Phase 5 — compute viewBox from outline bboxes + 80px padding.
//            Fallback: look inside clipPath <use> elements (c-lowercase
//            has no raw #FFFFFF outline). Last resort: dash bbox + 120px.
//  Phase 6 — scale every point, arrow, startSvg, and firstDash into
//            canvas space via `min(canvasW/vw, canvasH/vh)` + centering
//            offsets. Discard non-dot strokes whose total length ≤ 5px.
//  Phase 7 — smart reorder. Document order is correct for MOST letters
//            (A, T, I) because the author placed digits in pedagogical
//            order. But for letters whose strokes physically connect
//            end-to-start (W, Z, P) the digit-to-group assignment can go
//            wrong. We compute BOTH orderings (doc order vs connectivity
//            chain from upper-leftmost) and only use connectivity
//            chaining if its total endpoint→next-start distance is at
//            least 50% better than document order.
//  Phase 8 — manual overrides. For a hand-picked list of letters where
//            the main vertical stroke should come FIRST pedagogically but
//            the SVG digit order puts the horizontal bar first, we lift
//            the tallest non-dot stroke to the front. Current list:
//            T_U, I_U, K_U, k_L, R_U, P_U, p_L.
//
//  Finally a Path2D clipPath is built from outline d-strings with a
//  DOMMatrix that matches the canvas scale+offset, and the result is
//  cached by (letter × case × canvasW × canvasH).
//
//  ─────────────────────────────────────────────────────────────────────
//  RUNTIME: projectToPath + evaluateStrokeProgress
//  ─────────────────────────────────────────────────────────────────────
//  projectToPath(pts, tx, ty, currentIdx) finds the nearest path index
//  to (tx, ty) within a local window of [currentIdx-8 .. currentIdx+20].
//  The narrow window is important: without it, a drag near an earlier
//  part of the stroke would teleport the trace backwards.
//
//  The game corridor rule (in the React component):
//    if (proj.dist > PATH_CORRIDOR) cancel tracing.
//    newIdx = max(currentIdx, proj.idx)   // never go backwards
//
//  evaluateStrokeProgress(stroke, newIdx, trailWidth) answers "is this
//  stroke done?". The rule is deliberately strict to stop cross-stroke
//  auto-complete at intersections:
//
//    pctDone           = newIdx / (pts.length - 1)
//    minProgressMet    = pctDone >= 0.75
//    nearArrow         = minProgressMet && dist(currPt, arrowPt) < trailWidth * 0.4
//    nearEnd           = minProgressMet && dist(currPt, endPt)   < trailWidth * 0.4
//    complete          = nearArrow || nearEnd || pctDone >= COMPLETION_THRESHOLD (0.94)
//
//  The 75% gate is what prevents "o" from auto-completing when the
//  arrow sits physically near the start of the loop, and prevents a
//  short slide near the crossbar of T/P from finishing the vertical
//  stroke because the horizontal arrow happens to be nearby.
//
//  GRAB_RADIUS (90px) is the pick-up tolerance for the pointer-down
//  event on the stroke start — it is applied by the component, not here,
//  but it is part of the same contract and is exported from this module.
//
//  ─────────────────────────────────────────────────────────────────────
//  CONSTANTS TUNED OVER MANY ITERATIONS — DO NOT CHANGE CASUALLY
//  ─────────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

// ─── Constants ────────────────────────────────────────────────────────────
export const SVG_SIZE = 2000;            // source SVG viewBox is 0 0 2000 2000
export const PATH_CORRIDOR = 55;         // max px drift from polyline before tracing cancels
export const GRAB_RADIUS = 90;           // pointer-down tolerance on stroke start
export const COMPLETION_THRESHOLD = 0.94;// fallback completion ratio
export const ARROW_AREA = 100;           // min bbox area (w*h) for a closed shape to count as an arrow
export const INTERP_STEP = 8;            // subdivision step (px) for interpolatePoints

// Letter typography metadata (used by the React component for lowercase vertical offset)
export const DESCENDERS = new Set(['g', 'j', 'p', 'q', 'y']);
export const ASCENDERS  = new Set(['b', 'd', 'f', 'h', 'k', 'l', 't']);

// Letters where the tallest non-dot stroke should be drawn first, regardless of
// the digit order authored into the SVG. See Phase 8 above.
const VERTICAL_FIRST_LETTERS = ['T_U', 'I_U', 'K_U', 'k_L', 'R_U', 'P_U', 'p_L'];

// ─── Individual SVG imports from tracing-letter folder ──────────────────
const tracingRawModules = import.meta.glob(
  '../../../assets/materials/tracing-letter/*.svg',
  { query: '?raw', eager: true }
);
export const tracingSvgText = {}; // key: "A_U" or "a_L" → raw SVG text
for (const [path, mod] of Object.entries(tracingRawModules)) {
  const m = path.match(/\/([A-Za-z])-(?:uppercase|lowercase)\.svg$/);
  if (m) {
    const letter = m[1];
    const isUpper = path.includes('-uppercase');
    const key = `${letter}${isUpper ? '_U' : '_L'}`;
    tracingSvgText[key] = mod.default;
  }
}

export function tracingSvgKey(char, isUppercase) {
  return isUppercase ? `${char.toUpperCase()}_U` : `${char.toLowerCase()}_L`;
}

// ─── Caches ───────────────────────────────────────────────────────────────
const pathCache = {};

// ─── Math helpers ─────────────────────────────────────────────────────────
export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function polyLen(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i], pts[i - 1]);
  return len;
}

export function interpolatePoints(pts, step) {
  if (pts.length < 2) return pts;
  const result = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    const n = Math.max(1, Math.floor(d / step));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      result.push({
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      });
    }
  }
  return result;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────
// Get bbox of a path d string using a temp SVG
function getPathBBox(d, tempSvg) {
  const clone = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  clone.setAttribute('d', d);
  tempSvg.appendChild(clone);
  try {
    const bbox = clone.getBBox();
    return { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height,
      cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2,
      area: bbox.width * bbox.height };
  } finally { tempSvg.removeChild(clone); }
}

// Get fill color from a path element (handles both fill="..." and style="fill:...")
function getPathFill(el) {
  const fillAttr = el.getAttribute('fill');
  if (fillAttr && fillAttr !== 'none') return fillAttr.toUpperCase();
  const style = el.getAttribute('style') || '';
  const m = style.match(/fill:\s*([^;]+)/);
  return m ? m[1].trim().toUpperCase() : null;
}

// ─── Extract tracing paths from individual letter SVG ─────────────────────
// See the header comment for the full 8-phase algorithm + invariants.
export async function extractTracingPaths(char, isUppercase, canvasW, canvasH) {
  const svgKey = tracingSvgKey(char, isUppercase);
  const cacheKey = `${svgKey}_${canvasW}_${canvasH}`;
  if (pathCache[cacheKey]) return pathCache[cacheKey];

  const rawText = tracingSvgText[svgKey];
  if (!rawText) return { strokes: [], clipPath: null, viewBox: null, outlinePaths: [], rawSvgText: null };

  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(rawText, 'image/svg+xml');

  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tempSvg.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
  tempSvg.style.cssText = `position:absolute;left:-9999px;width:${SVG_SIZE}px;height:${SVG_SIZE}px;visibility:hidden`;
  document.body.appendChild(tempSvg);

  try {
    const allPaths = [...svgDoc.querySelectorAll('path')];

    // ── Phase 1: Extract letter outlines (#FFFFFF → clip mask) ──
    const outlineDs = [];
    const outlineBBoxes = [];

    for (const el of allPaths) {
      const fill = getPathFill(el);
      if (fill !== '#FFFFFF') continue;
      const d = el.getAttribute('d');
      if (!d) continue;
      const bb = getPathBBox(d, tempSvg);
      if (bb.w > 1500 || bb.h > 1500) continue; // background rect
      if (bb.w < 20 && bb.h < 20) continue; // too tiny
      outlineDs.push(d);
      outlineBBoxes.push(bb);
    }

    // ── Phase 2: Collect per-element dash groups AND arrow endpoints (#59595C) ──
    // CRITICAL: Each <path fill="#59595C"> with multiple z-closepaths contains ALL dashes
    // for exactly ONE stroke. We keep them as SEPARATE groups (never pool globally).
    // This prevents cross-stroke confusion at intersections (T, P, K, etc.).
    const dashGroups = []; // Array of { centers: [{x,y}], elementIdx: number }
    const arrows = [];

    for (const el of allPaths) {
      const fill = getPathFill(el);
      if (fill !== '#59595C') continue;
      const d = el.getAttribute('d');
      if (!d) continue;

      const closeCount = (d.match(/[zZ]/g) || []).length;
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', d);
      tempSvg.appendChild(tempPath);

      try {
        const bb = tempPath.getBBox();
        const area = bb.width * bb.height;

        if (closeCount <= 1 && area < 500) {
          // Single closed shape — arrow triangle
          if (area >= ARROW_AREA) {
            arrows.push({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
          }
          continue;
        }

        // Dash group — sample points along the path using getPointAtLength
        const totalLen = tempPath.getTotalLength();
        const sampleStep = 1.5;
        const samples = [];
        for (let len = 0; len <= totalLen; len += sampleStep) {
          const pt = tempPath.getPointAtLength(len);
          samples.push({ x: pt.x, y: pt.y });
        }

        // Cluster into connected segments — split on jumps > 10px (gaps between dashes)
        const segments = [];
        let currentSeg = samples.length > 0 ? [samples[0]] : [];
        for (let i = 1; i < samples.length; i++) {
          const gap = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
          if (gap > 10) {
            if (currentSeg.length > 0) segments.push(currentSeg);
            currentSeg = [];
          }
          currentSeg.push(samples[i]);
        }
        if (currentSeg.length > 0) segments.push(currentSeg);

        // Each segment center = one dash position — stored as a GROUP for this element
        const centers = [];
        for (const seg of segments) {
          let sx = 0, sy = 0;
          for (const p of seg) { sx += p.x; sy += p.y; }
          centers.push({ x: sx / seg.length, y: sy / seg.length });
        }
        if (centers.length > 0) {
          dashGroups.push({ centers, elementIdx: dashGroups.length });
        }
      } finally {
        tempSvg.removeChild(tempPath);
      }
    }

    // ── Phase 3: Collect stroke start points (#FCFDFF number text) ──
    // The FCFDFF paths are number digit outlines (1, 2, 3...).
    // Cluster nearby sub-paths into single digits, preserve SVG document order.
    const rawFcPaths = [];

    for (const el of allPaths) {
      const fill = getPathFill(el);
      if (fill !== '#FCFDFF') continue;
      const d = el.getAttribute('d');
      if (!d) continue;
      const bb = getPathBBox(d, tempSvg);
      if (bb.w > 100 || bb.h > 100) continue;
      if (bb.area < 2) continue;
      rawFcPaths.push({ x: bb.cx, y: bb.cy, bb });
    }

    // Cluster nearby FCFDFF sub-paths into composite digits (e.g. "4" has 2 sub-paths)
    // Preserve document order (first-encountered cluster comes first = digit 1, then 2, etc.)
    const CLUSTER_DIST = 30;
    const digitClusters = [];
    const fcUsed = new Set();
    for (let i = 0; i < rawFcPaths.length; i++) {
      if (fcUsed.has(i)) continue;
      fcUsed.add(i);
      const cluster = [rawFcPaths[i]];
      for (let j = i + 1; j < rawFcPaths.length; j++) {
        if (fcUsed.has(j)) continue;
        if (cluster.some(c => dist(c, rawFcPaths[j]) < CLUSTER_DIST)) {
          fcUsed.add(j);
          cluster.push(rawFcPaths[j]);
        }
      }
      let cx = 0, cy = 0;
      for (const c of cluster) { cx += c.x; cy += c.y; }
      cx /= cluster.length; cy /= cluster.length;
      digitClusters.push({ x: cx, y: cy, bb: cluster[0].bb });
    }

    // Use document order — the SVG author placed digits 1,2,3,4 in order.
    // This is the most reliable ordering for letters like W where strokes
    // alternate between top/bottom positions (reading-order sort fails).
    const strokeStarts = digitClusters;

    // ── Phase 4: Assign dash groups to stroke starts, then chain within each group ──
    // Each dashGroup belongs to exactly ONE stroke. Match by nearest distance.
    const CHAIN_MAX_GAP = 50;
    const ANGLE_LIMIT = Math.PI * 0.45;
    const orderedStrokes = [];

    // Pre-assign each stroke start to its nearest arrow (1:1 mapping)
    const usedArrows = new Set();
    const startArrowMap = new Map();
    for (let si = 0; si < strokeStarts.length; si++) {
      let bestAi = -1, bestD = Infinity;
      for (let ai = 0; ai < arrows.length; ai++) {
        if (usedArrows.has(ai)) continue;
        const d = dist(strokeStarts[si], arrows[ai]);
        if (d < bestD) { bestD = d; bestAi = ai; }
      }
      if (bestAi !== -1) {
        startArrowMap.set(si, bestAi);
        usedArrows.add(bestAi);
      }
    }

    // Assign each dash group to its nearest stroke start (1:1 mapping)
    const usedGroups = new Set();
    const startGroupMap = new Map(); // strokeIdx → dashGroup

    for (let si = 0; si < strokeStarts.length; si++) {
      const start = strokeStarts[si];
      let bestGi = -1, bestMinDist = Infinity;
      for (let gi = 0; gi < dashGroups.length; gi++) {
        if (usedGroups.has(gi)) continue;
        // Find the minimum distance from any center in this group to the stroke start
        let minD = Infinity;
        for (const c of dashGroups[gi].centers) {
          const d = dist(start, c);
          if (d < minD) minD = d;
        }
        if (minD < bestMinDist) { bestMinDist = minD; bestGi = gi; }
      }
      if (bestGi !== -1) {
        startGroupMap.set(si, dashGroups[bestGi]);
        usedGroups.add(bestGi);
      }
    }

    for (let si = 0; si < strokeStarts.length; si++) {
      const start = strokeStarts[si];
      const group = startGroupMap.get(si);
      const myArrowIdx = startArrowMap.get(si);
      const myArrow = myArrowIdx !== undefined ? arrows[myArrowIdx] : null;

      if (!group || group.centers.length === 0) {
        // No dashes found = dot stroke (e.g. dot on 'i', 'j')
        let dotCenter = { x: start.x, y: start.y };
        let bestDist = Infinity;
        for (const bb of outlineBBoxes) {
          if (bb.area > 25000) continue;
          const d = dist(start, { x: bb.cx, y: bb.cy });
          if (d < bestDist && d < 200) {
            bestDist = d;
            dotCenter = { x: bb.cx, y: bb.cy };
          }
        }
        orderedStrokes.push({ pts: [dotCenter], arrowPt: null, startSvg: { x: start.x, y: start.y } });
        continue;
      }

      // Chain-growth ONLY within this group's centers
      const groupCenters = [...group.centers];
      const claimed = new Set();
      const ordered = [];
      let current = { x: start.x, y: start.y };

      const ARROW_STOP_DIST = 35;
      let reachedArrow = false;

      while (!reachedArrow) {
        let bestIdx = -1, bestD = Infinity;
        const skipThisRound = new Set();

        for (let attempt = 0; attempt < 4; attempt++) {
          bestIdx = -1; bestD = Infinity;
          for (let j = 0; j < groupCenters.length; j++) {
            if (claimed.has(j) || skipThisRound.has(j)) continue;
            const d = dist(current, groupCenters[j]);
            if (d < bestD) { bestD = d; bestIdx = j; }
          }
          // First connection allows larger gap (number text → first dash)
          const maxGap = ordered.length === 0 ? 120 : CHAIN_MAX_GAP;
          if (bestIdx === -1 || bestD > maxGap) { bestIdx = -1; break; }

          if (ordered.length >= 3) {
            const lookback = Math.min(5, ordered.length - 1);
            const anchor = ordered[ordered.length - 1 - lookback];
            const curr = ordered[ordered.length - 1];
            const next = groupCenters[bestIdx];
            const dirAngle = Math.atan2(curr.y - anchor.y, curr.x - anchor.x);
            const newAngle = Math.atan2(next.y - curr.y, next.x - curr.x);
            let angleDiff = Math.abs(newAngle - dirAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            if (angleDiff > ANGLE_LIMIT) {
              skipThisRound.add(bestIdx);
              continue;
            }
          }
          break;
        }

        if (bestIdx === -1) break;
        claimed.add(bestIdx);
        ordered.push(groupCenters[bestIdx]);
        current = groupCenters[bestIdx];

        if (myArrow && ordered.length > 6 && dist(current, myArrow) < ARROW_STOP_DIST) {
          reachedArrow = true;
        }
      }

      if (ordered.length > 0) {
        const lastDash = ordered[ordered.length - 1];
        // Save the actual first dash center before any extensions
        const firstDashCenter = { x: ordered[0].x, y: ordered[0].y };

        // Prepend: extend backwards from first dash
        if (ordered.length >= 2) {
          const dx = ordered[0].x - ordered[1].x;
          const dy = ordered[0].y - ordered[1].y;
          const extLen = Math.hypot(dx, dy);
          if (extLen > 1) {
            ordered.unshift({
              x: ordered[0].x + (dx / extLen) * 15,
              y: ordered[0].y + (dy / extLen) * 15,
            });
          }
        }

        // Append: extend to arrow position
        if (myArrow) {
          if (dist(lastDash, myArrow) < 80) {
            ordered.push({ x: myArrow.x, y: myArrow.y });
          }
        } else if (ordered.length >= 2) {
          const n = ordered.length;
          const dx = ordered[n - 1].x - ordered[n - 2].x;
          const dy = ordered[n - 1].y - ordered[n - 2].y;
          const extLen = Math.hypot(dx, dy);
          if (extLen > 1) {
            ordered.push({
              x: ordered[n - 1].x + (dx / extLen) * 15,
              y: ordered[n - 1].y + (dy / extLen) * 15,
            });
          }
        }

        const smooth = interpolatePoints(ordered, INTERP_STEP);
        orderedStrokes.push({ pts: smooth, arrowPt: myArrow ? { ...myArrow } : null, startSvg: { x: start.x, y: start.y }, firstDash: firstDashCenter });
      } else {
        // Fallback: dot stroke
        orderedStrokes.push({ pts: [{ x: start.x, y: start.y }], arrowPt: null, startSvg: { x: start.x, y: start.y }, firstDash: { x: start.x, y: start.y } });
      }
    }

    // ── Phase 5: Compute viewBox from outlines ──
    // Fallback: if no #FFFFFF outlines found (e.g. c-lowercase), use clipPath group paths
    if (outlineBBoxes.length === 0) {
      // Look for large paths inside clipPath groups as outline fallback
      const clipGroups = svgDoc.querySelectorAll('clipPath');
      for (const cg of clipGroups) {
        const useEl = cg.querySelector('use');
        if (!useEl) continue;
        const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '';
        const refId = href.replace('#', '');
        const refEl = svgDoc.getElementById(refId);
        if (!refEl) continue;
        const d = refEl.getAttribute('d');
        const w = parseFloat(refEl.getAttribute('width') || '0');
        const h = parseFloat(refEl.getAttribute('height') || '0');
        const x = parseFloat(refEl.getAttribute('x') || '0');
        const y = parseFloat(refEl.getAttribute('y') || '0');
        if (w > 50 && h > 50 && w < 1500 && h < 1500) {
          outlineBBoxes.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, area: w * h });
        }
      }
      // Also look for the outlined path in the clipped group (the shape with stroke border)
      for (const el of allPaths) {
        const fill = getPathFill(el);
        const d = el.getAttribute('d');
        if (!d || fill === '#59595C' || fill === '#FCFDFF') continue;
        const bb = getPathBBox(d, tempSvg);
        if (bb.w > 1500 || bb.h > 1500) continue;
        if (bb.area > 5000 && bb.w > 50 && bb.h > 50) {
          outlineDs.push(d);
          outlineBBoxes.push(bb);
        }
      }
    }

    let vx, vy, vw, vh;
    if (outlineBBoxes.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const bb of outlineBBoxes) {
        minX = Math.min(minX, bb.x);
        minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w);
        maxY = Math.max(maxY, bb.y + bb.h);
      }
      const pad = 80;
      vx = minX - pad; vy = minY - pad;
      vw = (maxX - minX) + pad * 2;
      vh = (maxY - minY) + pad * 2;
    } else {
      // Last resort: use dash group bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const g of dashGroups) {
        for (const c of g.centers) {
          minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
        }
      }
      if (minX < Infinity) {
        const pad = 120;
        vx = minX - pad; vy = minY - pad;
        vw = (maxX - minX) + pad * 2;
        vh = (maxY - minY) + pad * 2;
      } else {
        vx = 500; vy = 300; vw = 1000; vh = 1000;
      }
    }

    // ── Phase 6: Scale to canvas ──
    const scale = Math.min(canvasW / vw, canvasH / vh);
    const offX = (canvasW - vw * scale) / 2;
    const offY = (canvasH - vh * scale) / 2;

    let strokes = orderedStrokes
      .map(stroke => {
        const scaled = stroke.pts.map(p => ({
          x: (p.x - vx) * scale + offX,
          y: (p.y - vy) * scale + offY,
        }));
        const len = polyLen(scaled);
        const isDot = stroke.pts.length === 1;
        let arrowScaled = null;
        if (stroke.arrowPt) {
          arrowScaled = {
            x: (stroke.arrowPt.x - vx) * scale + offX,
            y: (stroke.arrowPt.y - vy) * scale + offY,
          };
        }
        // Scale the SVG stroke start position (for glow circle positioning)
        let startScaled = null;
        if (stroke.startSvg) {
          startScaled = {
            x: (stroke.startSvg.x - vx) * scale + offX,
            y: (stroke.startSvg.y - vy) * scale + offY,
          };
        }
        // Scale the firstDash position (actual first dash center for cursor placement)
        let firstDashScaled = null;
        if (stroke.firstDash) {
          firstDashScaled = {
            x: (stroke.firstDash.x - vx) * scale + offX,
            y: (stroke.firstDash.y - vy) * scale + offY,
          };
        }
        return { pts: scaled, len, isDot, arrowPt: arrowScaled, startSvg: startScaled, firstDash: firstDashScaled };
      })
      .filter(s => s.isDot || s.len > 5);

    // ── Phase 7: Smart stroke reorder — compare document order vs connectivity chain ──
    // Document order (digit clusters as they appear in SVG) is correct for MOST letters
    // (A, T, I, etc.) but fails for letters where digit-to-dashgroup matching goes wrong
    // (W, Z, P). Connectivity chaining (endpoint→nearest start) fixes those but breaks
    // letters where strokes don't physically connect (A, T, I).
    //
    // Strategy: compute BOTH orderings, score each by total endpoint→next-start distance,
    // and only use connectivity chaining when it's significantly better (50%+ improvement).
    if (strokes.length > 1) {
      // Score an ordering: sum of distances from stroke[i] endpoint to stroke[i+1] start
      const scoreOrder = (arr) => {
        let total = 0;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i].isDot || arr[i + 1].isDot) continue;
          const end = arr[i].pts[arr[i].pts.length - 1];
          const start = arr[i + 1].pts[0];
          total += Math.hypot(end.x - start.x, end.y - start.y);
        }
        return total;
      };

      const docScore = scoreOrder(strokes);

      // Build connectivity chain ordering
      const chainOrder = [];
      const used = new Set();

      // Root: stroke whose start is most upper-left (y + x*0.3)
      let bestRoot = 0, bestRootScore = Infinity;
      for (let i = 0; i < strokes.length; i++) {
        if (strokes[i].isDot) continue;
        const p = strokes[i].pts[0];
        const s = p.y + p.x * 0.3;
        if (s < bestRootScore) { bestRootScore = s; bestRoot = i; }
      }
      used.add(bestRoot);
      chainOrder.push(bestRoot);

      while (chainOrder.length < strokes.length) {
        const curr = strokes[chainOrder[chainOrder.length - 1]];
        const endPt = curr.pts[curr.pts.length - 1];
        let nearest = -1, nearestDist = Infinity;
        for (let i = 0; i < strokes.length; i++) {
          if (used.has(i)) continue;
          const d = Math.hypot(endPt.x - strokes[i].pts[0].x, endPt.y - strokes[i].pts[0].y);
          if (d < nearestDist) { nearestDist = d; nearest = i; }
        }
        if (nearest === -1) break;
        used.add(nearest);
        chainOrder.push(nearest);
      }
      for (let i = 0; i < strokes.length; i++) {
        if (!used.has(i)) chainOrder.push(i);
      }

      const chainedStrokes = chainOrder.map(i => strokes[i]);
      const chainScore = scoreOrder(chainedStrokes);

      // Only use chaining if it's significantly better (50%+ improvement)
      // This preserves document order for A, T, I (where strokes don't chain nicely)
      // but fixes W, Z, P (where strokes physically connect end→start)
      if (chainScore < docScore * 0.5) {
        strokes = chainedStrokes;
      }
    }

    // ── Phase 8: Manual stroke order overrides ──
    // For letters where the main vertical stroke should come first but SVG
    // digit ordering puts the horizontal bar first (T, I uppercase).
    // Rule: put the longest (tallest) non-dot stroke first.
    if (VERTICAL_FIRST_LETTERS.includes(svgKey) && strokes.length > 1) {
      let tallestIdx = 0;
      let tallestH = 0;
      for (let i = 0; i < strokes.length; i++) {
        if (strokes[i].isDot) continue;
        const pts = strokes[i].pts;
        let minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const h = maxY - minY;
        if (h > tallestH) { tallestH = h; tallestIdx = i; }
      }
      if (tallestIdx !== 0) {
        const main = strokes.splice(tallestIdx, 1)[0];
        strokes.unshift(main);
      }
    }

    // Build clip path
    let clipPath = null;
    if (outlineDs.length > 0) {
      clipPath = new Path2D();
      const matrix = new DOMMatrix([scale, 0, 0, scale, -vx * scale + offX, -vy * scale + offY]);
      for (const d of outlineDs) {
        clipPath.addPath(new Path2D(d), matrix);
      }
    }

    const result = { strokes, clipPath, viewBox: { vx, vy, vw, vh }, outlinePaths: outlineDs, rawSvgText: rawText };
    pathCache[cacheKey] = result;
    return result;

  } finally {
    document.body.removeChild(tempSvg);
  }
}

// ─── Create a filtered SVG data URL (transparent bg, zoomed viewBox) ──────
// Used to display the dotted-guide SVG under the canvas. Rewrites viewBox so
// the visual matches the letter bounds that extractTracingPaths computed,
// making the dotted line sit exactly under the strokes regardless of canvas
// size. Also dims the #FFFFFF letter shell to 50% so the sand trail shows
// through.
export function createFilteredSvgDataUrl(rawSvgText, viewBox) {
  if (!rawSvgText || !viewBox) return null;
  const { vx, vy, vw, vh } = viewBox;

  let modified = rawSvgText;

  // Inject or replace viewBox to zoom into the letter
  if (/viewBox="[^"]*"/.test(modified)) {
    modified = modified.replace(/viewBox="[^"]*"/, `viewBox="${vx} ${vy} ${vw} ${vh}"`);
  } else {
    // No viewBox attribute — inject it and replace width/height to match
    modified = modified.replace(
      /<svg\s/,
      `<svg viewBox="${vx} ${vy} ${vw} ${vh}" `
    );
  }

  // Replace fixed width/height with 100% so it scales to container
  modified = modified.replace(/\bwidth="2000"/, 'width="100%"');
  modified = modified.replace(/\bheight="2000"/, 'height="100%"');

  // Remove enable-background
  modified = modified.replace(/style="enable-background:[^"]*"/g, '');
  modified = modified.replace(/enable-background="[^"]*"/g, '');

  // Add overflow hidden
  if (!modified.includes('overflow="hidden"')) {
    modified = modified.replace(
      /xml:space="preserve"/,
      'xml:space="preserve" overflow="hidden"'
    );
  }

  // Remove any white background rects (full-page 2000x2000 backgrounds)
  modified = modified.replace(/<rect\s+style="fill:#FFFFFF;"\s+width="2000"\s+height="2000"\s*\/>/g, '');
  modified = modified.replace(/<rect[^>]*style="fill:#FCFDFF;"[^>]*\/>/g, '');
  modified = modified.replace(/<rect[^>]*fill="#FFFFFF"[^>]*width="2000"[^>]*\/>/g, '');
  modified = modified.replace(/<rect[^>]*fill="#FFFFFF"[^>]*height="2000"[^>]*\/>/g, '');

  // Make letter shell (white fill) 50% transparent — handle both attribute and style forms
  modified = modified.replace(/fill="#FFFFFF"/g, 'fill="rgba(255,255,255,0.5)"');
  modified = modified.replace(/fill:#FFFFFF/gi, 'fill:rgba(255,255,255,0.5)');
  modified = modified.replace(/fill:\s*#FFFFFF/g, 'fill:rgba(255,255,255,0.5)');

  return `data:image/svg+xml,${encodeURIComponent(modified)}`;
}

// ─── Runtime: path projection ─────────────────────────────────────────────
// Find the nearest path index to (tx, ty) within a local window around
// currentIdx. The narrow window is what prevents backward teleporting when
// the pointer drifts near an earlier part of the stroke.
export function projectToPath(pts, tx, ty, currentIdx) {
  if (!pts || pts.length === 0) return { idx: 0, dist: 9999 };
  const lo = Math.max(0, currentIdx - 8);
  const hi = Math.min(pts.length, currentIdx + 20);
  let bestD2 = Infinity, bestIdx = currentIdx;
  for (let i = lo; i < hi; i++) {
    const dx = pts[i].x - tx, dy = pts[i].y - ty;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
  }
  return { idx: bestIdx, dist: Math.sqrt(bestD2) };
}

// ─── Runtime: stroke completion rule ──────────────────────────────────────
// This is the anti-auto-complete rule. It is deliberately strict so that a
// drag near the crossbar of T/P cannot finish the vertical stroke because
// the horizontal arrow happens to be physically nearby. See header comment
// for the full rationale.
export function evaluateStrokeProgress(stroke, newIdx, trailWidth) {
  const pts = stroke.pts;
  if (!pts || pts.length < 2) return true; // dots complete on tap elsewhere
  const endPt = pts[pts.length - 1];
  const currPt = pts[newIdx];
  const pctDone = newIdx / (pts.length - 1);
  const minProgressMet = pctDone >= 0.75;
  const nearArrow = minProgressMet && stroke.arrowPt
    ? dist(currPt, stroke.arrowPt) < trailWidth * 0.4
    : false;
  const nearEnd = minProgressMet && endPt
    ? dist(currPt, endPt) < trailWidth * 0.4
    : false;
  return nearArrow || nearEnd || pctDone >= COMPLETION_THRESHOLD;
}
