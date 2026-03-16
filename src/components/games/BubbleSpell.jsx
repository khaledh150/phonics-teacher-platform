import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';

const WORDS_PER_ROUND = 5;

const BUBBLE_COLORS = [
  0x4ECDC4, 0xFF6B9D, 0xFFD000, 0x8B5CF6, 0x60A5FA,
  0x22C55E, 0xFF6600, 0xF59E0B, 0xE60023, 0x00B894,
];

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

const playPopSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    noise.connect(noiseGain); noiseGain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(100, ctx.currentTime);
    noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    noise.start(ctx.currentTime); noise.stop(ctx.currentTime + 0.1);
  } catch (e) { /* silent */ }
};

const playBoingSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch (e) { /* silent */ }
};

// --- Error boundary for PixiJS ---
class PixiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[#1a1147] text-white text-center p-8">
          <div>
            <p className="text-xl font-bold mb-2">Oops!</p>
            <p className="text-white/60">Something went wrong. Please try again.</p>
            <button
              onClick={this.props.onBack}
              className="mt-4 px-6 py-3 bg-[#FFD000] text-[#3e366b] font-bold rounded-full"
              style={{ borderBottom: '4px solid #E0B800' }}
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main Game Component ---
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const BubbleSpellGame = ({ group, onBack, onPlayAgain }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [spelledLetters, setSpelledLetters] = useState([]);
  const [gameComplete, setGameComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixiReady, setPixiReady] = useState(false);

  const canvasContainerRef = useRef(null);
  const pixiAppRef = useRef(null);
  const bubblesRef = useRef([]);
  const bubbleRadiusRef = useRef(38);
  const mountedRef = useRef(true);
  const destroyedRef = useRef(false);
  const nextLetterIdxRef = useRef(0);
  const isProcessingRef = useRef(false);
  const wordIndexRef = useRef(0);
  const idleRef = useRef(null);
  const spelledLettersRef = useRef([]);
  const wrongTapCountRef = useRef(0);
  const [transitioning, setTransitioning] = useState(false);

  const [roundWords] = useState(() => pickRandom(group.words, WORDS_PER_ROUND));
  const currentWord = roundWords[wordIndex];
  const letters = currentWord ? currentWord.word.split('') : [];

  // Keep refs in sync
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { wordIndexRef.current = wordIndex; }, [wordIndex]);
  useEffect(() => { spelledLettersRef.current = spelledLetters; }, [spelledLetters]);

  const handleBubbleTapRef = useRef(null);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      const w = roundWords[wordIndexRef.current];
      if (w) {
        await playVO('Pop the bubbles to spell the word!');
        if (!mountedRef.current) return;
        await delay(100);
        if (!mountedRef.current) return;
        await speakAsync(w.word, { rate: 0.85 });
      }
    }, 10000);
  }, [roundWords]);

  // Replay target word via speaker button
  const handleReplayWord = useCallback(() => {
    const w = roundWords[wordIndexRef.current];
    if (w) speakAsync(w.word, { rate: 0.85 });
    clearTimeout(idleRef.current);
    startIdleReminder();
  }, [roundWords, startIdleReminder]);

  // VO on mount
  useEffect(() => {
    mountedRef.current = true;
    destroyedRef.current = false;
    let cancelled = false;
    const run = async () => {
      await playVO('Pop the bubbles to spell the word!');
      if (cancelled) return;
      await delay(100);
      if (cancelled) return;
      if (currentWord) await speakAsync(currentWord.word, { rate: 0.85 });
      if (cancelled) return;
      startIdleReminder();
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
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const el = canvasContainerRef.current;

    const init = async () => {
      try {
        await new Promise((r) => requestAnimationFrame(r));
        if (destroyedRef.current) return;

        const w = el.offsetWidth || window.innerWidth;
        const h = el.offsetHeight || (window.innerHeight * 0.65);

        const app = new Application();
        await app.init({
          width: w,
          height: h,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
        if (destroyedRef.current) { app.destroy(true); return; }

        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.position = 'absolute';
        app.canvas.style.top = '0';
        app.canvas.style.left = '0';
        el.appendChild(app.canvas);
        pixiAppRef.current = app;

        // Compute bubble radius from canvas (1.5x bigger)
        const bRadius = Math.min(Math.max(50, Math.min(w, h) * 0.1), 72);
        bubbleRadiusRef.current = bRadius;

        const TRAY_H = 80;
        app.ticker.add((ticker) => {
          const dt = ticker.deltaTime;
          const cW = app.screen.width;
          const cH = app.screen.height;
          const R = bubbleRadiusRef.current;
          const maxY = cH - TRAY_H - R;
          const minY = R + 10;
          const minX = R + 5;
          const maxX = cW - R - 5;
          const bubbles = bubblesRef.current;

          for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];

            // Pop animation
            if (b.popped) {
              b.popScale -= 0.08 * dt;
              if (b.popScale <= 0) {
                try { app.stage.removeChild(b.container); } catch (e) { /* */ }
                try { b.container.destroy({ children: true }); } catch (e) { /* */ }
                bubbles.splice(i, 1);
                continue;
              }
              b.container.scale.set(b.popScale);
              b.container.alpha = b.popScale;
              continue;
            }

            // Straight-line drift, bounce off walls
            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Bounce off edges (reflect velocity)
            if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy); }
            if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy); }
            if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx); }
            if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }

            // Shimmer (gentle scale pulse)
            b.shimmerPhase += 0.025 * dt;
            const shimmerScale = 1 + Math.sin(b.shimmerPhase) * 0.025;

            // Shake on wrong tap
            let shakeX = 0;
            if (b.shakeStart !== null) {
              const elapsed = performance.now() - b.shakeStart;
              if (elapsed < 400) {
                shakeX = Math.sin(elapsed * 0.05) * 6 * (1 - elapsed / 400);
              } else {
                b.shakeStart = null;
              }
            }

            b.container.x = b.x + shakeX;
            b.container.y = b.y;
            b.container.scale.set(shimmerScale);
          }
        });

        setPixiReady(true);
      } catch (e) {
        console.error('PixiJS init failed:', e);
      }
    };

    init();

    return () => {
      destroyedRef.current = true;
      const pixiApp = pixiAppRef.current;
      if (pixiApp) {
        try { pixiApp.ticker.stop(); } catch (e) { /* silent */ }
        try { pixiApp.destroy(true); } catch (e) { /* silent */ }
      }
      bubblesRef.current.forEach((b) => {
        try { b.container.destroy({ children: true }); } catch (e) { /* silent */ }
      });
      bubblesRef.current = [];
      pixiAppRef.current = null;
    };
  }, []);

  // Spawn bubbles when word changes AND pixi is ready
  useEffect(() => {
    if (!pixiReady || !pixiAppRef.current || !currentWord) return;
    const app = pixiAppRef.current;
    const w = app.screen.width;
    const h = app.screen.height;
    if (w === 0 || h === 0) return;

    // Clear old bubbles
    bubblesRef.current.forEach((b) => {
      try { app.stage.removeChild(b.container); } catch (e) { /* */ }
      try { b.container.destroy({ children: true }); } catch (e) { /* */ }
    });
    bubblesRef.current = [];
    nextLetterIdxRef.current = 0;
    setSpelledLetters([]);
    setIsProcessing(false);

    const TRAY_H = 80;
    const playArea = h - TRAY_H; // usable height above tray

    const wordLetters = currentWord.word.split('');
    const allLetters = [...wordLetters];

    // 3x distractors: ~12-18 extra letters for a busy, fun screen
    const distractorPool = group.sounds.filter((s) => s.length === 1 && !wordLetters.includes(s));
    const fallbackPool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !wordLetters.includes(c));
    const pool = [...distractorPool, ...fallbackPool.filter((c) => !distractorPool.includes(c))];
    const numDistractors = Math.max(12, wordLetters.length * 3);
    // Allow duplicate distractor letters so we can fill the count
    const distractors = [];
    for (let d = 0; d < numDistractors; d++) {
      distractors.push(pool[d % pool.length]);
    }
    allLetters.push(...distractors);

    // Shuffle
    for (let i = allLetters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]];
    }

    // Spawn each bubble at a random position within the play area
    const R = bubbleRadiusRef.current;
    const fontSize = Math.max(R * 0.6, 20);

    allLetters.forEach((letter, idx) => {
      const container = new Container();
      container.interactive = true;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      const gfx = new Graphics();
      const color = BUBBLE_COLORS[idx % BUBBLE_COLORS.length];
      gfx.circle(0, 0, R);
      gfx.fill({ color, alpha: 0.7 });
      gfx.circle(-R * 0.25, -R * 0.25, R * 0.3);
      gfx.fill({ color: 0xffffff, alpha: 0.35 });
      gfx.circle(0, 0, R);
      gfx.stroke({ color: 0xffffff, width: 1.5, alpha: 0.25 });
      container.addChild(gfx);

      const text = new Text({
        text: letter.toUpperCase(),
        style: new TextStyle({
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize,
          fontWeight: 'bold',
          fill: 0xffffff,
        }),
      });
      text.anchor.set(0.5);
      container.addChild(text);

      // Random position across full play area
      const startX = R + 10 + Math.random() * (w - R * 2 - 20);
      const startY = R + 10 + Math.random() * (playArea - R * 2 - 20);

      container.x = startX;
      container.y = startY;
      app.stage.addChild(container);

      const bubble = {
        id: idx,
        letter,
        x: startX,
        y: startY,
        // Velocity: random direction
        vx: (Math.random() - 0.5) * 1.4,
        vy: (Math.random() - 0.5) * 1.4,
        // Visual
        shimmerPhase: Math.random() * Math.PI * 2,
        popped: false,
        popScale: 1,
        shakeStart: null,
        container,
      };

      container.on('pointertap', () => {
        handleBubbleTapRef.current?.(bubble);
      });

      bubblesRef.current.push(bubble);
    });

    // Announce word — same VO + dictation sequence as first round
    if (wordIndex > 0) {
      const announceWord = async () => {
        await delay(400);
        if (!mountedRef.current) return;
        await playVO('Pop the bubbles to spell the word!');
        if (!mountedRef.current) return;
        await delay(100);
        if (!mountedRef.current) return;
        await speakAsync(currentWord.word, { rate: 0.85 });
        if (!mountedRef.current) return;
        startIdleReminder();
      };
      announceWord();
    }
  }, [pixiReady, wordIndex, currentWord, group.sounds, startIdleReminder]);

  // Bubble tap handler
  handleBubbleTapRef.current = async (bubble) => {
    if (bubble.popped || isProcessingRef.current) return;
    clearTimeout(idleRef.current);

    const currentLetters = roundWords[wordIndexRef.current]?.word.split('') || [];
    const expectedLetter = currentLetters[nextLetterIdxRef.current];

    if (bubble.letter === expectedLetter) {
      setIsProcessing(true);
      isProcessingRef.current = true;
      bubble.popped = true;
      bubble.popScale = 1;
      playPopSfx();
      await playLetterSound(bubble.letter).catch(() => {});

      const newSpelled = [...spelledLettersRef.current, bubble.letter];
      setSpelledLetters(newSpelled);
      nextLetterIdxRef.current += 1;

      if (nextLetterIdxRef.current >= currentLetters.length) {
        wrongTapCountRef.current = 0;
        await delay(400);
        if (!mountedRef.current) return;
        triggerSmallBurst();
        const w = roundWords[wordIndexRef.current];
        if (w) await speakAsync(w.word, { rate: 0.85 });
        if (!mountedRef.current) return;
        await playEncouragement();
        if (!mountedRef.current) return;
        await delay(800);
        if (!mountedRef.current) return;

        if (wordIndexRef.current < roundWords.length - 1) {
          // Transition: fade out remaining bubbles, then spawn new word
          setTransitioning(true);
          // Animate all remaining bubbles shrinking away
          const remaining = bubblesRef.current.filter((bb) => !bb.popped);
          remaining.forEach((bb) => { bb.popped = true; bb.popScale = 1; });
          await delay(600);
          if (!mountedRef.current) return;
          setTransitioning(false);
          setWordIndex((prev) => prev + 1);
        } else {
          triggerCelebration();
          await playVO('Great job!');
          if (!mountedRef.current) return;
          setGameComplete(true);
        }
      } else {
        setIsProcessing(false);
        isProcessingRef.current = false;
        startIdleReminder();
      }
    } else {
      playBoingSfx();
      bubble.shakeStart = performance.now();
      wrongTapCountRef.current += 1;

      // After 2+ wrong taps, play hint VO + dictation
      if (wrongTapCountRef.current >= 2) {
        wrongTapCountRef.current = 0;
        setIsProcessing(true);
        isProcessingRef.current = true;
        await playVO('Pop the bubbles to spell the word!');
        if (!mountedRef.current) return;
        const w = roundWords[wordIndexRef.current];
        if (w) await speakAsync(w.word, { rate: 0.85 });
        if (!mountedRef.current) return;
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
      startIdleReminder();
    }
  };

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#4ECDC4]">
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
            animate={{ y: [0, -8, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🫧⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#4ECDC4] mb-2">
            Spelling Star!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You spelled all the words!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#4ECDC4] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #38B2AC', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white font-bold text-sm md:text-base"
              style={{ borderRadius: '1.6rem', borderBottom: '4px solid rgba(255,255,255,0.1)' }}
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

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-gradient-to-b from-[#0d1b3e] to-[#1a3a5c]">
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

      {/* Speaker button — top right */}
      <motion.button
        onClick={handleReplayWord}
        className="fixed top-3 right-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#6B3FA0]"
        style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
        whileTap={{ scale: 0.95, y: 3 }}
        whileHover={{ scale: 1.1 }}
      >
        <Volume2 className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white" />
      </motion.button>

      {/* Progress dots — next to speaker */}
      <div className="fixed top-4 right-14 md:right-16 z-[70] flex items-center gap-1.5">
        {roundWords.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < wordIndex
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === wordIndex
                ? 'bg-[#4ECDC4] w-3 h-3 ring-2 ring-[#4ECDC4]/40'
                : 'bg-white/20 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* PixiJS canvas area */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-10" />

      {/* Spelling tray at bottom — solid, above canvas */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#0d1b3e] border-t-2 border-[#4ECDC4]/30 py-4 md:py-5 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={wordIndex}
            className="flex items-center justify-center gap-2 md:gap-3"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {letters.map((letter, idx) => {
              const isSpelled = idx < spelledLetters.length;
              return (
                <motion.div
                  key={idx}
                  className={`w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center text-xl md:text-2xl lg:text-3xl font-black uppercase ${
                    isSpelled
                      ? 'bg-[#4ECDC4] text-white'
                      : 'bg-white/10 text-white/20 border-2 border-dashed border-white/20'
                  }`}
                  style={isSpelled ? {
                    borderBottom: '4px solid #38B2AC',
                    boxShadow: '0px 4px 0px rgba(0,0,0,0.12)',
                  } : {}}
                  initial={isSpelled ? { scale: 0, rotate: -20 } : {}}
                  animate={isSpelled ? { scale: 1, rotate: 0 } : {}}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  {isSpelled ? spelledLetters[idx] : '?'}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const BubbleSpell = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <PixiErrorBoundary onBack={props.onBack}>
      <BubbleSpellGame {...props} key={gameKey} onPlayAgain={() => setGameKey((k) => k + 1)} />
    </PixiErrorBoundary>
  );
};

export default BubbleSpell;
