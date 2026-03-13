import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Volume2 } from 'lucide-react';
import { getWordImage } from '../utils/assetHelpers';
import { speakWithVoice } from '../utils/speech';

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

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const ExerciseMatch = ({ group, onComplete, onFinish }) => {
  const [pairs, setPairs] = useState([]);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [shuffledPics, setShuffledPics] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedPic, setSelectedPic] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState(new Set());
  const [shakeWord, setShakeWord] = useState(null);
  const [shakePic, setShakePic] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const checkTimeoutRef = useRef(null);

  const initGame = useCallback(() => {
    const gameWords = group.words.slice(0, Math.min(6, group.words.length));
    setPairs(gameWords);
    setShuffledWords(shuffle(gameWords.map((w) => w.word)));
    setShuffledPics(shuffle(gameWords.map((w) => w.word)));
    setSelectedWord(null);
    setSelectedPic(null);
    setMatchedPairs(new Set());
    setIsComplete(false);
    setScore(0);
    setAttempts(0);
    setGameKey((prev) => prev + 1);
  }, [group]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (selectedWord === null || selectedPic === null) return;

    checkTimeoutRef.current = setTimeout(() => {
      setAttempts((prev) => prev + 1);

      if (selectedWord === selectedPic) {
        playPop();
        setMatchedPairs((prev) => {
          const next = new Set(prev);
          next.add(selectedWord);
          if (next.size === pairs.length) {
            setTimeout(() => {
              setIsComplete(true);
            }, 600);
          }
          return next;
        });
        setScore((prev) => prev + 1);
        setSelectedWord(null);
        setSelectedPic(null);
      } else {
        playError();
        setShakeWord(selectedWord);
        setShakePic(selectedPic);
        setTimeout(() => {
          setShakeWord(null);
          setShakePic(null);
          setSelectedWord(null);
          setSelectedPic(null);
        }, 600);
      }
    }, 200);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [selectedWord, selectedPic, pairs.length, onComplete]);

  const handleWordClick = (word) => {
    if (matchedPairs.has(word) || shakeWord) return;
    speakWithVoice(word, { rate: 0.85 });
    setSelectedWord(word);
  };

  const handlePicClick = (word) => {
    if (matchedPairs.has(word) || shakePic) return;
    setSelectedPic(word);
  };

  const visiblePics = shuffledPics.filter((w) => !matchedPairs.has(w));
  const visibleWords = shuffledWords.filter((w) => !matchedPairs.has(w));

  return (
    <div className="h-full w-full flex flex-col items-center relative overflow-hidden">
      {/* Title - center top */}
      <div className="w-full text-center pt-3 md:pt-4 lg:pt-6 z-30">
        <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-[#3e366b]">Match the Pair</h2>
        <p className="text-[#3e366b]/40 text-xs lg:text-sm mt-0.5">
          Tap a word, then tap its picture
        </p>
      </div>

      {/* Progress & reset - top right */}
      <div className="absolute top-3 right-3 md:top-4 md:right-4 lg:top-6 lg:right-6 z-30 flex items-center gap-2">
        <div className="bg-white/60 backdrop-blur-sm rounded-full px-3 py-1 lg:px-4 lg:py-1.5 flex items-center gap-2">
          <span className="text-xs lg:text-sm text-[#3e366b]/50 font-medium">
            {matchedPairs.size}/{pairs.length}
          </span>
          <div className="w-12 md:w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#22c55e] rounded-full"
              animate={{ width: `${pairs.length > 0 ? (matchedPairs.size / pairs.length) * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            />
          </div>
        </div>
        <button
          onClick={initGame}
          className="p-1.5 lg:p-2 rounded-full bg-white/50 hover:bg-white/80 transition-all"
        >
          <RotateCcw size={14} className="text-[#3e366b]/40" />
        </button>
      </div>

      {/* Game area: pictures on top, words on bottom */}
      <div className="flex-1 w-full flex flex-col items-center justify-center px-3 md:px-8 lg:px-12 py-2 md:py-4 lg:py-6 gap-4 md:gap-5 lg:gap-7">

        {/* Pictures Grid - 3 per row on small screens */}
        <motion.div
          key={`pics-${gameKey}`}
          className="grid grid-cols-3 justify-items-center gap-2 md:gap-4 lg:gap-6 w-full max-w-3xl lg:max-w-5xl"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {shuffledPics.map((word) => {
            const isMatched = matchedPairs.has(word);
            const isSelected = selectedPic === word;
            const isShaking = shakePic === word;
            const imgSrc = getWordImage(group.id, word);

            if (isMatched) return (
              <motion.div
                key={word + '-pic'}
                initial={{ scale: 1 }}
                animate={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'backIn' }}
                className="w-full aspect-square"
              />
            );

            return (
              <motion.button
                key={word + '-pic'}
                layout
                onClick={() => handlePicClick(word)}
                className={`rounded-2xl shadow-lg transition-all flex items-center justify-center w-full aspect-square ${
                  isSelected
                    ? 'bg-[#4d79ff]/10 border-3 border-[#4d79ff] ring-4 ring-[#4d79ff]/20'
                    : isShaking
                    ? 'bg-red-50 border-3 border-red-400'
                    : 'bg-white border-3 border-[#ffd700]/70 hover:border-[#4d79ff] hover:shadow-xl'
                }`}
                style={{
                  maxWidth: '200px',
                  maxHeight: '200px',
                  padding: 'clamp(4px, 1.5vw, 12px)',
                }}
                animate={isShaking ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={isShaking ? { duration: 0.4 } : {}}
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
        <div className="w-full max-w-md lg:max-w-2xl flex items-center gap-3 my-1 md:my-0">
          <div className="flex-1 h-px bg-[#3e366b]/10" />
          <span className="text-[#3e366b]/30 text-xs font-medium">match</span>
          <div className="flex-1 h-px bg-[#3e366b]/10" />
        </div>

        {/* Words Grid - 3 per row on small screens */}
        <motion.div
          key={`words-${gameKey}`}
          className="grid grid-cols-3 justify-items-center gap-2 md:gap-4 lg:gap-6 w-full max-w-3xl lg:max-w-5xl"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {shuffledWords.map((word) => {
            const isMatched = matchedPairs.has(word);
            const isSelected = selectedWord === word;
            const isShaking = shakeWord === word;

            if (isMatched) return (
              <motion.div
                key={word}
                initial={{ scale: 1 }}
                animate={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'backIn' }}
                className="w-full"
                style={{ aspectRatio: '2/1', maxWidth: '200px' }}
              />
            );

            return (
              <motion.button
                key={word}
                layout
                onClick={() => handleWordClick(word)}
                className={`rounded-2xl font-bold shadow-lg transition-all flex flex-col items-center justify-center gap-0.5 w-full ${
                  isSelected
                    ? 'bg-[#4d79ff] text-white border-3 border-[#4d79ff] ring-4 ring-[#4d79ff]/20'
                    : isShaking
                    ? 'bg-red-50 text-red-500 border-3 border-red-400'
                    : 'bg-white text-[#3e366b] border-3 border-[#ae90fd]/60 hover:border-[#4d79ff] hover:shadow-xl'
                }`}
                style={{
                  maxWidth: '200px',
                  aspectRatio: '2/1',
                  fontSize: 'clamp(16px, 5vw, 32px)',
                }}
                animate={isShaking ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={isShaking ? { duration: 0.4 } : {}}
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

      {/* Completion - auto advance */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{ background: 'radial-gradient(ellipse at center, rgba(62,54,107,0.7) 0%, rgba(0,0,0,0.8) 100%)' }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl text-center max-w-sm md:max-w-md mx-4"
            >
              <motion.span className="text-6xl md:text-8xl block mb-3"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >&#127881;</motion.span>
              <h2 className="text-2xl md:text-3xl font-bold text-[#3e366b] mb-2">Great Matching!</h2>
              <p className="text-[#ae90fd] font-semibold text-lg mb-8">All pairs found!</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <motion.button
                  onClick={initGame}
                  className="px-6 py-3 rounded-full bg-white border-3 border-[#ae90fd] text-[#ae90fd] font-bold text-base shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw className="w-4 h-4 inline mr-1.5" />
                  Play Again
                </motion.button>
                <motion.button
                  onClick={onComplete}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-bold text-base md:text-lg shadow-xl"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Next Step &rarr;
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExerciseMatch;
