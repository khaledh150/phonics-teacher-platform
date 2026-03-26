import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import Lottie from 'lottie-react';
import { Application, Graphics, Text, TextStyle, Container, Sprite as PixiSprite, Texture, Assets } from 'pixi.js';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import { SkyFullBackground } from '../themes/SkyBackground';

import dogBathingData from '../../assets/materials/dog-bathing-in-bathtub.json';

// Bubble PNG sprites
import bubble1Url from '../../assets/materials/ballons-bubbles/bubble-1.png';
import bubble2Url from '../../assets/materials/ballons-bubbles/bubble-2.png';
import bubble3Url from '../../assets/materials/ballons-bubbles/bubble-3.png';
import bubble4Url from '../../assets/materials/ballons-bubbles/bubble-4.png';
import bubble5Url from '../../assets/materials/ballons-bubbles/bubble-5.png';
import bubble6Url from '../../assets/materials/ballons-bubbles/bubble-6.png';
import bubble7Url from '../../assets/materials/ballons-bubbles/bubble-7.png';
import bubble8Url from '../../assets/materials/ballons-bubbles/bubble-8.png';

const WORDS_PER_ROUND = 5;
const BUBBLE_PNG_URLS = [
  bubble1Url, bubble2Url, bubble3Url, bubble4Url,
  bubble5Url, bubble6Url, bubble7Url, bubble8Url,
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
  const [instructionLock, setInstructionLock] = useState(true);

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
  const bubbleTexturesRef = useRef([]);
  const skyRef = useRef(null);
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
    }, 6000);
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
      setInstructionLock(false);
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
          resolution: 1,
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

        // Resize handler — keeps canvas resolution matched to container so bubbles don't stretch
        const resizeObserver = new ResizeObserver((entries) => {
          if (destroyedRef.current || !pixiAppRef.current) return;
          const entry = entries[0];
          if (!entry) return;
          const newW = Math.round(entry.contentRect.width);
          const newH = Math.round(entry.contentRect.height);
          if (newW > 0 && newH > 0) {
            pixiAppRef.current.renderer.resize(newW, newH);
          }
        });
        resizeObserver.observe(el);
        // Store for cleanup
        el._resizeObserver = resizeObserver;

        // Sky background handled by CSS gradient + DOM clouds/birds (behind transparent canvas)

        // Load bubble PNG textures via Assets.load (PixiJS v8)
        try {
          const texArr = await Promise.all(BUBBLE_PNG_URLS.map(url => Assets.load(url)));
          bubbleTexturesRef.current = texArr;
        } catch (e) { console.warn('Bubble textures failed:', e); }
        if (destroyedRef.current) { app.destroy(true); return; }

        // Compute bubble radius from canvas (1.5x bigger)
        // Bigger on phones (min 50), scales up on larger screens
        const bRadius = Math.min(Math.max(50, Math.min(w, h) * 0.09), 65);
        bubbleRadiusRef.current = bRadius;

        const TRAY_H = 80;
        // Dog Lottie occupies bottom ~25% — bubbles spawn from above the dog area
        const DOG_H_RATIO = 0.25;
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

            // Float upward + lateral drift, bounce off side walls
            b.x += b.vx * dt;
            b.y += b.vy * dt; // vy is negative (upward)

            // Bounce off side edges
            if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx); }
            if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }

            // If bubble floats above visible area, recycle — respawn from dog position
            if (b.y < -R * 2) {
              b.firstWave = false;
              b.y = cH * 0.78 + Math.random() * (cH * 0.05);
              b.x = cW * 0.3 + Math.random() * (cW * 0.4);
              b.growPhase = 0;
            }
            // Keep bubbles from sinking below play area
            if (b.y > maxY) { b.y = maxY; }

            // Growth phase — starts shortly after spawning
            const spawnZone = cH * 0.72;
            if (b.growPhase < 1) {
              if (b.y < spawnZone) {
                b.growPhase = Math.min(1, b.growPhase + 0.008 * dt);
              }
              const growScale = 0.3 + b.growPhase * 0.7;
              b.container.scale.set(growScale);
            }

            // Shimmer (gentle scale pulse)
            b.shimmerPhase += 0.025 * dt;
            const shimmerScale = 1 + Math.sin(b.shimmerPhase) * 0.025;
            if (b.growPhase >= 1) { b.container.scale.set(shimmerScale); }

            // Shake on wrong tap — red tint on sprite
            let shakeX = 0;
            if (b.shakeStart !== null) {
              const elapsed = performance.now() - b.shakeStart;
              if (elapsed < 500) {
                shakeX = Math.sin(elapsed * 0.05) * 8 * (1 - elapsed / 500);
                if (b.sprite) b.sprite.tint = 0xFF4444;
              } else {
                b.shakeStart = null;
                if (b.sprite) b.sprite.tint = 0xFFFFFF;
              }
            }

            b.container.x = b.x + shakeX;
            b.container.y = b.y;
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
      // Clean up resize observer
      if (el._resizeObserver) { el._resizeObserver.disconnect(); el._resizeObserver = null; }
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

    // Clear old bubbles and spawn timers
    if (bubblesRef.current._cleanupSpawnTimers) bubblesRef.current._cleanupSpawnTimers();
    bubblesRef.current.forEach((b) => {
      try { app.stage.removeChild(b.container); } catch (e) { /* */ }
      try { b.container.destroy({ children: true }); } catch (e) { /* */ }
    });
    bubblesRef.current = [];
    nextLetterIdxRef.current = 0;
    setSpelledLetters([]);
    setIsProcessing(false);

    const TRAY_H = 80;
    const playArea = h - TRAY_H;

    const wordLetters = currentWord.word.split('');
    const allLetters = [...wordLetters];

    // 3x distractors
    const distractorPool = group.sounds.filter((s) => s.length === 1 && !wordLetters.includes(s));
    const fallbackPool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !wordLetters.includes(c));
    const pool = [...distractorPool, ...fallbackPool.filter((c) => !distractorPool.includes(c))];
    const numDistractors = Math.max(12, wordLetters.length * 3);
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

    // Spawn bubbles one-by-one with stagger
    const R = bubbleRadiusRef.current;
    const spawnTimers = [];

    const spawnBubble = (letter, idx) => {
      if (destroyedRef.current || !pixiAppRef.current) return;
      const container = new Container();
      container.interactive = true;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // SVG bubble sprite
      let bubbleSprite = null;
      const textures = bubbleTexturesRef.current;
      if (textures.length > 0) {
        const tex = textures[idx % textures.length];
        bubbleSprite = new PixiSprite(tex);
        bubbleSprite.anchor.set(0.5);
        bubbleSprite.width = R * 2;
        bubbleSprite.height = R * 2;
        container.addChild(bubbleSprite);
      } else {
        const circle = new Graphics();
        circle.circle(0, 0, R);
        circle.fill({ color: 0x4ECDC4, alpha: 0.7 });
        container.addChild(circle);
      }

      // Hit area in local coords — must be large enough to compensate for scale-down during growth.
      // At minimum scale 0.3, pointer coords are divided by 0.3 (amplified ~3.3x),
      // so a tap at visual radius R maps to local ~R/0.3 = R*3.3. Use R*4 to be safe.
      const hitR = R * 4;
      container.hitArea = { contains: (x, y) => (x * x + y * y) <= hitR * hitR };

      const text = new Text({
        text: letter.toLowerCase(),
        style: new TextStyle({
          fontFamily: '"Fredoka", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: Math.max(R * 0.85, 24),
          fontWeight: '900',
          fill: '#3e366b',
          stroke: { color: '#ffffff', width: 3 },
          dropShadow: { color: 0xffffff, alpha: 0.5, blur: 2, distance: 0 },
        }),
      });
      text.anchor.set(0.5);
      container.addChild(text);

      // Spawn from behind the dog (bottom ~80% of canvas height)
      const startX = w * 0.3 + Math.random() * (w * 0.4);
      const startY = h * 0.78 + Math.random() * (h * 0.05);

      container.x = startX;
      container.y = startY;
      app.stage.addChild(container);

      const bubble = {
        id: idx,
        letter,
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.15 + Math.random() * 0.35),
        shimmerPhase: Math.random() * Math.PI * 2,
        popped: false,
        popScale: 1,
        shakeStart: null,
        growPhase: 0,
        firstWave: true,
        sprite: bubbleSprite,
        container,
      };

      container.on('pointertap', () => {
        handleBubbleTapRef.current?.(bubble);
      });

      bubblesRef.current.push(bubble);
    };

    // Stagger spawn: one bubble every 150ms
    allLetters.forEach((letter, idx) => {
      const timer = setTimeout(() => spawnBubble(letter, idx), idx * 150);
      spawnTimers.push(timer);
    });

    // Store timers for cleanup
    const cleanupTimers = () => spawnTimers.forEach(t => clearTimeout(t));
    bubblesRef.current._cleanupSpawnTimers = cleanupTimers;

    // Announce word
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
    if (instructionLock) return;
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
          setTransitioning(true);
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

      // Play "oops try again" on every wrong tap
      playVO('oops_try_again').catch(() => {});

      if (wrongTapCountRef.current >= 3) {
        wrongTapCountRef.current = 0;
        setIsProcessing(true);
        isProcessingRef.current = true;
        await delay(600);
        if (!mountedRef.current) return;
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#5BA3D9] to-[#87CEEB]">
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
          className="bg-[#2d1b69] border-t-4 border-[#FFD000] p-8 md:p-12 text-center max-w-md mx-4"
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
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16a34a', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
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
    <div className="h-screen w-screen overflow-hidden relative flex flex-col">
      {/* Sky background: blue sky + clouds + birds (all behind canvas) */}
      <SkyFullBackground />

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

      {/* Progress dots */}
      <div className="fixed top-4 right-14 md:right-16 z-[70] flex items-center gap-1.5">
        {roundWords.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < wordIndex
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === wordIndex
                ? 'bg-[#4ECDC4] w-3 h-3 ring-2 ring-[#4ECDC4]/40'
                : 'bg-white/40 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* PixiJS canvas area — transparent, bubbles only */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-[10]" style={{ maxWidth: '100vw', maxHeight: '100vh' }} />

      {/* Dog bathing Lottie — centered at bottom, behind spelling tray */}
      <div
        className="absolute z-[12] pointer-events-none flex justify-center"
        style={{
          bottom: 'clamp(20px, 3vh, 50px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'clamp(380px, 55vw, 500px)',
          height: 'clamp(310px, 44vw, 400px)',
          maxHeight: '40vh',
        }}
      >
        <Lottie
          animationData={dogBathingData}
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Spelling tray at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white/20 backdrop-blur-md border-t border-white/30 py-4 md:py-5 px-4">
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
                      : 'bg-white/40 text-[#3e366b]/50 border-2 border-dashed border-[#3e366b]/40'
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
