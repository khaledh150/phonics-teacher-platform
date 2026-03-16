import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const TOTAL_ROUNDS = 8;
const NUM_HOLES = 6;
const LETTER_VISIBLE_MS = 1500;
const SPAWN_INTERVAL_MS = 800;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Pick N random items (Fisher-Yates partial shuffle)
const pickRandom = (arr, n) => {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
};

// --- Web Audio SFX ---
let sharedCtx = null;
const getCtx = () => {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
};

const playWhackSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* silent */ }
};

const playWrongSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
};

const WhackASoundGame = ({ group, onBack, onPlayAgain }) => {
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [holes, setHoles] = useState(() =>
    Array.from({ length: NUM_HOLES }, () => ({ visible: false, letter: '', whacked: false, shaking: false }))
  );

  const mountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const holeTimersRef = useRef([]);
  const spawnIntervalRef = useRef(null);
  const targetSoundRef = useRef('');
  const holesRef = useRef(holes);
  const roundIndexRef = useRef(0);
  const correctShownRef = useRef(false);
  const cycleCountRef = useRef(0);

  // Build round targets from group sounds, cycling if needed
  const [roundTargets] = useState(() => {
    const sounds = group.sounds || [];
    const targets = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      targets.push(sounds[i % sounds.length]);
    }
    // Shuffle for variety
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    return targets;
  });

  const targetSound = roundTargets[roundIndex] || '';

  // Keep refs in sync
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { roundIndexRef.current = roundIndex; }, [roundIndex]);
  useEffect(() => { holesRef.current = holes; }, [holes]);
  useEffect(() => { targetSoundRef.current = targetSound; }, [targetSound]);

  // Get distractors (letters not matching the target)
  const getDistractorLetter = useCallback((target) => {
    const pool = ALPHABET.filter((l) => l !== target.toLowerCase());
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  // Clear all hole timers
  const clearAllHoleTimers = useCallback(() => {
    holeTimersRef.current.forEach((t) => clearTimeout(t));
    holeTimersRef.current = [];
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
  }, []);

  // Hide all holes
  const resetHoles = useCallback(() => {
    setHoles(Array.from({ length: NUM_HOLES }, () => ({
      visible: false, letter: '', whacked: false, shaking: false,
    })));
  }, []);

  // Show a letter in a random available hole
  const showLetterInHole = useCallback((letter) => {
    const current = holesRef.current;
    const available = [];
    for (let i = 0; i < NUM_HOLES; i++) {
      if (!current[i].visible) available.push(i);
    }
    if (available.length === 0) return;
    const idx = available[Math.floor(Math.random() * available.length)];

    setHoles((prev) => {
      const next = [...prev];
      next[idx] = { visible: true, letter, whacked: false, shaking: false };
      return next;
    });

    // Auto-hide after LETTER_VISIBLE_MS
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      setHoles((prev) => {
        const next = [...prev];
        if (next[idx].visible && next[idx].letter === letter && !next[idx].whacked) {
          next[idx] = { ...next[idx], visible: false };
        }
        return next;
      });
    }, LETTER_VISIBLE_MS);
    holeTimersRef.current.push(timer);
  }, []);

  // Start spawning letters for the current round
  const startSpawning = useCallback(() => {
    clearAllHoleTimers();
    resetHoles();
    correctShownRef.current = false;
    cycleCountRef.current = 0;

    const target = targetSoundRef.current;

    spawnIntervalRef.current = setInterval(() => {
      if (!mountedRef.current || isProcessingRef.current) return;
      cycleCountRef.current += 1;

      // Don't allow correct letter in first 2 cycles — show distractors first
      const pastEarlyCycles = cycleCountRef.current > 2;
      // Guarantee the correct letter appears every 2-3 cycles (after early cycles)
      const shouldShowCorrect = pastEarlyCycles && (!correctShownRef.current || cycleCountRef.current % 3 === 0);

      if (shouldShowCorrect && Math.random() < 0.6) {
        showLetterInHole(target);
        correctShownRef.current = true;
      } else {
        // Show a distractor
        showLetterInHole(getDistractorLetter(target));
      }

      // Sometimes show a second letter for more action
      if (Math.random() < 0.4) {
        const timer = setTimeout(() => {
          if (!mountedRef.current || isProcessingRef.current) return;
          if (Math.random() < 0.3 && !correctShownRef.current) {
            showLetterInHole(target);
            correctShownRef.current = true;
          } else {
            showLetterInHole(getDistractorLetter(target));
          }
        }, 400);
        holeTimersRef.current.push(timer);
      }

      // Force correct letter if it hasn't appeared in 4 cycles (but not in first 2)
      if (cycleCountRef.current >= 4 && pastEarlyCycles && !correctShownRef.current) {
        const forceTimer = setTimeout(() => {
          if (!mountedRef.current || isProcessingRef.current) return;
          showLetterInHole(target);
          correctShownRef.current = true;
        }, 200);
        holeTimersRef.current.push(forceTimer);
      }
    }, SPAWN_INTERVAL_MS);
  }, [clearAllHoleTimers, resetHoles, showLetterInHole, getDistractorLetter]);

  // Idle reminder
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Where did it go..Whack the sound!');
      if (!mountedRef.current) return;
      await delay(300);
      if (!mountedRef.current) return;
      await playLetterSound(targetSoundRef.current).catch(() => {});
    }, 8000);
  }, []);

  // Play round intro VO
  const playRoundIntro = useCallback(async () => {
    await playVO('Whack the letter that makes the sound...');
    if (!mountedRef.current) return;
    await delay(300);
    if (!mountedRef.current) return;
    await playLetterSound(targetSoundRef.current).catch(() => {});
    if (!mountedRef.current) return;
    startIdleReminder();
    startSpawning();
  }, [startIdleReminder, startSpawning]);

  // Mount + first round
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const run = async () => {
      await delay(500);
      if (cancelled) return;
      await playRoundIntro();
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
      clearAllHoleTimers();
    };
  }, []);

  // Handle round changes (after first)
  useEffect(() => {
    if (roundIndex === 0) return;
    if (gameComplete) return;
    let cancelled = false;
    const run = async () => {
      resetHoles();
      await delay(600);
      if (cancelled || !mountedRef.current) return;
      await playRoundIntro();
    };
    run();
    return () => { cancelled = true; };
  }, [roundIndex]);

  // Handle whacking a hole
  const handleWhack = useCallback(async (holeIndex) => {
    if (isProcessingRef.current) return;
    const hole = holesRef.current[holeIndex];
    if (!hole.visible || hole.whacked) return;

    clearTimeout(idleRef.current);
    const target = targetSoundRef.current;

    if (hole.letter.toLowerCase() === target.toLowerCase()) {
      // CORRECT
      setIsProcessing(true);
      isProcessingRef.current = true;
      clearAllHoleTimers();

      // Squish animation
      setHoles((prev) => {
        const next = [...prev];
        next[holeIndex] = { ...next[holeIndex], whacked: true };
        return next;
      });

      playWhackSfx();
      triggerSmallBurst();

      await delay(400);
      if (!mountedRef.current) return;

      await playEncouragement();
      if (!mountedRef.current) return;

      setScore((s) => s + 1);

      await delay(400);
      if (!mountedRef.current) return;

      const nextRound = roundIndexRef.current + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        // Game complete
        triggerCelebration();
        await playVO('Great job!');
        if (!mountedRef.current) return;
        setGameComplete(true);
      } else {
        setIsProcessing(false);
        isProcessingRef.current = false;
        setRoundIndex(nextRound);
      }
    } else {
      // WRONG
      setHoles((prev) => {
        const next = [...prev];
        next[holeIndex] = { ...next[holeIndex], shaking: true };
        return next;
      });
      playWrongSfx();

      // Clear shaking after animation
      const shakeTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        setHoles((prev) => {
          const next = [...prev];
          if (next[holeIndex]) {
            next[holeIndex] = { ...next[holeIndex], shaking: false };
          }
          return next;
        });
      }, 500);
      holeTimersRef.current.push(shakeTimer);

      setIsProcessing(true);
      isProcessingRef.current = true;
      await playVO('Oops, try again!');
      if (!mountedRef.current) return;
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    }
  }, [clearAllHoleTimers, startIdleReminder]);

  // Confetti rain on results
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

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    holeTimersRef.current.forEach((t) => clearTimeout(t));
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    onBack();
  };

  // --- RESULTS SCREEN ---
  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#F59E0B]">
        <motion.button
          onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] p-8 md:p-12 text-center max-w-md mx-4"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span
            className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🔨⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#F59E0B] mb-2">
            Whack Master!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You found all the sounds!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#F59E0B] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #D97706', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
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

  // --- GAME SCREEN ---
  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-gradient-to-b from-[#1a1147] to-[#6B3FA0]">
      {/* Back + Fullscreen buttons */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button
          onClick={handleBack}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.button
          onClick={toggleFullscreen}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          title="Toggle Fullscreen"
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* Progress dots */}
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-1.5">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < roundIndex
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === roundIndex
                ? 'bg-[#F59E0B] w-3 h-3 ring-2 ring-[#F59E0B]/40'
                : 'bg-white/20 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* Target sound display */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[60]">
        <motion.div
          className="bg-white/10 backdrop-blur-sm px-6 py-2 rounded-2xl flex items-center gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          key={roundIndex}
        >
          <span className="text-white/70 text-sm font-bold">Find:</span>
          <span className="text-3xl md:text-4xl font-black text-[#FFD000] uppercase">
            {targetSound}
          </span>
        </motion.div>
      </div>

      {/* Game area */}
      {/* Game area */}
      <div className="flex-1 flex flex-col items-center justify-center pt-20">
        {/* Holes grid: 3x2 */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-3 md:gap-x-8 md:gap-y-5 lg:gap-x-12 lg:gap-y-7">
          {holes.map((hole, holeIndex) => (
            <div key={holeIndex} className="relative w-28 h-24 md:w-36 md:h-32 lg:w-44 lg:h-36">
              {/* The popping letter */}
              <AnimatePresence>
                {hole.visible && !hole.whacked && (
                  <motion.button
                    initial={{ y: 40, opacity: 0 }}
                    animate={
                      hole.shaking
                        ? { y: -10, opacity: 1, x: [0, -6, 6, -4, 4, 0] }
                        : { y: -10, opacity: 1 }
                    }
                    exit={{ y: 40, opacity: 0 }}
                    transition={
                      hole.shaking
                        ? { x: { duration: 0.4 }, y: { type: 'spring', stiffness: 400, damping: 15 } }
                        : { type: 'spring', stiffness: 400, damping: 15 }
                    }
                    onClick={() => handleWhack(holeIndex)}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-white flex items-center justify-center font-black text-3xl md:text-4xl lg:text-5xl text-[#3e366b] z-10 uppercase cursor-pointer select-none active:scale-95"
                    style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}
                  >
                    {hole.letter}
                  </motion.button>
                )}
                {hole.whacked && (
                  <motion.div
                    initial={{ scaleY: 1, scaleX: 1 }}
                    animate={{ scaleY: 0.5, scaleX: 1.3, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-[#22C55E] flex items-center justify-center font-black text-3xl md:text-4xl lg:text-5xl text-white z-10 uppercase"
                    style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}
                  >
                    {hole.letter}
                  </motion.div>
                )}
              </AnimatePresence>
              {/* The hole */}
              <div className="absolute bottom-0 w-full h-10 md:h-12 lg:h-14 bg-[#2a1a5e] rounded-[50%]" />
            </div>
          ))}
        </div>
      </div>

      {/* Green grass at very bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-0">
        <div className="h-12 md:h-16 bg-gradient-to-b from-[#22C55E] to-[#16A34A] rounded-t-[2rem]" />
        <div className="h-8 md:h-10 bg-[#16A34A]" />
      </div>
    </div>
  );
};

// Key-based remount wrapper
const WhackASound = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <WhackASoundGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default WhackASound;
