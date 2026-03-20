import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio, playLetterSound } from '../../utils/letterSounds';
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
const WHEEL_COLORS = ['#FF6B9D', '#4ECDC4', '#FFD000', '#8B5CF6', '#22C55E', '#FF8A5B'];

const CarnivalWheelGame = ({ group, onBack, onPlayAgain }) => {
  const wheelSounds = useMemo(() => {
    const sounds = [...group.sounds];
    while (sounds.length < 6) sounds.push(sounds[sounds.length % group.sounds.length]);
    return sounds.slice(0, 6);
  }, [group.sounds]);

  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [landedSound, setLandedSound] = useState(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [instructionLock, setInstructionLock] = useState(true);
  const [shakeId, setShakeId] = useState(null);
  const [choices, setChoices] = useState([]);

  const isProcessing = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);

  // --- Check if a word matches a target sound (handles multi-letter sounds) ---
  const wordMatchesSound = useCallback((word, targetSound) => {
    const w = word.toLowerCase();
    const s = targetSound.toLowerCase();
    // Check startsWith first, then check if the sound appears in the word's phoneme data
    if (w.startsWith(s)) return true;
    // For multi-letter sounds (e.g. "ch", "sh", "oo"), also check if word contains the sound
    if (s.length > 1 && w.includes(s)) return true;
    return false;
  }, []);

  // --- Build choices for a given landed sound ---
  const buildChoices = useCallback((targetSound) => {
    const wordsWithImages = group.words.filter(
      (w) => getWordImage(group.id, w.image || w.word) !== null
    );
    const correctWords = wordsWithImages.filter(
      (w) => wordMatchesSound(w.word, targetSound)
    );
    const distractorWords = wordsWithImages.filter(
      (w) => !wordMatchesSound(w.word, targetSound)
    );

    // Fallback: if no words match the sound, pick a random word as "correct"
    // and mark it so the game can still proceed
    let correct;
    let distractorPool;
    if (correctWords.length === 0) {
      const shuffled = [...wordsWithImages].sort(() => Math.random() - 0.5);
      correct = shuffled[0];
      distractorPool = shuffled.slice(1);
    } else {
      correct = correctWords[Math.floor(Math.random() * correctWords.length)];
      distractorPool = distractorWords.length > 0 ? distractorWords : wordsWithImages.filter((w) => w.word !== correct.word);
    }

    if (!correct) return [];

    // Tag the correct word so handleChoice can identify it even in fallback mode
    correct = { ...correct, _isCorrect: true };

    const shuffledDistractors = [...distractorPool].sort(() => Math.random() - 0.5);
    const distractors = shuffledDistractors.slice(0, 2);

    const allChoices = [correct, ...distractors].sort(() => Math.random() - 0.5);
    return allChoices;
  }, [group, wordMatchesSound]);

  // --- Idle reminder ---
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('What does it land on');
    }, 8000);
  }, []);

  // --- Mount: intro VO + idle ---
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const run = async () => {
      await playVO('Spin the wheel!');
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
    return () => {
      running = false;
    };
  }, [gameComplete]);

  // --- Spin handler ---
  const handleSpin = async () => {
    if (isSpinning || isProcessing.current || instructionLock) return;
    clearTimeout(idleRef.current);
    setIsSpinning(true);
    setShowChoices(false);

    // Random target slice
    const targetIndex = Math.floor(Math.random() * wheelSounds.length);
    // Calculate rotation: 5 full spins + offset to land on target
    const sliceAngle = 360 / wheelSounds.length;
    const targetAngle = targetIndex * sliceAngle + sliceAngle / 2;
    // Ensure we always land exactly on the center of the target slice
    const desiredFinalMod = (360 - targetAngle + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const extraNeeded = ((desiredFinalMod - currentMod + 360) % 360);
    const newRotation = rotation + 360 * 5 + extraNeeded;

    setRotation(newRotation);
    setLandedSound(wheelSounds[targetIndex]);

    // Build choices for this sound
    const roundChoices = buildChoices(wheelSounds[targetIndex]);
    setChoices(roundChoices);

    // Wait for spin to finish (3s transition + 500ms buffer)
    await delay(3500);
    if (!mountedRef.current) return;
    setIsSpinning(false);

    // Play the landed sound
    await playLetterSound(wheelSounds[targetIndex]);
    if (!mountedRef.current) return;
    await playVO('Tap the picture that starts with that sound!');
    if (!mountedRef.current) return;

    setShowChoices(true);
  };

  // --- Choice handler ---
  const handleChoice = async (word) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    const isCorrect = word._isCorrect || wordMatchesSound(word.word, landedSound);
    if (isCorrect) {
      // Correct!
      triggerSmallBurst();
      await playEncouragement();
      await delay(1500);
      if (!mountedRef.current) return;

      if (roundNumber >= TOTAL_ROUNDS) {
        triggerCelebration();
        await playVO('Great job!');
        if (!mountedRef.current) return;
        setGameComplete(true);
      } else {
        setRoundNumber((r) => r + 1);
        setShowChoices(false);
        setLandedSound(null);
        isProcessing.current = false;
        startIdleReminder();
      }
    } else {
      // Wrong - shake + oops VO
      setShakeId(word.word);
      await playVO('Oops, try again!');
      setTimeout(() => setShakeId(null), 500);
      isProcessing.current = false;
    }
  };

  // --- Back handler ---
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
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] p-8 md:p-12 text-center max-w-md mx-4 border-t-4 border-[#FFD000]"
          style={{
            borderRadius: '2.2rem',
            boxShadow: '0px 10px 0px rgba(0,0,0,0.12)',
          }}
        >
          <motion.span
            className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎡⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#8B5CF6] mb-2">
            Wheel Winner!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You got them all right!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#22c55e] text-white font-bold text-base md:text-lg"
              style={{
                borderRadius: '1.6rem',
                borderBottom: '5px solid #16a34a',
                boxShadow: '0px 6px 0px rgba(0,0,0,0.12)',
              }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-white/70 font-bold text-sm md:text-base"
              style={{
                borderRadius: '1.6rem',
                borderBottom: '4px solid rgba(0,0,0,0.05)',
              }}
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

  // --- Main game ---
  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-b from-[#1a1147] to-[#6B3FA0] overflow-hidden">
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

      {/* Speaker + Progress dots */}
      <div className="fixed top-3 right-3 z-[70] flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx < roundNumber - 1
                  ? 'bg-[#22c55e] w-2.5 h-2.5'
                  : idx === roundNumber - 1
                  ? 'bg-[#8B5CF6] w-3 h-3 ring-2 ring-[#8B5CF6]/40'
                  : 'bg-white/40 w-2.5 h-2.5'
              }`}
            />
          ))}
        </div>
        <motion.button
          onClick={async () => {
            if (isProcessing.current || isSpinning) return;
            clearTimeout(idleRef.current);
            if (landedSound) {
              try { await playLetterSound(landedSound); } catch (e) { /* ignore */ }
            }
            if (mountedRef.current) startIdleReminder();
          }}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#6B3FA0]"
          style={{ borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.15)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          whileHover={{ scale: 1.1 }}
        >
          <Volume2 className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white" />
        </motion.button>
      </div>

      {/* Wheel + Spin button + Choices */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {/* Wheel container */}
        <div className="relative" style={{ width: 'min(85vw, 380px)', height: 'min(85vw, 380px)' }}>
          {/* Triangle pointer at top */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#FFD000]" />
          </div>

          {/* Spinning wheel */}
          <div
            className="relative w-full h-full"
            style={{
              background: `conic-gradient(${wheelSounds.map((s, i) =>
                `${WHEEL_COLORS[i]} ${i * 60}deg ${(i + 1) * 60}deg`
              ).join(', ')})`,
              borderRadius: '50%',
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              boxShadow: '0 8px 0 rgba(0,0,0,0.2), inset 0 0 30px rgba(0,0,0,0.15)',
              border: '4px solid rgba(255,255,255,0.3)',
            }}
          >
            {/* Labels for each slice */}
            {wheelSounds.map((sound, i) => {
              const angle = i * 60 + 30;
              const rad = (angle - 90) * Math.PI / 180;
              const r = 35;
              return (
                <div
                  key={i}
                  className="absolute text-white font-black text-2xl md:text-3xl lg:text-4xl"
                  style={{
                    left: `${50 + r * Math.cos(rad)}%`,
                    top: `${50 + r * Math.sin(rad)}%`,
                    transform: `translate(-50%, -50%) rotate(-${rotation}deg)`,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {sound.toUpperCase()}
                </div>
              );
            })}

            {/* Center dot */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white"
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
            />
          </div>
        </div>

        {/* Spin button */}
        {!showChoices && (
          <motion.button
            onClick={handleSpin}
            disabled={isSpinning || instructionLock}
            className="mt-4 px-10 py-4 md:px-14 md:py-5 bg-[#E60023] text-white font-bold text-xl md:text-2xl lg:text-3xl rounded-full"
            style={{ borderBottom: '6px solid #B8001B', boxShadow: '0px 8px 0px rgba(0,0,0,0.12)' }}
            whileHover={!isSpinning ? { scale: 1.05 } : {}}
            whileTap={!isSpinning ? { scale: 0.95 } : {}}
            animate={!isSpinning && !instructionLock ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {isSpinning ? '\uD83C\uDF00 Spinning...' : '\uD83C\uDFB0 SPIN!'}
          </motion.button>
        )}

        {/* Word image choices */}
        {showChoices && choices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex items-center justify-center gap-3 md:gap-5 mt-2"
          >
            {choices.map((word) => {
              const imageUrl = getWordImage(group.id, word.image || word.word);
              return (
                <motion.button
                  key={word.word}
                  onClick={() => handleChoice(word)}
                  className="flex flex-col items-center gap-1.5"
                  animate={shakeId === word.word ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div
                    className="w-28 h-28 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-2xl bg-white flex items-center justify-center p-2 overflow-hidden"
                    style={{
                      boxShadow: '0 4px 0 rgba(0,0,0,0.15)',
                    }}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={word.word}
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-3xl md:text-4xl font-black text-[#3e366b] uppercase">
                        {word.word}
                      </span>
                    )}
                  </div>
                  <span className="text-white font-bold text-sm md:text-base capitalize">
                    {word.word}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};

const CarnivalWheel = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <CarnivalWheelGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default CarnivalWheel;
