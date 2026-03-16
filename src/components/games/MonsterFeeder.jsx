import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio, playBlendingSequence } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import confetti from 'canvas-confetti';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const ROUNDS = 5;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Generate 2 distractors that look similar to the target word.
 * Strategy: swap a vowel or change the first consonant.
 */
const generateDistractors = (targetWord, allGroupWords) => {
  const vowels = 'aeiou';
  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const target = targetWord.toLowerCase();
  const distractors = new Set();
  const realWords = new Set(allGroupWords.map((w) => w.toLowerCase()));

  // Strategy 1: change each vowel in the word
  for (let i = 0; i < target.length && distractors.size < 4; i++) {
    if (vowels.includes(target[i])) {
      for (const v of vowels) {
        if (v !== target[i]) {
          const d = target.slice(0, i) + v + target.slice(i + 1);
          if (d !== target && !realWords.has(d)) distractors.add(d);
        }
      }
    }
  }

  // Strategy 2: change first consonant
  if (consonants.includes(target[0])) {
    for (const c of consonants) {
      if (c !== target[0] && distractors.size < 6) {
        const d = c + target.slice(1);
        if (!realWords.has(d)) distractors.add(d);
      }
    }
  }

  // Strategy 3: change last consonant
  const lastChar = target[target.length - 1];
  if (consonants.includes(lastChar)) {
    for (const c of consonants) {
      if (c !== lastChar && distractors.size < 8) {
        const d = target.slice(0, -1) + c;
        if (!realWords.has(d)) distractors.add(d);
      }
    }
  }

  // Pick 2 random distractors from pool
  const pool = [...distractors];
  const picked = [];
  while (picked.length < 2 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  // Fallback: generate random CVC if not enough distractors
  while (picked.length < 2) {
    const c1 = consonants[Math.floor(Math.random() * consonants.length)];
    const v = vowels[Math.floor(Math.random() * vowels.length)];
    const c2 = consonants[Math.floor(Math.random() * consonants.length)];
    const w = c1 + v + c2;
    if (w !== target && !picked.includes(w)) picked.push(w);
  }

  return picked;
};

/**
 * Build rounds: each round has 1 target word + 2 distractors, shuffled into 3 choices.
 */
const buildRounds = (group) => {
  const words = group.words.map((w) => w.word);
  const allWords = words.map((w) => w.toLowerCase());
  // Pick up to ROUNDS unique target words
  const targets = shuffle(words).slice(0, ROUNDS);
  return targets.map((target) => {
    const distractors = generateDistractors(target, allWords);
    const choices = shuffle([
      { word: target, isTarget: true },
      { word: distractors[0], isTarget: false },
      { word: distractors[1], isTarget: false },
    ]);
    return { target, choices };
  });
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
    [0, 0.12].forEach((offset) => {
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.08);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime + offset);
    });
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

// --- Draggable Word Card ---
const DraggableWordCard = ({ word, onDrop, isProcessing, cardShaking }) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

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
        onDrop(word, {
          clientX: lastPointerRef.current.x,
          clientY: lastPointerRef.current.y,
        });
      }}
      initial={{ opacity: 0, y: 30, scale: 0.8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isDragging ? 1.1 : 1,
        x: cardShaking === word ? [0, -12, 12, -8, 8, -4, 4, 0] : 0,
      }}
      transition={
        cardShaking === word
          ? { duration: 0.5, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 400, damping: 25 }
      }
      style={{ zIndex: isDragging ? 100 : 30 }}
    >
      <div
        className="bg-white flex items-center justify-center"
        style={{
          borderRadius: '1.6rem',
          borderBottom: '5px solid rgba(0,0,0,0.1)',
          boxShadow: isDragging
            ? '0px 16px 40px rgba(0,0,0,0.3)'
            : '0px 8px 0px rgba(0,0,0,0.12)',
          padding: 'clamp(10px, 2.5vw, 22px) clamp(20px, 6vw, 48px)',
          minWidth: 'clamp(90px, 25vw, 180px)',
        }}
      >
        <span className="text-lg md:text-2xl lg:text-3xl font-black text-[#3e366b] tracking-wider uppercase">
          {word}
        </span>
      </div>
    </motion.div>
  );
};

