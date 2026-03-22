import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Maximize } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { playLetterSound, stopAllAudio } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import { getWordImage } from '../../utils/assetHelpers';
import confetti from 'canvas-confetti';
import forestBg from '../../assets/backgrounds/Forest_Moonlight.webm';

const WORDS_PER_ROUND = 6;

// Pick N random items from array (Fisher-Yates partial shuffle)
const pickRandom = (arr, n) => {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
};

// Get the initial sound(s) of a word based on the group's sounds
const getInitialSound = (word, groupSounds) => {
  const w = word.toLowerCase();
  // Check multi-char sounds first (longest match)
  const sorted = [...groupSounds].sort((a, b) => b.length - a.length);
  for (const s of sorted) {
    if (w.startsWith(s.toLowerCase())) return s;
  }
  return w[0];
};

// Generate 2 distractor letters (not the correct one)
const getDistractors = (correctSound, groupSounds) => {
  const others = groupSounds.filter((s) => s !== correctSound);
  const picked = pickRandom(others, 2);
  // If not enough from group, add generic
  while (picked.length < 2) {
    const fallback = 'bcdfghjklmnpqrstvwxyz'.split('').filter(
      (c) => c !== correctSound && !picked.includes(c)
    );
    picked.push(fallback[Math.floor(Math.random() * fallback.length)]);
  }
  return picked;
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const MagicFlashlightGame = ({ group, onBack, onPlayAgain }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 });
  const [gameComplete, setGameComplete] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const darkRef = useRef(null);
  const mountedRef = useRef(true);
  const idleRef = useRef(null);

  // Select words for this round — only words that have images
  const [roundWords] = useState(() => {
    const wordsWithImages = group.words.filter(
      (w) => getWordImage(group.id, w.image || w.word) !== null
    );
    return pickRandom(wordsWithImages.length > 0 ? wordsWithImages : group.words, WORDS_PER_ROUND);
  });
  const currentWord = roundWords[wordIndex];

  const correctSound = currentWord ? getInitialSound(currentWord.word, group.sounds) : '';
  const imageUrl = currentWord ? getWordImage(group.id, currentWord.image || currentWord.word) : null;

  // Shuffle letter options when word changes
  useEffect(() => {
    if (!currentWord) return;
    const correct = getInitialSound(currentWord.word, group.sounds);
    const distractors = getDistractors(correct, group.sounds);
    const options = [correct, ...distractors];
    // Shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    setShuffledOptions(options);
  }, [wordIndex, currentWord, group.sounds]);

  const letterIdleRef = useRef(null);

  // VO on mount
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const run = async () => {
      await playVO('Use your magic flashlight to find the picture!');
      if (cancelled) return;
      await delay(1500);
      if (cancelled) return;
      await playVO('Tap the starting letter!');
      if (cancelled) return;
      if (!cancelled) setInstructionLock(false);
      startIdleReminder();
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
      clearTimeout(letterIdleRef.current);
    };
  }, []);

  // Play "Tap the starting letter!" at start of each new round (after first)
  useEffect(() => {
    if (wordIndex === 0) return; // First round handled by mount VO
    let cancelled = false;
    setInstructionLock(true);
    const run = async () => {
      await delay(300);
      if (cancelled) return;
      await playVO('Tap the starting letter!');
      if (cancelled) return;
      setInstructionLock(false);
      startIdleReminder();
    };
    run();
    return () => { cancelled = true; };
  }, [wordIndex]);

  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    clearTimeout(letterIdleRef.current);
    // Flashlight reminder after 8s, then letter reminder 5s later
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Use your magic flashlight to find the picture!');
      if (!mountedRef.current) return;
      letterIdleRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        await playVO('Tap the starting letter!');
      }, 5000);
    }, 8000);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!darkRef.current) return;
    const rect = darkRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPointerPos({ x, y });
  }, []);

  const handleLetterTap = useCallback(async (letter) => {
    if (instructionLock) return;
    if (isProcessing || isRevealed || !currentWord) return;
    setIsProcessing(true);
    clearTimeout(idleRef.current);
    clearTimeout(letterIdleRef.current);

    if (letter === correctSound) {
      // Correct!
      setIsRevealed(true);
      triggerSmallBurst();
      await playLetterSound(letter).catch(() => {});
      await delay(400);
      if (!mountedRef.current) return;
      await speakAsync(currentWord.word, { rate: 0.85 });
      if (!mountedRef.current) return;
      await delay(300);
      if (!mountedRef.current) return;
      await playVO('Great job!');
      if (!mountedRef.current) return;

      // Linger delay before next word
      await delay(1500);
      if (!mountedRef.current) return;

      if (wordIndex < roundWords.length - 1) {
        setWordIndex((prev) => prev + 1);
        setIsRevealed(false);
        setIsProcessing(false);
        startIdleReminder();
      } else {
        triggerCelebration();
        setGameComplete(true);
      }
    } else {
      // Wrong
      await playVO('Oops, try again!');
      setIsProcessing(false);
      startIdleReminder();
    }
  }, [instructionLock, isProcessing, isRevealed, currentWord, correctSound, wordIndex, roundWords.length, startIdleReminder]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    clearTimeout(letterIdleRef.current);
    onBack();
  };

  // Continuous confetti rain on results screen
  useEffect(() => {
    if (!gameComplete) return;
    let running = true;
    const rain = () => {
      if (!running) return;
      confetti({
        particleCount: 3,
        angle: 270,
        spread: 120,
        origin: { x: Math.random(), y: -0.1 },
        gravity: 0.6,
        scalar: 0.8,
        ticks: 200,
        colors: ['#FFD000', '#FF6B9D', '#4ECDC4', '#8B5CF6', '#22C55E'],
      });
      requestAnimationFrame(rain);
    };
    rain();
    return () => { running = false; };
  }, [gameComplete]);

  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#6B3FA0]">
        <motion.button
          onClick={toggleFullscreen}
          className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] border-t-4 border-[#FFD000] p-8 md:p-12 text-center max-w-md mx-4"
          style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
        >
          <motion.span
            className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🔦⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#6B3FA0] mb-2">
            Amazing Work!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You found all the pictures!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #16a34a', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white/70 font-bold text-sm md:text-base"
              style={{ borderRadius: '1.6rem', borderBottom: '4px solid rgba(0,0,0,0.05)' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Back to Playground
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-[#1a1147]">
      {/* Looping video background */}
      <video
        src={forestBg}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Back + Fullscreen buttons */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button
          onClick={handleBack}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
        <motion.button
          onClick={toggleFullscreen}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          title="Toggle Fullscreen"
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* Progress indicator */}
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-1.5">
        {roundWords.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < wordIndex
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === wordIndex
                ? 'bg-[#FFD000] w-3 h-3 ring-2 ring-[#FFD000]/40'
                : 'bg-white/40 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* Flashlight area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Hidden image underneath */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-6">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={currentWord?.word}
              className="object-contain drop-shadow-2xl"
              style={{ maxWidth: 'min(85%, 500px)', maxHeight: 'min(65%, 400px)' }}
              draggable={false}
            />
          ) : (
            <span className="text-8xl md:text-9xl">
              {currentWord?.word?.[0]?.toUpperCase()}
            </span>
          )}

          {/* Word label — visible only when picture is revealed */}
          <AnimatePresence>
            {isRevealed && currentWord && (
              <motion.div
                className="mt-4 flex items-center justify-center"
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
              >
                <span className="text-3xl md:text-4xl lg:text-5xl font-black tracking-wide uppercase">
                  {currentWord.word.split('').map((char, i) => {
                    const initial = correctSound.toLowerCase();
                    const isHighlighted = i < initial.length;
                    return (
                      <span
                        key={i}
                        style={{ color: isHighlighted ? '#FFD000' : '#ffffff' }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dark overlay with flashlight hole */}
        <AnimatePresence>
          {!isRevealed && (
            <motion.div
              ref={darkRef}
              className="absolute inset-0 z-10 cursor-none"
              onPointerMove={handlePointerMove}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) handlePointerMove(touch);
              }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              style={{
                background: `radial-gradient(circle ${Math.min(window.innerWidth, window.innerHeight) * 0.18}px at ${pointerPos.x}% ${pointerPos.y}%, transparent 0%, rgba(10, 5, 30, 0.97) 100%)`,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Letter buttons at bottom */}
      <div className="relative z-20 flex items-center justify-center gap-4 md:gap-6 py-6 md:py-8 bg-gradient-to-t from-[#2d1b69] to-transparent">
        {shuffledOptions.map((letter, idx) => (
          <motion.button
            key={`${wordIndex}-${letter}-${idx}`}
            onClick={() => handleLetterTap(letter)}
            disabled={isProcessing}
            className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-[1.2rem] bg-white text-[#3e366b] font-black text-2xl md:text-3xl lg:text-4xl flex items-center justify-center uppercase"
            style={{
              borderBottom: '5px solid #d1d5db',
              boxShadow: '0px 6px 0px rgba(0,0,0,0.12)',
            }}
            initial={{ opacity: 0, y: 30, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: idx * 0.1 }}
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9, y: 4 }}
          >
            {letter}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const MagicFlashlight = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <MagicFlashlightGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default MagicFlashlight;
