import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../../utils/audioPlayer';
import { stopAllAudio, playBlendingSequence, playLetterSound, getDisplaySound } from '../../../utils/letterSounds';
import { speakAsync } from '../../../utils/speech';
import { triggerSmallBurst, triggerCelebration } from '../../../utils/confetti';
import { playEncouragement } from '../../../utils/encouragement';
import { getWordImage } from '../../../utils/assetHelpers';
import confetti from 'canvas-confetti';
import frogSheet from '../../../assets/characters/set-cute-drawing-frogs.svg';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

const STAGE1_ROUNDS = 5;       // number of sounds to cycle through
const TIME_PER_SOUND = 30;     // seconds per sound
const FLY_TOTAL = 12;          // flies on screen at once
const STAGE2_ROUNDS = 5;
const CARD_COUNT = 6;
const CARD_SPACING = 170;
const CARD_SPEED = 50;
const FLY_SPEED_MIN = 60;
const FLY_SPEED_MAX = 130;

const shuffle = (arr) => {
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
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`${s.x} ${s.y} ${s.w} ${s.h}`}
      width={size} height={size * aspect}
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}>
      <image href={frogSheet} x="0" y="0" width="2000" height="2000" />
    </svg>
  );
};

// ─── Build rounds ───────────────────────────────────────────────────────────
// Build target sound list for Stage 1 (one target per timer round)
const buildFlySoundTargets = (group) => {
  const sounds = group.sounds || [];
  if (sounds.length === 0) return [];
  const targets = shuffle(sounds).slice(0, STAGE1_ROUNDS);
  while (targets.length < STAGE1_ROUNDS && sounds.length > 0) {
    targets.push(sounds[Math.floor(Math.random() * sounds.length)]);
  }
  return targets;
};

// Spawn a swarm of flies: ~40% target, ~60% distractors
const spawnFlySwarm = (target, allSounds, count) => {
  const targetCount = Math.max(3, Math.ceil(count * 0.4));
  const distractorCount = count - targetCount;
  const pool = allSounds.filter((s) => s !== target);
  const fallback = ['x', 'z', 'q', 'w', 'v', 'b', 'f', 'g', 'k', 'l'];
  while (pool.length < distractorCount) {
    const f = fallback.shift() || 'k';
    if (f !== target && !pool.includes(f)) pool.push(f);
  }
  const distractors = [];
  for (let i = 0; i < distractorCount; i++) {
    distractors.push(pool[i % pool.length]);
  }
  const flies = shuffle([
    ...Array(targetCount).fill(target),
    ...distractors,
  ]);
  return flies;
};

const generateDistractors = (targetWord, allGroupWords, count = 5) => {
  const vowels = 'aeiou';
  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const target = targetWord.toLowerCase();
  const distractors = new Set();
  const realWords = new Set(allGroupWords.map((w) => w.toLowerCase()));

  for (let i = 0; i < target.length && distractors.size < 6; i++) {
    if (vowels.includes(target[i])) {
      for (const v of vowels) {
        if (v !== target[i]) {
          const d = target.slice(0, i) + v + target.slice(i + 1);
          if (d !== target && !realWords.has(d)) distractors.add(d);
        }
      }
    }
  }
  if (consonants.includes(target[0])) {
    for (const c of consonants) {
      if (c !== target[0] && distractors.size < 8) {
        const d = c + target.slice(1);
        if (!realWords.has(d)) distractors.add(d);
      }
    }
  }
  const lastChar = target[target.length - 1];
  if (consonants.includes(lastChar)) {
    for (const c of consonants) {
      if (c !== lastChar && distractors.size < 10) {
        const d = target.slice(0, -1) + c;
        if (!realWords.has(d)) distractors.add(d);
      }
    }
  }
  const pool = [...distractors];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  while (picked.length < count) {
    const c1 = consonants[Math.floor(Math.random() * consonants.length)];
    const v = vowels[Math.floor(Math.random() * vowels.length)];
    const c2 = consonants[Math.floor(Math.random() * consonants.length)];
    const w = c1 + v + c2;
    if (w !== target && !picked.includes(w)) picked.push(w);
  }
  return picked;
};

// Stage 2: pick target words, show first letter on frog, display picture cards
const buildFeedRounds = (group) => {
  const allWords = group.words.map((w) => w.word);
  const targets = shuffle(allWords).slice(0, STAGE2_ROUNDS);
  return targets.map((target) => {
    const firstLetter = target[0].toLowerCase();
    // Pick distractors — other group words that DON'T start with the same letter
    const others = allWords.filter((w) => w !== target && w[0].toLowerCase() !== firstLetter);
    const distractors = shuffle(others).slice(0, CARD_COUNT - 1);
    // If not enough, pad with any group words
    while (distractors.length < CARD_COUNT - 1) {
      const extra = allWords.find((w) => w !== target && !distractors.includes(w));
      if (extra) distractors.push(extra);
      else break;
    }
    const choices = shuffle([
      { word: target, isTarget: true },
      ...distractors.map((d) => ({ word: d, isTarget: false })),
    ]);
    return { target, firstLetter, choices };
  });
};

