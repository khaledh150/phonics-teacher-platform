import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { getWordImage } from '../../../utils/assetHelpers';
import { speakWithVoice } from '../../../utils/speech';
import { playBlendingSequence, wordToPhonemes, wordToCharPhonemeMap } from '../../../utils/letterSounds';
import { playVO, stopVO, delay } from '../../../utils/audioPlayer';
import THAI_TRANSLATIONS from '../../../data/thaiTranslations';

// Shared glass-arrow navigation overlay with swipe + tap-to-reveal
const NavOverlay = ({ onPrev, onNext }) => {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });

  const show = () => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 2500);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const handlePointerDown = (e) => {
    touchStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > 50 && absDx > absDy * 1.5) {
      if (dx < 0 && onNext) onNext();
      else if (dx > 0 && onPrev) onPrev();
    } else if (absDx < 10 && absDy < 10) {
      show();
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-30"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'pan-y' }}
      />
      <AnimatePresence>
        {visible && onPrev && (
          <motion.button
            key="nav-prev"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="fixed left-2 md:left-4 top-1/2 -translate-y-1/2 z-50 p-2.5 md:p-3 rounded-2xl backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
          </motion.button>
        )}
        {visible && onNext && (
          <motion.button
            key="nav-next"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 z-50 p-2.5 md:p-3 rounded-2xl backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

// Whoosh sound for transitions
let sharedAudioContext = null;
const getAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume();
  return sharedAudioContext;
};

const playWhoosh = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* silent */ }
};

const imageVariants = {
  enter: (dir) => ({ x: dir > 0 ? 400 : -400, opacity: 0, scale: 0.85 }),
  center: {
    x: 0, opacity: 1, scale: 1,
    transition: { x: { type: 'spring', stiffness: 260, damping: 25 }, opacity: { duration: 0.3 }, scale: { type: 'spring', stiffness: 200, damping: 20 } },
  },
  exit: (dir) => ({ x: dir < 0 ? 400 : -400, opacity: 0, scale: 0.85, transition: { duration: 0.25 } }),
};

const wordVariants = {
  enter: (dir) => ({ y: dir > 0 ? 60 : -60, opacity: 0, scale: 0.8 }),
  center: {
    y: 0, opacity: 1, scale: 1,
    transition: { y: { type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }, opacity: { duration: 0.3, delay: 0.1 }, scale: { type: 'spring', stiffness: 400, damping: 20, delay: 0.1 } },
  },
  exit: (dir) => ({ y: dir < 0 ? 60 : -60, opacity: 0, scale: 0.8, transition: { duration: 0.2 } }),
};

