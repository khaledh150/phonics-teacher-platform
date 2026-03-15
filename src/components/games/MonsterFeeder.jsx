import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio } from '../../utils/letterSounds';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';

const ITEMS_PER_ROUND = 10;
const REAL_WORD_COUNT = 5;
const NONSENSE_WORD_COUNT = 5;

// Pick N random items from array (Fisher-Yates partial shuffle)
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

// Generate CVC nonsense words that aren't real words
const generateNonsenseWords = (group, count) => {
  const consonants = 'bcdfghjklmnpqrstvwxyz'.split('');
  const vowels = 'aeiou'.split('');
  const realWords = new Set(group.words.map((w) => w.word.toLowerCase()));
  const nonsense = new Set();
  let attempts = 0;
  while (nonsense.size < count && attempts < 500) {
    attempts++;
    const c1 = consonants[Math.floor(Math.random() * consonants.length)];
    const v = vowels[Math.floor(Math.random() * vowels.length)];
    const c2 = consonants[Math.floor(Math.random() * consonants.length)];
    const word = c1 + v + c2;
    if (!realWords.has(word) && !nonsense.has(word)) nonsense.add(word);
  }
  return [...nonsense];
};

// Shuffle array in place
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

const playMunchSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) { /* silent */ }
};

const playTrashSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) { /* silent */ }
};

const playWrongSfx = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* silent */ }
};