// ─── SFX ─────────────────────────────────────────────────────────────────────
let sharedCtx = null;
const getCtx = () => {
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
};

const playMunchSfx = () => {
  try {
    const ctx = getCtx();
    [0, 0.12].forEach((offset) => {
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.08);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime + offset);
    });
  } catch (e) { /* silent */ }
};

const playWrongSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* silent */ }
};

const playSplashSfx = () => {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(ctx.currentTime);
  } catch (e) { /* silent */ }
};

const playTongueSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* silent */ }
};

const playCatchSfx = () => {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * 0.04;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 5);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(ctx.currentTime);
  } catch (e) { /* silent */ }
};

// ─── Pond Background ─────────────────────────────────────────────────────────
const PondBackground = () => {
  const ripplesRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      frameRef.current++;
      if (ripplesRef.current) {
        const children = ripplesRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const el = children[i];
          const baseX = parseFloat(el.dataset.basex);
          const speed = parseFloat(el.dataset.speed);
          const w = parseFloat(el.dataset.w);
          const newX = ((baseX + frameRef.current * speed) % (window.innerWidth + w + 50)) - w - 25;
          el.style.transform = `translateX(${newX}px)`;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, []);

  const ripples = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      y: 30 + (i / 22) * 60,
      basex: Math.random() * 100,
      speed: 0.25 + Math.random() * 0.4,
      w: 35 + Math.random() * 55,
      opacity: 0.12 + Math.random() * 0.22,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Sky */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '18%', background: 'linear-gradient(180deg, #B8F4FF 0%, #A5EFFF 50%, #8BE8FF 100%)' }} />
      {/* Back bushes — darker, taller */}
      <div className="absolute left-0 right-0" style={{ top: '8%', height: '12%' }}>
        {[0, 0.1, 0.22, 0.35, 0.48, 0.6, 0.72, 0.85, 1].map((pos, i) => (
          <div key={`bb${i}`} className="absolute rounded-full" style={{
            left: `${pos * 100}%`, top: i % 2 === 0 ? '-20%' : '0%',
            width: 'clamp(90px, 15vw, 170px)', height: 'clamp(55px, 9vw, 110px)',
            background: '#087A42', transform: 'translateX(-50%)',
          }} />
        ))}
      </div>
      {/* Front bushes — brighter */}
      <div className="absolute left-0 right-0" style={{ top: '12%', height: '10%' }}>
        {[0, 0.12, 0.28, 0.42, 0.58, 0.72, 0.88, 1].map((pos, i) => (
          <div key={`bf${i}`} className="absolute rounded-full" style={{
            left: `${pos * 100}%`, top: i % 2 === 0 ? '-30%' : '-10%',
            width: 'clamp(80px, 14vw, 160px)', height: 'clamp(50px, 8vw, 100px)',
            background: i % 2 === 0 ? '#0D9B5C' : '#15B86A',
            transform: 'translateX(-50%)',
          }} />
        ))}
      </div>
      {/* Water */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: '18%', background: 'linear-gradient(180deg, #4DD8F0 0%, #38CCE8 40%, #22C0E0 100%)' }}>
        <div ref={ripplesRef} className="absolute inset-0 overflow-hidden">
          {ripples.map((r) => (
            <div key={r.id} data-basex={r.basex} data-speed={r.speed} data-w={r.w}
              className="absolute rounded-full"
              style={{ top: `${r.y}%`, width: r.w, height: 3, background: `rgba(255,255,255,${r.opacity})` }}
            />
          ))}
        </div>
      </div>
      {/* Cattails */}
      <div className="absolute" style={{ left: 0, bottom: 0, zIndex: 2 }}><CattailGroup flip={false} /></div>
      <div className="absolute" style={{ right: 0, bottom: 0, zIndex: 2 }}><CattailGroup flip={true} /></div>
      {/* Foreground plants */}
      {[{ l: '-3%', s: 90 }, { l: '4%', s: 70 }, { r: '-3%', s: 85 }, { r: '5%', s: 65 }].map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{
          bottom: '-30px',
          ...(p.l != null ? { left: p.l } : { right: p.r }),
          width: p.s, height: p.s,
          background: i % 2 === 0 ? '#0CAA4A' : '#12C456',
          zIndex: 3,
        }} />
      ))}
    </div>
  );
};

const CattailGroup = ({ flip }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120" width={50} height={100}
    style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}>
    <line x1="30" y1="120" x2="28" y2="30" stroke="#189313" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="28" cy="22" rx="4" ry="12" fill="#DC804F" />
    <line x1="38" y1="120" x2="40" y2="50" stroke="#189313" strokeWidth="2.5" strokeLinecap="round" />
    <ellipse cx="40" cy="42" rx="3.5" ry="10" fill="#B86E3F" />
    <path d="M30 80 Q15 70 10 55" fill="none" stroke="#62C903" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 65 Q45 55 50 42" fill="none" stroke="#00B401" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// ─── Mother Frog ─────────────────────────────────────────────────────────────
