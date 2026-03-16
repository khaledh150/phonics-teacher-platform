import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { getWordImage } from '../utils/assetHelpers';
import { speakWithVoice } from '../utils/speech';
import { playBlendingSequence, wordToPhonemes } from '../utils/letterSounds';
import { playVO, stopVO, delay } from '../utils/audioPlayer';

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

// Render word with per-phoneme highlighting
const HighlightedWord = ({ word, activePhonemeIndex, highlightAll }) => {
  const phonemes = useMemo(() => wordToPhonemes(word), [word]);

  // Map phonemes back to character ranges in the original word
  const segments = useMemo(() => {
    const result = [];
    let charIdx = 0;
    for (let i = 0; i < phonemes.length; i++) {
      const len = phonemes[i].length;
      result.push({
        text: word.slice(charIdx, charIdx + len),
        phonemeIdx: i,
      });
      charIdx += len;
    }
    // Handle any remaining chars (e.g. silent e)
    if (charIdx < word.length) {
      result.push({ text: word.slice(charIdx), phonemeIdx: -2 });
    }
    return result;
  }, [word, phonemes]);

  return (
    <span className="inline-flex">
      {segments.map((seg, i) => {
        const isActive = highlightAll || seg.phonemeIdx === activePhonemeIndex;
        return (
          <motion.span
            key={i}
            animate={isActive ? {
              scale: [1, 1.15, 1],
              color: highlightAll ? '#22c55e' : '#E60023',
            } : {
              scale: 1,
              color: '#ffffff',
            }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'inline-block',
              textShadow: isActive
                ? (highlightAll ? '0 0 20px rgba(34,197,94,0.5)' : '0 0 20px rgba(230,0,35,0.5)')
                : '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {seg.text}
          </motion.span>
        );
      })}
    </span>
  );
};

const FlashcardViewer = ({ group, onComplete }) => {
  const [[currentIndex, direction], setCurrentIndex] = useState([0, 0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBlending, setIsBlending] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [activePhoneme, setActivePhoneme] = useState(null); // index of phoneme being played, -1 = full word
  const speechTimeoutRef = useRef(null);
  const blendingRef = useRef(false);

  const words = group.words;
  const currentItem = words[currentIndex];

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
                setIsSpeaking(false);
                setIsBlending(false);
                setTimeout(() => setActivePhoneme(null), 600);
                resolve();
              },
              onError: () => {
                setIsSpeaking(false);
                setIsBlending(false);
                setActivePhoneme(null);
                resolve();
              },
            });
          },
          (phonemeIdx) => {
            setActivePhoneme(phonemeIdx);
          }
        );
      } catch {
        setIsSpeaking(false);
        setIsBlending(false);
        setActivePhoneme(null);
        resolve();
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

  // Full 3x sequence: play → "Say it with me!" → play → "Listen closely..." → play → reminder
  const handleBlendAndSpeak = useCallback(async () => {
    if (blendingRef.current) return;
    clearTimeout(reminderRef.current);
    stopVO();
    window.speechSynthesis.cancel();
    blendingRef.current = true;
    cancelledRef.current = false;

    // 1st play
    await runOneBlendCycle();
    if (cancelledRef.current) { blendingRef.current = false; return; }
    await delay(800);
    if (cancelledRef.current) { blendingRef.current = false; return; }
    // "Say it with me!" + 2nd play
    await playVO('Say it with me!');
    if (cancelledRef.current) { blendingRef.current = false; return; }
    await delay(600);
    if (cancelledRef.current) { blendingRef.current = false; return; }
    await runOneBlendCycle();
    if (cancelledRef.current) { blendingRef.current = false; return; }
    await delay(1000);
    if (cancelledRef.current) { blendingRef.current = false; return; }
    // "Listen closely..." + 3rd play
    await playVO('Listen closely...');
    if (cancelledRef.current) { blendingRef.current = false; return; }
    await delay(600);
    if (cancelledRef.current) { blendingRef.current = false; return; }
    await runOneBlendCycle();
    blendingRef.current = false;
    if (!cancelledRef.current) startReminderTimer();
  }, [runOneBlendCycle, startReminderTimer]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setImageError(false);
    setActivePhoneme(null);
    blendingRef.current = false;
    setIsBlending(false);
    setIsSpeaking(false);
    clearReminder();

    let cancelled = false;
    const run = async () => {
      await delay(currentIndex > 0 ? 400 : 100);
      if (cancelled) return;
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
      blendingRef.current = false;
      stopVO();
      clearReminder();
      window.speechSynthesis.cancel();
    };
  }, [currentIndex, handleBlendAndSpeak, clearReminder]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  const goToNext = () => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    clearReminder();
    stopVO();
    blendingRef.current = false;
    setIsSpeaking(false);
    setIsBlending(false);
    setActivePhoneme(null);
    playWhoosh();
    if (currentIndex === words.length - 1) {
      onComplete();
    } else {
      setCurrentIndex([currentIndex + 1, 1]);
    }
  };

  const goToPrev = () => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    clearReminder();
    stopVO();
    blendingRef.current = false;
    setIsSpeaking(false);
    setIsBlending(false);
    setActivePhoneme(null);
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

      {/* Progress - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-40">
        <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 md:px-4 md:py-1.5 lg:px-5 lg:py-2">
          <span className="text-white/60 font-semibold text-xs md:text-sm lg:text-base">
            {currentIndex + 1} / {words.length}
          </span>
        </div>
      </div>

      {/* Small screens: top half = pic, fixed center = speaker, bottom half = word */}
      {/* Big screens (lg+): horizontal row — pic left | speaker center | word right */}

      {/* --- SMALL/MEDIUM SCREEN LAYOUT (below lg) --- */}
      <div className="h-full w-full flex flex-col lg:hidden">
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
                    padding: 'clamp(8px, 2vw, 16px)',
                    boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                  }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <motion.div
                  className="rounded-3xl shadow-2xl bg-white flex items-center justify-center border-4 border-[#ae90fd]"
                  style={{
                    width: 'clamp(200px, 50vw, 350px)',
                    height: 'clamp(200px, 50vw, 350px)',
                    boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                  }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span style={{ fontSize: 'clamp(5rem, 12vw, 8rem)' }} className="text-[#ae90fd]">
                    {currentItem.word.charAt(0).toUpperCase()}
                  </span>
                </motion.div>
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
                  fontSize: 'clamp(8rem, 30vw, 10rem)',
                  lineHeight: 1.1,
                }}
              >
                <HighlightedWord
                  word={currentItem.word}
                  activePhonemeIndex={activePhoneme}
                  highlightAll={activePhoneme === -1}
                />
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* --- LARGE SCREEN LAYOUT (lg+) --- */}
      <div className="h-full w-full hidden lg:flex flex-row items-center justify-center px-24 py-12">
        {/* Image left */}
        <div className="flex-1 flex items-center justify-center">
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
                  className="object-contain rounded-3xl shadow-2xl bg-white border-4 border-[#ae90fd]"
                  style={{
                    width: '420px',
                    height: '420px',
                    padding: '20px',
                    boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                  }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <motion.div
                  className="rounded-3xl shadow-2xl bg-white flex items-center justify-center border-4 border-[#ae90fd]"
                  style={{
                    width: '420px',
                    height: '420px',
                    boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                  }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="text-[10rem] text-[#ae90fd]">
                    {currentItem.word.charAt(0).toUpperCase()}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Speaker center */}
        <div className="mx-8 xl:mx-12">
          <motion.button
            onClick={() => { clearReminder(); handleBlendOnce(); }}
            className={`p-5 transition-colors ${showReminder ? 'bg-[#E60023]' : 'bg-[#6B3FA0]'}`}
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
            <Volume2 className="w-10 h-10 text-white" />
          </motion.button>
        </div>

        {/* Word right */}
        <div className="flex-1 flex items-center justify-center pr-8 xl:pr-12">
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
                style={{ fontSize: '14rem', lineHeight: 1.1 }}
              >
                <HighlightedWord
                  word={currentItem.word}
                  activePhonemeIndex={activePhoneme}
                  highlightAll={activePhoneme === -1}
                />
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Speaker button - FIXED CENTER for small/medium screens only, same level as yellow arrows */}
      <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40 lg:hidden">
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

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <motion.button
          onClick={goToPrev}
          className="fixed left-2 md:left-6 lg:left-10 top-1/2 -translate-y-1/2 z-40 p-3 md:p-4 lg:p-5 bg-[#FFD000] transition-all"
          style={{ borderRadius: '1.6rem', borderBottom: '5px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileHover={{ scale: 1.15, x: -5 }}
          whileTap={{ scale: 0.9, y: 4 }}
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#3e366b]" />
        </motion.button>
      )}

      <motion.button
        onClick={goToNext}
        className="fixed right-2 md:right-6 lg:right-10 top-1/2 -translate-y-1/2 z-40 p-3 md:p-4 lg:p-5 bg-[#FFD000] transition-all"
        style={{ borderRadius: '1.6rem', borderBottom: '5px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
        whileHover={{ scale: 1.15, x: 5 }}
        whileTap={{ scale: 0.9, y: 4 }}
      >
        <ChevronRight className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#3e366b]" />
      </motion.button>
    </div>
  );
};

export default FlashcardViewer;
