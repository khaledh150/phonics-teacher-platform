import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio, playLetterSound } from '../../utils/letterSounds';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';
import skeletonData from '../../data/tracingSkeleton.json';

// ─── Constants ────────────────────────────────────────────────────────────────
const toggleFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

const TOTAL_ROUNDS = 5;
const PATH_CORRIDOR = 55; // px corridor around the path
const ANIMAL_GRAB_RADIUS = 60; // px to grab the animal cursor
const DOT_SPACING_N = skeletonData.defaults?.dotSpacingN || 0.08;
const ANIMAL_EMOJI = '\u270F\uFE0F'; // pencil emoji
const COMPLETION_THRESHOLD = 0.92; // 92% of path traced to auto-complete

// ─── Skeleton / Glyph Helpers ─────────────────────────────────────────────────
const GLYPHS = skeletonData.glyphs || {};

function getGlyphForChar(char) {
  const g = GLYPHS[char] || GLYPHS[char.toLowerCase()] || GLYPHS[char.toUpperCase()];
  if (!g || !Array.isArray(g.strokes)) return null;
  const strokes = g.strokes
    .map((s) => ({
      points: Array.isArray(s.points)
        ? s.points.filter((p) => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]))
        : [],
    }))
    .filter((s) => s.points.length >= 2);
  if (!strokes.length) return null;
  return { strokes };
}

/** Scale normalized [0-1] points to screen coordinates centered in the canvas */
function scalePoints(normalizedPoints, canvasW, canvasH) {
  const drawW = canvasW * 0.82;
  const drawH = canvasH * 0.82;
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  return normalizedPoints.map(([nx, ny]) => ({
    x: cx + (nx - 0.5) * drawW,
    y: cy + (ny - 0.5) * drawH,
  }));
}

/** Resample a polyline to have evenly spaced points */
function resamplePath(points, spacing) {
  if (points.length < 2) return [...points];
  const resampled = [points[0]];
  let remaining = spacing;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 0.001) continue;
    let covered = 0;
    while (covered + remaining <= segLen) {
      covered += remaining;
      const t = covered / segLen;
      resampled.push({
        x: prev.x + dx * t,
        y: prev.y + dy * t,
      });
      remaining = spacing;
    }
    remaining -= (segLen - covered);
  }
  // Always include the last point
  const last = points[points.length - 1];
  const prevLast = resampled[resampled.length - 1];
  if (Math.abs(last.x - prevLast.x) > 0.5 || Math.abs(last.y - prevLast.y) > 0.5) {
    resampled.push(last);
  }
  return resampled;
}

/** Generate checkpoint dot positions along a path */
function generateCheckpointDots(screenPoints, numDots) {
  if (screenPoints.length < 2 || numDots < 2) return [];
  let totalLen = 0;
  const cumLens = [0];
  for (let i = 1; i < screenPoints.length; i++) {
    const dx = screenPoints[i].x - screenPoints[i - 1].x;
    const dy = screenPoints[i].y - screenPoints[i - 1].y;
    totalLen += Math.sqrt(dx * dx + dy * dy);
    cumLens.push(totalLen);
  }
  const dots = [];
  for (let d = 0; d <= numDots; d++) {
    const targetLen = (d / numDots) * totalLen;
    let segIdx = 0;
    for (let i = 1; i < cumLens.length; i++) {
      if (cumLens[i] >= targetLen) { segIdx = i - 1; break; }
      if (i === cumLens.length - 1) segIdx = i - 1;
    }
    const segStart = cumLens[segIdx];
    const segEnd = cumLens[segIdx + 1] || segStart;
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetLen - segStart) / segLen : 0;
    const p1 = screenPoints[segIdx];
    const p2 = screenPoints[Math.min(segIdx + 1, screenPoints.length - 1)];
    dots.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      pct: d / numDots,
    });
  }
  return dots;
}

