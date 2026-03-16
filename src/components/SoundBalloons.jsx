import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { playLetterSound, getLetterSoundUrl } from '../utils/letterSounds';
import { speakWithVoice } from '../utils/speech';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../utils/confetti';

// Cycling encouragement for balloon pops
const POP_ENCOURAGEMENTS = [
  'Pop!', 'Wow', 'Nice', 'Super', 'Amazing', 'Keep popping!',
  'Wow, look at them go!', 'Amazing job!',
];
let popEncIdx = 0;
const playPopEncouragement = () => {
  const vo = POP_ENCOURAGEMENTS[popEncIdx % POP_ENCOURAGEMENTS.length];
  popEncIdx++;
  return playVO(vo);
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

const playBoing = () => {
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

const playPopSound = () => {
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

const playCountdownTick = (isGo) => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    if (isGo) {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) { /* silent */ }
};

// --- Constants ---
const BALLOON_COLORS = [
  0xFF1E56, 0x00C9A7, 0xFFD000, 0xFF6600, 0x8B00FF,
  0x0080FF, 0xE60023, 0x00CC44, 0xFF9500, 0x00B894,
];
const TIME_PER_SOUND = 30;

const ALL_SOUNDS = [
  's', 'a', 't', 'i', 'p', 'n', 'e', 'h', 'r', 'm', 'd',
  'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'x', 'y', 'c', 'k',
  'ai', 'ay', 'a-e', 'oa', 'ow', 'o-e', 'ie', 'igh', 'i-e',
  'ee', 'ea', 'e-e', 'ue', 'ew', 'u-e', 'ch', 'sh', 'th', 'ng', 'qu',
  'or', 'al', 'au', 'aw', 'er', 'ir', 'ur', 'ar', 'oi', 'oy', 'ou', 'oo',
];

let balloonIdCounter = 0;

// Draw a balloon shape into a Graphics object
const drawBalloon = (g, color, r, ry) => {
  g.clear();
  // Body
  g.ellipse(0, 0, r, ry);
  g.fill({ color, alpha: 0.92 });
  // Highlight
  g.ellipse(-r * 0.3, -ry * 0.35, r * 0.18, ry * 0.25);
  g.fill({ color: 0xffffff, alpha: 0.3 });
  // Knot
  g.moveTo(-5, ry - 2);
  g.lineTo(5, ry - 2);
  g.lineTo(0, ry + 10);
  g.closePath();
  g.fill({ color });
  // String
  g.moveTo(0, ry + 10);
  g.quadraticCurveTo(-4, ry + 25, 3, ry + 35);
  g.stroke({ color: 0x999999, width: 1.5 });
};

// --- Main Component ---
const SoundBalloons = ({ group, onComplete }) => {
  const [showResults, setShowResults] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);

  const [displayTargetIdx, setDisplayTargetIdx] = useState(0);
  const [displayTimeLeft, setDisplayTimeLeft] = useState(TIME_PER_SOUND);

  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const pixiAppRef = useRef(null);
  const balloonsRef = useRef([]); // Pure JS array, no React state
  const spawnIntervalRef = useRef(null);
  const timerRef = useRef(null);
  const soundScoresRef = useRef({});

  const targetIdxRef = useRef(0);
  const targetSoundRef = useRef(group.sounds[0]);
  const timeLeftRef = useRef(TIME_PER_SOUND);
  const gameOverRef = useRef(false);
  const transitioningRef = useRef(false);
  const gameStartedRef = useRef(false);

  const sounds = group.sounds;
  const idleReminderRef = useRef(null);

  const clearIdleReminder = useCallback(() => {
    clearTimeout(idleReminderRef.current);
  }, []);

  const announceSound = useCallback((sound) => {
    const url = getLetterSoundUrl(sound);
    if (url) {
      setTimeout(() => playLetterSound(sound).catch(() => {}), 300);
    } else {
      setTimeout(() => speakWithVoice(sound, { rate: 0.7 }), 300);
    }
  }, []);

  const announceWithVO = useCallback(async (sound) => {
    await playVO('Pop the balloons that make the sound...');
    announceSound(sound);
  }, [announceSound]);

  // Idle reminder
  const idleFirstRef = useRef(true);
  const startIdleReminderFnRef = useRef(null);
  startIdleReminderFnRef.current = () => {
    clearTimeout(idleReminderRef.current);
    const wait = idleFirstRef.current ? 5000 : 10000;
    idleReminderRef.current = setTimeout(async () => {
      if (gameOverRef.current || transitioningRef.current) return;
      idleFirstRef.current = false;
      await playVO('Pop the balloons that make the sound...');
      if (gameOverRef.current) return;
      announceSound(targetSoundRef.current);
      if (!gameOverRef.current && !transitioningRef.current) {
        startIdleReminderFnRef.current?.();
      }
    }, wait);
  };
  const startIdleReminder = useCallback((resetFirst) => {
    if (resetFirst) idleFirstRef.current = true;
    startIdleReminderFnRef.current?.();
  }, []);

  // Balloon tap handler (called from PixiJS, NOT React)
  const handleBalloonTapRef = useRef(null);
  handleBalloonTapRef.current = (balloon) => {
    if (balloon.popped) return;
    startIdleReminder(true);
    const currentTarget = targetSoundRef.current;
    if (balloon.sound === currentTarget) {
      playPopSound();
      playLetterSound(balloon.sound).catch(() => {});
      balloon.popped = true;
      balloon.popScale = 1;
      // Remove pixi objects with pop animation handled in ticker
      soundScoresRef.current[currentTarget] = (soundScoresRef.current[currentTarget] || 0) + 1;
      const total = Object.values(soundScoresRef.current).reduce((a, b) => a + b, 0);
      // Cycling encouragement every 3rd pop
      if (total % 3 === 0) playPopEncouragement();
    } else {
      playBoing();
      balloon.shakeStart = performance.now();
    }
  };

  // --- Initialize PixiJS Application (imperative, no React wrapper) ---
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const el = canvasContainerRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    let app;
    let destroyed = false;

    const init = async () => {
      try {
        app = new Application();
        await app.init({
          width: w,
          height: h,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });

        if (destroyed) { app.destroy(true); return; }

        // Style canvas
        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.position = 'absolute';
        app.canvas.style.top = '0';
        app.canvas.style.left = '0';
        el.appendChild(app.canvas);
        pixiAppRef.current = app;

        const stageW = w;
        const stageH = h;
        const balloonSize = Math.min(Math.max(110, stageW * 0.22), 180);

        // Main game loop — all balloon logic here, zero React state
        app.ticker.add((ticker) => {
          if (destroyed) return;
          const dt = Math.min(ticker.deltaTime, 4);
          const now = performance.now();
          const elapsed = now / 1000;
          const balloons = balloonsRef.current;

          for (let i = balloons.length - 1; i >= 0; i--) {
            const b = balloons[i];

            if (b.popped) {
              // Pop animation: scale down and fade
              b.popScale -= dt * 0.08;
              if (b.container) {
                b.container.scale.set(Math.max(b.popScale, 0));
                b.container.alpha = Math.max(b.popScale, 0);
              }
              if (b.popScale <= 0) {
                if (b.container) {
                  app.stage.removeChild(b.container);
                  b.container.destroy({ children: true });
                }
                balloons.splice(i, 1);
              }
              continue;
            }

            // Move up
            b.y -= b.speed * dt;
            const sway = Math.sin(elapsed + b.swayOffset) * b.swayAmp;
            b.currentX = b.x + sway;

            // Apply shake
            let shakeOffset = 0;
            if (b.shakeStart) {
              const shakeElapsed = now - b.shakeStart;
              if (shakeElapsed < 500) {
                shakeOffset = Math.sin(shakeElapsed * 0.04) * 14 * (1 - shakeElapsed / 500);
              } else {
                b.shakeStart = null;
              }
            }

            // Update pixi container position
            if (b.container) {
              b.container.x = b.currentX + shakeOffset;
              b.container.y = b.y;
            }

            // Remove if off-screen
            if (b.y < -balloonSize * 1.5) {
              if (b.container) {
                app.stage.removeChild(b.container);
                b.container.destroy({ children: true });
              }
              balloons.splice(i, 1);
            }
          }
        });

        // Expose spawn function
        pixiAppRef.current._spawnBalloon = () => {
          if (destroyed || gameOverRef.current) return;
          const active = balloonsRef.current.filter(b => !b.popped);
          if (active.length >= 18) return;

          const currentTarget = targetSoundRef.current;
          const isTarget = Math.random() < 0.6;
          let sound;
          if (isTarget) {
            sound = currentTarget;
          } else {
            const distractors = ALL_SOUNDS.filter(s => s !== currentTarget);
            sound = distractors[Math.floor(Math.random() * distractors.length)];
          }

          const colorIdx = Math.floor(Math.random() * BALLOON_COLORS.length);
          const color = BALLOON_COLORS[colorIdx];
          const r = balloonSize * 0.42;
          const ry = balloonSize * 0.48;

          // Create pixi container for this balloon
          const container = new Container();
          container.eventMode = 'static';
          container.cursor = 'pointer';

          // Draw balloon
          const gfx = new Graphics();
          drawBalloon(gfx, color, r, ry);
          container.addChild(gfx);

          // Add letter text
          const txt = new Text({
            text: sound,
            style: new TextStyle({
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: Math.max(balloonSize * 0.32, 22),
              fontWeight: 'bold',
              fill: 0xffffff,
              dropShadow: { color: 0x000000, alpha: 0.35, blur: 4, distance: 2 },
            }),
          });
          txt.anchor.set(0.5);
          txt.y = -6;
          container.addChild(txt);

          // Hit area - make it generous
          const hitGfx = new Graphics();
          hitGfx.circle(0, 0, Math.max(r, ry) + 10);
          hitGfx.fill({ color: 0xffffff, alpha: 0.001 });
          container.addChild(hitGfx);

          // Spread balloons across full screen width (margin from edges)
          const margin = balloonSize * 0.4;
          const bx = margin + Math.random() * (stageW - margin * 2);
          const by = stageH + 50;

          container.x = bx;
          container.y = by;

          const balloonData = {
            id: balloonIdCounter++,
            sound,
            colorIdx,
            x: bx,
            y: by,
            currentX: bx,
            speed: 0.9 + Math.random() * 0.9,
            swayOffset: Math.random() * Math.PI * 2,
            swayAmp: 12 + Math.random() * 20,
            size: balloonSize,
            popped: false,
            popScale: 1,
            shakeStart: null,
            container,
          };

          // Tap handler
          container.on('pointerdown', () => {
            handleBalloonTapRef.current?.(balloonData);
          });

          app.stage.addChild(container);
          balloonsRef.current.push(balloonData);
        };

        // Handle resize
        const onResize = () => {
          if (destroyed || !el) return;
          const nw = el.offsetWidth;
          const nh = el.offsetHeight;
          app.renderer.resize(nw, nh);
        };
        window.addEventListener('resize', onResize);
        pixiAppRef.current._cleanupResize = () => window.removeEventListener('resize', onResize);

      } catch (err) {
        console.error('PixiJS init failed:', err);
      }
    };

    init();

    return () => {
      destroyed = true;
      if (pixiAppRef.current) {
        pixiAppRef.current._cleanupResize?.();
        // Clean up all balloon containers
        balloonsRef.current.forEach(b => {
          if (b.container) b.container.destroy({ children: true });
        });
        balloonsRef.current = [];
        pixiAppRef.current.destroy(true);
        pixiAppRef.current = null;
      }
    };
  }, []); // Only once on mount

  // Reset on mount
  useEffect(() => {
    gameOverRef.current = false;
    targetIdxRef.current = 0;
    targetSoundRef.current = sounds[0];
    timeLeftRef.current = TIME_PER_SOUND;
    soundScoresRef.current = {};
    return () => {
      gameOverRef.current = true;
      clearInterval(timerRef.current);
      clearInterval(spawnIntervalRef.current);
      clearTimeout(idleReminderRef.current);
    };
  }, [sounds]);

  // 3-2-1-GO countdown
  useEffect(() => {
    if (gameStarted) return;
    let cancelled = false;
    const run = async () => {
      await playVO('Pop the balloons that make the sound...');
      if (cancelled) return;
      announceSound(sounds[0]);
      await delay(800);
      if (cancelled) return;
      playCountdownTick(false);
      await delay(1000);
      if (cancelled) return;
      setCountdown(2); playCountdownTick(false);
      await delay(1000);
      if (cancelled) return;
      setCountdown(1); playCountdownTick(false);
      await delay(1000);
      if (cancelled) return;
      setCountdown(0); playCountdownTick(true);
      await delay(700);
      if (cancelled) return;
      setGameStarted(true);
      gameStartedRef.current = true;
      startIdleReminder(true);
    };
    run();
    return () => { cancelled = true; stopVO(); clearIdleReminder(); };
  }, [gameStarted, sounds, announceSound]);

  // Game timer
  useEffect(() => {
    if (!gameStarted) return;
    timeLeftRef.current = TIME_PER_SOUND;

    timerRef.current = setInterval(() => {
      if (gameOverRef.current) { clearInterval(timerRef.current); return; }
      if (transitioningRef.current) return;

      timeLeftRef.current -= 1;
      setDisplayTimeLeft(timeLeftRef.current);

      if (timeLeftRef.current <= 0) {
        transitioningRef.current = true;
        const nextIdx = targetIdxRef.current + 1;

        if (nextIdx >= sounds.length) {
          gameOverRef.current = true;
          clearInterval(timerRef.current);
          clearInterval(spawnIntervalRef.current);
          clearTimeout(idleReminderRef.current);
          setShowResults(true);
          triggerCelebration();
          transitioningRef.current = false;
        } else {
          const handleTransition = async () => {
            triggerSmallBurst();
            await playVO("Time's up!");
            await delay(1000);
            if (gameOverRef.current) { transitioningRef.current = false; return; }
            targetIdxRef.current = nextIdx;
            targetSoundRef.current = sounds[nextIdx];
            timeLeftRef.current = TIME_PER_SOUND;
            setDisplayTargetIdx(nextIdx);
            setDisplayTimeLeft(TIME_PER_SOUND);

            // Clear non-popped balloons from pixi
            const app = pixiAppRef.current;
            balloonsRef.current = balloonsRef.current.filter(b => {
              if (!b.popped && app) {
                app.stage.removeChild(b.container);
                b.container.destroy({ children: true });
                return false;
              }
              return true;
            });

            await announceWithVO(sounds[nextIdx]);
            transitioningRef.current = false;
            startIdleReminder(true);
          };
          handleTransition();
        }
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameStarted, sounds, announceSound]);

  // Spawn balloons
  useEffect(() => {
    if (gameOverRef.current || !gameStarted) return;

    const spawn = () => pixiAppRef.current?._spawnBalloon?.();

    for (let i = 0; i < 6; i++) setTimeout(spawn, i * 80);
    spawnIntervalRef.current = setInterval(spawn, 400);
    return () => clearInterval(spawnIntervalRef.current);
  }, [gameStarted, displayTargetIdx]);

  const handleReplaySound = () => announceSound(targetSoundRef.current);

  useEffect(() => {
    if (showResults) playVO('Great job!');
  }, [showResults]);

  const handleFinish = () => {
    stopVO();
    setShowResults(false);
    onComplete();
  };

  const handlePlayAgain = () => {
    stopVO();
    setShowResults(false);
    // Reset all game state
    gameOverRef.current = false;
    targetIdxRef.current = 0;
    targetSoundRef.current = sounds[0];
    timeLeftRef.current = TIME_PER_SOUND;
    soundScoresRef.current = {};
    popEncIdx = 0;
    setDisplayTargetIdx(0);
    setDisplayTimeLeft(TIME_PER_SOUND);
    setCountdown(3);
    setGameStarted(false);
    gameStartedRef.current = false;
    // Clear remaining pixi balloons
    const app = pixiAppRef.current;
    if (app) {
      balloonsRef.current.forEach(b => {
        if (b.container) {
          app.stage.removeChild(b.container);
          b.container.destroy({ children: true });
        }
      });
    }
    balloonsRef.current = [];
  };

  const totalPopped = Object.values(soundScoresRef.current).reduce((a, b) => a + b, 0);
  const progress = (displayTargetIdx + (1 - displayTimeLeft / TIME_PER_SOUND)) / sounds.length;

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden select-none">
      {/* Sky background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #1a1147 0%, #2d1b69 40%, #1a1147 100%)',
      }} />

      {/* Soft floating circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={`bg-circle-${i}`}
            className="absolute rounded-full"
            style={{
              width: 40 + i * 20,
              height: 40 + i * 20,
              left: `${5 + i * 10}%`,
              top: `${10 + (i % 3) * 30}%`,
              background: ['rgba(174,144,253,0.12)', 'rgba(77,121,255,0.10)', 'rgba(255,215,0,0.10)', 'rgba(240,147,251,0.10)', 'rgba(34,197,94,0.08)'][i % 5],
              filter: 'blur(2px)',
            }}
            animate={{ y: [0, -15, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 5 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
          />
        ))}
      </div>

      {/* PixiJS canvas container — sits IN FRONT of background, BEHIND UI */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-20" />

      {/* Header HUD — z-50 to be above canvas */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-end px-4 pt-3 md:pt-4 lg:pt-6">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 lg:px-4 lg:py-1.5 flex items-center gap-2">
            <span className="text-xs lg:text-sm text-white/50 font-medium">
              {displayTargetIdx + 1}/{sounds.length}
            </span>
            <div className="w-16 md:w-24 h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#22c55e] rounded-full"
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              />
            </div>
          </div>
          <div className={`bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 font-bold text-sm ${displayTimeLeft <= 3 ? 'text-red-500' : 'text-white/70'}`}>
            {displayTimeLeft}s
          </div>
          <motion.button
            onClick={handleReplaySound}
            className="p-2 lg:p-2.5 rounded-[0.8rem] bg-[#6B3FA0]"
            style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.95, y: 3 }}
            whileHover={{ scale: 1.1 }}
          >
            <Volume2 className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Ground — behind balloons (part of background) */}
      <div className="absolute bottom-0 left-0 right-0 h-[8%] z-10" style={{
        background: 'linear-gradient(180deg, #34D058 0%, #22a740 100%)',
        borderTopLeftRadius: '50% 20px',
        borderTopRightRadius: '50% 20px',
      }} />

      {/* 3-2-1-GO Countdown */}
      <AnimatePresence mode="wait">
        {!gameStarted && (
          <motion.div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
            <motion.span
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="font-black"
              style={{
                fontSize: 'clamp(8rem, 30vw, 16rem)',
                color: countdown === 0 ? '#22c55e' : '#ffffff',
                textShadow: '0 4px 30px rgba(0,0,0,0.15)',
              }}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results screen */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
          >
            {/* Continuous confetti rain */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(70)].map((_, i) => (
                <motion.div
                  key={`confetti-${i}`}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: -20,
                    width: 7 + Math.random() * 10,
                    height: 7 + Math.random() * 10,
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    backgroundColor: ['#FF6B9D', '#4ECDC4', '#FFE66D', '#FF8A5B', '#9B59B6', '#3498DB', '#22c55e', '#ffd700', '#E60023', '#6B3FA0'][i % 10],
                  }}
                  animate={{
                    y: ['0vh', '110vh'],
                    x: [0, (Math.random() - 0.5) * 120],
                    rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 3,
                    delay: Math.random() * 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              ))}
              {[...Array(25)].map((_, i) => (
                <motion.div
                  key={`spark-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${15 + Math.random() * 70}%`,
                    top: `${15 + Math.random() * 70}%`,
                    width: 3 + Math.random() * 6,
                    height: 3 + Math.random() * 6,
                    backgroundColor: '#ffd700',
                  }}
                  animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 1 + Math.random(), delay: Math.random() * 3, repeat: Infinity }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="bg-[#2d1b69] p-6 md:p-10 text-center max-w-sm md:max-w-md mx-4 relative z-10"
              style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
            >
              <motion.div
                className="relative inline-block mb-3"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="text-6xl md:text-8xl block">&#127880;</span>
              </motion.div>
              <motion.h2
                className="text-2xl md:text-3xl font-bold text-white mb-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Amazing Popping!
              </motion.h2>
              <motion.div
                className="mb-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <motion.span
                  className="font-black block mb-1"
                  style={{
                    fontSize: 'clamp(3.5rem, 12vw, 5.5rem)',
                    color: group.color,
                    textShadow: `0 4px 15px ${group.color}40`,
                    lineHeight: 1.1,
                  }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {totalPopped}
                </motion.span>
                <span className="text-lg md:text-xl text-[#ae90fd] font-semibold block">
                  balloons popped!
                </span>
              </motion.div>
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={handlePlayAgain}
                  className="px-6 py-3 bg-[#6B3FA0] text-white font-bold text-base md:text-lg"
                  style={{ borderRadius: '1.6rem', borderBottom: '5px solid #4A2B70', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 4 }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  Play Again &#8635;
                </motion.button>
                <motion.button
                  onClick={handleFinish}
                  className="px-6 py-3 bg-[#E60023] text-white font-bold text-base md:text-lg"
                  style={{ borderRadius: '1.6rem', borderBottom: '5px solid #B3001B', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 4 }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  Next Step &rarr;
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SoundBalloons;
