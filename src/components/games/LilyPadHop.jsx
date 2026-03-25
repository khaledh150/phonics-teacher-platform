import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio, playLetterSound } from '../../utils/letterSounds';
import { triggerSmallBurst, triggerCelebration, triggerBurstAt } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';
import frogSheet from '../../assets/characters/set-cute-drawing-frogs.svg';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

const TOTAL_ROUNDS = 10;
const ALL_SOUNDS = [
  's','a','t','i','p','n','c','k','e','h','r','m','d','g','o','u','l','f','b','j','z','w','v','x','y',
  'ch','sh','th','ng','qu','ai','oa','ie','ee','or','oo','oi','ou','ue','er','ir','ur','ar','ay','ow','igh','ew','aw','al','au',
];

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Sprite regions in the 2000x2000 SVG ────────────────────────────────────
const SPRITES = {
  frogOnPad:    { x: 50,   y: 55,   w: 620, h: 530 },
  frogOnPad2:   { x: 1265, y: 75,   w: 680, h: 510 },
  frogSitting:  { x: 670,  y: 420,  w: 610, h: 270 },
  frogJumping:  { x: 610,  y: 730,  w: 520, h: 650 },
  frogSwimming: { x: 150,  y: 630,  w: 420, h: 740 },
  frogHead:     { x: 760,  y: 125,  w: 330, h: 240 },
  lilyPad:      { x: 120,  y: 1635, w: 420, h: 250 },
  lilyPad2:     { x: 120,  y: 1370, w: 420, h: 250 },
  fly:          { x: 1530, y: 585,  w: 360, h: 240 },
};

const Sprite = ({ sprite, size, className, style }) => {
  const s = SPRITES[sprite];
  if (!s) return null;
  const aspect = s.h / s.w;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`${s.x} ${s.y} ${s.w} ${s.h}`}
      width={size}
      height={size * aspect}
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <image href={frogSheet} x="0" y="0" width="2000" height="2000" />
    </svg>
  );
};

