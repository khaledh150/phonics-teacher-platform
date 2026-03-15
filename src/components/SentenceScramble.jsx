import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { speakWithVoice, speakAsync } from '../utils/speech';
import { findSentenceImage } from '../utils/assetHelpers';
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

const playPlaceSound = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
  } catch (e) { /* silent */ }
};

const playSuccessChime = () => {
  try {
    const ctx = getCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.25);
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

const BLOCK_COLORS = ['#4d79ff', '#ae90fd', '#FF6B9D', '#4ECDC4', '#FFE66D', '#FF6600', '#22c55e', '#00B894', '#E60023', '#8B00FF'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const isSame = a.every((item, idx) => item.originalIdx === idx);
  if (isSame && a.length > 1) return shuffle(arr);
  return a;
}

const SentenceScramble = ({ group, onComplete }) => {
  const { sentenceData, sentences } = useMemo(() => {
    const data = group.words
      .filter(w => w.sentence)
      .map(w => ({ sentence: w.sentence, keyword: w.word }));
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
    return { sentenceData: data, sentences: data.map(s => s.sentence) };
  }, [group]);

  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [shelfWords, setShelfWords] = useState([]);
  const [sourceWords, setSourceWords] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [checkWrong, setCheckWrong] = useState(false);
  // Reading animation state
  const [readingPhase, setReadingPhase] = useState(null); // 'dictation' | 'reading' | null
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showBorders, setShowBorders] = useState(true);
  const advancingRef = useRef(false);
  const cancelledRef = useRef(false);
  const idleReminderRef = useRef(null);

  const currentSentence = sentences[sentenceIdx] || '';
  const currentKeyword = sentenceData[sentenceIdx]?.keyword || '';
  const sentenceImage = findSentenceImage(group.id, currentKeyword, currentSentence);
  const correctWords = currentSentence.split(/\s+/).filter(Boolean);

  // Clear idle reminder
  const clearIdleReminder = () => {
    clearTimeout(idleReminderRef.current);
  };

  // Start idle reminder
  const startIdleReminder = () => {
    clearTimeout(idleReminderRef.current);
    idleReminderRef.current = setTimeout(async () => {
      if (cancelledRef.current || isLocked) return;
      await playVO('Tap the words to put them in order');
    }, 6000);
  };

  // VO on mount — no sentence dictation (don't reveal answer before user tries)
  useEffect(() => {
    cancelledRef.current = false;
    const run = async () => {
      await playVO("Let's build a sentence!");
      if (cancelledRef.current) return;
      await delay(200);
      if (cancelledRef.current) return;
      await playVO('Tap the words to put them in order');
      if (cancelledRef.current) return;
      startIdleReminder();
    };
    run();
    return () => { cancelledRef.current = true; stopVO(); clearIdleReminder(); };
  }, []);

  // Per-sentence VO reminder — no dictation (don't reveal answer)
  useEffect(() => {
    if (sentenceIdx === 0) return;
    cancelledRef.current = false;
    const run = async () => {
      await delay(400);
      if (cancelledRef.current) return;
      await playVO('Tap the words to put them in order');
      if (cancelledRef.current) return;
      startIdleReminder();
    };
    run();
    return () => { cancelledRef.current = true; stopVO(); clearIdleReminder(); };
  }, [sentenceIdx]);

  // Initialize shuffled words
  useEffect(() => {
    setShelfWords([]);
    setIsCorrect(false);
    setIsLocked(false);
    setCheckWrong(false);
    setReadingPhase(null);
    setHighlightIdx(-1);
    setShowBorders(true);
    advancingRef.current = false;

    const words = correctWords.map((word, idx) => ({
      id: `${sentenceIdx}-r${Math.random()}-${idx}`,
      text: word,
      originalIdx: idx,
    }));
    setSourceWords(shuffle(words));
  }, [sentenceIdx]);

  // Auto-check when shelf is full
  useEffect(() => {
    if (shelfWords.length === 0 || shelfWords.length < correctWords.length) return;

    const built = shelfWords.map(w => w.text).join(' ');
    const target = correctWords.join(' ');

    if (built === target) {
      setIsCorrect(true);
      setIsLocked(true);
      clearIdleReminder();
      triggerSmallBurst();
      playSuccessChime();

      // Reading animation sequence
      const runReadingAnimation = async () => {
        cancelledRef.current = false;
        await delay(800);
        if (cancelledRef.current) return;

        // Phase 1: Word-by-word dictation — TTS reads each word while it pops
        setReadingPhase('dictation');
        for (let i = 0; i < correctWords.length; i++) {
          if (cancelledRef.current) return;
          setHighlightIdx(i);
          await new Promise((resolve) => {
            speakWithVoice(correctWords[i], {
              rate: 0.7,
              onEnd: resolve,
              onError: resolve,
            });
          });
          // Extra delay between words so last word doesn't get cut off
          await delay(350);
        }

        if (cancelledRef.current) return;
        setHighlightIdx(-1);
        await delay(800);
        if (cancelledRef.current) return;

        // Phase 2: Full sentence dictation — reads the whole sentence at once
        await new Promise((resolve) => {
          speakWithVoice(currentSentence, {
            rate: 0.8,
            onEnd: resolve,
            onError: resolve,
          });
        });
        if (cancelledRef.current) return;
        await delay(600);
        if (cancelledRef.current) return;

        // Phase 3: "Let's read together" VO
        await playVO("Let's read together");
        if (cancelledRef.current) return;
        await delay(500);
        if (cancelledRef.current) return;

        // Remove borders/frames
        setShowBorders(false);
        setReadingPhase('reading');
        await delay(400);

        // Phase 4: Words pop one by one (no TTS — kids read along, slower pace)
        for (let i = 0; i < correctWords.length; i++) {
          if (cancelledRef.current) return;
          setHighlightIdx(i);
          // Slower timing to give kids time to read
          await delay(600 + correctWords[i].length * 100);
        }

        if (cancelledRef.current) return;
        setHighlightIdx(-1);
        await delay(400);

        // Completion VO
        await playCompletionEncouragement();
        await delay(800);
        if (cancelledRef.current) return;
        autoAdvance();
      };
      runReadingAnimation();
    } else {
      playErrorBuzz();
      playVO('Oops, try again!');
      setCheckWrong(true);
      setTimeout(() => {
        setCheckWrong(false);
        // Create fresh word objects to avoid duplication
        const freshWords = correctWords.map((word, idx) => ({
          id: `${sentenceIdx}-r${Math.random()}-${idx}`,
          text: word,
          originalIdx: idx,
        }));
        setShelfWords([]);
        setSourceWords(shuffle(freshWords));
        startIdleReminder();
      }, 700);
    }
  }, [shelfWords]);

  const autoAdvance = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setTimeout(() => {
      window.speechSynthesis.cancel();
      if (sentenceIdx < sentences.length - 1) {
        setSentenceIdx(prev => prev + 1);
      } else {
        setAllDone(true);
        triggerCelebration();
      }
    }, 500);
  };

  const handleWordTap = (word) => {
    speakWithVoice(word.text, { rate: 0.85 });
    if (!isLocked) {
      clearIdleReminder();
      startIdleReminder();
      playPlaceSound();
      setSourceWords(prev => prev.filter(w => w.id !== word.id));
      setShelfWords(prev => [...prev, word]);
      setCheckWrong(false);
    }
  };

  const handleRemoveFromShelf = (word) => {
    if (isLocked) return;
    speakWithVoice(word.text, { rate: 0.85 });
    setShelfWords(prev => prev.filter(w => w.id !== word.id));
    setSourceWords(prev => [...prev, word]);
    setCheckWrong(false);
  };

  const handleReset = () => {
    if (isLocked) return;
    window.speechSynthesis.cancel();
    const words = correctWords.map((word, idx) => ({
      id: `${sentenceIdx}-r${Math.random()}-${idx}`,
      text: word,
      originalIdx: idx,
    }));
    setSourceWords(shuffle(words));
    setShelfWords([]);
    setCheckWrong(false);
  };

  if (allDone) {
    return (
      <div className="h-full w-full flex items-center justify-center relative overflow-hidden"
        style={{ background: '#E8F4FF' }}>
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-white p-6 md:p-10 text-center max-w-sm md:max-w-md mx-4"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span className="text-6xl md:text-8xl block mb-3"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >&#128218;</motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#6B3FA0] mb-2">Sentence Master!</h2>
          <p className="text-[#ae90fd] font-semibold text-lg mb-8">You built {sentences.length} sentences!</p>
          <motion.button
            onClick={() => onComplete()}
            className="px-8 py-3 bg-[#E60023] text-white font-bold text-base md:text-lg"
            style={{ borderRadius: '1.6rem', borderBottom: '5px solid #B3001B', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95, y: 4 }}
          >
            Complete &#10003;
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col"
      style={{ background: '#E8F4FF' }}>

      {/* Progress - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-30">
        <div className="bg-white/70 backdrop-blur-sm rounded-full px-3 py-1 md:px-4 md:py-1.5 flex items-center gap-2">
          <span className="text-[#3e366b]/60 font-semibold text-xs md:text-sm lg:text-base">
            {sentenceIdx + 1} / {sentences.length}
          </span>
          {!isLocked && (
            <motion.button
              onClick={handleReset}
              className="p-1.5 rounded-full bg-[#3e366b]/10 hover:bg-[#3e366b]/20 transition-colors"
              whileTap={{ scale: 0.9, rotate: -180 }}
            >
              <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#3e366b]/50" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="pt-14 md:pt-16 px-4 text-center">
        <motion.span
          className="text-lg md:text-2xl lg:text-3xl font-bold text-[#3e366b]/70"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Build the sentence!
        </motion.span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-evenly px-4 md:px-8 lg:px-16 py-2">

        {/* Sentence picture hint — only shown if a proper sentence-level image exists */}
        {sentenceImage && (
          <motion.img
            key={`img-${sentenceIdx}`}
            src={sentenceImage}
            alt={currentKeyword}
            className="rounded-2xl shadow-lg object-contain"
            style={{ width: 'clamp(220px, 48vw, 320px)', height: 'clamp(220px, 48vw, 320px)' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Shelf (answer zone) */}
        <div className="w-full max-w-3xl">
          <motion.div
            className="rounded-2xl p-3 md:p-4 flex flex-wrap items-center justify-center gap-2 md:gap-3 transition-all duration-500"
            style={{
              minHeight: 'clamp(60px, 12vw, 90px)',
              borderWidth: showBorders ? 3 : 0,
              borderColor: isCorrect ? '#22c55e' : checkWrong ? '#E60023' : '#3e366b30',
              borderStyle: isCorrect ? 'solid' : 'dashed',
              backgroundColor: isCorrect ? '#22c55e15' : checkWrong ? '#E6002310' : 'white',
              boxShadow: isCorrect ? '0 0 30px rgba(34,197,94,0.3), inset 0 0 20px rgba(34,197,94,0.1)' : 'none',
            }}
            animate={checkWrong ? { x: [0, -6, 6, -6, 6, 0] } : shelfWords.length === 0 && !isCorrect ? { scale: [1, 1.01, 1] } : {}}
            transition={checkWrong ? { duration: 0.4 } : shelfWords.length === 0 && !isCorrect ? { scale: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } } : {}}
          >
            {shelfWords.length === 0 && (
              <span className="text-[#3e366b]/25 text-sm md:text-base lg:text-lg font-medium">
                Tap words below to build the sentence...
              </span>
            )}
            <AnimatePresence>
              {shelfWords.map((word, idx) => {
                const isHighlighted = highlightIdx === idx;
                const isInReadingPhase = readingPhase === 'reading';
                const isDictationPhase = readingPhase === 'dictation';

                return (
                  <motion.button
                    key={word.id}
                    onClick={() => isLocked ? speakWithVoice(word.text, { rate: 0.85 }) : handleRemoveFromShelf(word)}
                    className="px-4 py-2.5 md:px-5 md:py-3 lg:px-6 lg:py-3.5 font-bold text-white shadow-md select-none"
                    style={{
                      backgroundColor: isCorrect ? '#22c55e' : BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length],
                      fontSize: 'clamp(1rem, 4vw, 1.6rem)',
                      borderRadius: showBorders ? '0.75rem' : '0.5rem',
                      border: showBorders ? undefined : 'none',
                      boxShadow: showBorders ? undefined : 'none',
                    }}
                    initial={{ opacity: 0, scale: 0.5, y: 15 }}
                    animate={{
                      opacity: 1,
                      scale: isHighlighted ? 1.2 : 1,
                      y: isHighlighted ? -8 : 0,
                      backgroundColor: isHighlighted && isDictationPhase ? '#FFD000'
                        : isHighlighted && isInReadingPhase ? '#FF6600'
                        : isCorrect ? '#22c55e'
                        : BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length],
                    }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
                    whileTap={!isLocked ? { scale: 0.95 } : {}}
                    layout
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    {word.text}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Source words */}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 w-full max-w-2xl lg:max-w-3xl"
          style={{ maxWidth: 'calc(4 * (clamp(5rem, 20vw, 10rem) + 1rem))' }}
        >
          <AnimatePresence>
            {sourceWords.map((word, idx) => (
              <motion.button
                key={word.id}
                onClick={() => handleWordTap(word)}
                className="rounded-xl md:rounded-2xl font-bold text-white shadow-lg select-none cursor-pointer text-center"
                style={{
                  backgroundColor: BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length],
                  fontSize: 'clamp(1.1rem, 4.5vw, 1.8rem)',
                  boxShadow: `0 4px 15px ${BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length]}50, 0 2px 8px rgba(0,0,0,0.1)`,
                  width: 'clamp(5rem, 20vw, 10rem)',
                  padding: 'clamp(0.6rem, 2vw, 1rem) 0',
                }}
                initial={{ opacity: 0, scale: 0.5, rotate: Math.random() * 10 - 5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
                transition={{ delay: idx * 0.06, duration: 0.5 }}
                whileHover={{ scale: 1.08, y: -3 }}
                whileTap={{ scale: 0.92 }}
                layout
              >
                {word.text}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="pb-8 md:pb-10" />
    </div>
  );
};

export default SentenceScramble;
