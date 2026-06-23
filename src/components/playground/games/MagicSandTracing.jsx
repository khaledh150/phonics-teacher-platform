import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay, playLetterVO, stopWordVO } from '../../../utils/audioPlayer';
import { stopAllAudio, playLetterSound, getDisplaySound } from '../../../utils/letterSounds';
import { triggerSmallBurst, triggerCelebration } from '../../../utils/confetti';
import { playEncouragement } from '../../../utils/encouragement';
import confetti from 'canvas-confetti';
import stickersSvgRaw from '../../../assets/materials/Summer-sticker-collection.svg?raw';
import CrabCompanion from './CrabCompanion';
import BeachBackground from '../../themes/BeachBackground';
import {
  PATH_CORRIDOR,
  GRAB_RADIUS,
  DESCENDERS,
  ASCENDERS,
  dist,
  extractTracingPaths,
  createFilteredSvgDataUrl,
  projectToPath,
  evaluateStrokeProgress,
} from './tracingEngine';

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

// ─── Sand particles ───────────────────────────────────────────────────────
class SandParticles {
  constructor() { this.p = []; }
  emit(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      // Scatter sideways and slightly downward — sand settles, doesn't fly up
      const a = Math.PI * 0.1 + Math.random() * Math.PI * 0.8; // 18°-162° (downward arc)
      const spd = 1.0 + Math.random() * 2.0;
      this.p.push({
        x, y,
        vx: Math.cos(a) * spd * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.abs(Math.sin(a)) * spd * 0.5 + 0.3,
        life: 1, decay: 0.02 + Math.random() * 0.025,
        size: 3 + Math.random() * 6, hue: 35 + Math.random() * 25,
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
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
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

  const displaySound = getDisplaySound(currentSound);
  const allLetters = useMemo(() =>
    displaySound.length > 1 ? displaySound.split('') : [displaySound],
  [displaySound]);
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
  const currentSoundRef = useRef(currentSound);
  useEffect(() => { currentSoundRef.current = currentSound; }, [currentSound]);

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
      const side = Math.min(rect.width, rect.height) * 0.96;
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
        // Use firstDash (actual first dash center) for pencil placement,
        // not pts[0] which includes backward extension and may be off-stroke
        const start = result.strokes[0].firstDash || result.strokes[0].pts[0];
        cursorPosRef.current = { x: start.x, y: start.y };
        setCursorPos({ x: start.x, y: start.y });
        setTimeout(() => { if (!cancelled) setShowCursor(true); }, 500);
      }
    });
    return () => { cancelled = true; };
  }, [currentChar, isUppercase, canvasSize.w, canvasSize.h]);

  // ── Position cursor at first dash center (where user starts tracing) ──
  useEffect(() => {
    if (!pathsReady || !strokesData[currentStrokeIdx]) return;
    const stroke = strokesData[currentStrokeIdx];
    // Use firstDash for accurate start position, fallback to pts[0]
    const start = stroke.firstDash || stroke.pts[0];
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
      if (!mountedRef.current) return;
      await delay(200);
      if (!mountedRef.current) return;
      const s = currentSoundRef.current;
      if (s && s.length === 1) await playLetterVO(s).catch(() => {});
    }, 8000);
  }, []);

  // Play "Trace the letter!" + alphabet VO once per new round (not per upper/lower switch)
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const run = async () => {
      await playVO('Trace the letter!');
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      const s = currentSoundRef.current;
      if (s) await playLetterVO(s).catch(() => {});
      if (cancelled) return;
      startIdleReminder();
      if (!cancelled) setInstructionLock(false);
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopWordVO();
      stopAllAudio(); stopVO();
      clearTimeout(idleRef.current);
      clearTimeout(crabIdleTimerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [roundNumber, startIdleReminder]);

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
        particlesRef.current.emit(startPt.x, startPt.y, 6);
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
        particlesRef.current.emit(cursorPosRef.current.x, cursorPosRef.current.y, 4);
      }

      redrawCanvas();

      // Stroke completion rule lives in tracingEngine.evaluateStrokeProgress —
      // it enforces the 75%-progress gate that prevents auto-complete at
      // intersections (T, P, K) and circular strokes (o).
      const endPt = currentStroke.pts[currentStroke.pts.length - 1];
      const isComplete = evaluateStrokeProgress(currentStroke, newIdx, trailWidth);

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
    stopWordVO();
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
          className="fixed top-3 left-3 z-[70] flex items-center justify-center rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden"
          style={{ 
            width: 'clamp(36px, 10vh, 56px)', height: 'clamp(36px, 10vh, 56px)', 
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #3e366b', 
            boxShadow: '0 4px 0 #D4A000, 0 4px 12px rgba(0,0,0,0.1)' 
          }}
          whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}>
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <Maximize style={{ width: "65%", height: "65%" }} className="text-[#3e366b]" />
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

  // ── Cursor position as percentage of canvas ──
  const cursorPctX = canvasSize.w > 0 ? (cursorPos.x / canvasSize.w) * 100 : 0;
  const cursorPctY = canvasSize.h > 0 ? (cursorPos.y / canvasSize.h) * 100 : 0;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none"
      onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}>

      {/* Loading overlay — only on initial game load, not on letter/case transitions */}

      <BeachBackground />
      <div className="absolute inset-0 bg-black/10 pointer-events-none" style={{ zIndex: 0 }} />

      {/* Nav */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button onClick={handleBack}
          className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden"
          style={{ 
            width: 'clamp(36px, 10vh, 56px)', height: 'clamp(36px, 10vh, 56px)', 
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #3e366b', 
            boxShadow: '0 4px 0 #D4A000, 0 4px 12px rgba(0,0,0,0.1)' 
          }}
          whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}>
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <ArrowLeft style={{ width: "65%", height: "65%" }} className="text-[#3e366b]" />
        </motion.button>
        <motion.button onClick={toggleFullscreen}
          className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden"
          style={{ 
            width: 'clamp(36px, 10vh, 56px)', height: 'clamp(36px, 10vh, 56px)', 
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #3e366b', 
            boxShadow: '0 4px 0 #D4A000, 0 4px 12px rgba(0,0,0,0.1)' 
          }}
          whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}>
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <Maximize style={{ width: "65%", height: "65%" }} className="text-[#3e366b]" />
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
          whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}>
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

      {/* Decorative stickers now handled by BeachBackground */}

      {/* Tracing area */}
      <div className="flex-1 flex items-center justify-center p-2 relative z-10">
        <div className="flex flex-col items-center justify-center w-full h-full max-h-[95vh]">
          <div ref={containerRef} className="relative flex items-center justify-center"
            style={{ width: '100%', height: '100%', maxWidth: 'min(90vw, 650px)', maxHeight: 'min(78vh, 600px)' }}>

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
            <AnimatePresence>
              <motion.div
                key={`canvas-${roundNumber}-${activeLetterIdx}-${letterCase}`}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  scale: isUppercase ? 1 : 0.85,
                  y: isUppercase ? 0
                    : DESCENDERS.has(currentChar) ? canvasSize.h * 0.08
                    : ASCENDERS.has(currentChar) ? 0
                    : canvasSize.h * 0.04,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
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

                {/* Shovel indicator — INSIDE the scaled motion.div so it moves with the letter */}
                {showCursor && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`shovel-${shovelAnimKey}`}
                      className="absolute pointer-events-none z-[60] flex items-center justify-center"
                      style={{
                        left: `${cursorPctX}%`, top: `${cursorPctY}%`,
                        width: 100, height: 100,
                        marginLeft: -50, marginTop: -50,
                        transition: isActivelyTracing ? 'none' : 'left 0.15s ease, top 0.15s ease',
                      }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isActivelyTracing
                    ? { scale: 0.75, opacity: 0.6 }
                    : { scale: [1, 1.08, 1], opacity: 1 }
                  }
                  transition={isActivelyTracing
                    ? { duration: 0.12 }
                    : {
                        scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.9 },
                        opacity: { duration: 0.4, ease: 'easeOut' },
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
                      width: 70, height: 70,
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

              </motion.div>
            </AnimatePresence>

            {/* Particle canvas — outside AnimatePresence so it persists across letter changes */}
            <canvas ref={particleCanvasRef} width={canvasSize.w} height={canvasSize.h}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 12 }} />
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
