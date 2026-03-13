import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playLetterSound, getLetterSoundUrl } from '../utils/letterSounds';
import { speakWithVoice } from '../utils/speech';
import { getWordImage } from '../utils/assetHelpers';

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

// Get pointer coords from any event (mouse or touch)
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
    className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1, 0] }}
    transition={{ duration: 3, times: [0, 0.15, 0.75, 1] }}
  >
    <motion.div
      className="flex flex-col items-center"
      animate={{ y: [40, -40, -40] }}
      transition={{ duration: 2, times: [0, 0.5, 1], ease: 'easeInOut' }}
    >
      <span className="text-4xl md:text-5xl" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
        &#9757;
      </span>
      <motion.span
        className="mt-2 px-4 py-1.5 rounded-full bg-[#3e366b]/80 text-white text-xs md:text-sm font-semibold whitespace-nowrap"
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, times: [0, 0.2, 0.7, 1] }}
      >
        Drag letters into the slots!
      </motion.span>
    </motion.div>
  </motion.div>
);

const BlendingFactory = ({ group, onComplete }) => {
  const words = useMemo(() => group.words, [group]);
  const [wordIdx, setWordIdx] = useState(0);
  const [slots, setSlots] = useState([]);
  const [letters, setLetters] = useState([]);
  const [blending, setBlending] = useState(false);
  const [wordDone, setWordDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [shakeAll, setShakeAll] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef(null);
  const blendingRef = useRef(false);

  const currentWord = words[wordIdx];
  const wordLetters = currentWord.word.split('');
  const imageSrc = getWordImage(group.id, currentWord.image);

  // Initialize letters and slots for current word
  useEffect(() => {
    setWordDone(false);
    setImageError(false);
    setBlending(false);
    setShakeAll(false);
    setShowConfetti(false);
    blendingRef.current = false;

    // Show hint only on the very first word
    if (wordIdx > 0) setShowHint(false);

    const newSlots = wordLetters.map(() => null);
    setSlots(newSlots);

    // Fisher-Yates shuffle, ensure result differs from original order
    const makeShuffled = () => {
      const a = wordLetters.map((letter, idx) => ({ id: `${wordIdx}-r${Math.random()}-${idx}`, letter, originalIdx: idx }));
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    let shuffled = makeShuffled();
    // If it ended up in original order, shuffle again (up to 5 tries)
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
      setTimeout(() => startBlendAnimation(), 400);
    } else {
      playErrorBuzz();
      setShakeAll(true);
      setTimeout(() => {
        setShakeAll(false);
        const allLetters = slots.filter(s => s !== null);
        setLetters(prev => [...prev, ...allLetters].sort(() => Math.random() - 0.5));
        setSlots(wordLetters.map(() => null));
      }, 600);
    }
  }, [slots]);

  const startBlendAnimation = async () => {
    if (blendingRef.current) return;
    blendingRef.current = true;
    setBlending(true);
    setShowConfetti(true);
    playSuccessSound();

    // Play each letter sound sequentially
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

    // Speak the full word
    speakWithVoice(currentWord.word, {
      rate: 0.8,
      onEnd: () => {
        if (!blendingRef.current) return;
        setWordDone(true);
        // Auto-advance after short delay
        setTimeout(() => {
          if (!blendingRef.current) return;
          autoAdvance();
        }, 800);
      },
      onError: () => {
        if (!blendingRef.current) return;
        setWordDone(true);
        setTimeout(() => {
          if (!blendingRef.current) return;
          autoAdvance();
        }, 800);
      },
    });
  };

  const autoAdvance = () => {
    blendingRef.current = false;
    if (wordIdx < words.length - 1) {
      setWordIdx(prev => prev + 1);
    } else {
      setAllDone(true);
    }
  };

  // Find which slot is at a given screen coordinate using elementFromPoint
  const findSlotAtPoint = useCallback((x, y) => {
    // Temporarily hide dragged elements so elementFromPoint hits the slot beneath
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const slotIdx = el.getAttribute('data-slot-idx');
      if (slotIdx !== null) {
        return parseInt(slotIdx, 10);
      }
      // Check parent too
      if (el.parentElement) {
        const parentIdx = el.parentElement.getAttribute('data-slot-idx');
        if (parentIdx !== null) return parseInt(parentIdx, 10);
      }
    }
    return -1;
  }, []);

  const handleDrop = useCallback((letterId, letterObj, nativeEvent) => {
    if (blending || wordDone) return;

    const { x, y } = getPointerCoords(nativeEvent);
    const slotIdx = findSlotAtPoint(x, y);

    if (slotIdx === -1 || slots[slotIdx] !== null) return;

    setShowHint(false);
    playSnapSound();
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = letterObj;
      return next;
    });
    setLetters(prev => prev.filter(l => l.id !== letterId));
  }, [blending, wordDone, slots, findSlotAtPoint]);

  // Tap a filled slot to return letter to source
  const handleSlotTap = (idx) => {
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
        style={{ background: 'linear-gradient(135deg, #d8e9fa 0%, #e8f4ff 50%, #f0e6ff 100%)' }}>
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl text-center max-w-sm md:max-w-md mx-4"
        >
          <motion.span className="text-6xl md:text-8xl block mb-3"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >&#127942;</motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#3e366b] mb-2">Word Builder!</h2>
          <p className="text-[#ae90fd] font-semibold text-lg mb-8">You built {words.length} words!</p>
          <motion.button
            onClick={() => onComplete()}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-bold text-base md:text-lg shadow-xl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Next Step &rarr;
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(135deg, #d8e9fa 0%, #e8f4ff 50%, #f0e6ff 100%)' }}>

      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="fixed inset-0 z-[70] pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(40)].map((_, i) => (
              <motion.div
                key={`confetti-${i}`}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: -10,
                  width: 6 + Math.random() * 8,
                  height: 6 + Math.random() * 8,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  backgroundColor: ['#FF1E56', '#00C9A7', '#FFD000', '#FF6600', '#8B00FF', '#0080FF', '#E60023', '#00CC44', '#FF9500', '#22c55e'][i % 10],
                }}
                animate={{
                  y: [0, window.innerHeight + 50],
                  x: [(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 120],
                  rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                }}
                transition={{
                  duration: 1.5 + Math.random() * 1.5,
                  delay: Math.random() * 0.5,
                  ease: 'easeIn',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag hint for first-time users */}
      <AnimatePresence>
        {showHint && !blending && !wordDone && <DragHint />}
      </AnimatePresence>

      {/* Progress - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-30">
        <div className="bg-white/70 backdrop-blur-sm rounded-full px-3 py-1 md:px-4 md:py-1.5">
          <span className="text-[#3e366b]/60 font-semibold text-xs md:text-sm lg:text-base">
            {wordIdx + 1} / {words.length}
          </span>
        </div>
      </div>

      {/* Top section: picture + slots */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 md:pt-6">
        {/* Picture hint - always visible, BIGGER */}
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
              style={{ width: 'clamp(180px, 48vw, 320px)', height: 'clamp(180px, 48vw, 320px)' }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="rounded-2xl shadow-xl flex items-center justify-center bg-white border-3 border-[#ae90fd]/30"
              style={{ width: 'clamp(180px, 48vw, 320px)', height: 'clamp(180px, 48vw, 320px)' }}>
              <span className="text-5xl md:text-6xl">&#128522;</span>
            </div>
          )}
        </motion.div>

        <motion.span
          className="text-base md:text-xl lg:text-2xl font-bold text-[#3e366b]/60 mb-3 md:mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Build the word!
        </motion.span>

        {/* Drop zone slots */}
        <motion.div
          className="flex items-center justify-center gap-3 md:gap-4 lg:gap-5 mb-4"
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
                borderColor: slots[idx] ? SLOT_COLORS[idx % SLOT_COLORS.length] : '#3e366b30',
                borderStyle: slots[idx] ? 'solid' : 'dashed',
                backgroundColor: slots[idx] ? `${SLOT_COLORS[idx % SLOT_COLORS.length]}15` : 'white',
                boxShadow: slots[idx] ? `0 4px 15px ${SLOT_COLORS[idx % SLOT_COLORS.length]}25` : 'none',
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              {slots[idx] ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={blending ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  transition={blending ? { duration: 0.3, delay: idx * 0.15 } : { type: 'spring' }}
                  className="font-bold text-[#3e366b] pointer-events-none"
                  style={{ fontSize: 'clamp(2.2rem, 10vw, 4.5rem)' }}
                >
                  {slots[idx].letter}
                </motion.span>
              ) : (
                <span className="text-[#3e366b]/15 font-bold pointer-events-none" style={{ fontSize: 'clamp(1.5rem, 7vw, 2.5rem)' }}>
                  ?
                </span>
              )}
            </motion.div>
          ))}
        </motion.div>

      </div>

      {/* Bottom section: draggable letters or next button */}
      <div className="pb-12 md:pb-16 px-4 min-h-[130px] md:min-h-[170px]">
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 lg:gap-5">
          <AnimatePresence>
            {letters.map((letter) => (
              <DraggableLetter
                key={letter.id}
                letter={letter}
                onDrop={handleDrop}
                color={SLOT_COLORS[letter.originalIdx % SLOT_COLORS.length]}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Draggable letter block
const DraggableLetter = ({ letter, onDrop, color }) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Track pointer position via native events so we always have accurate coords
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
        // Play sound on pickup
        const url = getLetterSoundUrl(letter.letter);
        if (url) playLetterSound(letter.letter).catch(() => {});
      }}
      onDragEnd={(e) => {
        setIsDragging(false);
        // Use tracked pointer position — most reliable across all devices
        onDrop(letter.id, letter, {
          clientX: lastPointerRef.current.x,
          clientY: lastPointerRef.current.y,
        });
      }}
      initial={{ opacity: 0, scale: 0.5, y: 30 }}
      animate={{ opacity: 1, scale: isDragging ? 1.15 : 1, y: 0 }}
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
