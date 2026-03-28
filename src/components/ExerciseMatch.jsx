import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { getWordImage } from '../utils/assetHelpers';
import { speakWithVoice } from '../utils/speech';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../utils/confetti';
import { playMatchEncouragement, playCompletionEncouragement } from '../utils/encouragement';

// Web Audio sounds
let sharedAudioContext = null;
const getAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume();
  return sharedAudioContext;
};

const playPop = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) { /* silent */ }
};

const playError = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
};

const playFanfare = () => {
  try {
    const ctx = getAudioContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) { /* silent */ }
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const CONFETTI_COLORS = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#FF8A5B', '#9B59B6', '#3498DB', '#22c55e', '#ffd700', '#E60023', '#6B3FA0'];
const TOTAL_ROUNDS = 3;
const WORDS_PER_ROUND = 6;

// Mini confetti burst for a single match
const MatchConfetti = ({ active }) => {
  if (!active) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[55] pointer-events-none overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${30 + Math.random() * 40}%`,
            top: `${30 + Math.random() * 30}%`,
            width: 5 + Math.random() * 6,
            height: 5 + Math.random() * 6,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{
            y: (Math.random() - 0.5) * 300,
            x: (Math.random() - 0.5) * 300,
            scale: [0, 1.2, 0],
            opacity: [1, 1, 0],
            rotate: Math.random() * 360,
          }}
          transition={{ duration: 0.7 + Math.random() * 0.3, ease: 'easeOut' }}
        />
      ))}
    </motion.div>
  );
};

// Big confetti burst for round completion
const RoundConfetti = () => (
  <motion.div
    className="fixed inset-0 z-[55] pointer-events-none overflow-hidden"
    initial={{ opacity: 1 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Dense confetti rain */}
    {[...Array(60)].map((_, i) => (
      <motion.div
        key={`c-${i}`}
        className="absolute"
        style={{
          left: `${Math.random() * 100}%`,
          top: -20,
          width: 7 + Math.random() * 10,
          height: 7 + Math.random() * 10,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        }}
        animate={{
          y: ['0vh', '110vh'],
          x: [0, (Math.random() - 0.5) * 120],
          rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
        }}
        transition={{
          duration: 1.2 + Math.random() * 1.5,
          delay: Math.random() * 0.5,
          ease: 'easeIn',
        }}
      />
    ))}
    {/* Sparkle particles */}
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={`s-${i}`}
        className="absolute rounded-full"
        style={{
          left: `${15 + Math.random() * 70}%`,
          top: `${15 + Math.random() * 70}%`,
          width: 4 + Math.random() * 6,
          height: 4 + Math.random() * 6,
          backgroundColor: '#ffd700',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 0.8 + Math.random() * 0.5, delay: Math.random() * 0.8 }}
      />
    ))}
  </motion.div>
);

// Massive celebration for all rounds complete
const FinalCelebration = () => (
  <motion.div
    className="fixed inset-0 z-[58] pointer-events-none overflow-hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Dense confetti rain */}
    {[...Array(70)].map((_, i) => (
      <motion.div
        key={`confetti-${i}`}
        className="absolute"
        style={{
          left: `${Math.random() * 100}%`,
          top: -20,
          width: 7 + Math.random() * 10,
          height: 7 + Math.random() * 10,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        }}
        animate={{
          y: ['0vh', '110vh'],
          x: [0, (Math.random() - 0.5) * 120],
          rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
        }}
        transition={{
          duration: 2 + Math.random() * 3,
          delay: Math.random() * 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    ))}
    {/* Sparkle particles */}
    {[...Array(25)].map((_, i) => (
      <motion.div
        key={`spark-${i}`}
        className="absolute rounded-full"
        style={{
          left: `${15 + Math.random() * 70}%`,
          top: `${15 + Math.random() * 70}%`,
          width: 3 + Math.random() * 6,
          height: 3 + Math.random() * 6,
          backgroundColor: '#ffd700',
        }}
        animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 1 + Math.random(), delay: Math.random() * 3, repeat: Infinity }}
      />
    ))}
  </motion.div>
);

const ExerciseMatch = ({ group, onComplete }) => {
  // Build randomized rounds: shuffle all words, distribute into rounds so every word is played
  const roundsRef = useRef([]);
  const buildRounds = useCallback(() => {
    const allWords = shuffle([...group.words]);
    const result = [];
    for (let r = 0; r < TOTAL_ROUNDS; r++) {
      const start = r * WORDS_PER_ROUND;
      let roundWords = allWords.slice(start, start + WORDS_PER_ROUND);
      // If not enough words left, fill from shuffled pool (avoiding duplicates within this round)
      if (roundWords.length < WORDS_PER_ROUND) {
        const remaining = shuffle(allWords.filter((w) => !roundWords.includes(w)));
        roundWords = [...roundWords, ...remaining.slice(0, WORDS_PER_ROUND - roundWords.length)];
      }
      result.push(roundWords);
    }
    roundsRef.current = result;
    return result;
  }, [group]);

  const [round, setRound] = useState(0);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [shuffledPics, setShuffledPics] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedPic, setSelectedPic] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState(new Set());
  const [shakeWord, setShakeWord] = useState(null);
  const [shakePic, setShakePic] = useState(null);
  const [allComplete, setAllComplete] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [matchBurst, setMatchBurst] = useState(false);
  const [roundBurst, setRoundBurst] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultCountdown, setResultCountdown] = useState(5);
  const checkTimeoutRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  const currentRoundWords = roundsRef.current[round] || [];

  const initRound = useCallback((roundIdx) => {
    const words = roundsRef.current[roundIdx] || [];
    setShuffledWords(shuffle(words.map((w) => w.word)));
    setShuffledPics(shuffle(words.map((w) => w.word)));
    setSelectedWord(null);
    setSelectedPic(null);
    setMatchedPairs(new Set());
    setGameKey((prev) => prev + 1);
  }, []);

  const matchCountRef = useRef(0);
  const idleReminderRef = useRef(null);

  const clearIdleReminder = useCallback(() => {
    clearTimeout(idleReminderRef.current);
  }, []);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleReminderRef.current);
    idleReminderRef.current = setTimeout(() => {
      playVO('Match the word to the picture!');
    }, 6000);
  }, []);

  // Init on mount — build fresh randomized rounds each time
  useEffect(() => {
    const rounds = buildRounds();
    setRound(0);
    setAllComplete(false);
    matchCountRef.current = 0;
    // Init directly from freshly built rounds
    const words = rounds[0] || [];
    setShuffledWords(shuffle(words.map((w) => w.word)));
    setShuffledPics(shuffle(words.map((w) => w.word)));
    setSelectedWord(null);
    setSelectedPic(null);
    setMatchedPairs(new Set());
    setGameKey((prev) => prev + 1);
    // VO on mount + start idle reminder
    let cancelled = false;
    const run = async () => {
      await playVO('Match the word to the picture!');
      if (!cancelled) startIdleReminder();
    };
    run();
    return () => { cancelled = true; stopVO(); clearIdleReminder(); };
  }, [buildRounds]);

  // VO + confetti + 5-second auto-advance on all rounds complete
  useEffect(() => {
    if (!allComplete) return;
    clearIdleReminder();
    triggerCelebration();
    setResultCountdown(5);
    let cancelled = false;
    const run = async () => {
      await delay(500);
      if (!cancelled) await playVO('You did it!');
    };
    run();
    // 5-second countdown to auto-advance
    let count = 5;
    const countdownInterval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownInterval);
        setResultCountdown(0);
        if (!cancelled) setTimeout(() => onCompleteRef.current(), 0);
      } else {
        setResultCountdown(count);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(countdownInterval); clearIdleReminder(); };
  }, [allComplete, clearIdleReminder]);

  const handleNextRound = useCallback(() => {
    const nextRound = round + 1;
    if (nextRound >= TOTAL_ROUNDS) {
      setAllComplete(true);
    } else {
      setRound(nextRound);
      initRound(nextRound);
    }
  }, [round, initRound]);

  // Check match logic
  useEffect(() => {
    if (selectedWord === null || selectedPic === null) return;

    setIsProcessing(true);
    checkTimeoutRef.current = setTimeout(() => {
      if (selectedWord === selectedPic) {
        playPop();
        clearIdleReminder();
        setMatchBurst(true);
        setTimeout(() => setMatchBurst(false), 800);
        matchCountRef.current += 1;

        setMatchedPairs((prev) => {
          const next = new Set(prev);
          next.add(selectedWord);
          const isRoundComplete = next.size === currentRoundWords.length;
          // Only play match encouragement if NOT the last pair (round completion VO handles that)
          if (!isRoundComplete) {
            setTimeout(() => playMatchEncouragement(), 300);
          }
          if (isRoundComplete) {
            const runRoundEnd = async () => {
              await delay(500);
              setRoundBurst(true);
              triggerSmallBurst();
              playFanfare();
              await delay(1500);
              await playCompletionEncouragement();
              await delay(500);
              setRoundBurst(false);
              handleNextRound();
            };
            runRoundEnd();
          }
          return next;
        });
        setSelectedWord(null);
        setSelectedPic(null);
        setIsProcessing(false);
        startIdleReminder();
      } else {
        playError();
        clearIdleReminder();
        playVO('Oops, try again!');
        setShakeWord(selectedWord);
        setShakePic(selectedPic);
        setTimeout(() => {
          setShakeWord(null);
          setShakePic(null);
          setSelectedWord(null);
          setSelectedPic(null);
          setIsProcessing(false);
          startIdleReminder();
        }, 700);
      }
    }, 200);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [selectedWord, selectedPic, currentRoundWords.length, handleNextRound]);

  const handleWordClick = (word) => {
    if (matchedPairs.has(word) || shakeWord || isProcessing) return;
    clearIdleReminder();
    startIdleReminder();
    speakWithVoice(word, { rate: 0.85 });
    setSelectedWord(word);
  };

  const handlePicClick = (word) => {
    if (matchedPairs.has(word) || shakePic || isProcessing) return;
    clearIdleReminder();
    startIdleReminder();
    setSelectedPic(word);
  };

  const handleResetRound = () => {
    initRound(round);
  };

  return (
    <div className="h-full w-full flex flex-col items-center relative overflow-hidden">
      {/* Match confetti burst */}
      <AnimatePresence>
        {matchBurst && <MatchConfetti active />}
      </AnimatePresence>

      {/* Round complete confetti */}
      <AnimatePresence>
        {roundBurst && <RoundConfetti />}
      </AnimatePresence>

      {/* Title - center top */}
      <div className="w-full text-center pt-3 md:pt-4 lg:pt-6 z-30">
        <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-white">Match the Pair</h2>
      </div>

      {/* Progress & reset - top right */}
      <div className="absolute top-3 right-3 md:top-4 md:right-4 lg:top-6 lg:right-6 z-30 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 lg:px-4 lg:py-1.5 flex items-center gap-2">
            <span className="text-xs lg:text-sm text-white/50 font-medium">
              {matchedPairs.size}/{currentRoundWords.length}
            </span>
            <div className="w-12 md:w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#22c55e] rounded-full"
                animate={{ width: `${currentRoundWords.length > 0 ? (matchedPairs.size / currentRoundWords.length) * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              />
            </div>
          </div>
        </div>
        {/* Round dots - below progress bar */}
        <div className="flex items-center gap-1.5 pr-1">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i < round ? 'bg-[#22c55e]' : i === round ? 'bg-[#6B3FA0]' : 'bg-[#3e366b]/20'
              }`}
              style={{ width: i === round ? 10 : 7, height: i === round ? 10 : 7 }}
            />
          ))}
        </div>
      </div>

      {/* Game area: pictures on top, words on bottom */}
      <div className="flex-1 w-full flex flex-col items-center justify-center px-4 md:px-8 lg:px-10 py-4 md:py-6 lg:py-6 gap-4 md:gap-5 lg:gap-5">

        {/* Pictures Grid */}
        <motion.div
          key={`pics-${gameKey}`}
          className="grid grid-cols-3 justify-items-center gap-3 md:gap-4 lg:gap-5 w-full max-w-3xl lg:max-w-4xl"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {shuffledPics.map((word, idx) => {
            const isMatched = matchedPairs.has(word);
            const isSelected = selectedPic === word;
            const isShaking = shakePic === word;
            const imgSrc = getWordImage(group.id, word);

            if (isMatched) return (
              <motion.div
                key={word + '-pic'}
                initial={{ scale: 1 }}
                animate={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'backIn' }}
                className="w-full aspect-square"
              />
            );

            return (
              <motion.button
                key={word + '-pic'}
                onClick={() => handlePicClick(word)}
                className={`rounded-2xl shadow-lg transition-all flex items-center justify-center w-full aspect-square ${
                  isSelected
                    ? 'bg-[#4d79ff]/10 border-3 border-[#4d79ff] ring-4 ring-[#4d79ff]/20'
                    : isShaking
                    ? 'bg-red-50 border-3 border-red-400'
                    : 'bg-white border-3 border-[#ffd700]/70 hover:border-[#4d79ff] hover:shadow-xl'
                }`}
                style={{
                  maxWidth: 'clamp(140px, 22vw, 180px)',
                  maxHeight: 'clamp(140px, 22vw, 180px)',
                  padding: 'clamp(6px, 2vw, 10px)',
                }}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={isShaking ? { opacity: 1, y: 0, scale: 1, x: [0, -8, 8, -8, 8, 0] } : { opacity: 1, y: 0, scale: 1 }}
                transition={isShaking ? { duration: 0.5 } : { delay: idx * 0.06, duration: 0.5 }}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={word}
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#ae90fd]/15 to-[#4d79ff]/15 flex items-center justify-center">
                    <span style={{ fontSize: 'clamp(28px, 8vw, 56px)' }} className="text-[#ae90fd] font-bold">
                      {word.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Separator line */}
        <div className="w-full max-w-md lg:max-w-2xl flex items-center gap-3 my-0">
          <div className="flex-1 h-px bg-[#3e366b]/10" />
          <span className="text-white/30 text-xs font-medium">match</span>
          <div className="flex-1 h-px bg-[#3e366b]/10" />
        </div>

        {/* Words Grid */}
        <motion.div
          key={`words-${gameKey}`}
          className="grid grid-cols-3 justify-items-center gap-3 md:gap-4 lg:gap-5 w-full max-w-3xl lg:max-w-4xl"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {shuffledWords.map((word, idx) => {
            const isMatched = matchedPairs.has(word);
            const isSelected = selectedWord === word;
            const isShaking = shakeWord === word;

            if (isMatched) return (
              <motion.div
                key={word}
                initial={{ scale: 1 }}
                animate={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'backIn' }}
                className="w-full aspect-square"
                style={{ maxWidth: '200px' }}
              />
            );

            return (
              <motion.button
                key={word}
                layout
                onClick={() => handleWordClick(word)}
                className={`rounded-2xl font-bold shadow-lg transition-all flex flex-col items-center justify-center gap-1 w-full aspect-square ${
                  isSelected
                    ? 'bg-[#4d79ff] text-white border-3 border-[#4d79ff] ring-4 ring-[#4d79ff]/20'
                    : isShaking
                    ? 'bg-red-50 text-red-500 border-3 border-red-400'
                    : 'bg-white/10 text-white border-3 border-[#ae90fd]/60 hover:border-[#4d79ff] hover:shadow-xl'
                }`}
                style={{
                  maxWidth: 'clamp(140px, 22vw, 180px)',
                  maxHeight: 'clamp(140px, 22vw, 180px)',
                  fontSize: 'clamp(16px, 4.5vw, 28px)',
                  padding: 'clamp(6px, 1.5vw, 10px)',
                }}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={isShaking ? { opacity: 1, y: 0, scale: 1, x: [0, -8, 8, -8, 8, 0] } : { opacity: 1, y: 0, scale: 1 }}
                transition={isShaking ? { duration: 0.5 } : { delay: idx * 0.06, duration: 0.5 }}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                <Volume2 style={{ width: 'clamp(12px, 3.5vw, 22px)', height: 'clamp(12px, 3.5vw, 22px)' }} className="opacity-30" />
                <span>{word}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* ALL ROUNDS COMPLETE - Big celebration */}
      <AnimatePresence>
        {allComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
          >
            <FinalCelebration />

            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="bg-[#2d1b69] p-8 md:p-12 text-center max-w-md mx-4 relative z-10"
              style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
            >
              <motion.span
                className="text-7xl md:text-8xl block mb-4"
                animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎯⭐
              </motion.span>

              <motion.h2
                className="text-3xl md:text-4xl font-bold text-[#6B3FA0] mb-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Match Master!
              </motion.h2>

              <motion.p
                className="text-lg md:text-xl text-[#ae90fd] font-semibold mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                All {TOTAL_ROUNDS} rounds complete!
              </motion.p>

              <motion.p
                className="text-white/50 text-sm mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                You matched {TOTAL_ROUNDS * WORDS_PER_ROUND} pairs!
              </motion.p>

              <motion.div
                className="flex items-center justify-center gap-2 text-white/50 text-sm font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <span>Next step in</span>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-base">
                  {resultCountdown}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExerciseMatch;