// Render word with per-phoneme highlighting (supports split digraphs — e.g. "bake" highlights a+e together)
const HighlightedWord = ({ word, activePhonemeIndex, highlightAll, groupSounds }) => {
  // Per-character phoneme index map — handles split digraphs where vowel and final e share same index
  const charMap = useMemo(() => wordToCharPhonemeMap(word, groupSounds).charMap, [word, groupSounds]);

  return (
    <span className="inline-flex">
      {word.split('').map((char, i) => {
        const phonemeIdx = charMap[i];
        const isActive = highlightAll || phonemeIdx === activePhonemeIndex;
        const isSilent = phonemeIdx === -2;
        return (
          <motion.span
            key={i}
            animate={isActive && !isSilent ? {
              scale: [1, 1.15, 1],
              color: highlightAll ? '#22c55e' : '#E60023',
            } : {
              scale: 1,
              color: isSilent ? '#ffffff60' : '#ffffff',
            }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'inline-block',
              textShadow: isActive && !isSilent
                ? (highlightAll ? '0 0 20px rgba(34,197,94,0.5)' : '0 0 20px rgba(230,0,35,0.5)')
                : '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {char}
          </motion.span>
        );
      })}
    </span>
  );
};

// Scale font size down for longer words so they don't overflow
// Portrait mode: slightly smaller to balance with picture on small screens
const getWordFontSize = (word, base, vw, max) => {
  const len = word.length;
  if (len <= 4) return `clamp(${parseFloat(base) * 0.7}rem, ${parseFloat(vw) * 0.8}vw, ${parseFloat(max) * 0.8}rem)`;
  if (len <= 5) return `clamp(${parseFloat(base) * 0.55}rem, ${parseFloat(vw) * 0.6}vw, ${parseFloat(max) * 0.6}rem)`;
  // 6+ chars — scale aggressively
  const scale = Math.max(0.35, 3.5 / len);
  return `clamp(${(parseFloat(base) * scale).toFixed(1)}rem, ${(parseFloat(vw) * scale).toFixed(1)}vw, ${(parseFloat(max) * scale).toFixed(1)}rem)`;
};

const getWordFontSizeLg = (word) => {
  const len = word.length;
  const base = 'clamp(7.5rem, 32vh, 15rem)'; 
  if (len <= 4) return base;
  if (len <= 5) return `calc(${base} * 0.7)`;
  if (len <= 6) return `calc(${base} * 0.55)`;
  const scale = Math.max(0.3, 4 / len);
  return `calc(${base} * ${scale.toFixed(2)})`;
};

const FlashcardViewer = ({ group, onComplete, onReady, active }) => {
  const [[currentIndex, direction], setCurrentIndex] = useState([0, 0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBlending, setIsBlending] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [activePhoneme, setActivePhoneme] = useState(null); // index of phoneme being played, -1 = full word
  const speechTimeoutRef = useRef(null);
  const blendingRef = useRef(false);

  // Signal readiness to parent (DOM-based step, ready immediately)
  useEffect(() => { onReady?.(); }, []);

  const words = group.words;
  const currentItem = words[currentIndex];
  const goToNextRef = useRef(null);

  const imagePath = getWordImage(group.id, currentItem.image);
  const displayText = currentItem.word;

  const reminderRef = useRef(null);
  const cancelledRef = useRef(false);
  const [showReminder, setShowReminder] = useState(false);

  const startReminderTimer = useCallback(() => {
    clearTimeout(reminderRef.current);
    setShowReminder(false);
    reminderRef.current = setTimeout(() => {
      setShowReminder(true);
      playVO('Tap the speaker to hear it again!');
    }, 6000);
  }, []);

  const clearReminder = useCallback(() => {
    clearTimeout(reminderRef.current);
    setShowReminder(false);
  }, []);

  // Single blend+speak cycle, returns promise that resolves when the final word is spoken
  const runOneBlendCycle = useCallback(() => {
    return new Promise(async (resolve) => {
      let resolved = false;
      const safeResolve = () => { if (!resolved) { resolved = true; resolve(); } };

      // Safety timeout — TTS onEnd/onError may never fire on some devices
      const safetyTimer = setTimeout(() => {
        setIsSpeaking(false);
        setIsBlending(false);
        setActivePhoneme(null);
        safeResolve();
      }, 8000);

      setIsBlending(true);
      setIsSpeaking(true);
      setActivePhoneme(null);
      try {
        await playBlendingSequence(
          displayText,
          (word) => {
            speakWithVoice(word, {
              rate: 0.85,
              onEnd: () => {
                clearTimeout(safetyTimer);
                setIsSpeaking(false);
                setIsBlending(false);
                setTimeout(() => setActivePhoneme(null), 600);
                safeResolve();
              },
              onError: () => {
                clearTimeout(safetyTimer);
                setIsSpeaking(false);
                setIsBlending(false);
                setActivePhoneme(null);
                safeResolve();
              },
            });
          },
          (phonemeIdx) => {
            setActivePhoneme(phonemeIdx);
          },
          group.sounds
        );
      } catch {
        clearTimeout(safetyTimer);
        setIsSpeaking(false);
        setIsBlending(false);
        setActivePhoneme(null);
        safeResolve();
      }
    });
  }, [displayText]);

  // Single play — used when user taps the speaker button
  const handleBlendOnce = useCallback(async () => {
    if (blendingRef.current) return;
    clearTimeout(reminderRef.current);
    stopVO();
    window.speechSynthesis.cancel();
    blendingRef.current = true;
    cancelledRef.current = false;

    await runOneBlendCycle();
    blendingRef.current = false;
    if (!cancelledRef.current) startReminderTimer();
  }, [runOneBlendCycle, startReminderTimer]);

  const autoAdvanceTimerRef = useRef(null);

  // Full 3x sequence: play → "Say it with me!" → play → "Listen closely..." → play → auto-advance
  // Matches SoundLearning's speakSound pattern exactly — no blendingRef guard
  const handleBlendAndSpeak = useCallback(async () => {
    stopVO();
    clearTimeout(reminderRef.current);
    clearTimeout(autoAdvanceTimerRef.current);
    cancelledRef.current = false;

    // 1st play
    await runOneBlendCycle();
    if (cancelledRef.current) return;
    await delay(800);
    if (cancelledRef.current) return;
    // "Say it with me!" + 2nd play
    await playVO('Say it with me!');
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await runOneBlendCycle();
    if (cancelledRef.current) return;
    await delay(1000);
    if (cancelledRef.current) return;
    // "Listen closely..." + 3rd play
    await playVO('Listen closely...');
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await runOneBlendCycle();
    if (cancelledRef.current) return;
    // Auto-advance to next word after a brief pause
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) goToNextRef.current?.();
    }, 1500);
  }, [runOneBlendCycle]);

  useEffect(() => {
    if (!active) return;
    setImageError(false);
    setActivePhoneme(null);
    setIsBlending(false);
    setIsSpeaking(false);
    clearReminder();

    let cancelled = false;
    const run = async () => {
      if (currentIndex > 0) {
        await delay(400);
        if (cancelled) return;
      }
      await playVO('Look at the picture.');
      if (cancelled) return;
      await delay(300);
      if (cancelled) return;
      await playVO('What is it');
      if (cancelled) return;
      await delay(400);
      if (cancelled) return;
      handleBlendAndSpeak();
    };
    run();
    return () => {
      cancelled = true;
      cancelledRef.current = true;
      clearTimeout(autoAdvanceTimerRef.current);
      stopVO();
      clearReminder();
      window.speechSynthesis.cancel();
    };
  }, [active, currentIndex, handleBlendAndSpeak, clearReminder]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearTimeout(autoAdvanceTimerRef.current);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  const goToNext = () => {
    cancelledRef.current = true;
    clearReminder();
    clearTimeout(autoAdvanceTimerRef.current);
    stopVO();
    window.speechSynthesis.cancel();
    playWhoosh();
    if (currentIndex === words.length - 1) {
      onComplete();
    } else {
      setCurrentIndex([currentIndex + 1, 1]);
    }
  };
  goToNextRef.current = goToNext;

  const goToPrev = () => {
    cancelledRef.current = true;
    clearReminder();
    clearTimeout(autoAdvanceTimerRef.current);
    stopVO();
    window.speechSynthesis.cancel();
    playWhoosh();
    if (currentIndex > 0) {
      setCurrentIndex([currentIndex - 1, -1]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goToNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); }
      else if (e.key === 'r' || e.key === 'R') { handleBlendOnce(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, handleBlendOnce]);

  return (
    <div className="h-full w-full overflow-hidden relative">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 80 + 40,
              height: Math.random() * 80 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: ['#ae90fd15', '#4d79ff15', '#ffd70015', '#f093fb15'][i % 4],
            }}
            animate={{ y: [0, -15, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: Math.random() * 5 + 5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 }}
          />
        ))}
      </div>

      {/* Title + Progress - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-40 flex flex-col items-center gap-1">
        <motion.span
          className="text-base md:text-xl lg:text-2xl font-bold text-white/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Flashcards!
        </motion.span>
        <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-0.5 md:px-4 md:py-1">
          <span className="text-white/50 font-semibold text-xs md:text-sm lg:text-base">
            {currentIndex + 1} / {words.length}
          </span>
        </div>
      </div>

      {/* --- PORTRAIT LAYOUT (only when taller than wide) --- */}
      <div className="h-full w-full flex flex-col landscape:hidden">
        {/* Top half: picture */}
        <div className="flex-1 flex items-center justify-center pb-10 md:pb-12 pt-10 md:pt-12 px-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentItem.word + '-img-sm'}
              custom={direction}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {imagePath && !imageError ? (
                <motion.img
                  src={imagePath}
                  alt={currentItem.word}
                  onError={() => setImageError(true)}
                  className="object-contain rounded-3xl shadow-2xl bg-white border-4 border-[#ae90fd]"
                  style={{
                    width: 'clamp(200px, 50vw, 350px)',
                    height: 'clamp(200px, 50vw, 350px)',
                    padding: 'clamp(4px, 1vh, 10px)', // Reduced padding
                    boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                  }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <motion.button
                  onClick={handleBlendOnce}
                  className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#A78BFA] to-[#7C3AED] relative overflow-hidden"
                  style={{ 
                    width: 'clamp(36px, 10vh, 50px)', height: 'clamp(36px, 10vh, 50px)',
                    border: 'clamp(2px, 0.5vh, 3px) solid #3e366b', 
                    boxShadow: '0 4px 0 #5B21B6, 0 4px 10px rgba(0,0,0,0.1)' 
                  }}
                  whileTap={{ scale: 0.95, y: 3 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/40 rounded-full pointer-events-none" />
                  <Volume2 className="w-[60%] h-[60%] text-white" />
                </motion.button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom half: word */}
        <div className="flex-1 flex items-start justify-center pt-20 pb-6 px-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentItem.word + '-text-sm'}
              custom={direction}
              variants={wordVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-center"
            >
              <h1
                className="font-bold tracking-wide"
                style={{
                  fontSize: getWordFontSize(currentItem.word, '5', '20', '10'),
                  lineHeight: 1.1,
                }}
              >
                <HighlightedWord
                  word={currentItem.word}
                  activePhonemeIndex={activePhoneme}
                  highlightAll={activePhoneme === -1}
                  groupSounds={group.sounds}
                />
              </h1>
              {THAI_TRANSLATIONS[currentItem.word] && (
                <p className="mt-2 text-white/50 font-semibold" style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)' }}>
                  {THAI_TRANSLATIONS[currentItem.word]}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* --- LANDSCAPE LAYOUT (side by side) --- */}
      <div className="h-full w-full hidden landscape:flex flex-row items-center justify-center px-4 md:px-8 py-6 gap-2">
        {/* LEFT: Image */}
        <div className="flex-[0.4] flex items-center justify-center translate-y-[clamp(10px, 2vh, 30px)] z-10 pl-8 pr-4">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentItem.word + '-img-lg'}
              custom={direction}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {imagePath && !imageError ? (
                <motion.img
                  src={imagePath}
                  alt={currentItem.word}
                  onError={() => setImageError(true)}
                  className="object-contain rounded-[2rem] shadow-2xl bg-white border-[3px] border-[#ae90fd]"
                  style={{
                    width: 'clamp(140px, 55vh, 400px)',
                    height: 'clamp(140px, 55vh, 400px)',
                    padding: 'clamp(4px, 1vh, 12px)', // Reduced padding
                    boxShadow: '0 clamp(4px, 1vh, 8px) 0 rgba(0,0,0,0.1)',
                  }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <motion.div
                  className="rounded-[2rem] shadow-2xl bg-white flex items-center justify-center border-[3px] border-[#ae90fd]"
                  style={{
                    width: 'clamp(140px, 55vh, 400px)',
                    height: 'clamp(140px, 55vh, 400px)',
                    boxShadow: '0 clamp(4px, 1vh, 8px) 0 rgba(0,0,0,0.1)',
                  }}
                >
                  <span className="text-[10vh] md:text-[14vh] text-[#ae90fd] font-bold">
                    {currentItem.word.charAt(0).toUpperCase()}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CENTER: Squishy Speaker Pill (Centered) */}
        <div className="flex-[0.2] flex items-center justify-center translate-y-[clamp(10px, 2vh, 30px)] z-20">
          <motion.button
            onClick={() => { clearReminder(); handleBlendOnce(); }}
            className={`flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-[#A78BFA] to-[#7C3AED]`}
            style={{ 
              width: 'clamp(44px, 12vh, 64px)', height: 'clamp(44px, 12vh, 64px)',
              borderRadius: '1.2rem',
              border: 'clamp(2.5px, 0.6vh, 3.5px) solid #3e366b',
              boxShadow: showReminder 
                ? '0 4px 0 #5B21B6, 0 0 20px rgba(139,92,246,0.5)' 
                : '0 4px 0 #5B21B6, 0 6px 12px rgba(0,0,0,0.1)' 
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95, y: 3 }}
            animate={showReminder ? { scale: [1, 1.05, 1] } : isBlending ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/40 rounded-full pointer-events-none" />
            <Volume2 style={{ width: '70%', height: '70%' }} className="text-white" />
          </motion.button>
        </div>

        {/* RIGHT: Phoneme Highlighted Text */}
        <div className="flex-[0.5] flex items-center justify-center translate-y-[clamp(10px, 2vh, 30px)] z-10 pl-4 pr-10 md:pr-16">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentItem.word + '-text-lg'}
              custom={direction}
              variants={wordVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-center"
            >
              <h1
                className="font-bold tracking-wide"
                style={{ fontSize: getWordFontSizeLg(currentItem.word), lineHeight: 1.1 }}
              >
                <HighlightedWord
                  word={currentItem.word}
                  activePhonemeIndex={activePhoneme}
                  highlightAll={activePhoneme === -1}
                  groupSounds={group.sounds}
                />
              </h1>
              {THAI_TRANSLATIONS[currentItem.word] && (
                <p className="mt-2 text-white/50 font-semibold" style={{ fontSize: 'clamp(1.5rem, 5vh, 2.5rem)' }}>
                  {THAI_TRANSLATIONS[currentItem.word]}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Speaker button - FIXED CENTER for small screens (PORTRAIT ONLY) */}
      <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40 landscape:hidden">
        <motion.button
          onClick={() => { clearReminder(); handleBlendOnce(); }}
          className={`p-4 md:p-5 transition-colors ${showReminder ? 'bg-[#E60023]' : 'bg-[#6B3FA0]'}`}
          style={{
            borderRadius: '1.6rem',
            borderBottom: showReminder ? '5px solid #B8001B' : '5px solid #4A2B70',
            boxShadow: showReminder ? '0px 6px 0px rgba(0,0,0,0.1), 0 0 20px rgba(230,0,35,0.5)' : '0px 6px 0px rgba(0,0,0,0.12)',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95, y: 4 }}
          animate={isSpeaking ? { scale: [1, 1.15, 1, 1.15, 1] } : showReminder ? { scale: [1, 1.12, 1] } : {}}
          transition={isSpeaking ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : showReminder ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <Volume2 className="w-8 h-8 md:w-9 md:h-9 text-white" />
        </motion.button>
      </div>

      {/* Swipe + tap-to-show navigation overlay */}
      <NavOverlay onPrev={currentIndex > 0 ? goToPrev : null} onNext={goToNext} />
    </div>
  );
};

export default FlashcardViewer;
