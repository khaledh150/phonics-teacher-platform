import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import Lottie from 'lottie-react';
import { Application, Graphics, Text, TextStyle, Container, Sprite as PixiSprite, Texture, Assets } from 'pixi.js';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst, triggerBurstAt } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import { SkyFullBackground } from '../themes/SkyBackground';

import dogBathingData from '../../assets/materials/dog-bathing-in-bathtub.json';
import tutorialArmUrl from '../../assets/materials/tutorial-pointing-arm.webp';
import { runBubbleSpellTutorial } from '../tutorials/bubbleSpellTutorial';

// Bubble PNG sprites
import bubble1Url from '../../assets/materials/ballons-bubbles/bubble-1.webp';
import bubble2Url from '../../assets/materials/ballons-bubbles/bubble-2.webp';
import bubble3Url from '../../assets/materials/ballons-bubbles/bubble-3.webp';
import bubble4Url from '../../assets/materials/ballons-bubbles/bubble-4.webp';
import bubble5Url from '../../assets/materials/ballons-bubbles/bubble-5.webp';
import bubble6Url from '../../assets/materials/ballons-bubbles/bubble-6.webp';
import bubble7Url from '../../assets/materials/ballons-bubbles/bubble-7.webp';
import bubble8Url from '../../assets/materials/ballons-bubbles/bubble-8.webp';

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