// Green bubbles rising from frog when it falls in water
const WaterBubbles = () => {
  const bubbles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      size: 5 + Math.random() * 7,
      left: 25 + Math.random() * 50,
      yTravel: 40 + Math.random() * 60,
      delay: i * 0.08,
      dur: 0.7 + Math.random() * 0.5,
    })), []);
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-visible">
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size, height: b.size,
            background: `rgba(120, 210, 80, 0.7)`,
            border: '1px solid rgba(100, 190, 60, 0.5)',
            left: `${b.left}%`, bottom: 0,
          }}
          initial={{ y: 0, opacity: 0.9, scale: 0.4 }}
          animate={{ y: -b.yTravel, opacity: 0, scale: 1.3 }}
          transition={{ duration: b.dur, delay: b.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

// Inline SVG water plant (reed/cattail) for corners
const WaterPlant = ({ flip, scale = 1 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 120"
    width={60 * scale}
    height={120 * scale}
    style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}
  >
    {/* Stem 1 */}
    <line x1="30" y1="120" x2="28" y2="30" stroke="#189313" strokeWidth="3" strokeLinecap="round" />
    {/* Cattail top */}
    <ellipse cx="28" cy="22" rx="4" ry="12" fill="#DC804F" />
    {/* Stem 2 (shorter) */}
    <line x1="38" y1="120" x2="40" y2="50" stroke="#189313" strokeWidth="2.5" strokeLinecap="round" />
    {/* Cattail top 2 */}
    <ellipse cx="40" cy="42" rx="3.5" ry="10" fill="#B86E3F" />
    {/* Leaf 1 */}
    <path d="M30 80 Q15 70 10 55" fill="none" stroke="#62C903" strokeWidth="3" strokeLinecap="round" />
    {/* Leaf 2 */}
    <path d="M32 65 Q45 55 50 42" fill="none" stroke="#00B401" strokeWidth="2.5" strokeLinecap="round" />
    {/* Leaf 3 (small) */}
    <path d="M36 95 Q48 88 52 78" fill="none" stroke="#62C903" strokeWidth="2" strokeLinecap="round" />
    {/* Grass blades */}
    <line x1="20" y1="120" x2="14" y2="85" stroke="#00B401" strokeWidth="2" strokeLinecap="round" />
    <line x1="45" y1="120" x2="50" y2="90" stroke="#62C903" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── Game ────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 210;
const BOTTOM_PADDING = 200;

const LilyPadHopGame = ({ group, onBack, onPlayAgain }) => {
  const rounds = useMemo(() => {
    const groupSounds = group.sounds || [];
    return Array.from({ length: TOTAL_ROUNDS }, () => {
      const target = groupSounds[Math.floor(Math.random() * groupSounds.length)];
      // Match distractor length to target length
      const targetLen = target.length;
      const matchedPool = ALL_SOUNDS.filter((s) => !groupSounds.includes(s) && s.length === targetLen);
      const fallbackPool = ALL_SOUNDS.filter((s) => !groupSounds.includes(s));
      const pool = matchedPool.length >= 2 ? matchedPool : fallbackPool;
      const distractors = shuffleArray(pool).slice(0, 2);
      const options = shuffleArray([target, ...distractors]);
      return { target, options };
    });
  }, [group]);

  const [currentRound, setCurrentRound] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [frogPadIndex, setFrogPadIndex] = useState(-1);
  const [frogCorrectOpt, setFrogCorrectOpt] = useState(null);
  const [scrollOffset, setScrollOffset] = useState(() => {
    const totalH = (TOTAL_ROUNDS + 2) * ROW_HEIGHT + BOTTOM_PADDING;
    return -(totalH - window.innerHeight);
  });
  const [jumping, setJumping] = useState(null);
  const [swimBack, setSwimBack] = useState(null);
  const [wrongPads, setWrongPads] = useState({});
  const [frogPopIn, setFrogPopIn] = useState(false);

  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);
  const padRefs = useRef({});
  const gameAreaRef = useRef(null);
  const containerRef = useRef(null);
  const frogStartRef = useRef(null);

  const roundData = rounds[currentRound] || rounds[0];
  const totalGameHeight = (TOTAL_ROUNDS + 2) * ROW_HEIGHT + BOTTOM_PADDING;
  // Responsive pad size — smaller on phones to prevent overflow
  const padSize = typeof window !== 'undefined' && window.innerWidth < 500 ? 100 : 140;

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Jump to the correct lily pad!');
      if (!mountedRef.current) return;
      try { await playLetterSound(rounds[currentRound]?.target); } catch (e) { /* ignore */ }
    }, 8000);
  }, [currentRound, rounds]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const run = async () => {
      await playVO('Help the frog jump to the sound...');
      if (cancelled) return;
      try { await playLetterSound(rounds[0].target); } catch (e) { /* ignore */ }
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentRound === 0) return;
    let cancelled = false;
    const run = async () => {
      await delay(400);
      if (cancelled) return;
      try { await playLetterSound(roundData.target); } catch (e) { /* ignore */ }
      if (cancelled) return;
      startIdleReminder();
    };
    run();
    return () => { cancelled = true; };
  }, [currentRound, roundData.target, startIdleReminder]);

  useEffect(() => {
    if (!gameComplete) return;
    let running = true;
    const rain = () => {
      if (!running) return;
      confetti({
        particleCount: 3, angle: 270, spread: 120,
        origin: { x: Math.random(), y: -0.1 },
        gravity: 0.6, scalar: 0.8, ticks: 200,
        colors: ['#FFD000', '#FF6B9D', '#4ECDC4', '#8B5CF6', '#22C55E'],
      });
      requestAnimationFrame(rain);
    };
    rain();
    return () => { running = false; };
  }, [gameComplete]);

  const getPadLayout = useCallback((roundIdx) => {
    // Reduce xShift on narrow screens to prevent overflow
    const isNarrow = window.innerWidth < 500;
    const xShift = isNarrow ? 0 : (roundIdx % 2 === 0 ? -8 : 8);
    const yFromBottom = (roundIdx + 1) * ROW_HEIGHT + BOTTOM_PADDING;
    return { xShift, yFromBottom };
  }, []);

  useEffect(() => {
    if (gameComplete) return;
    const viewportHeight = window.innerHeight;
    const activeRowY = totalGameHeight - ((currentRound + 1) * ROW_HEIGHT + BOTTOM_PADDING);
    const targetScroll = activeRowY - viewportHeight * 0.35;
    const maxScroll = totalGameHeight - viewportHeight;
    const clamped = Math.max(0, Math.min(targetScroll, maxScroll));
    setScrollOffset(-clamped);
  }, [currentRound, totalGameHeight, gameComplete]);

  const getFrogScreenPos = useCallback(() => {
    if (frogPadIndex === -1 && frogStartRef.current) {
      const rect = frogStartRef.current.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    if (frogPadIndex >= 0 && frogCorrectOpt !== null) {
      const padKey = `${frogPadIndex}-${frogCorrectOpt}`;
      const el = padRefs.current[padKey];
      if (el) {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.8 };
  }, [frogPadIndex, frogCorrectOpt]);

  const handlePadTap = useCallback(async (sound, roundIdx, optionIdx) => {
    if (instructionLock || isProcessingRef.current) return;
    if (roundIdx !== currentRound) return;
    isProcessingRef.current = true;
    clearTimeout(idleRef.current);

    const padKey = `${roundIdx}-${optionIdx}`;

    const fromPos = getFrogScreenPos();
    const padEl = padRefs.current[padKey];
    let toPos = { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
    if (padEl) {
      const rect = padEl.getBoundingClientRect();
      toPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    // Boing + jump
    playVO('Boing!');
    setJumping({ fromX: fromPos.x, fromY: fromPos.y, toX: toPos.x, toY: toPos.y });

    await delay(500);
    if (!mountedRef.current) return;

    if (sound !== roundData.target) {
      // Wrong — show frog fallen in water replacing the pad + bubbles
      // Set wrongPads BEFORE clearing jumping so resting frog stays hidden
      setWrongPads((prev) => ({ ...prev, [padKey]: true }));
      setJumping(null);

      await playVO('Oops, try again!');
      if (!mountedRef.current) return;

      // Get position for swim-back
      const wrongEl = padRefs.current[padKey];
      let swimFrom = toPos;
      if (wrongEl) {
        const rect = wrongEl.getBoundingClientRect();
        swimFrom = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }

      // Clear wrong pad, start swim-back with frogHead (underwater)
      setWrongPads((prev) => { const next = { ...prev }; delete next[padKey]; return next; });
      setSwimBack({ fromX: swimFrom.x, fromY: swimFrom.y, toX: fromPos.x, toY: fromPos.y });

      await delay(650);
      if (!mountedRef.current) return;
      setSwimBack(null);
      // Pop the frog back in at resting position
      setFrogPopIn(true);
      setTimeout(() => setFrogPopIn(false), 400);

      isProcessingRef.current = false;
      startIdleReminder();
      return;
    }

    // Correct!
    setJumping(null);
    setFrogPadIndex(roundIdx);
    setFrogCorrectOpt(optionIdx);

    if (padEl) {
      const rect = padEl.getBoundingClientRect();
      triggerBurstAt(
        (rect.left + rect.width / 2) / window.innerWidth,
        (rect.top + rect.height / 2) / window.innerHeight
      );
    } else {
      triggerSmallBurst();
    }

    await playEncouragement();
    if (!mountedRef.current) return;
    await delay(800);
    if (!mountedRef.current) return;

    if (currentRound >= TOTAL_ROUNDS - 1) {
      triggerCelebration();
      await playVO('Great job!');
      if (!mountedRef.current) return;
      setGameComplete(true);
    } else {
      setCurrentRound((r) => r + 1);
      isProcessingRef.current = false;
    }
  }, [instructionLock, currentRound, roundData.target, startIdleReminder, getFrogScreenPos]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  const handleSpeakerTap = async () => {
    if (isProcessingRef.current) return;
    clearTimeout(idleRef.current);
    try { await playLetterSound(roundData.target); } catch (e) { /* ignore */ }
    if (mountedRef.current) startIdleReminder();
  };

  const hasWrongPads = Object.keys(wrongPads).length > 0;
  const frogHidden = !!jumping || !!swimBack || hasWrongPads;

  // --- Results screen ---
  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#6B3FA0]">
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
          <motion.div
            className="flex justify-center mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sprite sprite="frogOnPad2" size={180} />
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#22c55e] mb-2">Hop Champion!</h2>
          <p className="text-white/60 text-sm md:text-base mb-6">The frog made it to the top!</p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16a34a', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white/70 font-bold text-sm md:text-base"
              style={{ borderRadius: '1.6rem', borderBottom: '4px solid rgba(0,0,0,0.05)' }}
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

  // --- Main game screen ---
  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-hidden relative"
      style={{ background: 'linear-gradient(to bottom, #8BDAF4, #75D1F1, #6ACBED)' }}
    >
      {/* Water shimmer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, rgba(255,255,255,0.06) 3px, transparent 6px)',
        }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Corner plants — SVG reeds/cattails in bottom corners only */}
      {/* Bottom-left */}
      <div className="fixed left-1 bottom-1 z-[5] pointer-events-none">
        <motion.div animate={{ rotate: [-4, 2, -4] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          <WaterPlant scale={0.7} />
        </motion.div>
      </div>
      <div className="fixed left-9 bottom-4 z-[5] pointer-events-none">
        <motion.div animate={{ rotate: [-2, 3, -2] }} transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}>
          <WaterPlant scale={0.45} />
        </motion.div>
      </div>
      {/* Bottom-right */}
      <div className="fixed right-1 bottom-1 z-[5] pointer-events-none">
        <motion.div animate={{ rotate: [4, -2, 4] }} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}>
          <WaterPlant scale={0.7} flip />
        </motion.div>
      </div>
      <div className="fixed right-9 bottom-4 z-[5] pointer-events-none">
        <motion.div animate={{ rotate: [2, -3, 2] }} transition={{ duration: 5.3, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}>
          <WaterPlant scale={0.45} flip />
        </motion.div>
      </div>

      {/* Decorative flies */}
      {[
        { top: '15%', left: '10%', size: 42, dur: 3, dx: 15, dy: 10 },
        { top: '50%', right: '6%', size: 38, dur: 4, dx: -12, dy: 8 },
        { top: '75%', left: '14%', size: 34, dur: 3.5, dx: 10, dy: -12 },
      ].map((f, i) => (
        <div
          key={i}
          className="fixed z-[5] pointer-events-none"
          style={{ top: f.top, left: f.left, right: f.right }}
        >
          <motion.div
            animate={{
              y: [0, f.dy, 0, -f.dy * 0.5, 0],
              x: [0, f.dx, 0, -f.dx * 0.5, 0],
              rotate: [0, 8, -8, 5, 0],
            }}
            transition={{ duration: f.dur, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sprite sprite="fly" size={f.size} />
          </motion.div>
        </div>
      ))}

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
          {Array.from({ length: TOTAL_ROUNDS }).map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx < currentRound
                  ? 'bg-[#22c55e] w-2 h-2 md:w-2.5 md:h-2.5'
                  : idx === currentRound
                  ? 'bg-[#8B5CF6] w-2.5 h-2.5 md:w-3 md:h-3 ring-2 ring-[#8B5CF6]/40'
                  : 'bg-white/40 w-2 h-2 md:w-2.5 md:h-2.5'
              }`}
            />
          ))}
        </div>
        <motion.button
          onClick={handleSpeakerTap}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#6B3FA0]"
          style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          whileHover={{ scale: 1.1 }}
        >
          <Volume2 className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white" />
        </motion.button>
      </div>

      {/* Jumping frog overlay */}
      <AnimatePresence>
        {jumping && (
          <motion.div
            className="fixed z-[60] pointer-events-none"
            style={{ left: jumping.fromX - 40, top: jumping.fromY - 50 }}
            initial={{ x: 0, y: 0, scale: 1 }}
            animate={{
              x: jumping.toX - jumping.fromX,
              y: jumping.toY - jumping.fromY,
              scale: [1, 1.3, 1],
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              animate={{ rotate: [0, -15, 15, 0] }}
              transition={{ duration: 0.45 }}
            >
              <Sprite sprite="frogJumping" size={100} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frog head swimming back underwater after wrong answer */}
      <AnimatePresence>
        {swimBack && (() => {
          // Calculate rotation so frog head points toward destination (head-first)
          const dx = swimBack.toX - swimBack.fromX;
          const dy = swimBack.toY - swimBack.fromY;
          // frogHead sprite faces left (180°). Rotate to face travel direction.
          const travelAngle = Math.atan2(dy, dx) * 180 / Math.PI;
          const headRotation = travelAngle - 180;
          return (
            <motion.div
              className="fixed z-[60] pointer-events-none"
              style={{ left: swimBack.fromX - 30, top: swimBack.fromY - 25 }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: swimBack.toX - swimBack.fromX,
                y: swimBack.toY - swimBack.fromY,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
              <motion.div
                style={{ rotate: headRotation }}
                animate={{ y: [0, 3, 0, -3, 0] }}
                transition={{ duration: 0.6 }}
              >
                <Sprite sprite="frogHead" size={55} />
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Scrollable game world */}
      <div
        ref={gameAreaRef}
        className="absolute inset-0"
        style={{
          height: `${totalGameHeight}px`,
          transform: `translateY(${scrollOffset}px)`,
          transition: 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {/* Finish banner */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ top: `${totalGameHeight - (TOTAL_ROUNDS + 1) * ROW_HEIGHT - BOTTOM_PADDING + 60}px` }}
        >
          <motion.div
            className="bg-[#FFD000] px-6 py-2 md:px-8 md:py-3 rounded-2xl"
            style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-[#3e366b] font-black text-lg md:text-xl lg:text-2xl">🏆 FINISH!</span>
          </motion.div>
        </div>

        {/* Lily pad rows */}
        {rounds.map((rd, roundIdx) => {
          const { xShift, yFromBottom } = getPadLayout(roundIdx);
          const isActive = roundIdx === currentRound;
          const isCompleted = roundIdx < currentRound;
          const yPos = totalGameHeight - yFromBottom;

          return (
            <div
              key={roundIdx}
              className="absolute left-1/2 flex items-center justify-center gap-1 sm:gap-3 md:gap-6 lg:gap-10"
              style={{
                top: `${yPos}px`,
                transform: `translateX(calc(-50% + ${xShift}vw))`,
                maxWidth: 'calc(100vw - 16px)',
              }}
            >
              {rd.options.map((sound, optIdx) => {
                const padKey = `${roundIdx}-${optIdx}`;
                const isTarget = sound === rd.target;
                const hasFrog = frogPadIndex === roundIdx && frogCorrectOpt === optIdx;
                const isWrong = wrongPads[padKey];
                const frogVisibleHere = hasFrog && !frogHidden;
                const isCompletedNonTarget = isCompleted && !isTarget;

                return (
                  <motion.div
                    key={padKey}
                    ref={(el) => { padRefs.current[padKey] = el; }}
                    className={`flex flex-col items-center relative ${isActive ? 'cursor-pointer' : ''}`}
                    style={{ overflow: 'visible' }}
                    onClick={() => isActive && handlePadTap(sound, roundIdx, optIdx)}
                  >
                    {/* Water ripple */}
                    <div
                      className="absolute rounded-full blur-md"
                      style={{
                        width: padSize + 10, height: 35, bottom: -10,
                        left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(255, 255, 255, 0.12)',
                      }}
                    />

                    <motion.div
                      className="relative flex items-center justify-center"
                      style={{
                        opacity: frogVisibleHere ? 1 : isActive ? 1 : isCompletedNonTarget ? 0.3 : isCompleted ? 0.7 : 0.55,
                        filter: isActive
                          ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.25)) drop-shadow(0 0 12px rgba(34,197,94,0.2))'
                          : 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))',
                      }}
                      whileHover={isActive && !isWrong ? { scale: 1.12, y: -6 } : {}}
                      whileTap={isActive && !isWrong ? { scale: 0.95, y: 3 } : {}}
                      animate={isActive && !isWrong ? { scale: [1, 1.04, 1] } : {}}
                      transition={isActive ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                    >
                      {frogVisibleHere ? (
                        /* CORRECT: happy frog on pad (frogOnPad2) */
                        <motion.div
                          style={{ marginTop: -12 }}
                          initial={frogPopIn ? { scale: 0, opacity: 0 } : { scale: 0.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1, y: [0, -6, 0] }}
                          transition={{
                            scale: { type: 'spring', stiffness: 400, damping: 12 },
                            opacity: { duration: 0.2 },
                            y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
                          }}
                        >
                          <Sprite sprite="frogOnPad2" size={padSize + 10} />
                        </motion.div>
                      ) : isWrong ? (
                        /* WRONG: frogSitting replaces the pad entirely + green bubbles */
                        <motion.div
                          className="relative"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                        >
                          <Sprite sprite="frogSitting" size={padSize} />
                          <WaterBubbles />
                        </motion.div>
                      ) : (
                        /* NORMAL: lily pad with sound label */
                        <>
                          <Sprite
                            sprite={optIdx % 2 === 0 ? 'lilyPad' : 'lilyPad2'}
                            size={padSize}
                          />
                          {!isCompletedNonTarget && (
                            <span
                              className={`absolute font-black select-none z-10 ${
                                isActive ? 'text-white' : isCompleted ? 'text-white/60' : 'text-white/70'
                              }`}
                              style={{
                                fontSize: 'clamp(2.5rem, 9vw, 5rem)',
                                textShadow: '0 2px 6px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.2)',
                                top: '30%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              {sound.toLowerCase()}
                            </span>
                          )}
                          {isCompleted && isTarget && (
                            <div className="absolute -top-1 -right-1 bg-[#22c55e] rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center shadow-lg z-20">
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}

        {/* Start platform */}
        <div
          ref={frogStartRef}
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ top: `${totalGameHeight - BOTTOM_PADDING + 20}px` }}
        >
          {frogPadIndex === -1 && !frogHidden && (
            <motion.div
              className="z-30"
              style={{ marginBottom: -20 }}
              initial={frogPopIn ? { scale: 0, opacity: 0 } : false}
              animate={frogPopIn
                ? { scale: 1, opacity: 1, y: [0, -8, 0] }
                : { y: [0, -8, 0] }
              }
              transition={frogPopIn
                ? { scale: { type: 'spring', stiffness: 400, damping: 12 }, y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 } }
                : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              <Sprite sprite="frogOnPad" size={160} />
            </motion.div>
          )}
          {(frogPadIndex >= 0 || (frogPadIndex === -1 && frogHidden)) && (
            <div style={{ marginBottom: -10, opacity: 0.4 }}>
              <Sprite sprite="lilyPad" size={100} />
            </div>
          )}
          <span className="text-white/50 text-xs mt-2 font-bold tracking-wider">START</span>
        </div>
      </div>
    </div>
  );
};

const LilyPadHop = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return <LilyPadHopGame {...props} key={gameKey} onPlayAgain={() => setGameKey((k) => k + 1)} />;
};

export default LilyPadHop;
