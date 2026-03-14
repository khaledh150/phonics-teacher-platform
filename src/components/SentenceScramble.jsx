import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { speakWithVoice } from '../utils/speech';
import { findSentenceImage } from '../utils/assetHelpers';
import { playVO, stopVO, delay } from '../utils/audioPlayer';

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
const CONFETTI_COLORS = ['#FF1E56', '#00C9A7', '#FFD000', '#FF6600', '#8B00FF', '#0080FF', '#E60023', '#00CC44', '#FF9500', '#22c55e'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Ensure not in original order
  const isSame = a.every((item, idx) => item.originalIdx === idx);
  if (isSame && a.length > 1) return shuffle(arr);
  return a;
}

const SentenceScramble = ({ group, onComplete }) => {
  const { sentenceData, sentences } = useMemo(() => {
    const data = group.words
      .filter(w => w.sentence)
      .map(w => ({ sentence: w.sentence, keyword: w.word }));
    // Shuffle sentence order
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
  const [showConfetti, setShowConfetti] = useState(false);
  const advancingRef = useRef(false);

  const currentSentence = sentences[sentenceIdx] || '';
  const currentKeyword = sentenceData[sentenceIdx]?.keyword || '';
  const sentenceImage = findSentenceImage(group.id, currentKeyword, currentSentence);
  const correctWords = currentSentence.split(/\s+/).filter(Boolean);

  // VO on mount - sequenced
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await playVO("Let's build a sentence!");
      if (cancelled) return;
      await delay(200);
      if (cancelled) return;
      await playVO('Tap the words to put them in order');
    };
    run();
    return () => { cancelled = true; stopVO(); };
  }, []);

  // Initialize shuffled words
  useEffect(() => {
    setShelfWords([]);
    setIsCorrect(false);
    setIsLocked(false);
    setCheckWrong(false);
    setShowConfetti(false);
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
      setShowConfetti(true);
      playSuccessChime();
      // Sequence: wait -> TTS reads sentence -> delay -> VO -> linger -> advance
      const runCompletion = async () => {
        await delay(800);
        await new Promise((resolve) => {
          speakWithVoice(currentSentence, {
            rate: 0.85,
            onEnd: resolve,
            onError: resolve,
          });
        });
        await delay(300);
        await playVO('What a great sentence!');
        await delay(1500);
        autoAdvance();
      };
      runCompletion();
    } else {
      // Wrong order — shake and dump back
      playErrorBuzz();
      setCheckWrong(true);
      setTimeout(() => {
        setCheckWrong(false);
        setShelfWords(prev => {
          setSourceWords(prevSource => shuffle([...prev, ...prevSource]));
          return [];
        });
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
      }
    }, 1000);
  };

  const handleWordTap = (word) => {
    // Always speak the word on tap
    speakWithVoice(word.text, { rate: 0.85 });

    // If not locked, also add to shelf
    if (!isLocked) {
      playPlaceSound();
      setSourceWords(prev => prev.filter(w => w.id !== word.id));
      setShelfWords(prev => [...prev, word]);
      setCheckWrong(false);
    }
  };

  const handleRemoveFromShelf = (word) => {
    if (isLocked) return;
    // Speak it
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
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
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

        {/* Sentence picture hint */}
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

        {/* Shelf (answer zone) — ABOVE the source words */}
        <div className="w-full max-w-3xl">
          <motion.div
            className="rounded-2xl border-3 p-3 md:p-4 flex flex-wrap items-center justify-center gap-2 md:gap-3 transition-all duration-500"
            style={{
              minHeight: 'clamp(60px, 12vw, 90px)',
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
              {shelfWords.map((word) => (
                <motion.button
                  key={word.id}
                  onClick={() => isLocked ? speakWithVoice(word.text, { rate: 0.85 }) : handleRemoveFromShelf(word)}
                  className="px-4 py-2.5 md:px-5 md:py-3 lg:px-6 lg:py-3.5 rounded-xl font-bold text-white shadow-md select-none"
                  style={{
                    backgroundColor: isCorrect ? '#22c55e' : BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length],
                    fontSize: 'clamp(1rem, 4vw, 1.6rem)',
                  }}
                  initial={{ opacity: 0, scale: 0.5, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
                  whileTap={!isLocked ? { scale: 0.95 } : {}}
                  layout
                >
                  {word.text}
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Source words - below the shelf, 4 per row max, last row centered */}
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
