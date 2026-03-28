import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { playLetterSound, getLetterSoundUrl } from '../utils/letterSounds';
import { speakWithVoice } from '../utils/speech';
import { getWordImage } from '../utils/assetHelpers';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../utils/confetti';
import { playCompletionEncouragement } from '../utils/encouragement';

let sharedCtx = null;
const getCtx = () => {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
};

const playSnapSound = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* silent */ }
};

const playSuccessSound = () => {
  try {
    const ctx = getCtx();
    [0, 0.12, 0.24].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime([523, 659, 784][i], ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.2);
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.2);
    });
  } catch (e) { /* silent */ }
};

const playErrorBuzz = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
};

const SLOT_COLORS = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#ae90fd', '#4d79ff', '#FF6600', '#22c55e', '#00B894'];

const getPointerCoords = (e) => {
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
};

const DragHint = () => (
  <motion.div
    className="w-full z-50 pointer-events-none flex items-center justify-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1, 0] }}
    transition={{ duration: 3, times: [0, 0.15, 0.75, 1] }}
  >
    <motion.div
      className="flex flex-col items-center"
      animate={{ y: [20, -10, -10] }}
      transition={{ duration: 2, times: [0, 0.5, 1], ease: 'easeInOut' }}
    >
      <motion.span
        className="px-6 py-2.5 md:px-8 md:py-3 rounded-full bg-[#3e366b]/80 text-white text-sm md:text-lg font-semibold whitespace-nowrap"
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, times: [0, 0.2, 0.7, 1] }}
      >
        &#9757; Drag letters into the slots!
      </motion.span>
    </motion.div>
  </motion.div>
);

// Split word into phoneme blocks using group sounds (digraphs stay together)
const splitIntoBlocks = (word, groupSounds) => {
  const blocks = [];
  const w = word.toLowerCase();
  // Sort sounds by length (longest first) so digraphs/trigraphs match before single letters
  const sorted = [...groupSounds].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < w.length) {
    let matched = false;
    for (const sound of sorted) {
      if (w.substring(i, i + sound.length) === sound.toLowerCase()) {
        blocks.push(w.substring(i, i + sound.length));
        i += sound.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      blocks.push(w[i]);
      i++;
    }
  }
  return blocks;
};