const MotherFrog = ({ targetLabel, showBubble, bubbleType, mouthOpen, celebrating, tongueTarget, frogRef }) => {
  const frogSize = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.45, 450) : 300;

  return (
    <div className="flex flex-col items-center relative" ref={frogRef}>
      {/* Speech bubble */}
      <AnimatePresence>
        {showBubble && targetLabel && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              top: '50%', left: '55%', transform: 'translate(-50%, -50%)',
              zIndex: 60,
            }}
          >
            <span className="font-black uppercase"
              style={{
                fontSize: 'clamp(3rem, 9vw, 5rem)',
                color: '#fff',
                textShadow: '0 3px 10px rgba(0,0,0,0.6), 0 0 25px rgba(255,255,255,0.3)',
              }}>
              {bubbleType === 'sound' ? getDisplaySound(targetLabel) : targetLabel}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tongue */}
      <AnimatePresence>
        {tongueTarget && (
          <TongueOverlay tongueTarget={tongueTarget} frogSize={frogSize} />
        )}
      </AnimatePresence>

      {/* Frog body */}
      <motion.div
        animate={
          celebrating
            ? { y: [0, -25, 0, -18, 0], scale: [1, 1.15, 1, 1.1, 1], rotate: [0, -4, 4, -2, 0] }
            : mouthOpen
              ? { scale: [1, 1.08, 0.97, 1], y: [0, -3, 0] }
              : { scale: [1, 1.02, 1] }
        }
        transition={
          celebrating
            ? { duration: 1, repeat: 2 }
            : mouthOpen
              ? { duration: 0.35 }
              : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <Sprite sprite="frogOnPad" size={frogSize} />
      </motion.div>

    </div>
  );
};

// ─── Tongue Overlay ──────────────────────────────────────────────────────────
const TongueOverlay = ({ tongueTarget, frogSize }) => {
  const dx = tongueTarget.x;
  const dy = tongueTarget.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: '50%', top: frogSize * 0.3,
        height: 14, borderRadius: 7,
        backgroundColor: '#E53935',
        transformOrigin: 'left center',
        transform: `rotate(${angle}deg)`,
        zIndex: 55,
      }}
      initial={{ width: 0 }}
      animate={{ width: [0, dist, dist, 0] }}
      transition={{ duration: 0.44, times: [0, 0.4, 0.55, 1], ease: 'easeInOut' }}
    />
  );
};

// ─── Fly Sprite for Stage 1 ─────────────────────────────────────────────────
const FlyBug = ({ letter, x, y, onTap, isEaten, isWrong, size = 150 }) => (
  <motion.div
    className="absolute flex items-center justify-center cursor-pointer"
    style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, zIndex: 100 }}
    onClick={(e) => { e.stopPropagation(); if (!isEaten && onTap) onTap(); }}
    animate={
      isEaten ? { scale: 0, opacity: 0 } :
      isWrong ? { x: [0, -10, 10, -6, 6, 0], scale: [1, 0.9, 1] } :
      {}
    }
    transition={isEaten ? { duration: 0.3 } : isWrong ? { duration: 0.4 } : {}}
  >
    <Sprite sprite="fly" size={size} />
    {/* Letter circle overlay */}
    <div className="absolute flex items-center justify-center rounded-full bg-white/95 shadow-md"
      style={{
        width: size * 0.45, height: size * 0.45,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }}>
      <span className="font-black text-[#8B2FC9]" style={{ fontSize: size * 0.22 }}>
        {getDisplaySound(letter)}
      </span>
    </div>
  </motion.div>
);