// --- Main Game Component ---
const MonsterFeederGame = ({ group, onBack, onPlayAgain }) => {
  const [currentRound, setCurrentRound] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [monsterState, setMonsterState] = useState('hungry');
  const hungryVideoRef = useRef(null);
  const eatVideoRef = useRef(null);
  const [cardShaking, setCardShaking] = useState(null); // word string or null
  const [cardExiting, setCardExiting] = useState(null); // word string or null

  const mountedRef = useRef(true);
  const idleRef = useRef(null);
  const isProcessingRef = useRef(false);
  const monsterZoneRef = useRef(null);

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const [rounds] = useState(() => buildRounds(group));
  const round = rounds[currentRound];

  const speakTarget = useCallback(async () => {
    if (!mountedRef.current) return;
    await playVO('Feed the monster the word...');
    if (!mountedRef.current) return;
    await delay(200);
    if (!mountedRef.current) return;
    await speakAsync(rounds[currentRound]?.target || '');
  }, [rounds, currentRound]);

  const idleCountRef = useRef(0);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current || isProcessingRef.current) return;
      const count = idleCountRef.current++;
      if (count % 2 === 0) {
        // Full instruction: "Feed the monster the word..." + dictation
        await speakTarget();
      } else {
        // Short reminder: monster says "Feed me!"
        await playVO('Feed me!');
      }
      if (!mountedRef.current || isProcessingRef.current) return;
      startIdleReminder();
    }, 8000);
  }, [speakTarget]);

  // Round start: announce the target word
  useEffect(() => {
    if (gameComplete) return;
    mountedRef.current = true;
    let cancelled = false;
    const run = async () => {
      setIsProcessing(true);
      isProcessingRef.current = true;
      await delay(600);
      if (cancelled) return;
      await playVO('Feed the monster the word...');
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      await speakAsync(rounds[currentRound]?.target || '');
      if (cancelled) return;
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    };
    run();
    return () => {
      cancelled = true;
      clearTimeout(idleRef.current);
    };
  }, [currentRound, gameComplete]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
    };
  }, []);

  const handleDrop = useCallback(async (droppedWord, pointer) => {
    if (isProcessingRef.current || !round) return;

    const monsterRect = monsterZoneRef.current?.getBoundingClientRect();
    if (!monsterRect) return;

    const hitMonster =
      pointer.clientX >= monsterRect.left &&
      pointer.clientX <= monsterRect.right &&
      pointer.clientY >= monsterRect.top &&
      pointer.clientY <= monsterRect.bottom;

    if (!hitMonster) return;

    clearTimeout(idleRef.current);
    setIsProcessing(true);
    isProcessingRef.current = true;

    const isCorrect = round.choices.find(
      (c) => c.word === droppedWord && c.isTarget
    );

    if (isCorrect) {
      // Correct word fed to monster
      setCardExiting(droppedWord);
      playMunchSfx();
      setMonsterState('eating');
      if (eatVideoRef.current) {
        eatVideoRef.current.load();
        eatVideoRef.current.currentTime = 0;
        eatVideoRef.current.play().catch(() => {});
      }
      await delay(300);
      if (!mountedRef.current) return;
      triggerSmallBurst();
      await playVO('Yum, yum!');
      if (!mountedRef.current) return;
      // Letter sounds + full word dictation
      await playBlendingSequence(round.target, (w) => speakAsync(w));
      if (!mountedRef.current) return;
      await delay(300);
      if (!mountedRef.current) return;
      await playEncouragement();
      if (!mountedRef.current) return;

      // Linger delay
      await delay(1500);
      if (!mountedRef.current) return;
      setCardExiting(null);

      // Force back to hungry in case onEnded didn't fire
      setMonsterState('hungry');
      if (hungryVideoRef.current) {
        hungryVideoRef.current.currentTime = 0;
        hungryVideoRef.current.play().catch(() => {});
      }

      if (currentRound < rounds.length - 1) {
        setCurrentRound((prev) => prev + 1);
        setIsProcessing(false);
        isProcessingRef.current = false;
      } else {
        triggerCelebration();
        await playVO('Great job!');
        if (!mountedRef.current) return;
        setGameComplete(true);
      }
    } else {
      // Wrong word fed to monster
      playWrongSfx();
      setCardShaking(droppedWord);
      await playVO('Blegh!');
      if (!mountedRef.current) return;
      await playVO('Oops, try again!');
      if (!mountedRef.current) return;
      // Re-prompt with the target word
      await speakAsync(round.target);
      if (!mountedRef.current) return;
      setCardShaking(null);
      setIsProcessing(false);
      isProcessingRef.current = false;
      startIdleReminder();
    }
  }, [round, currentRound, rounds.length, startIdleReminder]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#FF6B9D]">
        <motion.button
          onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          title="Toggle Fullscreen"
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
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            👾⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#FF6B9D] mb-2">
            Monster Fed!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You fed all the right words!
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
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-gradient-to-b from-[#1a1147] to-[#6B3FA0]">
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

      {/* Speaker + Progress dots */}
      <div className="fixed top-3 right-3 md:top-4 md:right-4 z-[70] flex items-center gap-2">
        <motion.button
          onClick={async () => {
            if (isProcessingRef.current) return;
            setIsProcessing(true);
            isProcessingRef.current = true;
            clearTimeout(idleRef.current);
            await speakAsync(round?.target || '');
            if (mountedRef.current) {
              setIsProcessing(false);
              isProcessingRef.current = false;
              startIdleReminder();
            }
          }}
          className="p-2 md:p-2.5 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          title="Hear the word"
        >
          <Volume2 className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <div className="flex items-center gap-1.5">
          {rounds.map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx < currentRound
                  ? 'bg-[#22c55e] w-2.5 h-2.5'
                  : idx === currentRound
                  ? 'bg-[#FF6B9D] w-3 h-3 ring-2 ring-[#FF6B9D]/40'
                  : 'bg-white/20 w-2.5 h-2.5'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Monster centered */}
      <div className="flex-1 flex items-center justify-center pt-14 px-2">
        <div
          ref={monsterZoneRef}
          className="flex flex-col items-center"
        >
          <video
            ref={hungryVideoRef}
            src="/vids/monster_hungry.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="object-contain"
            style={{
              width: 'min(110vw, 75vh)',
              height: 'min(110vw, 75vh)',
              display: monsterState === 'hungry' ? 'block' : 'none',
            }}
          />
          <video
            ref={eatVideoRef}
            src="/vids/monster_eat.webm"
            muted
            playsInline
            className="object-contain"
            style={{
              width: 'min(110vw, 75vh)',
              height: 'min(110vw, 75vh)',
              display: monsterState === 'eating' ? 'block' : 'none',
            }}
            onEnded={() => {
              setMonsterState('hungry');
              if (hungryVideoRef.current) {
                hungryVideoRef.current.currentTime = 0;
                hungryVideoRef.current.play().catch(() => {});
              }
            }}
          />
          {/* Floating "Feed Me" label below monster */}
          <motion.span
            className="text-lg md:text-2xl lg:text-3xl font-bold text-[#FF6B9D] drop-shadow-lg tracking-wide -mt-6 md:-mt-8"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            Feed Me! 🍖
          </motion.span>
        </div>
      </div>

      {/* 3 word choices at bottom — all draggable */}
      <div className="relative z-30 flex items-center justify-center gap-3 md:gap-5 pb-8 md:pb-12 lg:pb-16 pt-2 px-2">
        <AnimatePresence>
          {round && round.choices.map((choice) => (
            cardExiting !== choice.word && (
              <DraggableWordCard
                key={`${currentRound}-${choice.word}`}
                word={choice.word}
                onDrop={handleDrop}
                isProcessing={isProcessing}
                cardShaking={cardShaking}
              />
            )
          ))}
        </AnimatePresence>

        {/* Exiting card animation */}
        <AnimatePresence>
          {cardExiting && (
            <motion.div
              key={`exit-${currentRound}-${cardExiting}`}
              className="absolute select-none pointer-events-none"
              initial={{ opacity: 1, scale: 1 }}
              animate={{
                opacity: 0,
                scale: 0.3,
                y: -200,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeIn' }}
            >
              <div
                className="bg-white flex items-center justify-center"
                style={{
                  borderRadius: '1.6rem',
                  borderBottom: '5px solid rgba(0,0,0,0.1)',
                  boxShadow: '0px 8px 0px rgba(0,0,0,0.12)',
                  padding: 'clamp(10px, 2.5vw, 22px) clamp(20px, 6vw, 48px)',
                  minWidth: 'clamp(90px, 25vw, 180px)',
                }}
              >
                <span className="text-lg md:text-2xl lg:text-3xl font-black text-[#3e366b] tracking-wider uppercase">
                  {cardExiting}
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
          Drag the right word to the monster
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