const BlendingFactory = ({ group, onComplete }) => {
  const words = useMemo(() => {
    const withImages = group.words.filter(w => getWordImage(group.id, w.image || w.word) !== null);
    return withImages.length > 0 ? withImages : group.words;
  }, [group]);
  const [wordIdx, setWordIdx] = useState(0);
  const [slots, setSlots] = useState([]);
  const [letters, setLetters] = useState([]);
  const [blending, setBlending] = useState(false);
  const [wordDone, setWordDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [resultCountdown, setResultCountdown] = useState(5);
  const [shakeAll, setShakeAll] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [instructionLock, setInstructionLock] = useState(true);
  const containerRef = useRef(null);
  const blendingRef = useRef(false);
  const idleReminderRef = useRef(null);
  const speakerReminderRef = useRef(null);
  const cancelledRef = useRef(false);

  const currentWord = words[wordIdx];
  const wordLetters = splitIntoBlocks(currentWord.word, group.sounds || []);
  const imageSrc = getWordImage(group.id, currentWord.image);

  // Clear idle reminders
  const clearIdleReminder = useCallback(() => {
    clearTimeout(idleReminderRef.current);
    clearTimeout(speakerReminderRef.current);
  }, []);

  // Start idle reminder — reminds to drag letters after 6s, then tap speaker after 15s
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleReminderRef.current);
    clearTimeout(speakerReminderRef.current);
    idleReminderRef.current = setTimeout(async () => {
      if (cancelledRef.current || blendingRef.current) return;
      await playVO('Drag the correct letter to the empty box.');
    }, 6000);
    speakerReminderRef.current = setTimeout(async () => {
      if (cancelledRef.current || blendingRef.current) return;
      await playVO('Tap the speaker to hear the word!');
    }, 15000);
  }, []);

  // Speak the full word (for the speaker button)
  const speakWord = useCallback(() => {
    speakWithVoice(currentWord.word, { rate: 0.8 });
  }, [currentWord.word]);

  // VO on mount - sequenced (no auto dictation — user must tap speaker)
  useEffect(() => {
    cancelledRef.current = false;
    const run = async () => {
      await playVO("Let's build the word together!");
      if (cancelledRef.current) return;
      await delay(200);
      if (cancelledRef.current) return;
      await playVO('Drag the correct letter to the empty box.');
      if (cancelledRef.current) return;
      startIdleReminder();
      if (!cancelledRef.current) setInstructionLock(false);
    };
    run();
    return () => { cancelledRef.current = true; stopVO(); clearIdleReminder(); };
  }, []);

  // Per-word idle reminder (no auto dictation — user must tap speaker)
  useEffect(() => {
    if (wordIdx === 0) return; // First word handled by mount VO
    cancelledRef.current = false;
    startIdleReminder();
    return () => { cancelledRef.current = true; stopVO(); clearIdleReminder(); };
  }, [wordIdx]);

  // Initialize letters and slots for current word
  useEffect(() => {
    setWordDone(false);
    setImageError(false);
    setBlending(false);
    setShakeAll(false);
    blendingRef.current = false;

    if (wordIdx > 0) setShowHint(false);

    const newSlots = wordLetters.map(() => null);
    setSlots(newSlots);

    const makeShuffled = () => {
      const a = wordLetters.map((letter, idx) => ({ id: `${wordIdx}-r${Math.random()}-${idx}`, letter, originalIdx: idx }));
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    let shuffled = makeShuffled();
    for (let attempt = 0; attempt < 5; attempt++) {
      const isSameOrder = shuffled.every((item, idx) => item.originalIdx === idx);
      if (!isSameOrder) break;
      shuffled = makeShuffled();
    }
    setLetters(shuffled);
  }, [wordIdx]);

  // Check if all slots are filled
  useEffect(() => {
    if (slots.length === 0 || slots.some(s => s === null)) return;
    const builtWord = slots.map(s => s.letter).join('');
    if (builtWord === currentWord.word) {
      clearIdleReminder();
      setTimeout(() => startBlendAnimation(), 400);
    } else {
      playErrorBuzz();
      playVO('Oops, try again!');
      setShakeAll(true);
      setTimeout(() => {
        setShakeAll(false);
        const allLetters = slots.filter(s => s !== null);
        setLetters(prev => [...prev, ...allLetters].sort(() => Math.random() - 0.5));
        setSlots(wordLetters.map(() => null));
        startIdleReminder();
      }, 600);
    }
  }, [slots]);

  const startBlendAnimation = async () => {
    if (blendingRef.current) return;
    blendingRef.current = true;
    setBlending(true);
    triggerSmallBurst();
    playSuccessSound();

    for (let i = 0; i < wordLetters.length; i++) {
      if (!blendingRef.current) return;
      await new Promise(resolve => {
        const url = getLetterSoundUrl(wordLetters[i]);
        if (url) {
          playLetterSound(wordLetters[i]).then(resolve).catch(resolve);
        } else {
          setTimeout(resolve, 300);
        }
      });
      await new Promise(r => setTimeout(r, 150));
    }

    await new Promise(r => setTimeout(r, 150));
    if (!blendingRef.current) return;

    speakWithVoice(currentWord.word, {
      rate: 0.8,
      onEnd: async () => {
        if (!blendingRef.current) return;
        setWordDone(true);
        await delay(300);
        if (!blendingRef.current) return;
        await playCompletionEncouragement();
        await delay(1500);
        if (!blendingRef.current) return;
        autoAdvance();
      },
      onError: async () => {
        if (!blendingRef.current) return;
        setWordDone(true);
        await delay(1500);
        if (!blendingRef.current) return;
        autoAdvance();
      },
    });
  };

  const autoAdvance = () => {
    blendingRef.current = false;
    if (wordIdx < words.length - 1) {
      setWordIdx(prev => prev + 1);
    } else {
      setAllDone(true);
      triggerCelebration();
    }
  };

  // 5-second auto-advance when all done (use ref to avoid re-triggering on onComplete identity change)
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!allDone) return;
    setResultCountdown(5);
    let cancelled = false;
    const countdownInterval = setInterval(() => {
      setResultCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          if (!cancelled) onCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { cancelled = true; clearInterval(countdownInterval); };
  }, [allDone]);

  const findSlotAtPoint = useCallback((x, y) => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const slotIdx = el.getAttribute('data-slot-idx');
      if (slotIdx !== null) return parseInt(slotIdx, 10);
      if (el.parentElement) {
        const parentIdx = el.parentElement.getAttribute('data-slot-idx');
        if (parentIdx !== null) return parseInt(parentIdx, 10);
      }
    }
    return -1;
  }, []);

  const handleDrop = useCallback((letterId, letterObj, nativeEvent) => {
    if (instructionLock) return;
    if (blending || wordDone) return;
    const { x, y } = getPointerCoords(nativeEvent);
    const slotIdx = findSlotAtPoint(x, y);
    if (slotIdx === -1 || slots[slotIdx] !== null) return;

    setShowHint(false);
    clearIdleReminder();
    startIdleReminder();
    playSnapSound();
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = letterObj;
      return next;
    });
    setLetters(prev => prev.filter(l => l.id !== letterId));
  }, [instructionLock, blending, wordDone, slots, findSlotAtPoint, clearIdleReminder, startIdleReminder]);

  const handleSlotTap = (idx) => {
    if (instructionLock) return;
    if (blending || wordDone) return;
    if (slots[idx] === null) return;
    const letterObj = slots[idx];
    setSlots(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    setLetters(prev => [...prev, letterObj]);
  };

  if (allDone) {
    return (
      <div className="h-full w-full flex items-center justify-center relative overflow-hidden"
        style={{ background: 'transparent' }}>
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] p-6 md:p-10 text-center max-w-sm md:max-w-md mx-4"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span className="text-6xl md:text-8xl block mb-3"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >🏭⭐</motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#6B3FA0] mb-2">Word Builder!</h2>
          <p className="text-[#ae90fd] font-semibold text-lg mb-8">You built {words.length} words!</p>
          <motion.div
            className="flex items-center justify-center gap-2 text-white/50 text-sm font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span>Next step in</span>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-base">
              {resultCountdown}
            </span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden flex flex-col"
      style={{ background: 'transparent' }}>

      {/* Progress - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-30">
        <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 md:px-4 md:py-1.5">
          <span className="text-white/60 font-semibold text-xs md:text-sm lg:text-base">
            {wordIdx + 1} / {words.length}
          </span>
        </div>
      </div>

      {/* Top section: picture + speaker + slots */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 md:pt-6" style={{ paddingBottom: 'clamp(120px, 22vh, 200px)' }}>
        {/* Picture hint */}
        <motion.div
          key={`pic-${wordIdx}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-3 md:mb-4"
        >
          {imageSrc && !imageError ? (
            <img
              src={imageSrc}
              alt={currentWord.word}
              className="rounded-2xl shadow-xl object-contain bg-white border-3 border-[#ae90fd]/30"
              style={{ width: 'clamp(220px, 48vw, 320px)', height: 'clamp(220px, 48vw, 320px)' }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="rounded-2xl shadow-xl flex items-center justify-center bg-white border-3 border-[#ae90fd]/30"
              style={{ width: 'clamp(220px, 48vw, 320px)', height: 'clamp(220px, 48vw, 320px)' }}>
              <span className="text-5xl md:text-6xl">&#128522;</span>
            </div>
          )}
        </motion.div>

        {/* Speaker button + "Build the word!" label */}
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <motion.button
            onClick={speakWord}
            className="p-3 md:p-4 rounded-[1.2rem] bg-[#6B3FA0]"
            style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.9, y: 3 }}
            whileHover={{ scale: 1.1 }}
          >
            <Volume2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
          </motion.button>
          <motion.span
            className="text-base md:text-xl lg:text-2xl font-bold text-white/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Build the word!
          </motion.span>
        </div>

        {/* Drop zone slots — mt-4 on phone for breathing room, no extra margin on larger screens */}
        <motion.div
          className="flex items-center justify-center gap-3 md:gap-4 lg:gap-5 mb-4 mt-4 md:mt-0"
          animate={shakeAll ? { x: [0, -10, 10, -10, 10, 0] } : {}}
          transition={shakeAll ? { duration: 0.4 } : {}}
        >
          {wordLetters.map((letter, idx) => (
            <motion.div
              key={`slot-${wordIdx}-${idx}`}
              data-slot-idx={idx}
              onClick={() => handleSlotTap(idx)}
              className="relative flex items-center justify-center rounded-2xl md:rounded-3xl border-3 cursor-pointer"
              style={{
                width: 'clamp(62px, 18vw, 120px)',
                height: 'clamp(72px, 21vw, 135px)',
                borderColor: slots[idx] ? SLOT_COLORS[slots[idx].originalIdx % SLOT_COLORS.length] : '#3e366b30',
                borderStyle: slots[idx] ? 'solid' : 'dashed',
                backgroundColor: slots[idx] ? SLOT_COLORS[slots[idx].originalIdx % SLOT_COLORS.length] : 'white',
                boxShadow: slots[idx] ? `0 4px 15px ${SLOT_COLORS[slots[idx].originalIdx % SLOT_COLORS.length]}40, 0 2px 8px rgba(0,0,0,0.1)` : 'none',
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={slots[idx] ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: [1, 1.03, 1] }}
              transition={slots[idx] ? { delay: idx * 0.08 } : { delay: idx * 0.08, scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
            >
              {slots[idx] ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={blending ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  transition={blending ? { duration: 0.3, delay: idx * 0.15 } : { type: 'spring' }}
                  className="font-bold text-white pointer-events-none"
                  style={{ fontSize: 'clamp(2.6rem, 12vw, 5rem)' }}
                >
                  {slots[idx].letter}
                </motion.span>
              ) : (
                <span className="text-white/15 font-bold pointer-events-none" style={{ fontSize: 'clamp(1.5rem, 7vw, 2.5rem)' }}>
                  ?
                </span>
              )}
            </motion.div>
          ))}
        </motion.div>

      </div>

      {/* Drag hint */}
      <AnimatePresence>
        {showHint && !blending && !wordDone && (
          <div className="absolute bottom-60 md:bottom-52 lg:bottom-56 left-0 right-0 z-30">
            <DragHint />
          </div>
        )}
      </AnimatePresence>

      {/* Bottom section: draggable letters */}
      <div className="absolute bottom-32 md:bottom-28 lg:bottom-36 xl:bottom-40 left-0 right-0 px-4 z-20">
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 lg:gap-5">
          <AnimatePresence>
            {letters.map((letter, i) => (
              <DraggableLetter
                key={letter.id}
                letter={letter}
                onDrop={handleDrop}
                color={SLOT_COLORS[letter.originalIdx % SLOT_COLORS.length]}
                entranceDelay={i * 0.08}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const DraggableLetter = ({ letter, onDrop, color, entranceDelay = 0 }) => {
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
      drag
      dragSnapToOrigin
      dragElastic={0.3}
      dragMomentum={false}
      onDragStart={(e) => {
        setIsDragging(true);
        const t = e.touches?.[0] || e;
        lastPointerRef.current = { x: t.clientX || 0, y: t.clientY || 0 };
        const url = getLetterSoundUrl(letter.letter);
        if (url) playLetterSound(letter.letter).catch(() => {});
      }}
      onDragEnd={(e) => {
        setIsDragging(false);
        onDrop(letter.id, letter, {
          clientX: lastPointerRef.current.x,
          clientY: lastPointerRef.current.y,
        });
      }}
      initial={{ opacity: 0, scale: 0.5, y: 30 }}
      animate={{ opacity: 1, scale: isDragging ? 1.15 : 1, y: 0, transition: { delay: entranceDelay, duration: 0.3 } }}
      exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
      whileHover={{ scale: 1.08 }}
      style={{ zIndex: isDragging ? 100 : 10 }}
    >
      <div
        className="flex items-center justify-center rounded-2xl md:rounded-3xl shadow-lg font-bold text-white pointer-events-none"
        style={{
          width: 'clamp(60px, 18vw, 110px)',
          height: 'clamp(68px, 21vw, 125px)',
          backgroundColor: color,
          fontSize: 'clamp(2rem, 9vw, 4rem)',
          boxShadow: isDragging
            ? `0 12px 40px ${color}60, 0 4px 15px rgba(0,0,0,0.2)`
            : `0 4px 15px ${color}40, 0 2px 8px rgba(0,0,0,0.1)`,
        }}
      >
        {letter.letter}
      </div>
    </motion.div>
  );
};

export default BlendingFactory;
