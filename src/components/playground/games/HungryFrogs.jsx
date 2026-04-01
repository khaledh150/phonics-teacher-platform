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

const STAGE1_ROUNDS = 5;
const STAGE2_ROUNDS = 5;
const FLY_COUNT = 4;
const CARD_COUNT = 6;
const CARD_SPACING = 170;
const CARD_SPEED = 50;
const FLY_SPEED_MIN = 75;
const FLY_SPEED_MAX = 125;

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
const buildFlyRounds = (group) => {
  const sounds = group.sounds || [];
  if (sounds.length === 0) return [];
  const targets = shuffle(sounds).slice(0, STAGE1_ROUNDS);
  // If fewer sounds than rounds, cycle
  while (targets.length < STAGE1_ROUNDS && sounds.length > 0) {
    targets.push(sounds[Math.floor(Math.random() * sounds.length)]);
  }
  return targets.map((target) => {
    const pool = sounds.filter((s) => s !== target);
    const distractors = shuffle(pool).slice(0, FLY_COUNT - 1);
    // Fill if not enough distractors
    const fallback = ['x', 'z', 'q', 'w', 'v'];
    while (distractors.length < FLY_COUNT - 1) {
      const f = fallback.shift() || 'k';
      if (f !== target && !distractors.includes(f)) distractors.push(f);
    }
    return { target, flies: shuffle([target, ...distractors]) };
  });
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

const buildFeedRounds = (group) => {
  const words = group.words.map((w) => w.word);
  const allWords = words.map((w) => w.toLowerCase());
  const targets = shuffle(words).slice(0, STAGE2_ROUNDS);
  return targets.map((target) => {
    const distractors = generateDistractors(target, allWords, CARD_COUNT - 1);
    const choices = shuffle([
      { word: target, isTarget: true },
      ...distractors.map((d) => ({ word: d, isTarget: false })),
    ]);
    return { target, choices };
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
  const frogSize = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.25, 280) : 200;

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
            className="absolute bg-white rounded-2xl flex items-center justify-center"
            style={{
              top: -70, left: '50%', transform: 'translateX(-50%)',
              padding: 'clamp(8px, 2.5vw, 16px) clamp(14px, 4vw, 24px)',
              boxShadow: '0px 6px 18px rgba(0,0,0,0.25)',
              zIndex: 60, minWidth: 70,
            }}
          >
            <span className="font-black text-[#3e366b] uppercase"
              style={{ fontSize: bubbleType === 'sound' ? 'clamp(1.8rem, 5vw, 2.8rem)' : 'clamp(1.2rem, 3.5vw, 2rem)' }}>
              {bubbleType === 'sound' ? getDisplaySound(targetLabel) : targetLabel}
            </span>
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid white' }} />
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

      {/* Large lily pad under frog */}
      <div style={{ marginTop: -frogSize * 0.12 }}>
        <Sprite sprite="lilyPad" size={frogSize * 1.35} />
      </div>
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
const FlyBug = ({ letter, x, y, onTap, isEaten, isWrong, size = 65 }) => (
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
      {/* Lily pad behind card */}
      <div className="absolute" style={{ left: -20, top: 50, zIndex: -1 }}>
        <LilyPadSVG size={135} />
      </div>
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
// STAGE 1: CATCH THE FLY
// ═════════════════════════════════════════════════════════════════════════════
const CatchTheFlyStage = ({ group, onComplete }) => {
  const [flyRound, setFlyRound] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [tongueTarget, setTongueTarget] = useState(null);
  const [eatenFlyId, setEatenFlyId] = useState(null);
  const [wrongFlyId, setWrongFlyId] = useState(null);
  const [flyTick, setFlyTick] = useState(0);

  const mountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const idleCountRef = useRef(0);
  const flyPosRef = useRef({});
  const frogRef = useRef(null);

  const [rounds] = useState(() => buildFlyRounds(group));
  const round = rounds[flyRound];

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Fly movement rAF
  useEffect(() => {
    let running = true;
    let lastTime = performance.now();
    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    // Init fly positions
    if (round) {
      const positions = {};
      round.flies.forEach((letter, i) => {
        const speed = FLY_SPEED_MIN + Math.random() * (FLY_SPEED_MAX - FLY_SPEED_MIN);
        positions[`${letter}-${i}`] = {
          x: w() + 80 + i * 180,
          y: h() * 0.55 + (i % 2 === 0 ? -40 : 40) + Math.random() * 30,
          baseY: h() * 0.55 + (i % 2 === 0 ? -40 : 40) + Math.random() * 30,
          speed,
          letter,
        };
      });
      flyPosRef.current = positions;
    }

    let frame = 0;
    const tick = (now) => {
      if (!running) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      frame++;

      const pos = flyPosRef.current;
      const ids = Object.keys(pos);
      for (const id of ids) {
        const p = pos[id];
        p.x -= p.speed * dt;
        p.y = p.baseY + Math.sin(p.x * 0.015) * 25;
        if (p.x < -100) {
          p.x = w() + 80 + Math.random() * 60;
          p.baseY = h() * 0.45 + Math.random() * (h() * 0.25);
          p.y = p.baseY;
        }
      }

      if (frame % 2 === 0) setFlyTick((t) => t + 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [flyRound, round]);

  const speakTarget = useCallback(async () => {
    if (!mountedRef.current) return;
    await playVO('Catch the fly with the sound...');
    if (!mountedRef.current) return;
    await delay(200);
    if (!mountedRef.current) return;
    await playLetterSound(rounds[flyRound]?.target || 'a');
  }, [rounds, flyRound]);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current || isProcessingRef.current) return;
      const count = idleCountRef.current++;
      if (count % 2 === 0) {
        await speakTarget();
      } else {
        await playVO('Catch the fly!');
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
    setEatenFlyId(null);
    setWrongFlyId(null);
    setTongueTarget(null);
    let cancelled = false;
    const run = async () => {
      setIsProcessing(true);
      isProcessingRef.current = true;
      await delay(600);
      if (cancelled) return;
      await playVO('Catch the fly with the sound...');
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      await playLetterSound(rounds[flyRound]?.target || 'a');
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
  }, [flyRound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(idleRef.current);
    };
  }, []);

  const handleFlyTap = useCallback(async (flyId, letter) => {
    if (instructionLock || isProcessingRef.current || !round) return;

    clearTimeout(idleRef.current);
    setIsProcessing(true);
    isProcessingRef.current = true;

    const isCorrect = letter === round.target;
    const flyPos = flyPosRef.current[flyId];

    if (isCorrect) {
      // Get frog center for tongue direction
      const frogRect = frogRef.current?.getBoundingClientRect();
      const frogCX = frogRect ? frogRect.left + frogRect.width / 2 : window.innerWidth / 2;
      const frogCY = frogRect ? frogRect.top + frogRect.height * 0.35 : window.innerHeight * 0.25;
      const dx = (flyPos?.x || 0) - frogCX;
      const dy = (flyPos?.y || 0) - frogCY;
      setTongueTarget({ x: dx, y: dy });
      playTongueSfx();

      await delay(200);
      if (!mountedRef.current) return;
      setEatenFlyId(flyId);
      playCatchSfx();

      await delay(250);
      if (!mountedRef.current) return;
      setTongueTarget(null);
      setMouthOpen(true);
      playMunchSfx();

      await delay(200);
      if (!mountedRef.current) return;
      setMouthOpen(false);
      triggerSmallBurst();
      setShowBubble(false);

      await playVO('Yum!');
      if (!mountedRef.current) return;
      setCelebrating(true);
      await playEncouragement();
      if (!mountedRef.current) return;
      setCelebrating(false);
      await delay(500);
      if (!mountedRef.current) return;

      if (flyRound < rounds.length - 1) {
        setFlyRound((prev) => prev + 1);
        setIsProcessing(false);
        isProcessingRef.current = false;
      } else {
        // Stage 1 complete
        triggerCelebration();
        await playVO('Great catching!');
        if (!mountedRef.current) return;
        onComplete();
      }
    } else {
      setWrongFlyId(flyId);
      playWrongSfx();
      await delay(400);
      if (!mountedRef.current) return;
      setWrongFlyId(null);
      await playVO('Oops, try again!');
      if (!mountedRef.current) return;
      await playLetterSound(round.target);
      if (!mountedRef.current) return;
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    }
  }, [round, flyRound, rounds, startIdleReminder, instructionLock, onComplete]);

  const positions = flyPosRef.current;

  return (
    <>
      {/* Frog — top center */}
      <div className="absolute left-1/2 -translate-x-1/2 z-30" style={{ top: 'clamp(50px, 8vh, 100px)' }}>
        <MotherFrog
          targetLabel={round?.target}
          showBubble={showBubble}
          bubbleType="sound"
          mouthOpen={mouthOpen}
          celebrating={celebrating}
          tongueTarget={tongueTarget}
          frogRef={frogRef}
        />
      </div>

      {/* Flies */}
      <div className="absolute inset-0 z-40">
        {round?.flies.map((letter, i) => {
          const flyId = `${letter}-${i}`;
          const pos = positions[flyId];
          if (!pos || eatenFlyId === flyId) return null;
          return (
            <FlyBug
              key={flyId + '-' + flyRound}
              letter={letter}
              x={pos.x}
              y={pos.y}
              onTap={() => handleFlyTap(flyId, letter)}
              isEaten={eatenFlyId === flyId}
              isWrong={wrongFlyId === flyId}
              size={Math.min(window.innerWidth * 0.08, 70)}
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
// STAGE 2: FEED THE FROG
// ═════════════════════════════════════════════════════════════════════════════
const FeedTheFrogStage = ({ group, onComplete }) => {
  const [currentRound, setCurrentRound] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [cardShaking, setCardShaking] = useState(null);
  const [removedCards, setRemovedCards] = useState(new Set());
  const [showType] = useState(() => Math.random() > 0.5 ? 'picture' : 'text');
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
        y: window.innerHeight * 0.65 + laneOffset,
        baseY: window.innerHeight * 0.65 + laneOffset,
      };
    });
    flowRef.current.positions = positions;
    setRemovedCards(new Set());
  }, [currentRound, round]);

  const speakTarget = useCallback(async () => {
    if (!mountedRef.current) return;
    await playVO('Feed the frog the word...');
    if (!mountedRef.current) return;
    await delay(200);
    if (!mountedRef.current) return;
    await speakAsync(rounds[currentRound]?.target || '');
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
    let cancelled = false;
    const run = async () => {
      setIsProcessing(true);
      isProcessingRef.current = true;
      await delay(600);
      if (cancelled) return;
      await playVO('Feed the frog the word...');
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      await speakAsync(rounds[currentRound]?.target || '');
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
      pointer.x >= frogRect.left - 50 &&
      pointer.x <= frogRect.right + 50 &&
      pointer.y >= frogRect.top - 50 &&
      pointer.y <= frogRect.bottom + 50;

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
      playWrongSfx();
      setCardShaking(card.word);
      setMouthOpen(true);
      await delay(200);
      setMouthOpen(false);
      await playVO('Blegh!');
      if (!mountedRef.current) return;
      await playVO('Oops, try again!');
      if (!mountedRef.current) return;
      await speakAsync(round.target);
      if (!mountedRef.current) return;
      setCardShaking(null);
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    }
  }, [round, currentRound, rounds, startIdleReminder, instructionLock, onComplete]);

  const positions = flowRef.current.positions;

  return (
    <>
      {/* Mother frog — top center */}
      <div
        ref={frogZoneRef}
        className="absolute left-1/2 -translate-x-1/2 z-30"
        style={{ top: 'clamp(50px, 8vh, 100px)' }}
      >
        <MotherFrog
          targetLabel={round?.target}
          showBubble={showBubble}
          bubbleType="word"
          mouthOpen={mouthOpen}
          celebrating={celebrating}
          tongueTarget={null}
          frogRef={frogRef}
        />
      </div>

      {/* Flowing word cards */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {round?.choices.map((c, i) => {
          if (removedCards.has(c.word)) return null;
          const pos = positions[c.word];
          if (!pos) return null;
          return (
            <div key={c.word + '-' + currentRound} className="pointer-events-auto">
              <motion.div
                animate={cardShaking === c.word ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                <FlowingWordCard
                  card={c}
                  posX={pos.x}
                  posY={pos.y}
                  colorIndex={i}
                  onDrop={handleDrop}
                  isProcessing={isProcessing || instructionLock}
                  showType={showType}
                  groupId={group.id}
                />
              </motion.div>
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
const ResultsScreen = ({ onBack, onPlayAgain }) => {
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
          You caught {STAGE1_ROUNDS} flies and fed {STAGE2_ROUNDS} words!
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
        <CatchTheFlyStage group={group} onComplete={() => setGameStage('transition')} />
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
