import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { getWordImage } from '../utils/assetHelpers';
import { speakWithVoice } from '../utils/speech';
import { playBlendingSequence, wordToPhonemes } from '../utils/letterSounds';

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
              color: '#3e366b',
            }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'inline-block',
              textShadow: isActive
                ? (highlightAll ? '0 0 20px rgba(34,197,94,0.5)' : '0 0 20px rgba(230,0,35,0.5)')
                : '0 4px 12px rgba(62, 54, 107, 0.15)',
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

  const handleBlendAndSpeak = useCallback(async () => {
    if (blendingRef.current) return;
    blendingRef.current = true;
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
              blendingRef.current = false;
              setTimeout(() => setActivePhoneme(null), 600);
            },
            onError: () => {
              setIsSpeaking(false);
              setIsBlending(false);
              blendingRef.current = false;
              setActivePhoneme(null);
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
      blendingRef.current = false;
      setActivePhoneme(null);
    }
  }, [displayText]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setImageError(false);
    setActivePhoneme(null);
    blendingRef.current = false;
    setIsBlending(false);
    setIsSpeaking(false);
    speechTimeoutRef.current = setTimeout(() => {
      handleBlendAndSpeak();
    }, 400);
    return () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      window.speechSynthesis.cancel();
    };
  }, [currentIndex, handleBlendAndSpeak]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  const goToNext = () => {
    window.speechSynthesis.cancel();
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
    window.speechSynthesis.cancel();
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
      else if (e.key === 'r' || e.key === 'R') { handleBlendAndSpeak(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, handleBlendAndSpeak]);

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
        <div className="bg-white/60 backdrop-blur-sm rounded-full px-3 py-1 md:px-4 md:py-1.5 lg:px-5 lg:py-2">
          <span className="text-[#3e366b]/60 font-semibold text-xs md:text-sm lg:text-base">
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
                    boxShadow: '0 16px 40px -12px rgba(174, 144, 253, 0.4), 0 0 30px rgba(77, 121, 255, 0.12)',
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
                    boxShadow: '0 16px 40px -12px rgba(174, 144, 253, 0.4)',
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
                  fontSize: 'clamp(6rem, 24vw, 10rem)',
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
                    boxShadow: '0 16px 40px -12px rgba(174, 144, 253, 0.4), 0 0 30px rgba(77, 121, 255, 0.12)',
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
                    boxShadow: '0 16px 40px -12px rgba(174, 144, 253, 0.4)',
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
            onClick={handleBlendAndSpeak}
            className="p-5 rounded-full bg-[#4d79ff] hover:bg-[#3d69ef] transition-colors shadow-xl"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            animate={isSpeaking ? { scale: [1, 1.15, 1, 1.15, 1] } : {}}
            transition={isSpeaking ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
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
          onClick={handleBlendAndSpeak}
          className="p-4 md:p-5 rounded-full bg-[#4d79ff] hover:bg-[#3d69ef] transition-colors shadow-xl"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          animate={isSpeaking ? { scale: [1, 1.15, 1, 1.15, 1] } : {}}
          transition={isSpeaking ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <Volume2 className="w-8 h-8 md:w-9 md:h-9 text-white" />
        </motion.button>
      </div>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <motion.button
          onClick={goToPrev}
          className="fixed left-2 md:left-6 lg:left-10 top-1/2 -translate-y-1/2 z-40 p-3 md:p-4 lg:p-5 rounded-full bg-[#ffd700] hover:bg-[#e6c200] transition-all shadow-xl"
          whileHover={{ scale: 1.15, x: -5 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#3e366b]" />
        </motion.button>
      )}

      <motion.button
        onClick={goToNext}
        className="fixed right-2 md:right-6 lg:right-10 top-1/2 -translate-y-1/2 z-40 p-3 md:p-4 lg:p-5 rounded-full bg-[#ffd700] hover:bg-[#e6c200] transition-all shadow-xl"
        whileHover={{ scale: 1.15, x: 5 }}
        whileTap={{ scale: 0.9 }}
      >
        <ChevronRight className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#3e366b]" />
      </motion.button>
    </div>
  );
};

export default FlashcardViewer;
