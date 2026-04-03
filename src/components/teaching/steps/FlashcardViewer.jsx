import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { getWordImage } from '../../../utils/assetHelpers';
import { speakWithVoice } from '../../../utils/speech';
import { playBlendingSequence, wordToCharPhonemeMap } from '../../../utils/letterSounds';
import { playVO, stopVO, delay } from '../../../utils/audioPlayer';

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
            className="fixed left-2 md:left-4 top-1/2 -translate-y-1/2 z-50 p-2 md:p-3 rounded-full"
            style={{ 
              background: 'linear-gradient(145deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)', 
              border: 'clamp(1px, 0.3vh, 2px) solid rgba(255,255,255,0.4)',
              boxShadow: '0 clamp(4px, 1vh, 8px) rgba(0,0,0,0.2)' 
            }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft style={{ width: 'clamp(24px, 6vh, 32px)', height: 'clamp(24px, 6vh, 32px)' }} className="text-white" />
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
            className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 z-50 p-2 md:p-3 rounded-full"
            style={{ 
              background: 'linear-gradient(145deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)', 
              border: 'clamp(1px, 0.3vh, 2px) solid rgba(255,255,255,0.4)',
              boxShadow: '0 clamp(4px, 1vh, 8px) rgba(0,0,0,0.2)' 
            }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight style={{ width: 'clamp(24px, 6vh, 32px)', height: 'clamp(24px, 6vh, 32px)' }} className="text-white" />
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
  enter: (dir) => ({ x: dir > 0 ? '50vw' : '-50vw', opacity: 0, scale: 0.7, rotateY: dir > 0 ? 45 : -45 }),
  center: {
    x: 0, opacity: 1, scale: 1, rotateY: 0,
    transition: { type: 'spring', stiffness: 220, damping: 20, mass: 1 },
  },
  exit: (dir) => ({ x: dir < 0 ? '50vw' : '-50vw', opacity: 0, scale: 0.7, rotateY: dir < 0 ? -45 : 45, transition: { duration: 0.3 } }),
};

const wordVariants = {
  enter: (dir) => ({ y: dir > 0 ? '20vh' : '-20vh', opacity: 0, scale: 0.8 }),
  center: {
    y: 0, opacity: 1, scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25, delay: 0.1 },
  },
  exit: (dir) => ({ y: dir < 0 ? '20vh' : '-20vh', opacity: 0, scale: 0.8, transition: { duration: 0.2 } }),
};

// Render word with per-phoneme highlighting
const HighlightedWord = ({ word, activePhonemeIndex, highlightAll, groupSounds }) => {
  const charMap = useMemo(() => wordToCharPhonemeMap(word, groupSounds).charMap, [word, groupSounds]);

  return (
    <span className="inline-flex" style={{ padding: '0 clamp(10px, 2vh, 20px)' }}>
      {word.split('').map((char, i) => {
        const phonemeIdx = charMap[i];
        const isActive = highlightAll || phonemeIdx === activePhonemeIndex;
        const isSilent = phonemeIdx === -2;
        return (
          <motion.span
            key={i}
            animate={isActive && !isSilent ? {
              scale: [1, 1.15, 1],
              color: highlightAll ? '#A78BFA' : '#FFD000',
              textShadow: highlightAll ? '0 0 30px rgba(167,139,250,0.8)' : '0 0 30px rgba(255,208,0,0.8)'
            } : {
              scale: 1,
              color: isSilent ? '#ffffff60' : '#ffffff',
              textShadow: isSilent ? 'none' : '0 clamp(4px, 1vh, 8px) rgba(0, 0, 0, 0.4)'
            }}
            transition={{ duration: 0.3 }}
            style={{ display: 'inline-block' }}
          >
            {char}
          </motion.span>
        );
      })}
    </span>
  );
};

// Extremely responsive font sizing for landscape VH constraints
const getResponsiveFontSize = (word) => {
  const len = word.length;
  if (len <= 4) return `clamp(3rem, 18vh, 12rem)`;
  if (len <= 5) return `clamp(2.5rem, 14vh, 9rem)`;
  return `clamp(2rem, 10vh, 7rem)`;
};

