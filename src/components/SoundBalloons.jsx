import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import Lottie from 'lottie-react';
import { Application, Graphics, Text, TextStyle, Container, Sprite as PixiSprite, Texture, Assets } from 'pixi.js';
import { playLetterSound, getLetterSoundUrl } from '../utils/letterSounds';
import { speakWithVoice } from '../utils/speech';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst, triggerBurstAt } from '../utils/confetti';
import { createSkyBackground, SkyOverlay } from './themes/SkyBackground';

// Balloon PNG sprites
import balloonBlueUrl from '../assets/materials/ballons-bubbles/balloon-blue.webp';
import balloonGreenUrl from '../assets/materials/ballons-bubbles/balloon-green.webp';
import balloonPinkUrl from '../assets/materials/ballons-bubbles/balloon-pink.webp';
import balloonPurpleUrl from '../assets/materials/ballons-bubbles/balloon-purple.webp';
import balloonRedUrl from '../assets/materials/ballons-bubbles/balloon-red.webp';
import balloonYellowUrl from '../assets/materials/ballons-bubbles/balloon-yellow.webp';

// Lottie + tutorial assets
import cuteCatData from '../assets/materials/cute-cat.json';
import tutorialArmUrl from '../assets/materials/tutorial-pointing-arm.webp';

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
const BALLOON_SPRITE_URLS = [
  balloonBlueUrl, balloonGreenUrl, balloonPinkUrl,
  balloonPurpleUrl, balloonRedUrl, balloonYellowUrl,
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

// --- Main Component ---
const SoundBalloons = ({ group, onComplete }) => {
  const [showResults, setShowResults] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [resultCountdown, setResultCountdown] = useState(5);

  const [displayTargetIdx, setDisplayTargetIdx] = useState(0);
  const [displayTimeLeft, setDisplayTimeLeft] = useState(TIME_PER_SOUND);
  const [pixiReady, setPixiReady] = useState(false);

  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const pixiAppRef = useRef(null);
  const balloonsRef = useRef([]); // Pure JS array, no React state
  const spawnIntervalRef = useRef(null);
  const timerRef = useRef(null);
  const soundScoresRef = useRef({});
  const balloonTexturesRef = useRef([]);
  const skyRef = useRef(null);

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
      // Confetti burst at pop location
      const app = pixiAppRef.current;
      if (app) triggerBurstAt(balloon.currentX / app.screen.width, balloon.y / app.screen.height);
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
          backgroundAlpha: 1,
          backgroundColor: 0x87CEEB,
          antialias: true,
          resolution: 1,
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

        // Sky parallax background
        try {
          skyRef.current = await createSkyBackground(app);
        } catch (e) { console.warn('Sky bg failed:', e); }
        if (destroyed) { app.destroy(true); return; }

        // Load balloon PNG textures via Assets.load (PixiJS v8)
        try {
          const texArr = await Promise.all(BALLOON_SPRITE_URLS.map(url => Assets.load(url)));
          balloonTexturesRef.current = texArr;
        } catch (e) { console.warn('Balloon textures failed:', e); }
        if (destroyed) { app.destroy(true); return; }

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
          if (active.length >= 14) return;

          const currentTarget = targetSoundRef.current;
          const isTarget = Math.random() < 0.6;
          let sound;
          if (isTarget) {
            sound = currentTarget;
          } else {
            // Match distractor length to target length
            const targetLen = currentTarget.length;
            const distractors = ALL_SOUNDS.filter(s => s !== currentTarget && s.length === targetLen);
            sound = distractors.length > 0
              ? distractors[Math.floor(Math.random() * distractors.length)]
              : ALL_SOUNDS.filter(s => s !== currentTarget)[Math.floor(Math.random() * (ALL_SOUNDS.length - 1))];
          }

          const bSize = balloonSize * 1.05;

          // Create pixi container for this balloon
          const container = new Container();
          container.eventMode = 'static';
          container.cursor = 'pointer';

          // Balloon PNG sprite — uniform scale (no squeezing)
          const textures = balloonTexturesRef.current;
          if (textures.length > 0) {
            const tex = textures[Math.floor(Math.random() * textures.length)];
            const spr = new PixiSprite(tex);
            spr.anchor.set(0.5);
            // Keep aspect ratio: scale uniformly based on texture
            const aspect = tex.height / tex.width;
            spr.width = bSize;
            spr.height = bSize * aspect;
            container.addChild(spr);
          } else {
            const gfx = new Graphics();
            gfx.ellipse(0, 0, bSize * 0.45, bSize * 0.5);
            gfx.fill({ color: 0xFF1E56, alpha: 0.92 });
            container.addChild(gfx);
          }

          // Letter text — centered on balloon
          const txt = new Text({
            text: sound.toLowerCase(),
            style: new TextStyle({
              fontFamily: '"Fredoka", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: Math.max(bSize * 0.55, 36),
              fontWeight: '900',
              fill: '#3e366b',
              stroke: { color: '#ffffff', width: 3 },
              dropShadow: { color: 0xffffff, alpha: 0.5, blur: 3, distance: 0 },
            }),
          });
          txt.anchor.set(0.5, 0.5);
          txt.y = -bSize * 0.5;
          container.addChild(txt);

          // Hit area
          const hitGfx = new Graphics();
          hitGfx.circle(0, 0, bSize * 0.55);
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
            x: bx,
            y: by,
            currentX: bx,
            speed: 1.0 + Math.random() * 0.7,
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

        setPixiReady(true);
      } catch (err) {
        console.error('PixiJS init failed:', err);
      }
    };

    init();

    return () => {
      destroyed = true;
      if (skyRef.current) { skyRef.current.destroy(); skyRef.current = null; }
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
      if (helpCancelRef.current) helpCancelRef.current();
    };
  }, [sounds]);

  // Tutorial hand + cat Lottie state
  const [tutorialHand, setTutorialHand] = useState(null); // { x, y, visible, popping }
  const [showCatLottie, setShowCatLottie] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);
  const [popFlash, setPopFlash] = useState(null); // { sound } — celebration flash on correct pop
  const hasPlayedOnceRef = useRef(false);
  const tutorialRunningRef = useRef(false);
  const helpCancelRef = useRef(null);

  // Reusable tutorial runner — used by initial load AND the ? help button
  const runBalloonTutorial = useCallback(async (isCancelled) => {
    const app = pixiAppRef.current;
    const canvasEl = canvasContainerRef.current;
    if (!app || !canvasEl) return;

    tutorialRunningRef.current = true;
    const stageW = app.screen.width;
    const stageH = app.screen.height;
    const balloonSize = Math.min(Math.max(110, stageW * 0.22), 180);
    const bSize = balloonSize * 1.05;
    const textures = balloonTexturesRef.current;
    const targetSound = sounds[0];

    setShowTutorialOverlay(true);

    // Build demo sounds: 3 targets + 6 distractors — natural floating from bottom
    const distractorList = ALL_SOUNDS.filter(s => s !== targetSound && s.length === targetSound.length);
    const demoSounds = [targetSound, targetSound, targetSound];
    for (let i = 0; i < 6 && distractorList.length > 0; i++) {
      const idx = Math.floor(Math.random() * distractorList.length);
      demoSounds.push(distractorList.splice(idx, 1)[0]);
    }
    // Shuffle
    for (let i = demoSounds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [demoSounds[i], demoSounds[j]] = [demoSounds[j], demoSounds[i]];
    }

    // Spawn tutorial balloons from bottom (like gameplay) — staggered across width
    const demoBalloons = [];
    const margin = balloonSize * 0.6;
    const usableWidth = stageW - margin * 2;
    // Evenly distribute starting X positions with jitter for natural look
    const slotWidth = usableWidth / demoSounds.length;
    for (let i = 0; i < demoSounds.length; i++) {
      const container = new Container();
      if (textures.length > 0) {
        const tex = textures[Math.floor(Math.random() * textures.length)];
        const spr = new PixiSprite(tex);
        spr.anchor.set(0.5);
        const aspect = tex.height / tex.width;
        spr.width = bSize;
        spr.height = bSize * aspect;
        container.addChild(spr);
      } else {
        const gfx = new Graphics();
        gfx.ellipse(0, 0, bSize * 0.45, bSize * 0.5);
        gfx.fill({ color: 0xFF1E56, alpha: 0.92 });
        container.addChild(gfx);
      }
      const txt = new Text({
        text: demoSounds[i].toLowerCase(),
        style: new TextStyle({
          fontFamily: '"Fredoka", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: Math.max(bSize * 0.55, 36),
          fontWeight: '900',
          fill: '#3e366b',
          stroke: { color: '#ffffff', width: 3 },
          dropShadow: { color: 0xffffff, alpha: 0.5, blur: 3, distance: 0 },
        }),
      });
      txt.anchor.set(0.5, 0.5);
      txt.y = -bSize * 0.5;
      container.addChild(txt);

      // Spread evenly across width with jitter, stagger spawn depths
      const bx = margin + slotWidth * i + slotWidth * 0.5 + (Math.random() - 0.5) * slotWidth * 0.6;
      const by = stageH + 50 + i * 40; // stagger so they don't all appear at once
      container.x = bx;
      container.y = by;
      app.stage.addChild(container);
      demoBalloons.push({
        sound: demoSounds[i],
        container,
        x: bx,
        y: by,
        currentX: bx,
        speed: 1.2 + Math.random() * 0.6, // faster so they reach center quickly
        swayOffset: Math.random() * Math.PI * 2,
        swayAmp: 18 + Math.random() * 25,
        popped: false,
        popScale: 1,
      });
    }

    // Ticker: float tutorial balloons naturally (same physics as gameplay)
    const tutTicker = (ticker) => {
      if (isCancelled()) return;
      const dt = Math.min(ticker.deltaTime, 4);
      const elapsed = performance.now() / 1000;
      for (const b of demoBalloons) {
        if (b.popped) {
          b.popScale -= dt * 0.08;
          if (b.container) {
            b.container.scale.set(Math.max(b.popScale, 0));
            b.container.alpha = Math.max(b.popScale, 0);
          }
          continue;
        }
        b.y -= b.speed * dt;
        const sway = Math.sin(elapsed + b.swayOffset) * b.swayAmp;
        b.currentX = b.x + sway;
        b.container.x = b.currentX;
        b.container.y = b.y;
        // Recycle if off top
        if (b.y < -balloonSize * 1.5) {
          b.y = stageH + 50;
          const rSlot = Math.floor(Math.random() * demoSounds.length);
          b.x = margin + slotWidth * rSlot + slotWidth * 0.5 + (Math.random() - 0.5) * slotWidth * 0.6;
        }
      }
    };
    app.ticker.add(tutTicker);

    const cleanup = () => {
      app.ticker.remove(tutTicker);
      demoBalloons.forEach(db => { try { app.stage.removeChild(db.container); db.container.destroy({ children: true }); } catch(e){} });
    };

    // VO plays while balloons rise into view
    await playVO('Pop the balloons that make the sound...');
    if (isCancelled()) { cleanup(); tutorialRunningRef.current = false; return; }
    await playLetterSound(targetSound).catch(() => {});
    if (isCancelled()) { cleanup(); tutorialRunningRef.current = false; return; }
    // Extra wait so balloons float into center area
    await delay(1200);
    if (isCancelled()) { cleanup(); tutorialRunningRef.current = false; return; }

    // Hand pops 2 target balloons
    let popsRemaining = 2;
    for (let pi = 0; pi < 10 && popsRemaining > 0; pi++) {
      if (isCancelled()) break;
      // Find a target balloon in center area (25%-65% of screen height)
      let bestBalloon = null;
      for (const b of demoBalloons) {
        if (b.popped || b.sound !== targetSound) continue;
        if (b.container.y > stageH * 0.65 || b.container.y < stageH * 0.2) continue;
        bestBalloon = b;
        break;
      }
      if (!bestBalloon) { await delay(400); continue; }

      // Freeze balloon
      const savedSpeed = bestBalloon.speed;
      bestBalloon.speed = 0;

      const rect = canvasEl.getBoundingClientRect();
      const startX = rect.left + rect.width * 0.5;
      const startY = rect.top + rect.height + 100;

      setTutorialHand({ x: startX, y: startY, visible: true, popping: false });
      await delay(300);
      if (isCancelled()) { bestBalloon.speed = savedSpeed; break; }

      // Hand to slightly left of balloon center-bottom
      const endX = rect.left + (bestBalloon.currentX / stageW) * rect.width - (balloonSize * 0.15 * rect.width / stageW);
      const endY = rect.top + (bestBalloon.container.y / stageH) * rect.height + (balloonSize * 0.1 * rect.height / stageH);
      setTutorialHand({ x: endX, y: endY, visible: true, popping: false });
      await delay(500);
      if (isCancelled()) { bestBalloon.speed = savedSpeed; break; }

      // Pop!
      setTutorialHand({ x: endX, y: endY, visible: true, popping: true });
      playPopSound();
      bestBalloon.popped = true;
      bestBalloon.popScale = 1;
      triggerBurstAt(bestBalloon.currentX / stageW, bestBalloon.container.y / stageH);
      await playLetterSound(targetSound).catch(() => {});
      popsRemaining--;

      await delay(400);
      if (isCancelled()) break;
      setTutorialHand(null);
      await delay(300);
    }
    setTutorialHand(null);
    if (isCancelled()) { cleanup(); tutorialRunningRef.current = false; return; }

    // Brief celebration
    triggerSmallBurst();
    await delay(800);
    if (isCancelled()) { cleanup(); tutorialRunningRef.current = false; return; }

    // Fade out tutorial balloons
    app.ticker.remove(tutTicker);
    await new Promise((resolve) => {
      let t = 0;
      const fadeTicker = (ticker) => {
        if (isCancelled()) { app.ticker.remove(fadeTicker); resolve(); return; }
        t += ticker.deltaTime;
        for (const db of demoBalloons) db.container.alpha = Math.max(0, db.container.alpha - 0.04 * ticker.deltaTime);
        if (t > 30) { app.ticker.remove(fadeTicker); resolve(); }
      };
      app.ticker.add(fadeTicker);
    });
    demoBalloons.forEach(db => { try { app.stage.removeChild(db.container); db.container.destroy({ children: true }); } catch(e){} });
    if (isCancelled()) { tutorialRunningRef.current = false; return; }

    setShowTutorialOverlay(false);
    tutorialRunningRef.current = false;
  }, [sounds]);

  // Tutorial + 3-2-1-GO countdown (waits for pixi to be ready)
  useEffect(() => {
    if (gameStarted || !pixiReady) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const run = async () => {
      // Step 1: Tutorial with natural floating balloons (first play only)
      if (!hasPlayedOnceRef.current) {
        await runBalloonTutorial(isCancelled);
        if (cancelled) return;
      } else {
        // Replay: just announce
        await playVO('Pop the balloons that make the sound...');
        if (cancelled) return;
        announceSound(sounds[0]);
        await delay(1200);
        if (cancelled) return;
      }

      // Step 2: 3-2-1-GO countdown
      setShowCountdown(true);
      setCountdown(3);
      await delay(200);
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
      setShowCountdown(false);
      setGameStarted(true);
      gameStartedRef.current = true;
      hasPlayedOnceRef.current = true;
      setShowCatLottie(true);
      startIdleReminder(true);
    };
    run();
    return () => { cancelled = true; stopVO(); clearIdleReminder(); setTutorialHand(null); setShowCatLottie(false); setShowCountdown(false); setShowTutorialOverlay(false); };
  }, [gameStarted, pixiReady, sounds, announceSound]);

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
          // Play Time's up VO before showing results
          const showFinal = async () => {
            triggerSmallBurst();
            await playVO("Time's up!");
            await delay(500);
            setShowResults(true);
            triggerCelebration();
            transitioningRef.current = false;
          };
          showFinal();
        } else {
          const handleTransition = async () => {
            // Show completion flash for this sound
            const completedSound = targetSoundRef.current;
            const poppedCount = soundScoresRef.current[completedSound] || 0;
            triggerCelebration();
            setPopFlash({ sound: completedSound, count: poppedCount });
            await playVO("Time's up!");
            await delay(1500);
            setPopFlash(null);
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

    // Spawn 4 staggered, then continuous at a relaxed rate
    for (let i = 0; i < 4; i++) setTimeout(spawn, i * 300);
    spawnIntervalRef.current = setInterval(spawn, 700);
    return () => clearInterval(spawnIntervalRef.current);
  }, [gameStarted, displayTargetIdx]);

  const handleReplaySound = () => announceSound(targetSoundRef.current);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!showResults) return;
    playVO('Great job!');
    setResultCountdown(5);
    let cancelled = false;
    const countdownInterval = setInterval(() => {
      setResultCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          if (!cancelled) { stopVO(); onCompleteRef.current(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { cancelled = true; clearInterval(countdownInterval); };
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
      {/* PixiJS canvas container — sky background + balloons rendered here */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-20" />

      {/* Background flying birds */}
      <SkyOverlay />

      {/* Cat Lottie — floats in during game */}
      <AnimatePresence>
        {showCatLottie && (
          <motion.div
            className="fixed z-[52] pointer-events-none"
            style={{ bottom: '2%', right: '3%', width: 'clamp(200px, 35vw, 400px)' }}
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: [0, -15, 0], opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
          >
            <Lottie animationData={cuteCatData} loop autoplay style={{ width: '100%', height: '100%' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial pointing arm */}
      <AnimatePresence>
        {tutorialHand && tutorialHand.visible && (
          <motion.img
            src={tutorialArmUrl}
            alt=""
            className="fixed z-[56] pointer-events-none select-none"
            style={{
              width: 'clamp(140px, 25vw, 260px)',
              // Rotate -90deg and flip so the arm points upward; fingertip is at top
              transform: 'rotate(-90deg) scaleX(-1)',
              transformOrigin: 'center center',
              // Position so fingertip (top of rotated image) touches the target
              left: tutorialHand.x,
              top: tutorialHand.y,
              marginLeft: '-12%',
              marginTop: '-25%',
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: tutorialHand.popping ? 1.15 : 1,
              x: 0, y: 0,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

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

      {/* 3-2-1-GO Countdown — only shown after tutorial finishes */}
      <AnimatePresence mode="wait">
        {showCountdown && (
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

      {/* "How to Play!" tutorial overlay */}
      <AnimatePresence>
        {showTutorialOverlay && (
          <motion.div
            className="fixed inset-0 z-[53] pointer-events-none flex items-center justify-start pt-16 md:pt-20 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="absolute inset-0 bg-black/30" />
            <motion.div
              className="relative z-10 bg-[#FFD000] px-8 py-3 rounded-full shadow-lg"
              style={{ borderBottom: '4px solid #E0B800' }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-[#3e366b] font-black text-2xl md:text-3xl">How to Play!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Correct pop celebration flash */}
      <AnimatePresence>
        {popFlash && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-[#2d1b69]/80 backdrop-blur-sm px-10 py-6 md:px-14 md:py-8 rounded-3xl flex flex-col items-center gap-2"
              initial={{ scale: 0.4, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <motion.span
                className="text-5xl md:text-6xl"
                animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6 }}
              >
                🎈
              </motion.span>
              <span className="text-3xl md:text-4xl font-black text-[#4ECDC4] uppercase">{popFlash.sound}</span>
              {popFlash.count > 0 && (
                <span className="text-white font-bold text-lg md:text-xl">{popFlash.count} popped!</span>
              )}
              <span className="text-white/70 text-sm md:text-base font-bold">Great job!</span>
            </motion.div>
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
              {[...Array(20)].map((_, i) => (
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
              <div className="flex flex-col items-center gap-3">
                <motion.button
                  onClick={handlePlayAgain}
                  className="px-6 py-3 bg-[#22c55e] text-white font-bold text-base md:text-lg"
                  style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16a34a', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 4 }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  Play Again &#8635;
                </motion.button>
                <motion.div
                  className="flex items-center gap-2 text-white/50 text-sm font-medium"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <span>Next step in</span>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-base">
                    {resultCountdown}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SoundBalloons;
