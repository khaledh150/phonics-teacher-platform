import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize } from 'lucide-react';
import { Application, Graphics, Text, TextStyle, Container, Sprite as PixiSprite, Texture, Assets } from 'pixi.js';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';
import { SkyFullBackground } from '../themes/SkyBackground';

// Hot-air balloon + bubble sprites
import hotairBalloonUrl from '../../assets/backgrounds/sky/hotair-balloon.webp';
import bubble1Url from '../../assets/materials/ballons-bubbles/bubble-1.webp';
import bubble2Url from '../../assets/materials/ballons-bubbles/bubble-2.webp';
import bubble3Url from '../../assets/materials/ballons-bubbles/bubble-3.webp';
import bubble4Url from '../../assets/materials/ballons-bubbles/bubble-4.webp';
import bubble5Url from '../../assets/materials/ballons-bubbles/bubble-5.webp';
import bubble6Url from '../../assets/materials/ballons-bubbles/bubble-6.webp';
import bubble7Url from '../../assets/materials/ballons-bubbles/bubble-7.webp';
import bubble8Url from '../../assets/materials/ballons-bubbles/bubble-8.webp';

const ITEM_BUBBLE_URLS = [
  bubble1Url, bubble2Url, bubble3Url, bubble4Url,
  bubble5Url, bubble6Url, bubble7Url, bubble8Url,
];

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
  const [countdown, setCountdown] = useState(null);

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
  const itemBubbleTexturesRef = useRef([]);
  const laneCountRef = useRef(3);
  const nextLaneRef = useRef(0);

  // Build round sounds from group — only use sounds that have matching words (startsWith)
  const [roundSounds] = useState(() => {
    const allSounds = group.sounds || [];
    const words = (group.words || []).map(w => w.word.toLowerCase());

    // Filter sounds to only those that have at least one word starting with them
    const viableSounds = allSounds.filter(s =>
      words.some(w => w.startsWith(s.toLowerCase()))
    );

    // Fallback: if no sounds match via startsWith, use unique first letters of words
    let soundsToUse = viableSounds.length > 0 ? viableSounds : [];
    if (soundsToUse.length === 0) {
      const firstLetters = [...new Set(words.map(w => w[0]).filter(Boolean))];
      soundsToUse = firstLetters.length > 0 ? firstLetters : allSounds;
    }

    if (soundsToUse.length === 0) return allSounds.slice(0, TOTAL_ROUNDS);
    if (soundsToUse.length >= TOTAL_ROUNDS) return pickRandom(soundsToUse, TOTAL_ROUNDS);
    // Cycle through available sounds to fill rounds
    const result = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      result.push(soundsToUse[i % soundsToUse.length]);
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

  // Track spawns to guarantee a correct word every N spawns
  const spawnCountRef = useRef(0);
  const correctSinceLastRef = useRef(false);

  // Helper: create a drop item container with bubble + text
  const createDropItem = useCallback((word, w) => {
    const itemSize = Math.max(110, Math.min(180, w * 0.25));
    const itemContainer = new Container();

    const textures = itemBubbleTexturesRef.current;
    if (textures.length > 0) {
      const tex = textures[Math.floor(Math.random() * textures.length)];
      const spr = new PixiSprite(tex);
      spr.anchor.set(0.5);
      spr.width = itemSize;
      spr.height = itemSize;
      itemContainer.addChild(spr);
    } else {
      const bg = new Graphics();
      bg.circle(0, 0, itemSize / 2);
      bg.fill({ color: 0x4ECDC4, alpha: 0.7 });
      itemContainer.addChild(bg);
    }

    const fontSize = Math.max(32, Math.min(52, w * 0.07));
    const text = new Text({
      text: word,
      style: new TextStyle({
        fontFamily: '"Fredoka", "Baloo 2", "Nunito", "Segoe UI", sans-serif',
        fontSize,
        fontWeight: '700',
        fill: '#ffffff',
        stroke: { color: '#3e366b', width: 4 },
        dropShadow: { color: '#00000044', blur: 4, distance: 2, angle: Math.PI / 4 },
        letterSpacing: 1,
      }),
    });
    text.anchor.set(0.5);
    itemContainer.addChild(text);

    return { itemContainer, itemSize };
  }, []);

  // Tutorial: simulates actual gameplay — one-at-a-time drops in lanes, balloon moves to catch correct ones
  const runTutorialAnimation = useCallback((sound) => {
    const app = appRef.current;
    const wagon = wagonRef.current;
    if (!app || !wagon || !mountedRef.current) return Promise.resolve();

    const screenW = app.screen.width;
    const correctWords = getWordsForSound(sound);
    const distractorWords = getDistractorWords(sound);
    if (correctWords.length === 0) return Promise.resolve();

    const lanes = laneCountRef.current;
    const laneW = screenW / lanes;
    const centerX = screenW / 2;
    const swayRange = screenW * 0.3;

    // Build demo word queue (like real game: mix of correct & distractor, one at a time)
    const demoCount = 5;
    const demoQueue = [];
    // 2 correct + 3 distractors, shuffled
    for (let i = 0; i < 2; i++) demoQueue.push({ word: correctWords[i % correctWords.length], isCorrect: true });
    for (let i = 0; i < demoCount - 2; i++) {
      const dw = distractorWords.length > 0
        ? distractorWords[Math.floor(Math.random() * distractorWords.length)]
        : 'no';
      demoQueue.push({ word: dw, isCorrect: false });
    }
    for (let si = demoQueue.length - 1; si > 0; si--) {
      const sj = Math.floor(Math.random() * (si + 1));
      [demoQueue[si], demoQueue[sj]] = [demoQueue[sj], demoQueue[si]];
    }

    let phase = 0; // 0 = sway, 1 = gameplay simulation
    let phaseT = 0;
    let demoItems = [];
    let nextSpawnIdx = 0;
    let spawnTimer = 0;
    let demoLane = 0;
    const DEMO_SPAWN_INTERVAL = 55; // ticks between spawns (like SPAWN_INTERVAL_MS)

    return new Promise((resolve) => {
      const tutTicker = (ticker) => {
        if (!mountedRef.current) {
          demoItems.forEach(d => {
            try { if (d.container.parent) app.stage.removeChild(d.container); d.container.destroy({ children: true }); } catch(e) {}
          });
          app.ticker.remove(tutTicker);
          resolve();
          return;
        }
        const dt = ticker.deltaTime;
        phaseT += dt;

        if (phase === 0) {
          // Sway balloon left-right to show movement
          if (phaseT < 25) {
            wagon.x = centerX - swayRange * (phaseT / 25);
          } else if (phaseT < 75) {
            const t = (phaseT - 25) / 50;
            wagon.x = centerX - swayRange + swayRange * 2 * t;
          } else if (phaseT < 100) {
            const t = (phaseT - 75) / 25;
            wagon.x = centerX + swayRange - swayRange * t;
          } else {
            wagon.x = centerX;
            phase = 1;
            phaseT = 0;
            spawnTimer = DEMO_SPAWN_INTERVAL; // spawn first immediately
          }
        } else if (phase === 1) {
          // Spawn items one-at-a-time in lanes (like real game)
          spawnTimer += dt;
          if (spawnTimer >= DEMO_SPAWN_INTERVAL && nextSpawnIdx < demoQueue.length) {
            spawnTimer = 0;
            const entry = demoQueue[nextSpawnIdx];
            const { itemContainer, itemSize } = createDropItem(entry.word, screenW);
            const lane = demoLane % lanes;
            demoLane++;
            const spawnX = laneW * lane + laneW / 2;
            itemContainer.x = spawnX;
            itemContainer.y = -itemSize / 2;
            app.stage.addChild(itemContainer);
            demoItems.push({
              container: itemContainer,
              laneX: spawnX,
              isCorrect: entry.isCorrect,
              speed: 1.5 + Math.random() * 0.5,
              caught: false,
            });
            nextSpawnIdx++;
          }

          // Find nearest correct uncaught item to move balloon toward
          let targetX = wagon.x;
          let nearestCorrectY = -Infinity;
          for (const d of demoItems) {
            if (!d.caught && d.isCorrect && d.container.y > nearestCorrectY) {
              nearestCorrectY = d.container.y;
              targetX = d.laneX;
            }
          }
          wagon.x += (targetX - wagon.x) * 0.04 * dt;

          // Move items down and check collision with balloon
          for (const d of demoItems) {
            if (d.caught) continue;
            d.container.y += d.speed * dt;

            if (d.container.y >= wagon.y - 50) {
              d.caught = true;
              if (d.isCorrect) {
                d.container.alpha = 0;
                playCatchSfx();
              } else {
                d.container.alpha = 0.3;
              }
            }
          }

          // Done when all spawned and all caught/fallen
          const allSpawned = nextSpawnIdx >= demoQueue.length;
          const allDone = allSpawned && demoItems.every(d => d.caught || d.container.y > app.screen.height + 60);
          if (allDone) {
            app.ticker.remove(tutTicker);
            setTimeout(() => {
              demoItems.forEach(d => {
                try { if (d.container.parent) app.stage.removeChild(d.container); d.container.destroy({ children: true }); } catch(e) {}
              });
              wagon.x = centerX;
              resolve();
            }, 300);
          }
        }
      };
      app.ticker.add(tutTicker);
    });
  }, [getWordsForSound, getDistractorWords, createDropItem]);

  // Play round intro VO — tutorial runs simultaneously with VO on first round
  const playRoundIntro = useCallback(async (sound) => {
    pausedRef.current = true;

    if (roundIndexRef.current === 0) {
      // Run tutorial animation and VO at the same time
      const voSequence = (async () => {
        await playVO('Catch the items that start with the sound...');
        if (!mountedRef.current) return;
        await delay(300);
        if (!mountedRef.current) return;
        await playLetterSound(sound).catch(() => {});
        if (!mountedRef.current) return;
        await delay(500);
        if (!mountedRef.current) return;
        await playVO('Move the wagon to catch them!');
      })();
      const tutorialAnim = runTutorialAnimation(sound);
      await Promise.all([voSequence, tutorialAnim]);
    } else {
      await playVO('Catch the items that start with the sound...');
      if (!mountedRef.current) return;
      await delay(300);
      if (!mountedRef.current) return;
      await playLetterSound(sound).catch(() => {});
      if (!mountedRef.current) return;
      await delay(500);
      if (!mountedRef.current) return;
      await playVO('Move the wagon to catch them!');
    }

    if (!mountedRef.current) return;
    pausedRef.current = false;
    startIdleReminder();
  }, [startIdleReminder, runTutorialAnimation]);

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
    spawnCountRef.current = 0;
    correctSinceLastRef.current = false;

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

      const lanes = laneCountRef.current;
      spawnCountRef.current++;

      // Guarantee at least one correct word every full cycle through all lanes
      const forceCorrect = spawnCountRef.current % lanes === 0 && !correctSinceLastRef.current;
      const isCorrect = forceCorrect || Math.random() < CORRECT_CHANCE;

      let word;
      if (isCorrect && correctWords.length > 0) {
        word = correctWords[Math.floor(Math.random() * correctWords.length)];
        correctSinceLastRef.current = true;
      } else if (distractorWords.length > 0) {
        word = distractorWords[Math.floor(Math.random() * distractorWords.length)];
      } else {
        word = correctWords[Math.floor(Math.random() * correctWords.length)];
        correctSinceLastRef.current = true;
      }

      // Reset correct tracking each full lane cycle
      if (spawnCountRef.current % lanes === 0) {
        correctSinceLastRef.current = false;
      }

      const { itemContainer, itemSize } = createDropItem(word, w);

      // Grid lanes: pick lane in round-robin, ensure spacing from last item in same lane
      const laneW = w / lanes;
      const lane = nextLaneRef.current % lanes;
      nextLaneRef.current = (nextLaneRef.current + 1) % lanes;
      const spawnX = laneW * lane + laneW / 2;

      // Check vertical spacing: more gap between drops
      const MIN_GAP = itemSize * 2.5;
      const tooClose = itemsRef.current.some(it =>
        !it.caught && Math.abs(it.graphics.x - spawnX) < laneW * 0.5 && it.graphics.y < MIN_GAP
      );
      if (tooClose) return; // skip this spawn, next interval will try again

      itemContainer.x = spawnX;
      itemContainer.y = -itemSize / 2;

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
  }, [getWordsForSound, getDistractorWords, createDropItem]);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let destroyed = false;
    let resizeObs = null;
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
          resolution: 1,
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

        // Resize handler — keeps canvas resolution matched so sprites don't stretch
        resizeObs = new ResizeObserver((entries) => {
          if (destroyed || !appRef.current) return;
          const entry = entries[0];
          if (!entry) return;
          const nW = Math.round(entry.contentRect.width);
          const nH = Math.round(entry.contentRect.height);
          if (nW > 0 && nH > 0) appRef.current.renderer.resize(nW, nH);
        });
        resizeObs.observe(el);

        // Sky background handled by DOM (SkyFullBackground) behind transparent canvas
        if (destroyed) { resizeObs.disconnect(); app.destroy(true); return; }

        // Load hot-air balloon + item bubble textures via Assets.load (PixiJS v8)
        try {
          const texArr = await Promise.all(ITEM_BUBBLE_URLS.map(url => Assets.load(url)));
          itemBubbleTexturesRef.current = texArr;
        } catch (e) { console.warn('Item bubble textures failed:', e); }
        if (destroyed) { app.destroy(true); return; }

        const screenW = app.screen.width;
        const screenH = app.screen.height;

        // Compute lane count based on screen width (3 for phones, more for bigger)
        laneCountRef.current = screenW < 600 ? 3 : screenW < 1100 ? 4 : 5;

        // Hot-air balloon — sized proportionally, raised up from bottom
        const wagonWidth = Math.max(140, Math.min(260, screenW * 0.32));
        const wagonHeight = wagonWidth * 1.4;
        const wagonY = screenH - wagonHeight * 0.5 - 80;

        const wagonContainer = new Container();

        let balloonSprite;
        try {
          const tex = await Assets.load(hotairBalloonUrl);
          balloonSprite = new PixiSprite(tex);
          balloonSprite.anchor.set(0.5);
          balloonSprite.width = wagonWidth;
          balloonSprite.height = wagonHeight;
          wagonContainer.addChild(balloonSprite);
          wagonBodyRef.current = balloonSprite;
        } catch (e) {
          // Fallback: simple colored ellipse
          const body = new Graphics();
          body.ellipse(0, 0, wagonWidth / 2, wagonHeight / 2);
          body.fill('#FFD000');
          wagonContainer.addChild(body);
          wagonBodyRef.current = body;
        }
        if (destroyed) { app.destroy(true); return; }

        wagonContainer.x = screenW / 2;
        wagonContainer.y = wagonY;
        app.stage.addChild(wagonContainer);
        wagonRef.current = wagonContainer;

        // Pointer events to move balloon catcher
        const halfW = wagonWidth / 2;
        app.canvas.addEventListener('pointermove', (e) => {
          if (instructionLockRef.current) return;
          if (!wagonRef.current || destroyedRef.current) return;
          const rect = app.canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * app.screen.width;
          wagonRef.current.x = Math.max(halfW, Math.min(x, app.screen.width - halfW));
        });

        app.canvas.addEventListener('pointerdown', (e) => {
          if (instructionLockRef.current) return;
          if (!wagonRef.current || destroyedRef.current) return;
          const rect = app.canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * app.screen.width;
          wagonRef.current.x = Math.max(halfW, Math.min(x, app.screen.width - halfW));
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
          // Only the upper 60% of the balloon catches (envelope, not basket)
          const catchZoneBottom = wBounds.y + wBounds.height * 0.6;
          const items = itemsRef.current;

          for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.caught) continue;

            item.graphics.y += item.speed * dt;

            // Check collision with upper 60% of balloon only
            const iBounds = item.graphics.getBounds();
            if (
              iBounds.y + iBounds.height > wBounds.y &&
              iBounds.y < catchZoneBottom &&
              iBounds.x + iBounds.width > wBounds.x &&
              iBounds.x < wBounds.x + wBounds.width
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
      // Clean up resize observer
      if (resizeObs) resizeObs.disconnect();
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

      // 3-2-1 GO countdown
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await delay(800);
        if (cancelled) return;
      }
      setCountdown(0); // "GO!"
      await delay(600);
      if (cancelled) return;
      setCountdown(null);

      // Replay instruction VO after countdown
      await playVO('Catch the items that start with the sound...');
      if (cancelled || !mountedRef.current) return;
      await playLetterSound(targetSoundRef.current).catch(() => {});
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
    <div className="h-screen w-screen overflow-hidden relative flex flex-col">
      {/* Full sky background: blue sky + clouds + birds (behind transparent canvas) */}
      <SkyFullBackground />
      {/* 3-2-1 GO countdown overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
            <motion.span
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="font-black"
              style={{
                fontSize: 'clamp(8rem, 30vw, 16rem)',
                color: countdown === 0 ? '#22c55e' : '#ffffff',
                textShadow: '0 4px 30px rgba(0,0,0,0.15)',
              }}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </motion.span>
          </div>
        )}
      </AnimatePresence>
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

      {/* PixiJS canvas container — transparent, above sky layers */}
      <div ref={containerRef} className="absolute inset-0 z-[10]" />
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
