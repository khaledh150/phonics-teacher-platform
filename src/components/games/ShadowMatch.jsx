import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import { getWordImage } from '../../utils/assetHelpers';
import confetti from 'canvas-confetti';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const TOTAL_ROUNDS = 5;

const ShadowMatchGame = ({ group, onBack, onPlayAgain }) => {
  const wordsWithImages = useRef(
    group.words.filter((w) => getWordImage(group.id, w.image || w.word) !== null)
  );

  const usedWordsRef = useRef(new Set());

  const generateRound = useCallback(() => {
    const pool = wordsWithImages.current;
    if (pool.length < 3) return null;
    const available = pool.filter((w) => !usedWordsRef.current.has(w.word));
    const correctPool = available.length > 0 ? available : pool;
    const correct = correctPool[Math.floor(Math.random() * correctPool.length)];
    usedWordsRef.current.add(correct.word);
    const distractorPool = pool.filter((w) => w.word !== correct.word);
    const shuffledDistractors = [...distractorPool].sort(() => Math.random() - 0.5);
    const distractors = shuffledDistractors.slice(0, 2);
    const choices = [correct, ...distractors].map((w) => ({
      word: w.word,
      imageUrl: getWordImage(group.id, w.image || w.word),
      isCorrect: w.word === correct.word,
    }));
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      correctWord: correct.word,
      shadowUrl: getWordImage(group.id, correct.image || correct.word),
      choices,
    };
  }, [group]);

  const [round, setRound] = useState(() => generateRound());
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameComplete, setGameComplete] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [matchedWord, setMatchedWord] = useState(null); // word text shown after correct
  const [wrongIdx, setWrongIdx] = useState(null); // shaking wrong choice

  const isProcessingRef = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);
  const shadowRef = useRef(null);

  // --- Idle reminder ---
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Look at the shape...');
    }, 8000);
  }, []);

  // --- Mount: intro VO + idle ---
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const run = async () => {
      // Use speakAsync for custom instruction, then idle reminder
      await playVO('Match the picture to its shadow!');
      if (cancelled) return;
      startIdleReminder();
      if (!cancelled) setInstructionLock(false);
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
    };
  }, [startIdleReminder]);

  // --- Confetti rain on results ---
  useEffect(() => {
    if (!gameComplete) return;
    let running = true;
    const rain = () => {
      if (!running) return;
      confetti({
        particleCount: 3, angle: 270, spread: 120,
        origin: { x: Math.random(), y: -0.1 },
        gravity: 0.6, scalar: 0.8, ticks: 200,
        colors: ['#FFD000', '#FF6B9D', '#4ECDC4', '#8B5CF6', '#22C55E'],
      });
      requestAnimationFrame(rain);
    };
    rain();
    return () => { running = false; };
  }, [gameComplete]);

  // --- Speaker button handler ---
  const handleSpeaker = () => {
    if (!round) return;
    speakAsync(round.correctWord, { rate: 0.85 });
  };

  // --- Drop handler: check if dragged image is near the shadow ---
  const handleDragEnd = useCallback(
    async (choiceIdx, info) => {
      if (instructionLock || isProcessingRef.current) return;
      const choice = round.choices[choiceIdx];

      // Check proximity to shadow area
      const shadowEl = shadowRef.current;
      if (!shadowEl) return;
      const shadowRect = shadowEl.getBoundingClientRect();
      const dropX = info.point.x;
      const dropY = info.point.y;

      const inShadow =
        dropX >= shadowRect.left - 40 && dropX <= shadowRect.right + 40 &&
        dropY >= shadowRect.top - 40 && dropY <= shadowRect.bottom + 40;

      if (!inShadow) return; // Dropped outside shadow area, snap back

      clearTimeout(idleRef.current);

      if (!choice.isCorrect) {
        // Wrong answer
        setWrongIdx(choiceIdx);
        await playVO('Oops, try again!');
        if (!mountedRef.current) return;
        setTimeout(() => { if (mountedRef.current) setWrongIdx(null); }, 500);
        startIdleReminder();
        return;
      }

      // Correct!
      isProcessingRef.current = true;
      setRevealed(true);
      setMatchedWord(choice.word);
      triggerSmallBurst();

      await playEncouragement();
      if (!mountedRef.current) return;
      await speakAsync(choice.word, { rate: 0.85 });
      if (!mountedRef.current) return;
      await delay(1500);
      if (!mountedRef.current) return;

      if (roundNumber < TOTAL_ROUNDS) {
        setRoundNumber((r) => r + 1);
        setRound(generateRound());
        setRevealed(false);
        setMatchedWord(null);
        isProcessingRef.current = false;
        startIdleReminder();
      } else {
        triggerCelebration();
        await playVO('Great job!');
        if (!mountedRef.current) return;
        setGameComplete(true);
      }
    },
    [round, instructionLock, roundNumber, generateRound, startIdleReminder]
  );

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  // --- Results screen ---
  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#8B5CF6]">
        <motion.button
          onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] p-8 md:p-12 text-center max-w-md mx-4 border-t-4 border-[#FFD000]"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}>
            🔍⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#8B5CF6] mb-2">Shadow Spotter!</h2>
          <p className="text-white/60 text-sm md:text-base mb-6">You matched all the shadows!</p>
          <div className="flex flex-col gap-3">
            <motion.button onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16a34a', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95, y: 4 }}>
              Play Again
            </motion.button>
            <motion.button onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white/70 font-bold text-sm md:text-base"
              style={{ borderRadius: '1.6rem', borderBottom: '4px solid rgba(0,0,0,0.05)' }}
              whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95, y: 4 }}>
              Back to Playground
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Main game ---
  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-b from-[#1a1147] to-[#6B3FA0] overflow-hidden">
      {/* Back + Fullscreen buttons */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button onClick={handleBack}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}>
          <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.button onClick={toggleFullscreen}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}>
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* Speaker + Progress dots */}
      <div className="fixed top-3 right-3 z-[70] flex items-center gap-2">
        <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, idx) => (
          <div key={idx} className={`rounded-full transition-all ${
            idx < roundNumber - 1 ? 'bg-[#22c55e] w-2.5 h-2.5'
            : idx === roundNumber - 1 ? 'bg-[#8B5CF6] w-3 h-3 ring-2 ring-[#8B5CF6]/40'
            : 'bg-white/40 w-2.5 h-2.5'
          }`} />
        ))}
        </div>
        <motion.button onClick={handleSpeaker}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#6B3FA0]"
          style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          whileHover={{ scale: 1.1 }}>
          <Volume2 className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white" />
        </motion.button>
      </div>

      {/* Game area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 p-4">
        {/* Shadow image - MUCH BIGGER */}
        {round && (
          <motion.div
            ref={shadowRef}
            key={`shadow-${roundNumber}`}
            initial={{ opacity: 0, scale: 0.6, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="relative flex items-center justify-center rounded-3xl bg-white/5 backdrop-blur-sm p-4"
            style={{
              width: 'clamp(280px, 65vmin, 480px)',
              height: 'clamp(280px, 65vmin, 480px)',
              boxShadow: revealed ? '0 0 40px rgba(139,92,246,0.4)' : '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <img
              src={round.shadowUrl}
              alt="shadow"
              className="w-full h-full object-contain transition-all duration-700"
              style={{
                filter: revealed ? 'brightness(1) drop-shadow(0 0 20px rgba(139,92,246,0.5))' : 'brightness(0)',
              }}
              draggable={false}
            />
            {/* Glow pulse on shadow */}
            {!revealed && (
              <motion.div className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ boxShadow: 'inset 0 0 40px rgba(139,92,246,0.2)' }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }} />
            )}
            {/* Word label when revealed */}
            {matchedWord && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -bottom-10 left-0 right-0 text-center">
                <span className="text-white font-black text-3xl md:text-4xl lg:text-5xl uppercase tracking-wide"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  {matchedWord}
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Draggable choice images */}
        {round && (
          <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 mt-4">
            {round.choices.map((choice, idx) => {
              // After correct: hide wrong choices, show word for correct
              if (revealed && !choice.isCorrect) return null;
              if (revealed && choice.isCorrect) return null; // already shown above

              return (
                <motion.div
                  key={`${roundNumber}-${choice.word}-${idx}`}
                  drag
                  dragSnapToOrigin
                  dragElastic={0.8}
                  onDragEnd={(_, info) => handleDragEnd(idx, info)}
                  initial={{ opacity: 0, y: 50, scale: 0.8 }}
                  animate={{
                    opacity: 1, y: 0, scale: 1,
                    x: wrongIdx === idx ? [0, -12, 12, -12, 12, 0] : 0,
                  }}
                  transition={wrongIdx === idx ? { duration: 0.4 } : { type: 'spring', stiffness: 200, damping: 18, delay: idx * 0.1 }}
                  className="cursor-grab active:cursor-grabbing"
                  style={{
                    width: 'clamp(130px, 30vmin, 220px)',
                    height: 'clamp(130px, 30vmin, 220px)',
                    pointerEvents: revealed ? 'none' : 'auto',
                    touchAction: 'none',
                  }}
                  whileHover={{ scale: 1.08, y: -6 }}
                  whileTap={{ scale: 1.05 }}
                >
                  <div
                    className="w-full h-full rounded-2xl bg-white/15 backdrop-blur-sm p-3 md:p-4 flex items-center justify-center"
                    style={{
                      boxShadow: '0 6px 0 rgba(0,0,0,0.2), 0 12px 20px rgba(0,0,0,0.15)',
                      borderBottom: '4px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <img src={choice.imageUrl} alt={choice.word}
                      className="w-full h-full object-contain drop-shadow-lg"
                      draggable={false} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Drag instruction hint */}
        {!revealed && !instructionLock && (
          <motion.p className="text-white/40 text-xs md:text-sm font-medium"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}>
            Drag the picture to its shadow
          </motion.p>
        )}
      </div>
    </div>
  );
};

const ShadowMatch = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <ShadowMatchGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default ShadowMatch;