const playCountdownTick = (isGo) => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 600, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isGo ? 0.4 : 0.2));
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + (isGo ? 0.4 : 0.2));
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
  const [tutorialHand, setTutorialHand] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [tutorialDone, setTutorialDone] = useState(false);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);
  const [tutorialSpelled, setTutorialSpelled] = useState([]);
  const [tutorialWord, setTutorialWord] = useState('');

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
  const hasPlayedOnceRef = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const [wordCompleteFlash, setWordCompleteFlash] = useState(null); // holds the completed word string
  const helpCancelRef = useRef(null);

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

  // Mount/unmount lifecycle
  useEffect(() => {
    mountedRef.current = true;
    destroyedRef.current = false;
    return () => {
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
      if (helpCancelRef.current) helpCancelRef.current();
    };
  }, []);

  // Reusable tutorial runner — delegates to extracted tutorial module
  const tutorialRunningRef = useRef(false);
  const runTutorial = useCallback(async (cancelled, { isHelpReplay = false } = {}) => {
    // Pick a tutorial word NOT in the gameplay round
    const roundWordStrs = roundWords.map(w => w.word);
    const tutorialCandidates = group.words.filter(w => !roundWordStrs.includes(w.word));
    const tutWord = tutorialCandidates.length > 0
      ? tutorialCandidates[Math.floor(Math.random() * tutorialCandidates.length)]
      : group.words[Math.floor(Math.random() * group.words.length)];

    tutorialRunningRef.current = true;
    await runBubbleSpellTutorial(cancelled, {
      app: pixiAppRef.current,
      canvasEl: canvasContainerRef.current,
      tutWord,
      groupSounds: group.sounds || [],
      bubbleTextures: bubbleTexturesRef.current,
      bubbleRadius: bubbleRadiusRef.current,
      setTutorialHand,
      setShowTutorialOverlay,
      setTutorialSpelled,
      setTutorialWord,
      setInstructionLock,
      playPopSfx,
    }, { isHelpReplay });
    tutorialRunningRef.current = false;
  }, [roundWords, group]);

  // Tutorial + 3-2-1 countdown (runs once when pixi is ready)
  const tutorialRanRef = useRef(false);
  useEffect(() => {
    if (!pixiReady || tutorialRanRef.current) return;
    tutorialRanRef.current = true;
    let cancelled = false;
    const isCancelled = () => cancelled;

    const run = async () => {
      // Skip tutorial on replay — go straight to countdown
      if (hasPlayedOnceRef.current) {
        await playVO('Pop the bubbles to spell the word!');
        if (cancelled) return;
        if (currentWord) await speakAsync(currentWord.word, { rate: 0.85 });
        if (cancelled) return;

        setShowCountdown(true);
        setCountdown(3); await delay(200); if (cancelled) return;
        playCountdownTick(false); await delay(1000); if (cancelled) return;
        setCountdown(2); playCountdownTick(false); await delay(1000); if (cancelled) return;
        setCountdown(1); playCountdownTick(false); await delay(1000); if (cancelled) return;
        setCountdown(0); playCountdownTick(true); await delay(700); if (cancelled) return;
        setShowCountdown(false);
        setTutorialDone(true);
        setInstructionLock(false);
        startIdleReminder();
        return;
      }

      // --- FULL TUTORIAL ---
      await runTutorial(isCancelled);
      if (cancelled) return;

      // 3-2-1-GO countdown
      setShowCountdown(true);
      setCountdown(3); await delay(200); if (cancelled) return;
      playCountdownTick(false); await delay(1000); if (cancelled) return;
      setCountdown(2); playCountdownTick(false); await delay(1000); if (cancelled) return;
      setCountdown(1); playCountdownTick(false); await delay(1000); if (cancelled) return;
      setCountdown(0); playCountdownTick(true); await delay(700); if (cancelled) return;
      setShowCountdown(false);

      // Now start real game
      hasPlayedOnceRef.current = true;
      setTutorialDone(true);
      setInstructionLock(false);

      // Announce the actual first word
      await playVO('Pop the bubbles to spell the word!');
      if (cancelled) return;
      if (currentWord) await speakAsync(currentWord.word, { rate: 0.85 });
      if (cancelled) return;
      startIdleReminder();
    };
    run();
    return () => { cancelled = true; stopVO(); setTutorialHand(null); setShowCountdown(false); setShowTutorialOverlay(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady]);

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

        // Stage-level tap handler: find nearest bubble to tap point (fixes hard-to-tap back bubbles)
        app.canvas.addEventListener('pointerdown', (e) => {
          if (!handleBubbleTapRef.current) return;
          const rect = app.canvas.getBoundingClientRect();
          const tapX = ((e.clientX - rect.left) / rect.width) * app.screen.width;
          const tapY = ((e.clientY - rect.top) / rect.height) * app.screen.height;
          let closest = null;
          let closestDist = Infinity;
          for (const b of bubblesRef.current) {
            if (b.popped) continue;
            const dx = b.container.x - tapX;
            const dy = b.container.y - tapY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = b.container.scale?.x ?? 1;
            const hitRadius = bubbleRadiusRef.current * Math.max(scale, 0.5) * 1.3;
            if (dist < hitRadius && dist < closestDist) {
              closest = b;
              closestDist = dist;
            }
          }
          if (closest) handleBubbleTapRef.current(closest);
        });

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

  // Spawn bubbles when word changes AND pixi is ready AND tutorial is done
  useEffect(() => {
    if (!pixiReady || !pixiAppRef.current || !currentWord || !tutorialDone) return;
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
    const numDistractors = Math.max(8, wordLetters.length * 2);
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

    const R = bubbleRadiusRef.current;
    let spawnIdx = 0;

    const spawnBubble = (letter) => {
      if (destroyedRef.current || !pixiAppRef.current) return;
      const container = new Container();

      let bubbleSprite = null;
      const textures = bubbleTexturesRef.current;
      if (textures.length > 0) {
        const tex = textures[spawnIdx % textures.length];
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

      // Spawn from behind the dog, spread across full width
      const startX = w * 0.1 + Math.random() * (w * 0.8);
      const startY = h * 0.78 + Math.random() * (h * 0.05);

      container.x = startX;
      container.y = startY;
      app.stage.addChild(container);

      const bubble = {
        id: spawnIdx++,
        letter,
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.35 + Math.random() * 0.5),
        shimmerPhase: Math.random() * Math.PI * 2,
        popped: false,
        popScale: 1,
        shakeStart: null,
        growPhase: 0,
        firstWave: true,
        sprite: bubbleSprite,
        container,
      };

      bubblesRef.current.push(bubble);
    };

    // Continuous spawning: one bubble every 600ms, cycling through the letter pool
    let letterIdx = 0;
    const MAX_ALIVE = allLetters.length; // cap on-screen bubbles
    const spawnInterval = setInterval(() => {
      if (destroyedRef.current || !pixiAppRef.current) return;
      // Only spawn if below the cap (exclude popped bubbles still animating)
      const alive = bubblesRef.current.filter(b => !b.popped).length;
      if (alive >= MAX_ALIVE) return;
      spawnBubble(allLetters[letterIdx % allLetters.length]);
      letterIdx++;
    }, 600);

    // Spawn initial small batch (6 bubbles staggered quickly) so screen isn't empty
    const initialTimers = [];
    const initialCount = Math.min(6, allLetters.length);
    for (let i = 0; i < initialCount; i++) {
      const timer = setTimeout(() => {
        spawnBubble(allLetters[letterIdx % allLetters.length]);
        letterIdx++;
      }, i * 200);
      initialTimers.push(timer);
    }

    const cleanupTimers = () => {
      clearInterval(spawnInterval);
      initialTimers.forEach(t => clearTimeout(t));
    };
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
  }, [pixiReady, wordIndex, currentWord, group.sounds, startIdleReminder, tutorialDone]);

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
      // Confetti burst at bubble pop location
      const app = pixiAppRef.current;
      if (app) triggerBurstAt(bubble.container.x / app.screen.width, bubble.container.y / app.screen.height);
      await playLetterSound(bubble.letter).catch(() => {});

      const newSpelled = [...spelledLettersRef.current, bubble.letter];
      setSpelledLetters(newSpelled);
      nextLetterIdxRef.current += 1;

      if (nextLetterIdxRef.current >= currentLetters.length) {
        wrongTapCountRef.current = 0;
        await delay(300);
        if (!mountedRef.current) return;

        // Big celebration for completing a word
        const w = roundWords[wordIndexRef.current];
        triggerCelebration();
        setWordCompleteFlash(w ? w.word : '');
        if (w) await speakAsync(w.word, { rate: 0.85 });
        if (!mountedRef.current) return;
        await playEncouragement();
        if (!mountedRef.current) return;
        await delay(1200);
        if (!mountedRef.current) return;
        setWordCompleteFlash(null);

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

  const handleShowHelp = useCallback(async () => {
    if (tutorialRunningRef.current || showTutorialOverlay || showCountdown) return;
    // Cancel any previous help replay
    if (helpCancelRef.current) helpCancelRef.current();
    let cancelled = false;
    helpCancelRef.current = () => { cancelled = true; };

    // Pause gameplay — lock input during tutorial replay
    setInstructionLock(true);
    clearTimeout(idleRef.current);
    window.speechSynthesis.cancel();
    stopVO();

    await runTutorial(() => cancelled, { isHelpReplay: true });
    if (cancelled || !mountedRef.current) return;

    // Resume gameplay
    setInstructionLock(false);
    const w = roundWords[wordIndexRef.current];
    if (w) {
      await playVO('Pop the bubbles to spell the word!');
      if (!mountedRef.current || cancelled) return;
      await speakAsync(w.word, { rate: 0.85 });
    }
    startIdleReminder();
  }, [showTutorialOverlay, showCountdown, runTutorial, roundWords, startIdleReminder]);

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

      {/* Tutorial pointing arm — fingertip centered on target */}
      <AnimatePresence>
        {tutorialHand && tutorialHand.visible && (
          <motion.img
            src={tutorialArmUrl}
            alt=""
            className="fixed z-[56] pointer-events-none select-none"
            style={{
              width: 'clamp(120px, 22vw, 220px)',
              transformOrigin: 'top center',
              left: tutorialHand.x,
              top: tutorialHand.y,
              // Rotate so finger points up; translate so fingertip sits at left/top
              transform: 'rotate(-90deg) scaleX(-1) translate(50%, -50%)',
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: tutorialHand.popping ? 1.15 : 1,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

      {/* 3-2-1-GO Countdown */}
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

      {/* Word complete celebration flash */}
      <AnimatePresence>
        {wordCompleteFlash !== null && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-[#2d1b69]/80 backdrop-blur-sm px-10 py-6 md:px-14 md:py-8 rounded-3xl flex flex-col items-center gap-3"
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
                ⭐
              </motion.span>
              <span className="text-3xl md:text-4xl lg:text-5xl font-black text-[#4ECDC4] uppercase tracking-wider">
                {wordCompleteFlash}
              </span>
              <span className="text-white/70 text-base md:text-lg font-bold">Great spelling!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial "How to Play!" overlay — dims background, shows tutorial word tray */}
      <AnimatePresence>
        {showTutorialOverlay && (
          <motion.div
            className="fixed inset-0 z-[15] pointer-events-none flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Dim backdrop */}
            <div className="absolute inset-0 bg-black/30" />
            {/* "How to Play!" badge at top */}
            <motion.div
              className="relative z-10 mt-16 md:mt-20 bg-[#FFD000] px-8 py-3 rounded-full shadow-lg"
              style={{ borderBottom: '4px solid #E0B800' }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-[#3e366b] font-black text-2xl md:text-3xl">How to Play!</span>
            </motion.div>
            {/* Tutorial spelling tray */}
            {tutorialWord && (
              <motion.div
                className="relative z-10 mt-auto mb-20 flex items-center justify-center gap-2 md:gap-3 bg-white/20 backdrop-blur-md rounded-2xl px-6 py-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {tutorialWord.split('').map((letter, idx) => {
                  const isSpelled = idx < tutorialSpelled.length;
                  return (
                    <motion.div
                      key={idx}
                      className={`w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center text-xl md:text-2xl lg:text-3xl font-black uppercase ${
                        isSpelled
                          ? 'bg-[#4ECDC4] text-white'
                          : 'bg-white/40 text-[#3e366b]/50 border-2 border-dashed border-[#3e366b]/40'
                      }`}
                      style={isSpelled ? { borderBottom: '4px solid #38B2AC', boxShadow: '0px 4px 0px rgba(0,0,0,0.12)' } : {}}
                      initial={isSpelled ? { scale: 0, rotate: -20 } : {}}
                      animate={isSpelled ? { scale: 1, rotate: 0 } : {}}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      {isSpelled ? tutorialSpelled[idx] : '?'}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PixiJS canvas area — transparent, bubbles only */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-[10]" style={{ maxWidth: '100vw', maxHeight: '100vh' }} />

      {/* Dog bathing Lottie — centered at bottom, behind spelling tray */}
      <div
        className="absolute z-[12] pointer-events-none flex justify-center"
        style={{
          bottom: 'clamp(20px, 3vh, 50px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'clamp(440px, 65vw, 620px)',
          height: 'clamp(360px, 52vw, 500px)',
          maxHeight: '45vh',
        }}
      >
        <Lottie
          animationData={dogBathingData}
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Spelling tray at bottom — hidden during tutorial */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 bg-white/20 backdrop-blur-md border-t border-white/30 py-4 md:py-5 px-4 ${showTutorialOverlay ? 'opacity-0 pointer-events-none' : ''}`}>
        <div className="relative flex items-center justify-center">
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

          {/* Help "?" button — right side, aligned with answer boxes */}
          {tutorialDone && !showTutorialOverlay && (
            <motion.button
              onClick={handleShowHelp}
              className="absolute right-2 md:right-4 w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#FFD000] flex items-center justify-center"
              style={{ borderBottom: '3px solid #E0B800', boxShadow: '0px 4px 0px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.9, y: 2 }}
              whileHover={{ scale: 1.1 }}
            >
              <span className="text-[#3e366b] font-black text-lg md:text-xl">?</span>
            </motion.button>
          )}
        </div>
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