const FlashcardViewer = ({ group, onComplete }) => {
  const [[currentIndex, direction], setCurrentIndex] = useState([0, 0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBlending, setIsBlending] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [activePhoneme, setActivePhoneme] = useState(null); 
  const speechTimeoutRef = useRef(null);
  const blendingRef = useRef(false);

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

  const runOneBlendCycle = useCallback(() => {
    return new Promise(async (resolve) => {
      let resolved = false;
      const safeResolve = () => { if (!resolved) { resolved = true; resolve(); } };

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
  }, [displayText, group.sounds]);

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

  const handleBlendAndSpeak = useCallback(async () => {
    stopVO();
    clearTimeout(reminderRef.current);
    clearTimeout(autoAdvanceTimerRef.current);
    cancelledRef.current = false;

    await runOneBlendCycle();
    if (cancelledRef.current) return;
    await delay(800);
    if (cancelledRef.current) return;
    await playVO('Say it with me!');
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await runOneBlendCycle();
    if (cancelledRef.current) return;
    await delay(1000);
    if (cancelledRef.current) return;
    await playVO('Listen closely...');
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await runOneBlendCycle();
    if (cancelledRef.current) return;
    
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) goToNextRef.current?.();
    }, 1500);
  }, [runOneBlendCycle]);

  useEffect(() => {
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
  }, [currentIndex, handleBlendAndSpeak, clearReminder]);

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
      <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-40 pointer-events-none">
        <motion.div className="bg-[rgba(255,255,255,0.1)] rounded-full font-bold text-white shadow-sm" style={{ padding: 'clamp(2px, 0.5vh, 4px) clamp(10px, 2.5vh, 16px)', fontSize: 'clamp(0.6rem, 2vh, 0.9rem)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {currentIndex + 1} / {words.length}
        </motion.div>
      </div>

      {/* UNIVERSAL HORIZONTAL LAYOUT (VH SCALED) */}
      <div className="h-full w-full flex flex-row items-center justify-center gap-[clamp(8px,3vw,24px)] px-4 py-8" style={{ perspective: '1500px' }}>
        
        {/* LEFT: 3D Squishy Image Card */}
        <div className="flex-[0.4] flex items-center justify-center translate-y-[clamp(10px, 2vh, 30px)]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentItem.word + '-img'}
              custom={direction}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="relative cursor-pointer"
              whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }}
              whileTap={{ scale: 0.95, rotateY: -5, rotateX: 5 }}
              onClick={() => { clearReminder(); handleBlendOnce(); }}
            >
              <div 
                className="bg-white relative overflow-hidden"
                style={{
                  width: 'clamp(100px, min(40vh, 35vw), 450px)',
                  height: 'clamp(100px, min(40vh, 35vw), 450px)',
                  borderRadius: 'clamp(1.5rem, 5vh, 3rem)',
                  border: 'clamp(4px, 1vh, 8px) solid #FFF',
                  boxShadow: '0 clamp(8px, 3vh, 20px) rgba(0,0,0,0.3)'
                }}
              >
                {imagePath && !imageError ? (
                  <motion.img
                    src={imagePath}
                    alt={currentItem.word}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-contain relative z-0"
                    style={{ padding: 'clamp(10px, 3vh, 30px)' }}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span style={{ fontSize: 'clamp(4rem, 15vh, 8rem)' }} className="text-[#A78BFA] font-black">
                      {currentItem.word.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CENTER: Squishy Speaker Pill */}
        <div className="flex-[0.2] flex items-center justify-center translate-y-[clamp(10px, 2vh, 30px)] z-20 pl-4 md:pl-6">
          <motion.button
            onClick={() => { clearReminder(); handleBlendOnce(); }}
            className={`transition-colors flex items-center justify-center relative overflow-hidden ${showReminder ? 'bg-gradient-to-b from-[#FF6B9D] to-[#E60023]' : 'bg-gradient-to-b from-[#A78BFA] to-[#7C3AED]'}`}
            style={{
              width: 'clamp(60px, 18vh, 140px)',
              height: 'clamp(60px, 18vh, 140px)',
              borderRadius: 'clamp(1.2rem, 4vh, 2.5rem)',
              border: `clamp(2px, 0.5vh, 4px) solid ${showReminder ? '#FFF' : '#C4B5FD'}`,
              boxShadow: showReminder 
                ? '0 clamp(4px, 1vh, 8px) 0 #B8001B, 0 clamp(6px, 2vh, 15px) rgba(230,0,35,0.4)' 
                : '0 clamp(4px, 1.5vh, 8px) 0 #5B21B6, 0 clamp(6px, 2vh, 15px) rgba(0,0,0,0.3)'
            }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9, y: 4, boxShadow: showReminder ? '0 0px 0 #B8001B' : '0 0px 0 #5B21B6' }}
            animate={isSpeaking ? { scale: [1, 1.15, 1, 1.15, 1] } : showReminder ? { scale: [1, 1.1, 1] } : {}}
            transition={isSpeaking ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : showReminder ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/40 rounded-full" />
            <Volume2 className="text-white" style={{ width: 'clamp(24px, 8vh, 60px)', height: 'clamp(24px, 8vh, 60px)' }} />
          </motion.button>
        </div>

        {/* RIGHT: Phoneme Highlighted Text */}
        <div className="flex-[0.4] flex items-center justify-center translate-y-[clamp(10px, 2vh, 30px)] z-10 pl-4 pr-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentItem.word + '-text'}
              custom={direction}
              variants={wordVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-center w-full"
            >
              <h1
                className="font-extrabold tracking-wide drop-shadow-xl"
                style={{ fontSize: getResponsiveFontSize(currentItem.word), lineHeight: 1 }}
              >
                <HighlightedWord
                  word={currentItem.word}
                  activePhonemeIndex={activePhoneme}
                  highlightAll={activePhoneme === -1}
                  groupSounds={group.sounds}
                />
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <NavOverlay onPrev={currentIndex > 0 ? goToPrev : null} onNext={goToNext} />
    </div>
  );
};

export default FlashcardViewer;