// --- Main Game Component ---
const MonsterFeederGame = ({ group, onBack, onPlayAgain }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [monsterEating, setMonsterEating] = useState(false);
  const [trashActive, setTrashActive] = useState(false);
  const [cardShaking, setCardShaking] = useState(false);
  const [cardExiting, setCardExiting] = useState(null); // 'monster' | 'trash' | null

  const mountedRef = useRef(true);
  const idleRef = useRef(null);
  const monsterZoneRef = useRef(null);
  const trashZoneRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Build round items: 5 real words + 5 nonsense words, shuffled
  const [items] = useState(() => {
    const realWords = pickRandom(group.words, REAL_WORD_COUNT).map((w) => ({
      word: w.word,
      isReal: true,
    }));
    const nonsenseWords = generateNonsenseWords(group, NONSENSE_WORD_COUNT).map((w) => ({
      word: w,
      isReal: false,
    }));
    return shuffle([...realWords, ...nonsenseWords]);
  });

  const currentItem = items[currentIndex];

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Feed the monster the real words!');
    }, 10000);
  }, []);

  // VO on mount
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const run = async () => {
      await playVO('Feed the monster the real words!');
      if (cancelled) return;
      await delay(1500);
      if (cancelled) return;
      await playVO('Put the silly words in the trash');
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

  const handleDragEnd = useCallback(async (info) => {
    if (isProcessingRef.current || !currentItem) return;

    const cardCenterX = info.point.x;
    const cardCenterY = info.point.y;

    const monsterRect = monsterZoneRef.current?.getBoundingClientRect();
    const trashRect = trashZoneRef.current?.getBoundingClientRect();

    let hitMonster = false;
    let hitTrash = false;

    if (monsterRect) {
      hitMonster =
        cardCenterX >= monsterRect.left &&
        cardCenterX <= monsterRect.right &&
        cardCenterY >= monsterRect.top &&
        cardCenterY <= monsterRect.bottom;
    }
    if (trashRect) {
      hitTrash =
        cardCenterX >= trashRect.left &&
        cardCenterX <= trashRect.right &&
        cardCenterY >= trashRect.top &&
        cardCenterY <= trashRect.bottom;
    }

    // No zone hit — card snaps back automatically via framer-motion
    if (!hitMonster && !hitTrash) return;

    clearTimeout(idleRef.current);
    setIsProcessing(true);
    isProcessingRef.current = true;

    const isCorrect =
      (hitMonster && currentItem.isReal) || (hitTrash && !currentItem.isReal);

    if (isCorrect) {
      // Animate card exiting into the zone
      setCardExiting(hitMonster ? 'monster' : 'trash');

      if (hitMonster) {
        // Real word fed to monster
        playMunchSfx();
        setMonsterEating(true);
        setTimeout(() => setMonsterEating(false), 600);
        await delay(300);
        if (!mountedRef.current) return;
        triggerSmallBurst();
        await playVO('Yum yum!');
        if (!mountedRef.current) return;
        await playEncouragement();
        if (!mountedRef.current) return;
      } else {
        // Nonsense word trashed
        playTrashSfx();
        setTrashActive(true);
        setTimeout(() => setTrashActive(false), 400);
        await delay(300);
        if (!mountedRef.current) return;
        triggerSmallBurst();
      }

      await delay(400);
      if (!mountedRef.current) return;
      setCardExiting(null);

      // Advance to next item or complete
      if (currentIndex < items.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsProcessing(false);
        isProcessingRef.current = false;
        startIdleReminder();
      } else {
        triggerCelebration();
        await playVO('Great job!');
        if (!mountedRef.current) return;
        setGameComplete(true);
      }
    } else {
      // Wrong zone
      playWrongSfx();
      setCardShaking(true);
      await playVO('Blegh!');
      if (!mountedRef.current) return;
      setCardShaking(false);
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    }
  }, [currentItem, currentIndex, items.length, startIdleReminder]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  // Continuous confetti rain on results screen
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#FF6B9D]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-white p-8 md:p-12 text-center max-w-md mx-4"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span
            className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            👾⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#FF6B9D] mb-2">
            Monster Fed!
          </h2>
          <p className="text-[#3e366b]/60 text-sm md:text-base mb-6">
            You sorted all the words!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#FF6B9D] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #E0527E', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-[#3e366b]/70 font-bold text-sm md:text-base"
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
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-gradient-to-b from-[#1a1147] to-[#6B3FA0]">
      {/* Back button */}
      <motion.button
        onClick={handleBack}
        className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
        style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
        whileTap={{ scale: 0.95, y: 3 }}
      >
        <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
      </motion.button>

      {/* Progress dots */}
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-1.5">
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < currentIndex
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === currentIndex
                ? 'bg-[#FF6B9D] w-3 h-3 ring-2 ring-[#FF6B9D]/40'
                : 'bg-white/20 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* Drop zones — center area */}
      <div className="flex-1 flex items-center justify-center gap-6 md:gap-12 lg:gap-20 px-4 md:px-8 pt-14 pb-4">
        {/* Monster zone */}
        <motion.div
          ref={monsterZoneRef}
          className="flex flex-col items-center gap-2 md:gap-3"
          animate={monsterEating ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-28 h-28 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full bg-[#FF6B9D]/20 border-4 border-dashed border-[#FF6B9D]/50 flex items-center justify-center"
            animate={{
              scale: [1, 1.03, 1],
              borderColor: monsterEating
                ? ['rgba(255,107,157,0.8)', 'rgba(255,107,157,1)', 'rgba(255,107,157,0.8)']
                : ['rgba(255,107,157,0.5)', 'rgba(255,107,157,0.3)', 'rgba(255,107,157,0.5)'],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.span
              className="text-5xl md:text-6xl lg:text-7xl select-none"
              animate={
                monsterEating
                  ? { scale: [1, 1.3, 0.9, 1.1, 1], rotate: [0, -10, 10, -5, 0] }
                  : { y: [0, -4, 0] }
              }
              transition={
                monsterEating
                  ? { duration: 0.5 }
                  : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              👾
            </motion.span>
          </motion.div>
          <span className="text-sm md:text-base lg:text-lg font-bold text-[#FF6B9D] tracking-wide">
            Feed Me!
          </span>
        </motion.div>

        {/* Trash zone */}
        <motion.div
          ref={trashZoneRef}
          className="flex flex-col items-center gap-2 md:gap-3"
          animate={trashActive ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="w-28 h-28 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full bg-white/10 border-4 border-dashed border-white/30 flex items-center justify-center"
            animate={{
              scale: [1, 1.02, 1],
              borderColor: trashActive
                ? ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']
                : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.3)'],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.span
              className="text-5xl md:text-6xl lg:text-7xl select-none"
              animate={
                trashActive
                  ? { rotate: [0, -15, 15, -10, 0] }
                  : { rotate: [0, 2, -2, 0] }
              }
              transition={
                trashActive
                  ? { duration: 0.4 }
                  : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              🗑️
            </motion.span>
          </motion.div>
          <span className="text-sm md:text-base lg:text-lg font-bold text-white/60 tracking-wide">
            Trash
          </span>
        </motion.div>
      </div>

      {/* Word card at bottom */}
      <div className="relative z-30 flex items-center justify-center pb-8 md:pb-12 lg:pb-16 pt-4">
        <AnimatePresence mode="wait">
          {currentItem && !cardExiting && (
            <motion.div
              key={`card-${currentIndex}`}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.5}
              dragSnapToOrigin={!isProcessing}
              onDragEnd={(e, info) => handleDragEnd(info)}
              className="cursor-grab active:cursor-grabbing select-none touch-none"
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                x: cardShaking ? [0, -12, 12, -8, 8, -4, 4, 0] : 0,
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={
                cardShaking
                  ? { duration: 0.5, ease: 'easeInOut' }
                  : { type: 'spring', stiffness: 400, damping: 25 }
              }
              whileDrag={{ scale: 1.08, boxShadow: '0px 16px 32px rgba(0,0,0,0.3)' }}
            >
              <div
                className="bg-white px-10 py-5 md:px-14 md:py-6 lg:px-16 lg:py-7 flex items-center justify-center"
                style={{
                  borderRadius: '1.6rem',
                  borderBottom: '5px solid rgba(0,0,0,0.1)',
                  boxShadow: '0px 8px 0px rgba(0,0,0,0.12)',
                  minWidth: 'clamp(140px, 40vw, 240px)',
                }}
              >
                <span className="text-2xl md:text-3xl lg:text-4xl font-black text-[#3e366b] tracking-wider uppercase">
                  {currentItem.word}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exiting card animation */}
        <AnimatePresence>
          {cardExiting && currentItem && (
            <motion.div
              key={`exit-${currentIndex}`}
              className="absolute select-none pointer-events-none"
              initial={{ opacity: 1, scale: 1 }}
              animate={{
                opacity: 0,
                scale: 0.3,
                x: cardExiting === 'monster' ? -120 : 120,
                y: -200,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeIn' }}
            >
              <div
                className="bg-white px-10 py-5 md:px-14 md:py-6 lg:px-16 lg:py-7 flex items-center justify-center"
                style={{
                  borderRadius: '1.6rem',
                  borderBottom: '5px solid rgba(0,0,0,0.1)',
                  boxShadow: '0px 8px 0px rgba(0,0,0,0.12)',
                  minWidth: 'clamp(140px, 40vw, 240px)',
                }}
              >
                <span className="text-2xl md:text-3xl lg:text-4xl font-black text-[#3e366b] tracking-wider uppercase">
                  {currentItem.word}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instruction hint */}
      <div className="fixed bottom-2 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <motion.p
          className="text-white/30 text-xs md:text-sm font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
        >
          Drag the word to the monster or the trash
        </motion.p>
      </div>
    </div>
  );
};

const MonsterFeeder = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <MonsterFeederGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default MonsterFeeder;