// ─── Lily Pad SVG ───────────────────────────────────────────────────────────
const LilyPadSVG = ({ size = 130 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 50" width={size} height={size * (50 / 120)} style={{ display: 'block' }}>
    <defs>
      <linearGradient id="lpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2ECC71" />
        <stop offset="100%" stopColor="#1E8449" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="28" rx="58" ry="22" fill="url(#lpGrad)" />
    <path d="M10 28 Q15 18 25 22 Q35 16 45 22 Q55 16 65 22 Q75 16 85 22 Q95 16 105 22 Q110 28 105 34 Q95 40 85 34 Q75 40 65 34 Q55 40 45 34 Q35 40 25 34 Q15 38 10 28" fill="none" stroke="white" strokeWidth="2.5" opacity="0.5" />
    <path d="M60 6 L52 28 L68 28 Z" fill="#4DD8F0" />
  </svg>
);

// ─── Flowing Word Card (Stage 2) ────────────────────────────────────────────
const CARD_COLORS = ['#E040FB', '#7C4DFF', '#40C4FF', '#69F0AE', '#FFAB40', '#FF5252', '#EA80FC', '#64FFDA', '#FF6B9D', '#8BC34A'];

const FlowingWordCard = ({ card, posX, posY, colorIndex, onDrop, isProcessing, showType, groupId }) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const cardColor = CARD_COLORS[colorIndex % CARD_COLORS.length];
  const imgUrl = getWordImage(groupId, card.word);
  const cardSize = 'clamp(78px, 15vw, 105px)';

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const t = e.touches?.[0] || e;
      lastPointerRef.current = { x: t.clientX, y: t.clientY };
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onMove);
    };
  }, [isDragging]);

  return (
    <div className="absolute" style={{ left: posX, top: posY, zIndex: isDragging ? 200 : 50 }}>
      {/* Draggable card */}
      <motion.div
        className="cursor-grab active:cursor-grabbing select-none touch-none"
        drag={!isProcessing}
        dragSnapToOrigin
        dragElastic={0.3}
        dragMomentum={false}
        onDragStart={(e) => {
          setIsDragging(true);
          const t = e.touches?.[0] || e;
          lastPointerRef.current = { x: t.clientX || 0, y: t.clientY || 0 };
        }}
        onDragEnd={() => {
          setIsDragging(false);
          onDrop(card, lastPointerRef.current);
        }}
        animate={{ scale: isDragging ? 1.15 : 1, rotate: isDragging ? 3 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="flex items-center justify-center overflow-hidden"
          style={{
            width: cardSize, height: cardSize,
            borderRadius: '1.1rem', backgroundColor: cardColor,
            boxShadow: isDragging ? '0px 14px 35px rgba(0,0,0,0.3)' : '0px 6px 0px rgba(0,0,0,0.15)',
            padding: 4,
          }}>
          <div className="w-full h-full bg-white rounded-[0.8rem] flex items-center justify-center overflow-hidden">
            {showType === 'picture' && imgUrl ? (
              <img src={imgUrl} alt={card.word} className="w-[85%] h-[85%] object-contain select-none" draggable={false} />
            ) : (
              <span className="text-base md:text-lg lg:text-xl font-black text-[#333] text-center leading-tight uppercase">
                {card.word}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// STAGE 1: CATCH THE FLY — Balloon-popping style (timer + swarm + score)
// ═════════════════════════════════════════════════════════════════════════════
const CatchTheFlyStage = ({ group, onComplete, onScoreUpdate }) => {
  const [soundIdx, setSoundIdx] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [tongueTarget, setTongueTarget] = useState(null);
  const [flyTick, setFlyTick] = useState(0);
  const [displayTimeLeft, setDisplayTimeLeft] = useState(TIME_PER_SOUND);
  const [score, setScore] = useState(0);
  const [frogGrowth, setFrogGrowth] = useState(0); // grows with each catch
  const [popFlash, setPopFlash] = useState(null);

  const mountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const flyPosRef = useRef({});
  const frogRef = useRef(null);
  const timerRef = useRef(null);
  const timeLeftRef = useRef(TIME_PER_SOUND);
  const transitioningRef = useRef(false);
  const scoreRef = useRef(0);
  const soundScoreRef = useRef(0);
  const eatenSetRef = useRef(new Set());
  const nextFlyIdRef = useRef(0);

  const [soundTargets] = useState(() => buildFlySoundTargets(group));
  const allSounds = group.sounds || [];
  const currentTarget = soundTargets[soundIdx];

  const flySize = Math.min(window.innerWidth * 0.12, 130);
  // Frog grows slightly per catch, capped so it doesn't overflow
  const baseFrogSize = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.45, 450) : 300;
  const frogScale = 1 + Math.min(frogGrowth * 0.012, 0.25); // max +25%

  // Spawn a swarm of flies
  const spawnSwarm = useCallback((target) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const flyLetters = spawnFlySwarm(target, allSounds, FLY_TOTAL);
    const positions = {};
    flyLetters.forEach((letter, i) => {
      const id = `fly-${nextFlyIdRef.current++}`;
      const speed = FLY_SPEED_MIN + Math.random() * (FLY_SPEED_MAX - FLY_SPEED_MIN);
      const lane = i % 4;
      let baseY;
      if (lane === 0) baseY = h * 0.08 + Math.random() * (h * 0.15);
      else if (lane === 1) baseY = h * 0.75 + Math.random() * (h * 0.18);
      else if (lane === 2) baseY = h * 0.25 + Math.random() * (h * 0.1);
      else baseY = h * 0.6 + Math.random() * (h * 0.1);
      positions[id] = {
        x: -(50 + i * (w / FLY_TOTAL) + Math.random() * 100), // start off-screen LEFT
        y: baseY,
        baseY,
        speed,
        letter,
      };
    });
    flyPosRef.current = positions;
    eatenSetRef.current = new Set();
  }, [allSounds]);

  // Fly movement rAF — LEFT TO RIGHT
  useEffect(() => {
    let running = true;
    let lastTime = performance.now();
    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    spawnSwarm(currentTarget);

    let frame = 0;
    const tick = (now) => {
      if (!running) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      frame++;

      const pos = flyPosRef.current;
      for (const id of Object.keys(pos)) {
        if (eatenSetRef.current.has(id)) continue;
        const p = pos[id];
        p.x += p.speed * dt; // LEFT TO RIGHT
        p.y = p.baseY + Math.sin(p.x * 0.012) * 20;
        if (p.x > w() + 150) {
          // Re-spawn from left
          p.x = -(60 + Math.random() * 120);
          const lane = Math.floor(Math.random() * 4);
          if (lane === 0) p.baseY = h() * 0.08 + Math.random() * (h() * 0.15);
          else if (lane === 1) p.baseY = h() * 0.75 + Math.random() * (h() * 0.18);
          else if (lane === 2) p.baseY = h() * 0.25 + Math.random() * (h() * 0.1);
          else p.baseY = h() * 0.6 + Math.random() * (h() * 0.1);
          p.y = p.baseY;
          const targetRatio = Math.random();
          p.letter = targetRatio < 0.4 ? currentTarget : allSounds[Math.floor(Math.random() * allSounds.length)] || currentTarget;
        }
      }

      if (frame % 2 === 0) setFlyTick((t) => t + 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [soundIdx, currentTarget, spawnSwarm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer — 30s per sound
  useEffect(() => {
    if (instructionLock) return;
    timeLeftRef.current = TIME_PER_SOUND;
    setDisplayTimeLeft(TIME_PER_SOUND);
    soundScoreRef.current = 0;

    timerRef.current = setInterval(() => {
      if (!mountedRef.current) { clearInterval(timerRef.current); return; }
      if (transitioningRef.current) return;

      timeLeftRef.current -= 1;
      setDisplayTimeLeft(timeLeftRef.current);

      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current);
        transitioningRef.current = true;

        const nextIdx = soundIdx + 1;
        if (nextIdx >= soundTargets.length) {
          const finish = async () => {
            triggerCelebration();
            await playVO("Time's up!");
            if (!mountedRef.current) return;
            await delay(500);
            if (!mountedRef.current) return;
            await playVO('Great catching!');
            if (!mountedRef.current) return;
            onScoreUpdate?.(scoreRef.current);
            onComplete();
          };
          finish();
        } else {
          const transition = async () => {
            const caughtThisRound = soundScoreRef.current;
            triggerSmallBurst();
            setPopFlash({ sound: currentTarget, count: caughtThisRound });
            await playVO("Time's up!");
            if (!mountedRef.current) return;
            await delay(1200);
            if (!mountedRef.current) return;
            setPopFlash(null);
            setSoundIdx(nextIdx);
            transitioningRef.current = false;
          };
          transition();
        }
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [instructionLock, soundIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sound announcement
  useEffect(() => {
    mountedRef.current = true;
    setInstructionLock(true);
    setShowBubble(false);
    setFrogGrowth(0);
    let cancelled = false;
    const run = async () => {
      isProcessingRef.current = true;
      await delay(500);
      if (cancelled) return;
      await playVO('Catch the flies with the sound...');
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      await playLetterSound(currentTarget || 'a');
      if (cancelled) return;
      setShowBubble(true);
      isProcessingRef.current = false;
      setInstructionLock(false);
    };
    run();
    return () => { cancelled = true; clearTimeout(idleRef.current); };
  }, [soundIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(idleRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  const handleFlyTap = useCallback((flyId, letter) => {
    if (instructionLock || isProcessingRef.current || transitioningRef.current) return;
    if (eatenSetRef.current.has(flyId)) return;

    const isCorrect = letter === currentTarget;
    const flyPos = flyPosRef.current[flyId];

    if (isCorrect) {
      // Tongue shoots toward fly
      const frogRect = frogRef.current?.getBoundingClientRect();
      const frogCX = frogRect ? frogRect.left + frogRect.width / 2 : window.innerWidth / 2;
      const frogCY = frogRect ? frogRect.top + frogRect.height * 0.35 : window.innerHeight / 2;
      const dx = (flyPos?.x || 0) - frogCX;
      const dy = (flyPos?.y || 0) - frogCY;
      setTongueTarget({ x: dx, y: dy });
      playTongueSfx();

      // After tongue extends, eat the fly
      setTimeout(() => {
        if (!mountedRef.current) return;
        eatenSetRef.current.add(flyId);
        scoreRef.current += 1;
        soundScoreRef.current += 1;
        setScore(scoreRef.current);
        setFrogGrowth((g) => g + 1);
        playCatchSfx();
        playMunchSfx();
        triggerSmallBurst();
        setMouthOpen(true);
        setTimeout(() => {
          if (mountedRef.current) {
            setMouthOpen(false);
            setTongueTarget(null);
          }
        }, 250);
      }, 220);
    } else {
      playWrongSfx();
    }
  }, [currentTarget, instructionLock]);

  const positions = flyPosRef.current;
  const flyEntries = Object.entries(positions);

  return (
    <>
      {/* Frog — centered, grows with catches */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30"
        style={{ transform: `translate(-50%, -50%) scale(${frogScale})`, transition: 'transform 0.3s ease-out' }}>
        <MotherFrog
          targetLabel={currentTarget}
          showBubble={showBubble}
          bubbleType="sound"
          mouthOpen={mouthOpen}
          celebrating={celebrating}
          tongueTarget={tongueTarget}
          frogRef={frogRef}
        />
      </div>

      {/* Timer + Score HUD */}
      <div className="fixed top-3 right-3 z-[60] flex items-center gap-2">
        <div className={`bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 font-bold text-sm ${displayTimeLeft <= 5 ? 'text-red-400' : 'text-white/80'}`}>
          {displayTimeLeft}s
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 font-bold text-sm text-[#FFD000]">
          {score} caught
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 font-semibold text-xs text-white/60">
          {soundIdx + 1}/{soundTargets.length}
        </div>
      </div>

      {/* Pop flash — shows between sounds */}
      <AnimatePresence>
        {popFlash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
          >
            <div className="bg-white/90 rounded-3xl px-8 py-6 text-center" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
              <span className="text-4xl font-black text-[#1E8449] block mb-1">{popFlash.count}</span>
              <span className="text-lg font-bold text-[#3e366b]/70">
                "{getDisplaySound(popFlash.sound)}" flies caught!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flies */}
      <div className="absolute inset-0 z-40 overflow-hidden">
        {flyEntries.map(([flyId, pos]) => {
          if (eatenSetRef.current.has(flyId)) return null;
          return (
            <FlyBug
              key={flyId}
              letter={pos.letter}
              x={pos.x}
              y={pos.y}
              onTap={() => handleFlyTap(flyId, pos.letter)}
              isEaten={eatenSetRef.current.has(flyId)}
              isWrong={false}
              size={flySize}
            />
          );
        })}
      </div>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// STAGE TRANSITION
// ═════════════════════════════════════════════════════════════════════════════
const StageTransition = ({ onDone }) => {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const run = async () => {
      await delay(400);
      if (cancelled) return;
      await playVO("Great! Now let's feed the frog some words!");
      if (cancelled) return;
      await delay(800);
      if (cancelled) return;
      onDone();
    };
    run();
    return () => { cancelled = true; mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="mb-6"
      >
        <Sprite sprite="frogOnPad2" size={180} style={{ margin: '0 auto' }} />
      </motion.div>
      <motion.h2
        className="text-2xl md:text-4xl font-black text-white text-center px-6"
        style={{ textShadow: '0 3px 12px rgba(0,0,0,0.4)' }}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Now let's feed the frog!
      </motion.h2>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// STAGE 2: FEED THE FROG — letter on belly, picture cards, frog on right
// ═════════════════════════════════════════════════════════════════════════════
const FeedTheFrogStage = ({ group, onComplete }) => {
  const [currentRound, setCurrentRound] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [frogShakeWrong, setFrogShakeWrong] = useState(false);
  const [removedCards, setRemovedCards] = useState(new Set());
  const [flowTick, setFlowTick] = useState(0);

  const mountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const idleCountRef = useRef(0);
  const frogZoneRef = useRef(null);
  const frogRef = useRef(null);
  const flowRef = useRef({ positions: {}, frame: 0 });

  const [rounds] = useState(() => buildFeedRounds(group));
  const round = rounds[currentRound];

  // Smaller frog for stage 2 (right side)
  const stage2FrogSize = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.28, 280) : 200;

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Flow animation — rAF
  useEffect(() => {
    let running = true;
    let lastTime = performance.now();

    const tick = (now) => {
      if (!running) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      flowRef.current.frame++;

      const pos = flowRef.current.positions;
      const w = window.innerWidth;
      const ids = Object.keys(pos);

      for (const id of ids) {
        const p = pos[id];
        p.x += CARD_SPEED * dt;
        if (p.x > w + 150) {
          const minX = Math.min(...ids.map((k) => pos[k]?.x ?? 0));
          p.x = minX - CARD_SPACING;
        }
        p.y = p.baseY + Math.sin(p.x * 0.012) * 14;
      }

      if (flowRef.current.frame % 2 === 0) setFlowTick((t) => t + 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, []);

  // Init card positions on round change
  useEffect(() => {
    if (!round) return;
    const positions = {};
    round.choices.forEach((c, i) => {
      const laneOffset = i % 2 === 0 ? -25 : 25;
      positions[c.word] = {
        x: -CARD_SPACING - i * CARD_SPACING,
        y: window.innerHeight * 0.55 + laneOffset,
        baseY: window.innerHeight * 0.55 + laneOffset,
      };
    });
    flowRef.current.positions = positions;
    setRemovedCards(new Set());
  }, [currentRound, round]);

  const speakTarget = useCallback(async () => {
    if (!mountedRef.current) return;
    await playVO('Feed the frog the picture that starts with...');
    if (!mountedRef.current) return;
    await delay(200);
    if (!mountedRef.current) return;
    await playLetterSound(rounds[currentRound]?.firstLetter || 'a');
  }, [rounds, currentRound]);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current || isProcessingRef.current) return;
      const count = idleCountRef.current++;
      if (count % 2 === 0) {
        await speakTarget();
      } else {
        await playVO('Feed me!');
      }
      if (!mountedRef.current || isProcessingRef.current) return;
      startIdleReminder();
    }, 8000);
  }, [speakTarget]);

  // Round announcement
  useEffect(() => {
    mountedRef.current = true;
    setInstructionLock(true);
    setShowBubble(false);
    setFrogShakeWrong(false);
    let cancelled = false;
    const run = async () => {
      setIsProcessing(true);
      isProcessingRef.current = true;
      await delay(600);
      if (cancelled) return;
      await playVO('Feed the frog the picture that starts with...');
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      await playLetterSound(rounds[currentRound]?.firstLetter || 'a');
      if (cancelled) return;
      setShowBubble(true);
      setIsProcessing(false);
      isProcessingRef.current = false;
      setInstructionLock(false);
      idleCountRef.current = 0;
      startIdleReminder();
    };
    run();
    return () => { cancelled = true; clearTimeout(idleRef.current); };
  }, [currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(idleRef.current);
    };
  }, []);

  const handleDrop = useCallback(async (card, pointer) => {
    if (instructionLock || isProcessingRef.current || !round) return;

    const frogRect = frogZoneRef.current?.getBoundingClientRect();
    if (!frogRect) return;

    const hitFrog =
      pointer.x >= frogRect.left - 60 &&
      pointer.x <= frogRect.right + 60 &&
      pointer.y >= frogRect.top - 60 &&
      pointer.y <= frogRect.bottom + 60;

    if (!hitFrog) {
      playSplashSfx();
      setRemovedCards((prev) => new Set([...prev, card.word]));
      return;
    }

    clearTimeout(idleRef.current);
    setIsProcessing(true);
    isProcessingRef.current = true;

    if (card.isTarget) {
      setRemovedCards((prev) => new Set([...prev, card.word]));
      playMunchSfx();
      setMouthOpen(true);
      setShowBubble(false);
      await delay(200);
      if (!mountedRef.current) return;
      setMouthOpen(false);
      triggerSmallBurst();
      await playVO('Yum, yum!');
      if (!mountedRef.current) return;
      setCelebrating(true);
      await playBlendingSequence(round.target, (w) => speakAsync(w));
      if (!mountedRef.current) return;
      await delay(300);
      if (!mountedRef.current) return;
      await playEncouragement();
      if (!mountedRef.current) return;
      setCelebrating(false);
      await delay(800);
      if (!mountedRef.current) return;

      if (currentRound < rounds.length - 1) {
        setCurrentRound((prev) => prev + 1);
        setIsProcessing(false);
        isProcessingRef.current = false;
      } else {
        triggerCelebration();
        await playVO('Great job!');
        if (!mountedRef.current) return;
        onComplete();
      }
    } else {
      // WRONG: frog shakes red, card disappears, lily pad stays empty
      playWrongSfx();
      setFrogShakeWrong(true);
      setRemovedCards((prev) => new Set([...prev, card.word]));
      await delay(600);
      if (!mountedRef.current) return;
      setFrogShakeWrong(false);
      await playVO('Oops, try again!');
      if (!mountedRef.current) return;
      await playLetterSound(round.firstLetter);
      if (!mountedRef.current) return;
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    }
  }, [round, currentRound, rounds, startIdleReminder, instructionLock, onComplete]);

  const positions = flowRef.current.positions;

  return (
    <>
      {/* Mother frog — RIGHT side, smaller, with letter on belly */}
      <motion.div
        ref={frogZoneRef}
        className="absolute z-30"
        style={{ right: 'clamp(20px, 4vw, 80px)', top: '50%', transform: 'translateY(-50%)' }}
        animate={frogShakeWrong ? { x: [0, -15, 15, -10, 10, -5, 5, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center relative" ref={frogRef}>
          {/* Letter on belly — no background */}
          <AnimatePresence>
            {showBubble && round?.firstLetter && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute flex items-center justify-center pointer-events-none"
                style={{ top: '50%', left: '55%', transform: 'translate(-50%, -50%)', zIndex: 60 }}
              >
                <span className="font-black uppercase"
                  style={{
                    fontSize: 'clamp(2.5rem, 7vw, 4rem)',
                    color: frogShakeWrong ? '#EF4444' : '#fff',
                    textShadow: '0 3px 10px rgba(0,0,0,0.6), 0 0 25px rgba(255,255,255,0.3)',
                    transition: 'color 0.2s',
                  }}>
                  {getDisplaySound(round.firstLetter)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Frog body */}
          <motion.div
            animate={
              celebrating
                ? { y: [0, -25, 0, -18, 0], scale: [1, 1.15, 1, 1.1, 1], rotate: [0, -4, 4, -2, 0] }
                : mouthOpen
                  ? { scale: [1, 1.08, 0.97, 1], y: [0, -3, 0] }
                  : { scale: [1, 1.02, 1] }
            }
            transition={
              celebrating
                ? { duration: 1, repeat: 2 }
                : mouthOpen
                  ? { duration: 0.35 }
                  : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
            }
            style={{ filter: frogShakeWrong ? 'hue-rotate(-60deg) saturate(2) brightness(0.9)' : 'none', transition: 'filter 0.2s' }}
          >
            <Sprite sprite="frogOnPad" size={stage2FrogSize} />
          </motion.div>
        </div>
      </motion.div>

      {/* Flowing picture cards */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {round?.choices.map((c, i) => {
          const pos = positions[c.word];
          if (!pos) return null;
          const isRemoved = removedCards.has(c.word);
          return (
            <div key={c.word + '-' + currentRound} className="pointer-events-auto">
              {/* Lily pad always visible (bigger) */}
              <div className="absolute" style={{ left: pos.x - 25, top: pos.y + 45, zIndex: 10 }}>
                <LilyPadSVG size={180} />
              </div>
              {/* Card — only if not removed */}
              {!isRemoved && (
                <FlowingWordCard
                  card={c}
                  posX={pos.x}
                  posY={pos.y}
                  colorIndex={i}
                  onDrop={handleDrop}
                  isProcessing={isProcessing || instructionLock}
                  showType="picture"
                  groupId={group.id}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// RESULTS SCREEN
// ═════════════════════════════════════════════════════════════════════════════
const ResultsScreen = ({ onBack, onPlayAgain, fliesCaught = 0 }) => {
  // Confetti rain
  useEffect(() => {
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
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="bg-white/90 backdrop-blur-sm border-t-4 border-[#2ECC71] p-8 md:p-12 text-center max-w-md mx-4"
        style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-4"
        >
          <Sprite sprite="frogOnPad" size={130} style={{ margin: '0 auto' }} />
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#1E8449] mb-2">Frog Master!</h2>
        <p className="text-[#3e366b]/60 text-sm md:text-base mb-6">
          You caught {fliesCaught} flies and fed {STAGE2_ROUNDS} words!
        </p>
        <div className="flex gap-3 justify-center">
          <motion.button
            onClick={onBack}
            className="px-5 py-3 bg-[#6B3FA0] text-white font-bold rounded-2xl text-sm md:text-base"
            style={{ borderBottom: '4px solid #5A2D91', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
            whileTap={{ scale: 0.95, y: 3 }}
          >
            Back
          </motion.button>
          <motion.button
            onClick={onPlayAgain}
            className="px-5 py-3 bg-[#2ECC71] text-white font-bold rounded-2xl text-sm md:text-base"
            style={{ borderBottom: '4px solid #1E8449', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
            whileTap={{ scale: 0.95, y: 3 }}
          >
            Play Again
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN GAME ORCHESTRATOR
// ═════════════════════════════════════════════════════════════════════════════
const HungryFrogsGame = ({ group, onBack, onPlayAgain }) => {
  const [gameStage, setGameStage] = useState('fly'); // 'fly' | 'transition' | 'feed' | 'results'
  const [fliesCaught, setFliesCaught] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
    };
  }, []);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    onBack();
  };

  const stageName = gameStage === 'fly' ? 'Catch the Fly!' : gameStage === 'feed' ? 'Feed the Frog!' : '';

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <PondBackground />

      {/* Back + Fullscreen */}
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
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* HUD — stage name */}
      {stageName && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1">
          <span className="text-base md:text-xl lg:text-2xl font-bold text-white drop-shadow-md">
            {stageName}
          </span>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-0.5">
            <span className="text-white/80 font-semibold text-xs md:text-sm">
              Stage {gameStage === 'fly' ? '1' : '2'} of 2
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen button on results */}
      {gameStage === 'results' && (
        <motion.button
          onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      )}

      {/* Stages */}
      {gameStage === 'fly' && (
        <CatchTheFlyStage group={group} onComplete={() => setGameStage('transition')} onScoreUpdate={(s) => setFliesCaught(s)} />
      )}
      {gameStage === 'transition' && (
        <StageTransition onDone={() => setGameStage('feed')} />
      )}
      {gameStage === 'feed' && (
        <FeedTheFrogStage group={group} onComplete={() => setGameStage('results')} />
      )}
      {gameStage === 'results' && (
        <ResultsScreen
          onBack={handleBack}
          onPlayAgain={() => onPlayAgain ? onPlayAgain() : window.location.reload()}
          fliesCaught={fliesCaught}
        />
      )}
    </div>
  );
};

// ─── Wrapper with gameKey for replay ─────────────────────────────────────────
const HungryFrogs = ({ group, onBack }) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <HungryFrogsGame
      key={gameKey}
      group={group}
      onBack={onBack}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default HungryFrogs;