/** Project a touch point onto the path, returning nearest index and distance */
function projectToPath(screenPoints, tx, ty, currentIdx) {
  if (!screenPoints || screenPoints.length === 0) return { idx: 0, x: tx, y: ty, dist: 9999 };
  const searchStart = Math.max(0, currentIdx - 4);
  const searchEnd = Math.min(screenPoints.length, currentIdx + 30);
  let bestDist = Infinity;
  let bestIdx = currentIdx;
  let bestX = tx;
  let bestY = ty;
  for (let i = searchStart; i < searchEnd; i++) {
    const p = screenPoints[i];
    const dx = p.x - tx;
    const dy = p.y - ty;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      bestIdx = i;
      bestX = p.x;
      bestY = p.y;
    }
  }
  return { idx: bestIdx, x: bestX, y: bestY, dist: Math.sqrt(bestDist) };
}

/** Compute total polyline length */
function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// ─── Processed stroke data for a letter ───────────────────────────────────────
function buildStrokesForChar(char, canvasW, canvasH) {
  const glyph = getGlyphForChar(char);
  if (!glyph) {
    // Fallback: a vertical line
    return [{
      screenPoints: [{ x: canvasW / 2, y: canvasH * 0.2 }, { x: canvasW / 2, y: canvasH * 0.8 }],
      checkpoints: generateCheckpointDots(
        [{ x: canvasW / 2, y: canvasH * 0.2 }, { x: canvasW / 2, y: canvasH * 0.8 }],
        4
      ),
      isDot: false,
    }];
  }
  return glyph.strokes.map((stroke) => {
    const raw = scalePoints(stroke.points, canvasW, canvasH);
    // Resample for smooth tracing
    const totalLen = pathLength(raw);
    const spacing = Math.max(4, Math.min(10, totalLen / 60));
    const screenPoints = resamplePath(raw, spacing);
    const isDot = totalLen < 15;
    const numDots = isDot ? 0 : (totalLen < 120 ? 4 : totalLen < 250 ? 6 : 8);
    const checkpoints = isDot ? [] : generateCheckpointDots(screenPoints, numDots);
    return { screenPoints, checkpoints, isDot };
  });
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

/** Draw a smooth path through points as a thick line on canvas */
function drawPathOnCanvas(ctx, points, color, lineWidth, dash = null) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    // Use quadratic smoothing between midpoints
    if (i < points.length - 1) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    } else {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw the golden sand traced path */
function drawTracedPath(ctx, points, upToIdx) {
  if (upToIdx < 1 || points.length < 2) return;
  const sliceEnd = Math.min(upToIdx + 1, points.length);
  const tracedPoints = points.slice(0, sliceEnd);

  // Glow layer
  ctx.save();
  ctx.shadowColor = 'rgba(255, 180, 0, 0.6)';
  ctx.shadowBlur = 18;
  drawPathOnCanvas(ctx, tracedPoints, 'rgba(255, 200, 50, 0.5)', 38);
  ctx.restore();

  // Main golden stroke
  const grad = ctx.createLinearGradient(
    tracedPoints[0].x, tracedPoints[0].y,
    tracedPoints[tracedPoints.length - 1].x, tracedPoints[tracedPoints.length - 1].y
  );
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(0.3, '#FFA500');
  grad.addColorStop(0.6, '#FFD700');
  grad.addColorStop(1, '#FFEC80');
  drawPathOnCanvas(ctx, tracedPoints, grad, 28);

  // Sparkle dots along the traced path
  ctx.save();
  for (let i = 0; i < sliceEnd; i += Math.max(1, Math.floor(sliceEnd / 20))) {
    const p = tracedPoints[i];
    if (!p) continue;
    const ox = p.x + (Math.random() - 0.5) * 16;
    const oy = p.y + (Math.random() - 0.5) * 16;
    ctx.beginPath();
    ctx.arc(ox, oy, 1.5 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.4})`;
    ctx.fill();
  }
  ctx.restore();
}

/** Draw the guide path (thick semi-transparent white) */
function drawGuidePath(ctx, points) {
  if (points.length < 2) return;
  // Outer glow
  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.15)';
  ctx.shadowBlur = 12;
  drawPathOnCanvas(ctx, points, 'rgba(255, 255, 255, 0.12)', 42);
  ctx.restore();
  // Inner guide
  drawPathOnCanvas(ctx, points, 'rgba(255, 255, 255, 0.28)', 34);
  // Center dotted line
  drawPathOnCanvas(ctx, points, 'rgba(255, 255, 255, 0.08)', 2, [6, 6]);
}

/** Draw checkpoint dots */
function drawCheckpointDots(ctx, checkpoints, traceProgress) {
  for (const dot of checkpoints) {
    if (dot.pct <= traceProgress) continue; // already traced past
    ctx.save();
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
}

/** Draw a completed stroke (fully traced golden path) */
function drawCompletedStroke(ctx, points) {
  if (points.length < 2) return;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 180, 0, 0.4)';
  ctx.shadowBlur = 14;
  const grad = ctx.createLinearGradient(
    points[0].x, points[0].y,
    points[points.length - 1].x, points[points.length - 1].y
  );
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(0.5, '#FFA500');
  grad.addColorStop(1, '#FFD700');
  drawPathOnCanvas(ctx, points, grad, 28);
  ctx.restore();
}

// ─── Main Game Component ──────────────────────────────────────────────────────

const MagicSandTracingGame = ({ group, onBack, onPlayAgain }) => {
  // ── Sound / round data ──
  const getSounds = useCallback(() => {
    const sounds = group.sounds || [];
    const result = [];
    for (let i = 0; i < Math.max(TOTAL_ROUNDS, sounds.length); i++) {
      result.push(sounds[i % sounds.length]);
    }
    return result.slice(0, TOTAL_ROUNDS);
  }, [group]);

  const [sounds] = useState(() => getSounds());
  const totalRounds = sounds.length;
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameComplete, setGameComplete] = useState(false);

  const currentSound = sounds[roundNumber - 1] || sounds[0];

  // For multi-letter sounds like "ch", "sh" - trace each letter in sequence
  const allLetters = useMemo(() => {
    if (currentSound.length > 1) return currentSound.split('');
    return [currentSound];
  }, [currentSound]);
  const isMultiLetter = allLetters.length > 1;

  // ── Canvas sizing ──
  // We make the canvas responsive to the viewport
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 500, h: 500 });

  // Measure container on mount and resize
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Square canvas that fits in the container
        const side = Math.min(rect.width, rect.height) * 0.95;
        setCanvasSize({ w: Math.round(side), h: Math.round(side) });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── Tracing state ──
  const [currentLetterIdx, setCurrentLetterIdx] = useState(0);
  const [currentStrokeIdx, setCurrentStrokeIdx] = useState(0);
  const [completedStrokes, setCompletedStrokes] = useState([]); // indices of completed strokes
  const [completedLetters, setCompletedLetters] = useState([]); // indices of completed letters in multi-letter
  const [instructionLock, setInstructionLock] = useState(true);

  const traceIdxRef = useRef(0); // current point index along the stroke
  const isTracingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);
  const animFrameRef = useRef(null);
  const cursorPosRef = useRef({ x: 0, y: 0 }); // animal cursor position
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(true);
  const [isActivelyTracing, setIsActivelyTracing] = useState(false);

  const currentChar = (allLetters[currentLetterIdx] || allLetters[0]).toUpperCase();

  // ── Build stroke data for current character ──
  const strokesData = useMemo(() => {
    return buildStrokesForChar(currentChar, canvasSize.w, canvasSize.h);
  }, [currentChar, canvasSize.w, canvasSize.h]);

  const currentStroke = strokesData[currentStrokeIdx];

  // ── Initialize cursor at start of current stroke ──
  useEffect(() => {
    if (!currentStroke) return;
    const startPt = currentStroke.screenPoints[0];
    if (startPt) {
      cursorPosRef.current = { x: startPt.x, y: startPt.y };
      setCursorPos({ x: startPt.x, y: startPt.y });
    }
    traceIdxRef.current = 0;
    setShowCursor(true);
  }, [currentStroke, currentStrokeIdx, currentLetterIdx, roundNumber]);

  // ── Redraw canvas ──
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // Draw all strokes for the current letter
    for (let sIdx = 0; sIdx < strokesData.length; sIdx++) {
      const stroke = strokesData[sIdx];
      if (!stroke) continue;

      if (completedStrokes.includes(sIdx)) {
        // Draw completed stroke as golden
        drawCompletedStroke(ctx, stroke.screenPoints);
      } else if (sIdx === currentStrokeIdx) {
        // Draw guide path
        drawGuidePath(ctx, stroke.screenPoints);
        // Draw traced portion
        drawTracedPath(ctx, stroke.screenPoints, traceIdxRef.current);
        // Draw checkpoint dots
        const progress = stroke.screenPoints.length > 1
          ? traceIdxRef.current / (stroke.screenPoints.length - 1)
          : 0;
        drawCheckpointDots(ctx, stroke.checkpoints, progress);
      } else {
        // Future stroke: dim guide
        drawPathOnCanvas(ctx, stroke.screenPoints, 'rgba(255, 255, 255, 0.1)', 30);
      }
    }

  }, [canvasSize, strokesData, currentStrokeIdx, completedStrokes, completedLetters, allLetters, isMultiLetter]);

  // Redraw whenever stroke data or completion state changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Idle reminder ──
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('trace_the_letter');
    }, 8000);
  }, []);

  // ── Mount VO ──
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const run = async () => {
      await playVO('trace_the_letter');
      if (cancelled) return;
      startIdleReminder();
      if (!cancelled) setInstructionLock(false);
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [startIdleReminder]);

  // ── Stroke completion handler ──
  const handleStrokeComplete = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    clearTimeout(idleRef.current);

    // Mark this stroke as completed
    setCompletedStrokes((prev) => [...prev, currentStrokeIdx]);

    // Burst at cursor position
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const screenX = rect.left + (cursorPosRef.current.x / canvasSize.w) * rect.width;
      const screenY = rect.top + (cursorPosRef.current.y / canvasSize.h) * rect.height;
      triggerSmallBurst();
    }

    const nextStroke = currentStrokeIdx + 1;
    if (nextStroke < strokesData.length) {
      // More strokes for this letter
      await delay(300);
      if (!mountedRef.current) return;
      setCurrentStrokeIdx(nextStroke);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
      return;
    }

    // All strokes for this letter done
    setShowCursor(false);

    // Play letter sound
    try { await playLetterSound(currentChar); } catch (e) { /* ignore */ }
    if (!mountedRef.current) return;

    // Check if multi-letter: move to next letter
    if (isMultiLetter && currentLetterIdx < allLetters.length - 1) {
      setCompletedLetters((prev) => [...prev, currentLetterIdx]);
      await delay(400);
      if (!mountedRef.current) return;
      setCurrentLetterIdx((prev) => prev + 1);
      setCurrentStrokeIdx(0);
      setCompletedStrokes([]);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
      return;
    }

    // All letters for this sound done
    await playEncouragement();
    if (!mountedRef.current) return;

    if (roundNumber < totalRounds) {
      await delay(800);
      if (!mountedRef.current) return;
      // Next round
      setRoundNumber((r) => r + 1);
      setCurrentLetterIdx(0);
      setCurrentStrokeIdx(0);
      setCompletedStrokes([]);
      setCompletedLetters([]);
      traceIdxRef.current = 0;
      isProcessingRef.current = false;
      startIdleReminder();
    } else {
      // Game complete
      triggerCelebration();
      await playVO('great_job');
      if (!mountedRef.current) return;
      setGameComplete(true);
    }
  }, [currentStrokeIdx, strokesData, currentChar, isMultiLetter, currentLetterIdx, allLetters, roundNumber, totalRounds, canvasSize, startIdleReminder]);

  // ── Pointer handlers ──
  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasSize.w / rect.width;
    const scaleY = canvasSize.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [canvasSize]);

  const handlePointerDown = useCallback((e) => {
    if (instructionLock || isProcessingRef.current || !currentStroke) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    clearTimeout(idleRef.current);

    // Check if touching near the animal cursor
    const dx = pos.x - cursorPosRef.current.x;
    const dy = pos.y - cursorPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= ANIMAL_GRAB_RADIUS) {
      isTracingRef.current = true;
      setIsActivelyTracing(true);

      // Handle dot strokes (like i/j dot)
      if (currentStroke.isDot) {
        isTracingRef.current = false;
        setIsActivelyTracing(false);
        handleStrokeComplete();
      }
    }
  }, [instructionLock, currentStroke, getCanvasPos, handleStrokeComplete]);

  const handlePointerMove = useCallback((e) => {
    if (!isTracingRef.current || !currentStroke || isProcessingRef.current) return;
    const pos = getCanvasPos(e);
    if (!pos) return;

    const projected = projectToPath(
      currentStroke.screenPoints,
      pos.x,
      pos.y,
      traceIdxRef.current
    );

    // Must be within corridor
    if (projected.dist > PATH_CORRIDOR) {
      // Too far from path - stop tracing
      isTracingRef.current = false;
      setIsActivelyTracing(false);
      return;
    }

    // Only allow forward progress (or very small backward for tolerance)
    if (projected.idx >= traceIdxRef.current - 2) {
      const newIdx = Math.max(traceIdxRef.current, projected.idx);
      traceIdxRef.current = newIdx;

      // Smooth cursor movement along the path
      const pathPt = currentStroke.screenPoints[newIdx];
      if (pathPt) {
        const smooth = 0.6;
        cursorPosRef.current = {
          x: cursorPosRef.current.x + (pathPt.x - cursorPosRef.current.x) * smooth,
          y: cursorPosRef.current.y + (pathPt.y - cursorPosRef.current.y) * smooth,
        };
        setCursorPos({ ...cursorPosRef.current });
      }

      // Redraw
      redrawCanvas();

      // Check completion
      const progress = newIdx / (currentStroke.screenPoints.length - 1);
      if (progress >= COMPLETION_THRESHOLD) {
        // Complete! Snap to end
        traceIdxRef.current = currentStroke.screenPoints.length - 1;
        const endPt = currentStroke.screenPoints[currentStroke.screenPoints.length - 1];
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

  // ── Back handler ──
  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  // ── Confetti rain on results ──
  useEffect(() => {
    if (!gameComplete) return;
    let running = true;
    const rain = () => {
      if (!running) return;
      confetti({
        particleCount: 3,
        angle: 270,
        spread: 120,
        origin: { x: Math.random(), y: -0.1 },
        gravity: 0.6,
        scalar: 0.8,
        ticks: 200,
        colors: ['#FFD000', '#FF6B9D', '#4ECDC4', '#8B5CF6', '#22C55E'],
      });
      requestAnimationFrame(rain);
    };
    rain();
    return () => { running = false; };
  }, [gameComplete]);

  // ── Results screen ──
  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#8B5CF6]">
        <motion.button
          onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000]"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] p-8 md:p-12 text-center max-w-md mx-4 border-t-4 border-[#FFD000]"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span
            className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {ANIMAL_EMOJI}
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#FFD700] mb-2">Tracing Star!</h2>
          <p className="text-white/60 text-sm md:text-base mb-6">Beautiful letter tracing!</p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{
                borderRadius: '1.6rem',
                borderBottom: '5px solid #16a34a',
                boxShadow: '0px 6px 0px rgba(0,0,0,0.12)',
              }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white/70 font-bold text-sm md:text-base"
              style={{
                borderRadius: '1.6rem',
                borderBottom: '4px solid rgba(0,0,0,0.05)',
              }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Back to Playground
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Compute cursor screen position for the overlay div ──
  const canvasEl = canvasRef.current;
  let cursorScreenX = 0;
  let cursorScreenY = 0;
  if (canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    cursorScreenX = rect.left + (cursorPos.x / canvasSize.w) * rect.width;
    cursorScreenY = rect.top + (cursorPos.y / canvasSize.h) * rect.height;
  }

  // ── Main game UI ──
  return (
    <div
      className="h-screen w-screen flex flex-col bg-gradient-to-b from-[#2d1b00] to-[#5a3a10] overflow-hidden select-none"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Sandy background texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(255,215,0,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,165,0,0.1) 0%, transparent 50%)',
        }}
      />

      {/* Nav buttons */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button
          onClick={handleBack}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000]"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.button
          onClick={toggleFullscreen}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000]"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* Speaker + Progress dots */}
      <div className="fixed top-3 right-3 z-[70] flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalRounds }).map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx < roundNumber - 1
                  ? 'bg-[#22c55e] w-2.5 h-2.5'
                  : idx === roundNumber - 1
                    ? 'bg-[#FFD000] w-3 h-3 ring-2 ring-[#FFD000]/40'
                    : 'bg-white/40 w-2.5 h-2.5'
              }`}
            />
          ))}
        </div>
        <motion.button
          onClick={async () => {
            if (isProcessingRef.current) return;
            clearTimeout(idleRef.current);
            try { await playLetterSound(currentSound); } catch (e) { /* ignore */ }
            if (mountedRef.current) startIdleReminder();
          }}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#6B3FA0]"
          style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          whileHover={{ scale: 1.1 }}
        >
          <Volume2 className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white" />
        </motion.button>
      </div>

      {/* Main tracing area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center w-full h-full max-w-[90vh] max-h-[85vh]">
          {/* Sound label + multi-letter indicator */}
          <div className="flex items-center gap-3 mb-3">
            {isMultiLetter ? (
              allLetters.map((letter, idx) => (
                <motion.span
                  key={`label-${idx}`}
                  className={`text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-wider transition-colors duration-300 ${
                    idx === currentLetterIdx
                      ? 'text-[#FFD700]'
                      : idx < currentLetterIdx || completedLetters.includes(idx)
                        ? 'text-[#22c55e]'
                        : 'text-white/30'
                  }`}
                  style={{ textShadow: idx === currentLetterIdx ? '0 4px 12px rgba(255, 215, 0, 0.5)' : 'none' }}
                  animate={idx === currentLetterIdx ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {letter.toUpperCase()}
                </motion.span>
              ))
            ) : (
              <motion.span
                key={`sound-${currentSound}-${roundNumber}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-5xl md:text-6xl lg:text-7xl font-black text-[#FFD700] uppercase tracking-wider"
                style={{ textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
              >
                {currentSound.toUpperCase()}
              </motion.span>
            )}
          </div>

          {/* Canvas container */}
          <div
            ref={containerRef}
            className="relative flex items-center justify-center"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: 'min(75vmin, 600px)',
              maxHeight: 'min(75vmin, 600px)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`canvas-${roundNumber}-${currentLetterIdx}`}
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -80, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="relative rounded-3xl overflow-hidden"
                style={{
                  width: canvasSize.w,
                  height: canvasSize.h,
                  background: 'rgba(0,0,0,0.25)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3), inset 0 0 60px rgba(255,215,0,0.05)',
                  touchAction: 'none',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  className="absolute inset-0 w-full h-full"
                  style={{ touchAction: 'none' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                />
              </motion.div>
            </AnimatePresence>

            {/* Animal cursor overlay */}
            {showCursor && canvasEl && (
              <div
                className="fixed pointer-events-none z-[60]"
                style={{
                  left: cursorScreenX - 28,
                  top: cursorScreenY - 28,
                  width: 56,
                  height: 56,
                  transition: isActivelyTracing ? 'none' : 'left 0.3s ease, top 0.3s ease',
                }}
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.45)',
                    boxShadow: '0 0 16px rgba(255, 215, 0, 0.7), 0 0 30px rgba(255, 180, 0, 0.3)',
                    transform: isActivelyTracing ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <span className="text-[28px] leading-none select-none">{ANIMAL_EMOJI}</span>
                </div>
              </div>
            )}
          </div>

          {/* Stroke indicator */}
          {strokesData.length > 1 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-white/40 text-xs font-medium">Stroke</span>
              {strokesData.map((_, idx) => (
                <div
                  key={`si-${idx}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    completedStrokes.includes(idx)
                      ? 'bg-[#22c55e]'
                      : idx === currentStrokeIdx
                        ? 'bg-[#FFD000] ring-2 ring-[#FFD000]/40'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Wrapper with play-again key reset ────────────────────────────────────────

const MagicSandTracing = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <MagicSandTracingGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default MagicSandTracing;
