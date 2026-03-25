import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio, playLetterSound } from '../../utils/letterSounds';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';
import beachBg from '../../assets/backgrounds/beach-aerial-view.webp';
import stickersSvgRaw from '../../assets/materials/Summer-sticker-collection.svg?raw';
import CrabCompanion from './CrabCompanion';

// ─── Individual SVG imports from tracing-letter folder ──────────────────────
const tracingRawModules = import.meta.glob('../../assets/materials/tracing-letter/*.svg', { query: '?raw', eager: true });
const tracingSvgText = {}; // key: "A_U" or "a_L" → raw SVG text
for (const [path, mod] of Object.entries(tracingRawModules)) {
  const m = path.match(/\/([A-Za-z])-(?:uppercase|lowercase)\.svg$/);
  if (m) {
    const letter = m[1];
    const isUpper = path.includes('-uppercase');
    const key = `${letter}${isUpper ? '_U' : '_L'}`;
    tracingSvgText[key] = mod.default;
  }
}

// ─── Sticker extraction from Summer-sticker-collection.svg ──────────────────
const stickerSvgClean = stickersSvgRaw.replace(/<rect style="fill:#FFFFFF;" width="500" height="500"\/>/, '');
function createStickerUrl(sx, sy, sw, sh) {
  let s = stickerSvgClean.replace(/viewBox="[^"]*"/, `viewBox="${sx} ${sy} ${sw} ${sh}"`);
  s = s.replace(/xml:space="preserve"/, 'xml:space="preserve" overflow="hidden"');
  return `data:image/svg+xml,${encodeURIComponent(s)}`;
}
const STICKERS = {
  shovel:    createStickerUrl(45, 150, 95, 175),
  swimRing:  createStickerUrl(50, 318, 125, 125),
  surfboard: createStickerUrl(258, 155, 100, 170),
  flower:    createStickerUrl(365, 50, 95, 110),
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

const TOTAL_ROUNDS = 5;
const SVG_SIZE = 2000;
const PATH_CORRIDOR = 55;
const GRAB_RADIUS = 90;
const COMPLETION_THRESHOLD = 0.94;
const ARROW_AREA = 100;
const INTERP_STEP = 8;

// Descenders: letters whose lowercase sits lower (tail below baseline)
const DESCENDERS = new Set(['g', 'j', 'p', 'q', 'y']);
// Ascenders: letters whose lowercase is tall (reaches up near uppercase height)
const ASCENDERS = new Set(['b', 'd', 'f', 'h', 'k', 'l', 't']);

// ─── Sand particles ───────────────────────────────────────────────────────
class SandParticles {
  constructor() { this.p = []; }
  emit(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      // Scatter sideways and slightly downward — sand settles, doesn't fly up
      const a = Math.PI * 0.1 + Math.random() * Math.PI * 0.8; // 18°-162° (downward arc)
      const spd = 1.2 + Math.random() * 2.5;
      this.p.push({
        x, y,
        vx: Math.cos(a) * spd * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.abs(Math.sin(a)) * spd * 0.5 + 0.3,
        life: 1, decay: 0.015 + Math.random() * 0.02,
        size: 6 + Math.random() * 10, hue: 35 + Math.random() * 25,
      });
    }
  }
  update() {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
      if (p.life <= 0) this.p.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const p of this.p) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = `hsl(${p.hue}, 85%, ${50 + (1 - p.life) * 25}%)`;
      ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, ${p.life * 0.6})`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─── Caches ───────────────────────────────────────────────────────────────
const pathCache = {};

// ─── Helpers ──────────────────────────────────────────────────────────────
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function polyLen(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i], pts[i - 1]);
  return len;
}

function interpolatePoints(pts, step) {
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

// Get bbox center of a path d string using temp SVG
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
// New SVG structure (per-file, no side splitting):
// - #FFFFFF fill → letter body outlines (clip mask)
// - #59595C fill → dashed guide lines (small sub-paths) + arrow triangles (larger)
// - #FCFDFF fill → numbered text paths = stroke start points + ordering
async function extractTracingPaths(char, isUppercase, canvasW, canvasH) {
  const svgKey = isUppercase ? `${char.toUpperCase()}_U` : `${char.toLowerCase()}_L`;
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
    // Use getTotalLength() to reliably determine which digit: "1" has the shortest
    // perimeter, "2" is longer, "3" is longest. This is far more reliable than bbox width.
    const strokeStarts = [];

    for (const el of allPaths) {
      const fill = getPathFill(el);
      if (fill !== '#FCFDFF') continue;
      const d = el.getAttribute('d');
      if (!d) continue;
      const bb = getPathBBox(d, tempSvg);
      if (bb.w > 100 || bb.h > 100) continue;
      if (bb.area < 2) continue;
      // Measure path perimeter length to determine digit
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', d);
      tempSvg.appendChild(tempPath);
      const pathLen = tempPath.getTotalLength();
      tempSvg.removeChild(tempPath);
      strokeStarts.push({ x: bb.cx, y: bb.cy, bb, pathLen });
    }

    // Sort by pathLen ascending — "1" shortest perimeter, "2" medium, "3" longest
    strokeStarts.sort((a, b) => a.pathLen - b.pathLen);

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
        orderedStrokes.push({ pts: smooth, arrowPt: myArrow ? { ...myArrow } : null, startSvg: { x: start.x, y: start.y } });
      } else {
        // Fallback: dot stroke
        orderedStrokes.push({ pts: [{ x: start.x, y: start.y }], arrowPt: null, startSvg: { x: start.x, y: start.y } });
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

    const strokes = orderedStrokes
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
        return { pts: scaled, len, isDot, arrowPt: arrowScaled, startSvg: startScaled };
      })
      .filter(s => s.isDot || s.len > 5);

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
function createFilteredSvgDataUrl(rawSvgText, viewBox) {
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

  // Make letter shell (white fill) 50% transparent
  modified = modified.replace(/fill="#FFFFFF"/g, 'fill="rgba(255,255,255,0.5)"');
  modified = modified.replace(/fill:\s*#FFFFFF/g, 'fill:rgba(255,255,255,0.5)');

  return `data:image/svg+xml,${encodeURIComponent(modified)}`;
}

// ─── Path projection ──────────────────────────────────────────────────────
function projectToPath(pts, tx, ty, currentIdx) {
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

// ─── Sand trail drawing ──────────────────────────────────────────────────
function drawSandTrail(ctx, points, upToIdx, width) {
  if (upToIdx < 1 || points.length < 2) return;
  const slice = points.slice(0, Math.min(upToIdx + 1, points.length));
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.95)';
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(slice[0].x, slice[0].y);
  for (let i = 1; i < slice.length; i++) {
    if (i < slice.length - 1) {
      const mx = (slice[i].x + slice[i + 1].x) / 2;
      const my = (slice[i].y + slice[i + 1].y) / 2;
      ctx.quadraticCurveTo(slice[i].x, slice[i].y, mx, my);
    } else {
      ctx.lineTo(slice[i].x, slice[i].y);
    }
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = 'rgba(200, 150, 20, 0.3)';
  ctx.lineWidth = width * 0.5;
  ctx.beginPath();
  ctx.moveTo(slice[0].x, slice[0].y);
  for (let i = 1; i < slice.length; i++) {
    if (i < slice.length - 1) {
      const mx = (slice[i].x + slice[i + 1].x) / 2;
      const my = (slice[i].y + slice[i + 1].y) / 2;
      ctx.quadraticCurveTo(slice[i].x, slice[i].y, mx, my);
    } else {
      ctx.lineTo(slice[i].x, slice[i].y);
    }
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────────────────
const MagicSandTracingGame = ({ group, onBack, onPlayAgain }) => {
  const getSounds = useCallback(() => {
    const sounds = group.sounds || [];
    const result = [];
    for (let i = 0; i < Math.max(TOTAL_ROUNDS, sounds.length); i++)
      result.push(sounds[i % sounds.length]);
    return result.slice(0, TOTAL_ROUNDS);
  }, [group]);

  const [sounds] = useState(() => getSounds());
  const totalRounds = sounds.length;
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameComplete, setGameComplete] = useState(false);
  const currentSound = sounds[roundNumber - 1] || sounds[0];

  const allLetters = useMemo(() =>
    currentSound.length > 1 ? currentSound.split('') : [currentSound],
  [currentSound]);
  const isMultiLetter = allLetters.length > 1;

  // ── Case + letter tracking ──
  const [letterCase, setLetterCase] = useState('upper');
  const [activeLetterIdx, setActiveLetterIdx] = useState(0);
  const [frozenLetters, setFrozenLetters] = useState([]);

  // ── Canvas + tracing state ──
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 500, h: 500 });

  const [currentStrokeIdx, setCurrentStrokeIdx] = useState(0);
  const [completedStrokes, setCompletedStrokes] = useState([]);
  const [instructionLock, setInstructionLock] = useState(true);
  const [strokesData, setStrokesData] = useState([]);
  const [pathsReady, setPathsReady] = useState(false);
  const clipPathRef = useRef(null);
  const [viewBox, setViewBox] = useState(null);
  const [rawSvgText, setRawSvgText] = useState(null);

  const traceIdxRef = useRef(0);
  const isTracingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);
  const animFrameRef = useRef(null);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);
  const [isActivelyTracing, setIsActivelyTracing] = useState(false);
  const [shovelAnimKey, setShovelAnimKey] = useState(0);
  const particlesRef = useRef(new SandParticles());
  const [isIdleForCrab, setIsIdleForCrab] = useState(false);
  const [letterCompletedTrigger, setLetterCompletedTrigger] = useState(0);
  const crabIdleTimerRef = useRef(null);

  const currentChar = (allLetters[activeLetterIdx] || allLetters[0]).toLowerCase();
  const isUppercase = letterCase === 'upper';
  const currentStroke = strokesData[currentStrokeIdx];

  // Responsive trail width — scales with canvas size
  const trailWidth = useMemo(() => {
    const side = Math.max(canvasSize.w, canvasSize.h);
    return Math.max(55, Math.round(side * 0.18));
  }, [canvasSize]);

  // ── Measure canvas — same size for both cases, lowercase shrink via CSS ──
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height) * 0.92;
      setCanvasSize({
        w: Math.round(Math.max(side, 100)),
        h: Math.round(Math.max(side, 100)),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── Extract paths from SVG ──
  useEffect(() => {
    let cancelled = false;
    setPathsReady(false);
    setShowCursor(false);
    setViewBox(null);
    setRawSvgText(null);

    extractTracingPaths(currentChar, isUppercase, canvasSize.w, canvasSize.h).then(result => {
      if (cancelled) return;
      setStrokesData(result.strokes);
      clipPathRef.current = result.clipPath;
      setViewBox(result.viewBox);
      setRawSvgText(result.rawSvgText);
      setPathsReady(true);

      if (result.strokes.length > 0 && result.strokes[0].pts.length > 0) {
        const start = result.strokes[0].pts[0];
        cursorPosRef.current = { x: start.x, y: start.y };
        setCursorPos({ x: start.x, y: start.y });
        setTimeout(() => { if (!cancelled) setShowCursor(true); }, 500);
      }
    });
    return () => { cancelled = true; };
  }, [currentChar, isUppercase, canvasSize.w, canvasSize.h]);

  // ── Position cursor at first path point (where user starts tracing) ──
  useEffect(() => {
    if (!pathsReady || !strokesData[currentStrokeIdx]) return;
    const stroke = strokesData[currentStrokeIdx];
    const start = stroke.pts[0];
    if (start) {
      cursorPosRef.current = { x: start.x, y: start.y };
      setCursorPos({ x: start.x, y: start.y });
    }
    traceIdxRef.current = 0;
    setShowCursor(true);
    setShovelAnimKey(k => k + 1);
  }, [pathsReady, strokesData, currentStrokeIdx, activeLetterIdx, letterCase, roundNumber]);

  // ── Draw a dot (filled circle) for dot strokes ──
  const drawSandDot = useCallback((ctx, x, y) => {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.95)';
    ctx.shadowColor = 'rgba(255, 180, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, trailWidth * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 150, 20, 0.3)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, trailWidth * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [trailWidth]);

  // ── Redraw canvas ──
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
    ctx.save();
    if (clipPathRef.current) ctx.clip(clipPathRef.current, 'evenodd');
    for (let sIdx = 0; sIdx < strokesData.length; sIdx++) {
      const stroke = strokesData[sIdx];
      if (!stroke) continue;
      if (completedStrokes.includes(sIdx)) {
        if (stroke.isDot) {
          drawSandDot(ctx, stroke.pts[0].x, stroke.pts[0].y);
        } else {
          drawSandTrail(ctx, stroke.pts, stroke.pts.length - 1, trailWidth);
        }
      } else if (sIdx === currentStrokeIdx && !stroke.isDot) {
        drawSandTrail(ctx, stroke.pts, traceIdxRef.current, trailWidth);
      }
    }
    ctx.restore();
  }, [canvasSize, strokesData, currentStrokeIdx, completedStrokes, drawSandDot, trailWidth]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  // ── Particle loop — canvas is now outside AnimatePresence so it persists ──
  useEffect(() => {
    const pCanvas = particleCanvasRef.current;
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');
    let running = true;
    const loop = () => {
      if (!running) return;
      pCtx.clearRect(0, 0, canvasSize.w, canvasSize.h);
      particlesRef.current.update();
      particlesRef.current.draw(pCtx);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [canvasSize]);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    clearTimeout(crabIdleTimerRef.current);
    setIsIdleForCrab(false);
    crabIdleTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setIsIdleForCrab(true);
    }, 8000);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Trace the letter!');
    }, 8000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const run = async () => {
      await playVO('Trace the letter!');
      if (cancelled) return;
      startIdleReminder();
      if (!cancelled) setInstructionLock(false);
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio(); stopVO();
      clearTimeout(idleRef.current);
      clearTimeout(crabIdleTimerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [startIdleReminder]);

  // ── Stroke complete ──
  const handleStrokeComplete = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    clearTimeout(idleRef.current);
    setCompletedStrokes(prev => [...prev, currentStrokeIdx]);
    triggerSmallBurst();

    const nextStroke = currentStrokeIdx + 1;

    if (nextStroke < strokesData.length) {
      await delay(300);
      if (!mountedRef.current) return;
      setCurrentStrokeIdx(nextStroke);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
      return;
    }

    // All strokes done for this letter+case
    setLetterCompletedTrigger(t => t + 1);
    setShowCursor(false);
    try { await playLetterSound(currentChar); } catch (e) {}
    if (!mountedRef.current) return;

    // Multi-letter: more letters to trace in same case?
    if (isMultiLetter && activeLetterIdx < allLetters.length - 1) {
      const trailImage = canvasRef.current?.toDataURL('image/png') || '';
      setFrozenLetters(prev => [...prev, {
        filteredUrl: createFilteredSvgDataUrl(rawSvgText, viewBox),
        trailImage,
      }]);
      await delay(400);
      if (!mountedRef.current) return;
      setActiveLetterIdx(prev => prev + 1);
      setCurrentStrokeIdx(0);
      setCompletedStrokes([]);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
      return;
    }

    // All letters for this case done
    await playEncouragement();
    if (!mountedRef.current) return;

    if (letterCase === 'upper') {
      // Switch to lowercase — clear frozen uppercase to give space for lowercase
      await delay(600);
      if (!mountedRef.current) return;
      setLetterCase('lower');
      setActiveLetterIdx(0);
      setFrozenLetters([]);
      setCurrentStrokeIdx(0);
      setCompletedStrokes([]);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
      return;
    }

    // Both cases done → next round or game over
    if (roundNumber < totalRounds) {
      await delay(800);
      if (!mountedRef.current) return;
      setRoundNumber(r => r + 1);
      setLetterCase('upper');
      setActiveLetterIdx(0);
      setFrozenLetters([]);
      setCurrentStrokeIdx(0);
      setCompletedStrokes([]);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
    } else {
      triggerCelebration();
      await playVO('great_job');
      if (!mountedRef.current) return;
      setGameComplete(true);
    }
  }, [currentStrokeIdx, strokesData, currentChar, letterCase, viewBox, rawSvgText, isUppercase,
    isMultiLetter, activeLetterIdx, allLetters, roundNumber, totalRounds, startIdleReminder, frozenLetters]);

  // ── Pointer handlers ──
  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasSize.w / rect.width),
      y: (e.clientY - rect.top) * (canvasSize.h / rect.height),
    };
  }, [canvasSize]);

  const handlePointerDown = useCallback((e) => {
    if (instructionLock || isProcessingRef.current || !currentStroke || !pathsReady) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    clearTimeout(idleRef.current);
    clearTimeout(crabIdleTimerRef.current);
    setIsIdleForCrab(false);

    const startPt = currentStroke.pts[0];
    const distCursor = dist(pos, cursorPosRef.current);
    const distStart = startPt ? dist(pos, startPt) : Infinity;

    if (distCursor <= GRAB_RADIUS || distStart <= GRAB_RADIUS) {
      if (currentStroke.isDot) {
        particlesRef.current.emit(startPt.x, startPt.y, 12);
        redrawCanvas();
        handleStrokeComplete();
        return;
      }
      if (startPt && traceIdxRef.current === 0) {
        cursorPosRef.current = { x: startPt.x, y: startPt.y };
        setCursorPos({ x: startPt.x, y: startPt.y });
      }
      isTracingRef.current = true;
      setIsActivelyTracing(true);
    }
  }, [instructionLock, currentStroke, pathsReady, getCanvasPos, handleStrokeComplete, redrawCanvas]);

  const handlePointerMove = useCallback((e) => {
    if (!isTracingRef.current || !currentStroke || isProcessingRef.current) return;
    const pos = getCanvasPos(e);
    if (!pos) return;

    const proj = projectToPath(currentStroke.pts, pos.x, pos.y, traceIdxRef.current);
    if (proj.dist > PATH_CORRIDOR) {
      isTracingRef.current = false;
      setIsActivelyTracing(false);
      return;
    }

    if (proj.idx >= traceIdxRef.current - 2) {
      const newIdx = Math.max(traceIdxRef.current, proj.idx);
      traceIdxRef.current = newIdx;

      const pathPt = currentStroke.pts[newIdx];
      if (pathPt) {
        cursorPosRef.current = {
          x: cursorPosRef.current.x + (pathPt.x - cursorPosRef.current.x) * 0.75,
          y: cursorPosRef.current.y + (pathPt.y - cursorPosRef.current.y) * 0.75,
        };
        setCursorPos({ ...cursorPosRef.current });
        particlesRef.current.emit(cursorPosRef.current.x, cursorPosRef.current.y, 8);
      }

      redrawCanvas();

      // Completion check: must reach arrow endpoint OR last 6% of path
      // CRITICAL: require minimum 50% traced before proximity checks (prevents "o" auto-complete
      // where arrow is physically near the start of a circular stroke)
      const endPt = currentStroke.pts[currentStroke.pts.length - 1];
      const pctDone = newIdx / (currentStroke.pts.length - 1);
      const minProgressMet = pctDone >= 0.65;
      const nearArrow = minProgressMet && currentStroke.arrowPt
        ? dist(currentStroke.pts[newIdx], currentStroke.arrowPt) < trailWidth * 0.5
        : false;
      const nearEnd = minProgressMet && endPt
        ? dist(currentStroke.pts[newIdx], endPt) < trailWidth * 0.5
        : false;
      const isComplete = nearArrow || nearEnd || pctDone >= COMPLETION_THRESHOLD;

      if (isComplete) {
        traceIdxRef.current = currentStroke.pts.length - 1;
        if (endPt) {
          cursorPosRef.current = { x: endPt.x, y: endPt.y };
          setCursorPos({ x: endPt.x, y: endPt.y });
        }
        redrawCanvas();
        isTracingRef.current = false;
        setIsActivelyTracing(false);
        handleStrokeComplete();
      }
    }
  }, [currentStroke, getCanvasPos, redrawCanvas, handleStrokeComplete]);

  const handlePointerUp = useCallback(() => {
    if (isTracingRef.current) {
      isTracingRef.current = false;
      setIsActivelyTracing(false);
    }
    startIdleReminder();
  }, [startIdleReminder]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio(); stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  // Confetti rain on results
  useEffect(() => {
    if (!gameComplete) return;
    let running = true;
    const rain = () => {
      if (!running) return;
      confetti({ particleCount: 3, angle: 270, spread: 120,
        origin: { x: Math.random(), y: -0.1 }, gravity: 0.6, scalar: 0.8, ticks: 200,
        colors: ['#FFD000', '#FF6B9D', '#4ECDC4', '#8B5CF6', '#22C55E'] });
      requestAnimationFrame(rain);
    };
    rain();
    return () => { running = false; };
  }, [gameComplete]);

  // Filtered SVG data URL — transparent bg, zoomed viewBox
  const filteredSvgUrl = useMemo(() => {
    return createFilteredSvgDataUrl(rawSvgText, viewBox);
  }, [rawSvgText, viewBox]);

  // ── Results screen ──
  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#6B3FA0]">
        <CrabCompanion
          isActivelyTracing={false}
          isGameComplete={true}
          letterCompletedTrigger={letterCompletedTrigger}
          isIdle={false}
        />
        <motion.button onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000]"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}>
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] border-t-4 border-[#FFD000] p-8 md:p-12 text-center max-w-md mx-4"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}>
          <motion.span className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}>
            ✏️⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#4ECDC4] mb-2">Tracing Star!</h2>
          <p className="text-white/60 text-sm md:text-base mb-6">You traced all the letters!</p>
          <div className="flex flex-col gap-3">
            <motion.button onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16a34a', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95, y: 4 }}>Play Again</motion.button>
            <motion.button onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white font-bold text-sm md:text-base"
              style={{ borderRadius: '1.6rem', borderBottom: '4px solid rgba(0,0,0,0.05)' }}
              whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95, y: 4 }}>Back to Playground</motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Cursor screen position ──
  const canvasEl = canvasRef.current;
  let cursorScreenX = 0, cursorScreenY = 0;
  if (canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    cursorScreenX = rect.left + (cursorPos.x / canvasSize.w) * rect.width;
    cursorScreenY = rect.top + (cursorPos.y / canvasSize.h) * rect.height;
  }

  const pencilCenterX = cursorScreenX;
  const pencilCenterY = cursorScreenY;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none"
      onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}>

      <img src={beachBg} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 0 }} />
      <div className="absolute inset-0 bg-black/10 pointer-events-none" style={{ zIndex: 0 }} />

      {/* Nav */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button onClick={handleBack}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000]"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}>
          <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.button onClick={toggleFullscreen}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000]"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}>
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* Progress + Speaker */}
      <div className="fixed top-3 right-3 z-[70] flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalRounds }).map((_, idx) => (
            <div key={idx} className={`rounded-full transition-all ${
              idx < roundNumber - 1 ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === roundNumber - 1 ? 'bg-[#FFD000] w-3 h-3 ring-2 ring-[#FFD000]/40'
                : 'bg-white/40 w-2.5 h-2.5'
            }`} />
          ))}
        </div>

        <motion.button
          onClick={async () => {
            if (isProcessingRef.current) return;
            clearTimeout(idleRef.current);
            try { await playLetterSound(currentSound); } catch (e) {}
            if (mountedRef.current) startIdleReminder();
          }}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#6B3FA0]"
          style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
          whileTap={{ scale: 0.95, y: 3 }} whileHover={{ scale: 1.1 }}>
          <Volume2 className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white" />
        </motion.button>
      </div>

      {/* Crab companion */}
      <CrabCompanion
        isActivelyTracing={isActivelyTracing}
        isGameComplete={gameComplete}
        letterCompletedTrigger={letterCompletedTrigger}
        isIdle={isIdleForCrab}
      />

      {/* Decorative beach stickers */}
      <img src={STICKERS.swimRing} alt="" className="fixed pointer-events-none z-[5] opacity-85"
        style={{ left: '0.5%', top: '28%', width: 'clamp(80px, 13vw, 150px)', transform: 'rotate(-10deg)' }} />
      <img src={STICKERS.flower} alt="" className="fixed pointer-events-none z-[5] opacity-85"
        style={{ right: '0.5%', top: '30%', width: 'clamp(80px, 13vw, 140px)', transform: 'rotate(-5deg)' }} />

      {/* Tracing area */}
      <div className="flex-1 flex items-center justify-center p-2 relative z-10">
        <div className="flex flex-col items-center justify-center w-full h-full max-h-[95vh]">
          <div ref={containerRef} className="relative flex items-center justify-center"
            style={{ width: '100%', height: '100%', maxWidth: 'min(95vw, 1200px)', maxHeight: 'min(92vmin, 850px)' }}>

            {/* Frozen completed letters — slide to left edge, vertically centered */}
            {frozenLetters.map((frozen, idx) => {
              const frozenW = canvasSize.w * 0.32;
              const frozenH = canvasSize.h * 0.32;
              return (
                <motion.div key={`frozen-${letterCase}-${idx}`}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0.7 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute pointer-events-none"
                  style={{
                    width: frozenW, height: frozenH,
                    left: `${2 + idx * (frozenW + 2)}px`,
                    top: `calc(50% - ${frozenH / 2}px)`,
                    zIndex: 3,
                  }}>
                  {frozen.filteredUrl && (
                    <img src={frozen.filteredUrl}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ objectFit: 'contain' }} alt="" />
                  )}
                  {frozen.trailImage && (
                    <img src={frozen.trailImage} className="absolute inset-0 w-full h-full object-contain" alt="" />
                  )}
                </motion.div>
              );
            })}

            {/* Active letter canvas — centered, lowercase positioned for real writing */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`canvas-${roundNumber}-${activeLetterIdx}-${letterCase}`}
                initial={{ x: 80, opacity: 0, scale: 0.8 }}
                animate={{
                  x: 0, opacity: 1,
                  scale: isUppercase ? 1 : 0.85,
                  // Lowercase baseline positioning:
                  // Descenders (g,j,p,q,y) sit lower — their tails go below the line
                  // Ascenders (b,d,f,h,k,l,t) sit at same height as uppercase
                  // Short letters (a,c,e,m,n,o,r,s,u,v,w,x,z) sit a bit lower (mid-height)
                  y: isUppercase ? 0
                    : DESCENDERS.has(currentChar) ? canvasSize.h * 0.08
                    : ASCENDERS.has(currentChar) ? 0
                    : canvasSize.h * 0.04,
                }}
                exit={{ x: -80, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="relative flex-shrink-0"
                style={{
                  width: canvasSize.w, height: canvasSize.h,
                  touchAction: 'none',
                }}>

                {/* SVG visual — transparent bg, zoomed to letter */}
                {filteredSvgUrl && (
                  <img src={filteredSvgUrl}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ objectFit: 'contain', zIndex: 0 }}
                    alt="" />
                )}

                {/* Sand trail canvas */}
                <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
                  className="absolute inset-0 w-full h-full"
                  style={{ touchAction: 'none', zIndex: 1 }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove} />

              </motion.div>
            </AnimatePresence>

            {/* Particle canvas — outside AnimatePresence so it persists across letter changes */}
            <canvas ref={particleCanvasRef} width={canvasSize.w} height={canvasSize.h}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 12 }} />

            {/* Shovel indicator — circle + shovel, positioned at stroke start */}
            {showCursor && canvasEl && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`shovel-${shovelAnimKey}`}
                  className="fixed pointer-events-none z-[60] flex items-center justify-center"
                  style={{
                    left: pencilCenterX - 52, top: pencilCenterY - 52,
                    width: 104, height: 104,
                    transition: isActivelyTracing ? 'none' : 'left 0.15s ease, top 0.15s ease',
                  }}
                  initial={{ scale: 0, opacity: 0, x: -150, y: -100 }}
                  animate={isActivelyTracing
                    ? { scale: 0.75, opacity: 0.6, x: 0, y: 0 }
                    : { scale: [1, 1.08, 1], opacity: 1, x: 0, y: 0 }
                  }
                  transition={isActivelyTracing
                    ? { duration: 0.12 }
                    : {
                        scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.9 },
                        opacity: { duration: 0.4, ease: 'easeOut' },
                        x: { duration: 0.5, ease: 'easeOut' },
                        y: { duration: 0.5, ease: 'easeOut' },
                      }
                  }>
                  {/* Semi-transparent circle background */}
                  <div className="absolute inset-0 rounded-full"
                    style={{
                      background: 'rgba(255, 210, 50, 0.55)',
                      border: '2.5px solid rgba(255, 180, 0, 0.65)',
                      boxShadow: '0 0 16px rgba(255,200,0,0.5)',
                    }} />
                  {/* Shovel — square container with object-fit for true centering, 2.5x size */}
                  <motion.img src={STICKERS.shovel} alt=""
                    className="select-none"
                    style={{
                      width: 76, height: 76,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                    }}
                    initial={{ rotate: 0 }}
                    animate={{ rotate: [0, 360, 720, 1080] }}
                    transition={{ duration: 0.6, ease: [0.2, 0.8, 0.3, 1], times: [0, 0.3, 0.6, 1] }}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Stroke indicator */}
          {strokesData.length > 1 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-white/60 text-xs font-medium drop-shadow">Stroke</span>
              {strokesData.map((_, idx) => (
                <div key={`si-${idx}`} className={`w-2.5 h-2.5 rounded-full transition-all ${
                  completedStrokes.includes(idx) ? 'bg-[#22c55e]'
                    : idx === currentStrokeIdx ? 'bg-[#FFD000] ring-2 ring-[#FFD000]/40'
                    : 'bg-white/30'
                }`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MagicSandTracing = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return <MagicSandTracingGame {...props} key={gameKey} onPlayAgain={() => setGameKey(k => k + 1)} />;
};

export default MagicSandTracing;
