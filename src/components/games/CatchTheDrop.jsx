import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize } from 'lucide-react';
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../../utils/confetti';
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
const CATCHES_PER_ROUND = 6;
const SPAWN_INTERVAL_MS = 900;
const CORRECT_CHANCE = 0.4;

const ITEM_COLORS = [
  '#ffffff', '#F0F4FF', '#FFF8E1', '#F0FFF4', '#FFF0F5',
  '#F5F0FF', '#E8F8F5', '#FEF9E7',
];

const DISTRACTOR_WORDS = [
  'big', 'red', 'fun', 'hot', 'cup', 'leg', 'van', 'zip',
  'box', 'yam', 'wet', 'jog', 'hug', 'mix', 'dot', 'wig',
  'bug', 'pen', 'map', 'log', 'dig', 'net', 'rub', 'fox',
];

// Fisher-Yates partial shuffle
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

const playCatchSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) { /* silent */ }
};

const playWrongCatchSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
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
const CatchTheDropGame = ({ group, onBack, onPlayAgain }) => {
  const [roundIndex, setRoundIndex] = useState(0);
  const [caughtCount, setCaughtCount] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [pixiReady, setPixiReady] = useState(false);
  const [targetSound, setTargetSound] = useState('');
  const [instructionLock, setInstructionLock] = useState(true);

  const containerRef = useRef(null);
  const appRef = useRef(null);
  const instructionLockRef = useRef(true);
  const wagonRef = useRef(null);
  const itemsRef = useRef([]);
  const mountedRef = useRef(true);
  const destroyedRef = useRef(false);
  const idleRef = useRef(null);
  const spawnIntervalRef = useRef(null);
  const roundIndexRef = useRef(0);
  const caughtCountRef = useRef(0);
  const targetSoundRef = useRef('');
  const pausedRef = useRef(false);
  const wagonShakeRef = useRef(null);
  const wagonRedRef = useRef(false);
  const wagonBodyRef = useRef(null);
  const speedMultRef = useRef(1);

  // Build round sounds from group
  const [roundSounds] = useState(() => {
    const sounds = group.sounds || [];
    if (sounds.length >= TOTAL_ROUNDS) return pickRandom(sounds, TOTAL_ROUNDS);
    // If fewer sounds than rounds, cycle through them
    const result = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      result.push(sounds[i % sounds.length]);
    }
    return result;
  });

  // Keep refs in sync
  useEffect(() => { roundIndexRef.current = roundIndex; }, [roundIndex]);
  useEffect(() => { caughtCountRef.current = caughtCount; }, [caughtCount]);
  useEffect(() => { targetSoundRef.current = targetSound; }, [targetSound]);
  useEffect(() => { instructionLockRef.current = instructionLock; }, [instructionLock]);

  // Get words starting with a sound
  const getWordsForSound = useCallback((sound) => {
    const s = sound.toLowerCase();
    return (group.words || [])
      .map((w) => w.word)
      .filter((word) => word.toLowerCase().startsWith(s));
  }, [group.words]);

  // Get distractor words (don't start with the target sound)
  const getDistractorWords = useCallback((sound) => {
    const s = sound.toLowerCase();
    const groupWords = (group.words || [])
      .map((w) => w.word)
      .filter((word) => !word.toLowerCase().startsWith(s));
    const extras = DISTRACTOR_WORDS.filter((w) => !w.startsWith(s));
    return [...groupWords, ...extras];
  }, [group.words]);

  // Idle reminder
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Catch the items that start with the sound...');
      if (!mountedRef.current) return;
      await delay(300);
      if (!mountedRef.current) return;
      await playLetterSound(targetSoundRef.current).catch(() => {});
    }, 10000);
  }, []);

  // Play round intro VO
  const playRoundIntro = useCallback(async (sound) => {
    pausedRef.current = true;
    await playVO('Catch the items that start with the sound...');
    if (!mountedRef.current) return;
    await delay(300);
    if (!mountedRef.current) return;
    await playLetterSound(sound).catch(() => {});
    if (!mountedRef.current) return;
    await delay(500);
    if (!mountedRef.current) return;
    await playVO('Move the wagon to catch them!');
    if (!mountedRef.current) return;
    pausedRef.current = false;
    startIdleReminder();
  }, [startIdleReminder]);

  // Handle catching an item (called from ticker context via ref)
  const handleCatchRef = useRef(null);
  handleCatchRef.current = async (item, index) => {
    if (!mountedRef.current) return;
    clearTimeout(idleRef.current);

    // Remove item from stage and array
    const app = appRef.current;
    if (app && item.graphics.parent) {
      app.stage.removeChild(item.graphics);
    }
    const idx = itemsRef.current.indexOf(item);
    if (idx !== -1) itemsRef.current.splice(idx, 1);

    if (item.isCorrect) {
      playCatchSfx();
      // Flash green effect
      item.graphics.destroy({ children: true });

      const newCount = caughtCountRef.current + 1;
      caughtCountRef.current = newCount;
      setCaughtCount(newCount);

      triggerSmallBurst();
      await playEncouragement();
      if (!mountedRef.current) return;

      if (newCount >= CATCHES_PER_ROUND) {
        // Round complete - advance
        pausedRef.current = true;
        clearInterval(spawnIntervalRef.current);

        // Clear remaining items
        itemsRef.current.forEach((it) => {
          if (appRef.current && it.graphics.parent) {
            appRef.current.stage.removeChild(it.graphics);
          }
          it.graphics.destroy({ children: true });
        });
        itemsRef.current = [];

        await delay(600);
        if (!mountedRef.current) return;

        const nextRound = roundIndexRef.current + 1;
        if (nextRound >= TOTAL_ROUNDS || nextRound >= roundSounds.length) {
          // Game complete
          triggerCelebration();
          await playVO('Great job!');
          if (!mountedRef.current) return;
          setGameComplete(true);
        } else {
          // Next round
          roundIndexRef.current = nextRound;
          caughtCountRef.current = 0;
          speedMultRef.current = 1 + nextRound * 0.1;
          setRoundIndex(nextRound);
          setCaughtCount(0);

          const nextSound = roundSounds[nextRound];
          targetSoundRef.current = nextSound;
          setTargetSound(nextSound);

          await playRoundIntro(nextSound);
          if (!mountedRef.current) return;
          startSpawning();
        }
      } else {
        startIdleReminder();
      }
    } else {
      // Wrong catch
      playWrongCatchSfx();
      item.graphics.destroy({ children: true });

      // Shake the wagon + red tint
      if (wagonRef.current) {
        wagonShakeRef.current = performance.now();
        wagonRedRef.current = true;
        if (wagonBodyRef.current) wagonBodyRef.current.tint = 0xFF4444;
      }

      // Deduct progress
      const newCount = Math.max(0, caughtCountRef.current - 1);
      caughtCountRef.current = newCount;
      setCaughtCount(newCount);

      // Play "Oops, try again!" VO (async, don't block)
      playVO('Oops, try again!').catch(() => {});

      startIdleReminder();
    }
  };

  // Start spawning items
  const startSpawning = useCallback(() => {
    clearInterval(spawnIntervalRef.current);
    spawnIntervalRef.current = setInterval(() => {
      if (destroyedRef.current || pausedRef.current) return;
      const app = appRef.current;
      if (!app) return;

      const w = app.screen.width;
      const sound = targetSoundRef.current;
      if (!sound) return;

      const correctWords = getWordsForSound(sound);
      const distractorWords = getDistractorWords(sound);

      if (correctWords.length === 0) return;

      const isCorrect = Math.random() < CORRECT_CHANCE;
      let word;
      if (isCorrect && correctWords.length > 0) {
        word = correctWords[Math.floor(Math.random() * correctWords.length)];
      } else if (distractorWords.length > 0) {
        word = distractorWords[Math.floor(Math.random() * distractorWords.length)];
      } else {
        word = correctWords[Math.floor(Math.random() * correctWords.length)];
      }

      const itemW = Math.max(100, Math.min(160, w * 0.2));
      const itemH = 55;

      const itemContainer = new Container();

      const bg = new Graphics();
      bg.roundRect(0, 0, itemW, itemH, 10);
      const color = ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)];
      bg.fill(color);
      bg.stroke({ color: 0xcccccc, width: 1.5, alpha: 0.5 });
      itemContainer.addChild(bg);

      const fontSize = Math.max(20, Math.min(32, w * 0.045));
      const text = new Text({
        text: word,
        style: new TextStyle({
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize,
          fontWeight: 'bold',
          fill: '#3e366b',
        }),
      });
      text.anchor.set(0.5);
      text.x = itemW / 2;
      text.y = itemH / 2;
      itemContainer.addChild(text);

      const spawnX = Math.random() * (w - itemW);
      itemContainer.x = spawnX;
      itemContainer.y = -50;

      app.stage.addChild(itemContainer);

      const speed = (1.5 + Math.random() * 0.8) * speedMultRef.current;
      itemsRef.current.push({
        graphics: itemContainer,
        word,
        isCorrect: isCorrect && correctWords.includes(word),
        speed,
        caught: false,
      });
    }, SPAWN_INTERVAL_MS);
  }, [getWordsForSound, getDistractorWords]);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let destroyed = false;
    mountedRef.current = true;
    destroyedRef.current = false;

    const init = async () => {
      try {
        await new Promise((r) => requestAnimationFrame(r));
        if (destroyed) return;

        const w = el.offsetWidth || window.innerWidth;
        const h = el.offsetHeight || window.innerHeight;

        const app = new Application();
        await app.init({
          width: w,
          height: h,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
        if (destroyed) { app.destroy(true); return; }

        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.position = 'absolute';
        app.canvas.style.top = '0';
        app.canvas.style.left = '0';
        el.appendChild(app.canvas);
        appRef.current = app;

        const screenW = app.screen.width;
        const screenH = app.screen.height;

        // Wagon dimensions
        const wagonWidth = Math.max(120, Math.min(200, screenW * 0.22));
        const wagonHeight = 65;
        const wheelRadius = 14;
        const wagonY = screenH - wagonHeight - 80;

        // Create wagon container
        const wagonContainer = new Container();

        // Wagon body
        const body = new Graphics();
        body.roundRect(0, 0, wagonWidth, wagonHeight - wheelRadius, 12);
        body.fill('#FFD000');
        body.stroke({ color: 0xE0B800, width: 3 });
        wagonContainer.addChild(body);
        wagonBodyRef.current = body;

        // Wagon interior accent
        const accent = new Graphics();
        accent.roundRect(4, 4, wagonWidth - 8, wagonHeight - wheelRadius - 8, 8);
        accent.fill({ color: 0xFFE44D, alpha: 0.5 });
        wagonContainer.addChild(accent);

        // Left wheel
        const leftWheel = new Graphics();
        leftWheel.circle(wagonWidth * 0.25, wagonHeight - wheelRadius, wheelRadius);
        leftWheel.fill('#8B4513');
        leftWheel.stroke({ color: 0x654321, width: 2 });
        leftWheel.circle(wagonWidth * 0.25, wagonHeight - wheelRadius, 3);
        leftWheel.fill('#654321');
        wagonContainer.addChild(leftWheel);

        // Right wheel
        const rightWheel = new Graphics();
        rightWheel.circle(wagonWidth * 0.75, wagonHeight - wheelRadius, wheelRadius);
        rightWheel.fill('#8B4513');
        rightWheel.stroke({ color: 0x654321, width: 2 });
        rightWheel.circle(wagonWidth * 0.75, wagonHeight - wheelRadius, 3);
        rightWheel.fill('#654321');
        wagonContainer.addChild(rightWheel);

        wagonContainer.x = screenW / 2 - wagonWidth / 2;
        wagonContainer.y = wagonY;
        app.stage.addChild(wagonContainer);
        wagonRef.current = wagonContainer;

        // Pointer events to move wagon
        app.canvas.addEventListener('pointermove', (e) => {
          if (instructionLockRef.current) return;
          if (!wagonRef.current || destroyedRef.current) return;
          const rect = app.canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * app.screen.width;
          wagonRef.current.x = Math.max(0, Math.min(x - wagonWidth / 2, app.screen.width - wagonWidth));
        });

        app.canvas.addEventListener('pointerdown', (e) => {
          if (instructionLockRef.current) return;
          if (!wagonRef.current || destroyedRef.current) return;
          const rect = app.canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * app.screen.width;
          wagonRef.current.x = Math.max(0, Math.min(x - wagonWidth / 2, app.screen.width - wagonWidth));
        });

        // Game loop
        app.ticker.add((ticker) => {
          if (destroyedRef.current || pausedRef.current) return;
          const dt = ticker.deltaTime;
          const wagon = wagonRef.current;
          if (!wagon) return;

          // Wagon shake effect
          let shakeOffsetY = 0;
          if (wagonShakeRef.current !== null) {
            const elapsed = performance.now() - wagonShakeRef.current;
            if (elapsed < 400) {
              shakeOffsetY = Math.sin(elapsed * 0.06) * 4 * (1 - elapsed / 400);
            } else {
              wagonShakeRef.current = null;
              if (wagonRedRef.current) {
                wagonRedRef.current = false;
                if (wagonBodyRef.current) wagonBodyRef.current.tint = 0xFFFFFF;
              }
            }
          }
          wagon.y = wagonY + shakeOffsetY;

          const wBounds = wagon.getBounds();
          const items = itemsRef.current;

          for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.caught) continue;

            item.graphics.y += item.speed * dt;

            // Check collision with wagon
            const iBounds = item.graphics.getBounds();
            if (
              iBounds.y + iBounds.height > wBounds.y &&
              iBounds.x + iBounds.width > wBounds.x &&
              iBounds.x < wBounds.x + wBounds.width &&
              iBounds.y < wBounds.y + wBounds.height
            ) {
              item.caught = true;
              handleCatchRef.current?.(item, i);
              continue;
            }

            // Remove if off screen
            if (item.graphics.y > app.screen.height + 60) {
              if (item.graphics.parent) app.stage.removeChild(item.graphics);
              item.graphics.destroy({ children: true });
              items.splice(i, 1);
            }
          }
        });

        setPixiReady(true);

        // Start first round
        const firstSound = roundSounds[0];
        targetSoundRef.current = firstSound;
        setTargetSound(firstSound);
      } catch (e) {
        console.error('PixiJS init failed:', e);
      }
    };

    init();

    return () => {
      destroyed = true;
      destroyedRef.current = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
      clearInterval(spawnIntervalRef.current);
      // Clean up items
      itemsRef.current.forEach((item) => {
        try { item.graphics.destroy({ children: true }); } catch (e) { /* silent */ }
      });
      itemsRef.current = [];
      if (appRef.current) {
        try { appRef.current.ticker.stop(); } catch (e) { /* silent */ }
        try { appRef.current.destroy(true); } catch (e) { /* silent */ }
      }
      appRef.current = null;
    };
  }, []);

  // Start game when pixi is ready
  useEffect(() => {
    if (!pixiReady || !targetSound) return;
    let cancelled = false;

    const run = async () => {
      await playRoundIntro(targetSound);
      if (cancelled || !mountedRef.current) return;
      setInstructionLock(false);
      instructionLockRef.current = false;
      startSpawning();
    };
    run();

    return () => { cancelled = true; };
    // Only run on initial pixi ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    clearInterval(spawnIntervalRef.current);
    destroyedRef.current = true;
    mountedRef.current = false;
    if (appRef.current) {
      try { appRef.current.ticker.stop(); } catch (e) { /* silent */ }
      try { appRef.current.destroy(true); } catch (e) { /* silent */ }
      appRef.current = null;
    }
    onBack();
  };

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

  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#22C55E]">
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
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🛒⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#22C55E] mb-2">
            Super Catcher!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You caught all the right sounds!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22C55E] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16A34A', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
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

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-[#1a1147]">
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
        {roundSounds.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < roundIndex
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === roundIndex
                ? 'bg-[#FFD000] w-3 h-3 ring-2 ring-[#FFD000]/40'
                : 'bg-white/40 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* Target sound display */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[60]">
        <motion.div
          key={targetSound}
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="bg-white/10 backdrop-blur-sm px-6 py-2 rounded-2xl flex items-center gap-3"
        >
          <span className="text-white/70 text-sm font-bold">Catch:</span>
          <span className="text-3xl font-black text-[#FFD000] uppercase">{targetSound}</span>
        </motion.div>
      </div>

      {/* Caught count indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]">
        <div className="bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-xl flex items-center gap-2">
          {Array.from({ length: CATCHES_PER_ROUND }).map((_, idx) => (
            <motion.div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all ${
                idx < caughtCount
                  ? 'bg-[#22C55E]'
                  : 'bg-white/20 border border-white/30'
              }`}
              animate={idx < caughtCount ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* PixiJS canvas container */}
      <div ref={containerRef} className="absolute inset-0 z-10" />
    </div>
  );
};

const CatchTheDrop = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <PixiErrorBoundary onBack={props.onBack}>
      <CatchTheDropGame
        {...props}
        key={gameKey}
        onPlayAgain={() => setGameKey((k) => k + 1)}
      />
    </PixiErrorBoundary>
  );
};

export default CatchTheDrop;
