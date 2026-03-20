// src/games/tracing/tracingPaths.js
// Plain JS + CommonJS only.

const skeleton = require("./skeleton.json");

const DEFAULTS = skeleton?.defaults || { dotSpacingN: 0.065, sampleSpacingN: 0.015 };
const GLYPHS = skeleton?.glyphs || {};

const FALLBACK = {
  dotSpacingN: DEFAULTS.dotSpacingN,
  sampleSpacingN: DEFAULTS.sampleSpacingN,
  strokes: [{ points: [[0.5, 0.25], [0.5, 0.8]] }],
};

function normalizeTarget(t) {
  if (t === null || t === undefined) return "";
  if (typeof t === "object") {
    if (typeof t.text === "string") return t.text;
    if (typeof t.word === "string") return t.word;
    return String(t);
  }
  return String(t).trim();
}

function pickKey(raw) {
  const t = normalizeTarget(raw);
  if (!t) return "";
  return t[0] || "";
}

function sanitizeGlyph(g) {
  if (!g || !Array.isArray(g.strokes) || g.strokes.length === 0) return null;

  const strokes = g.strokes
    .map((s) => ({
      points: Array.isArray(s.points)
        ? s.points.filter(
            (p) => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1])
          )
        : [],
    }))
    .filter((s) => s.points.length >= 2);

  if (!strokes.length) return null;

  return {
    strokes,
    dotSpacingN: typeof g.dotSpacingN === "number" ? g.dotSpacingN : DEFAULTS.dotSpacingN,
    sampleSpacingN: typeof g.sampleSpacingN === "number" ? g.sampleSpacingN : DEFAULTS.sampleSpacingN,
  };
}

function getTracingGlyphForTarget(target) {
  const key = pickKey(target);
  if (!key) return FALLBACK;

  const g =
    GLYPHS[key] ||
    GLYPHS[String(key).toLowerCase()] ||
    GLYPHS[String(key).toUpperCase()] ||
    null;

  return sanitizeGlyph(g) || FALLBACK;
}

// Backward compatibility
const getTracingPathForTarget = getTracingGlyphForTarget;

module.exports = { getTracingGlyphForTarget, getTracingPathForTarget };
