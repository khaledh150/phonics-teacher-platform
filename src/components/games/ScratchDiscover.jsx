import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize, Volume2 } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio, playLetterSound } from '../../utils/letterSounds';
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
const CANVAS_SIZE = 500;

// Common digraphs/trigraphs to check for starting sounds
const DIGRAPHS = [
  'thr', 'shr', 'sch',
  'th', 'sh', 'ch', 'wh', 'ph', 'ck', 'qu', 'ng', 'ai', 'ee', 'oo', 'ou', 'ow', 'ew', 'oi', 'ar', 'or', 'er', 'ir', 'ur',
];

const getStartingSound = (word, groupSounds) => {
  const w = word.toLowerCase();
  // Check group sounds first (longest match wins)
  const sorted = [...groupSounds].sort((a, b) => b.length - a.length);
  for (const sound of sorted) {
    if (w.startsWith(sound.toLowerCase())) return sound.toLowerCase();
  }
  // Check common digraphs
  for (const d of DIGRAPHS) {
    if (w.startsWith(d)) return d;
  }
  // Fallback: first letter
  return w[0];
};

const getDistractors = (correctSound, groupSounds) => {
  const allLetters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const pool = [
    ...groupSounds.map((s) => s.toLowerCase()),
    ...allLetters,
  ].filter((s, i, arr) => arr.indexOf(s) === i && s !== correctSound);

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
};

const ScratchDiscoverGame = ({ group, onBack, onPlayAgain }) => {
  // --- Build word list with images ---
  const roundWords = useRef([]);

  const pickWords = useCallback(() => {
    const wordsWithImages = group.words.filter(
      (w) => getWordImage(group.id, w.image || w.word) !== null
    );
    const shuffled = [...wordsWithImages].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, TOTAL_ROUNDS);
  }, [group]);

  if (roundWords.current.length === 0) {
    roundWords.current = pickWords();
  }

  const [roundIndex, setRoundIndex] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [instructionLock, setInstructionLock] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [scratchPercent, setScratchPercent] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [showWord, setShowWord] = useState(false);
  const [shakeWrong, setShakeWrong] = useState(null);
  const [letterChoices, setLetterChoices] = useState([]);

  const canvasRef = useRef(null);
  const isScratching = useRef(false);
  const revealedRef = useRef(false);
  const isProcessing = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);
  const checkThrottleRef = useRef(0);

  const currentWord = roundWords.current[roundIndex] || roundWords.current[0];
  const wordText = currentWord?.word || '';
  const imageUrl = currentWord
    ? getWordImage(group.id, currentWord.image || currentWord.word)
    : null;
  const correctSound = getStartingSound(wordText, group.sounds || []);

  // --- Initialize canvas overlay ---
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Fill with a fun gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#7C3AED');
    gradient.addColorStop(0.3, '#8B5CF6');
    gradient.addColorStop(0.6, '#6D28D9');
    gradient.addColorStop(1, '#4ECDC4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Sparkle pattern - stars and dots
    const sparkleColors = [
      'rgba(255,255,255,0.25)',
      'rgba(255,215,0,0.2)',
      'rgba(78,205,196,0.18)',
      'rgba(255,107,157,0.15)',
    ];

    // Draw small dots
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
      ctx.fill();
    }

    // Draw star shapes
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 8 + 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      // 4-point star
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.3, -size * 0.3);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.3, size * 0.3);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.3, size * 0.3);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.3, -size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw sparkle emoji text for extra flair
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = `${Math.round(width * 0.07)}px serif`;
    for (let i = 0; i < 12; i++) {
      ctx.fillText('\u2728', Math.random() * width * 0.9, Math.random() * height * 0.9 + height * 0.05);
    }

    // Draw question mark in the center
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = `bold ${Math.round(width * 0.25)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', width / 2, height / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    revealedRef.current = false;
    setScratchPercent(0);
  }, []);

  // --- Scratch at position ---
  const scratch = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();

    // Softer outer ring for smoother edge
    const grad = ctx.createRadialGradient(x, y, 30, x, y, 50);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  };

  // --- Calculate scratch percentage ---
  const calcScratchPercent = () => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++;
    }
    return transparent / (pixels.length / 4);
  };

  // --- Pointer handlers ---
  const handlePointerDown = (e) => {
    if (instructionLock || isProcessing.current || revealedRef.current) return;
    isScratching.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    scratch((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    clearTimeout(idleRef.current);
  };

  const handlePointerMove = (e) => {
    if (!isScratching.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    scratch((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);

    // Throttle percentage calculation for performance
    const now = Date.now();
    if (now - checkThrottleRef.current > 200) {
      checkThrottleRef.current = now;
      const pct = calcScratchPercent();
      setScratchPercent(pct);
    }
  };

  const handlePointerUp = () => {
    isScratching.current = false;
    // Final check on release
    if (canvasRef.current && !revealedRef.current) {
      const pct = calcScratchPercent();
      setScratchPercent(pct);
      // Restart idle reminder if not yet revealed
      if (pct < 0.8 && !instructionLock && !isProcessing.current) {
        startIdleReminder();
      }
    }
  };

  // --- Generate letter choices when round changes ---
  useEffect(() => {
    const distractors = getDistractors(correctSound, group.sounds || []);
    const choices = [correctSound, ...distractors].sort(() => Math.random() - 0.5);
    setLetterChoices(choices);
  }, [roundIndex, correctSound, group.sounds]);

  // --- Init canvas on round change ---
  useEffect(() => {
    const timer = setTimeout(() => initCanvas(), 50);
    return () => clearTimeout(timer);
  }, [roundIndex, initCanvas]);

  // --- Idle reminder ---
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Keep scratching!');
    }, 8000);
  }, []);

  // --- Mount: intro VO ---
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const run = async () => {
      await playVO('Scratch the screen to reveal the picture!');
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

  // --- 80% reveal logic ---
  useEffect(() => {
    if (scratchPercent >= 0.8 && !revealedRef.current && !revealed) {
      revealedRef.current = true;
      clearTimeout(idleRef.current);
      const run = async () => {
        await playVO('What does it start with');
        if (!mountedRef.current) return;
        setRevealed(true);
      };
      run();
    }
  }, [scratchPercent, revealed]);

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

  // --- Letter choice handler ---
  const handleLetterTap = useCallback(
    async (letter) => {
      if (isProcessing.current) return;
      clearTimeout(idleRef.current);

      if (letter === correctSound) {
        // Correct!
        isProcessing.current = true;
        setSelectedLetter(letter);
        setShowWord(true);
        triggerSmallBurst();

        await speakAsync(wordText, { rate: 0.85 });
        if (!mountedRef.current) return;

        await playEncouragement();
        if (!mountedRef.current) return;

        await delay(1500);
        if (!mountedRef.current) return;

        if (roundIndex + 1 >= TOTAL_ROUNDS) {
          // Game complete
          triggerCelebration();
          await playVO('Great job!');
          if (!mountedRef.current) return;
          setGameComplete(true);
        } else {
          // Next round - reset state
          setRoundIndex((r) => r + 1);
          setRevealed(false);
          setSelectedLetter(null);
          setShowWord(false);
          setInstructionLock(true);
          isProcessing.current = false;
          revealedRef.current = false;

          // Brief intro for next round
          setTimeout(async () => {
            if (!mountedRef.current) return;
            await playVO('Scratch the screen to reveal the picture!');
            if (!mountedRef.current) return;
            setInstructionLock(false);
            startIdleReminder();
          }, 300);
        }
      } else {
        // Wrong - shake + oops VO
        setShakeWrong(letter);
        isProcessing.current = true;
        await playVO('Oops, try again!');
        if (!mountedRef.current) return;
        setShakeWrong(null);
        isProcessing.current = false;
      }
    },
    [correctSound, wordText, roundIndex, startIdleReminder]
  );

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
            {'\uD83D\uDD0D\u2B50'}
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#8B5CF6] mb-2">
            Super Scratcher!
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6">
            You discovered all the pictures!
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
                idx < roundIndex
                  ? 'bg-[#22c55e] w-2.5 h-2.5'
                  : idx === roundIndex
                  ? 'bg-[#8B5CF6] w-3 h-3 ring-2 ring-[#8B5CF6]/40'
                  : 'bg-white/40 w-2.5 h-2.5'
              }`}
            />
          ))}
        </div>
        <motion.button
          onClick={async () => {
            if (isProcessing.current) return;
            clearTimeout(idleRef.current);
            try { await playLetterSound(correctSound); } catch (e) { /* ignore */ }
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

      {/* Scratch area + letter choices */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        {/* Scratch container */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            width: 'min(80vmin, 450px)',
            height: 'min(80vmin, 450px)',
            boxShadow: '0 8px 0 rgba(0,0,0,0.15)',
          }}
        >
          {/* Image underneath */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={wordText}
              className="absolute inset-0 w-full h-full object-contain bg-white rounded-3xl"
              draggable={false}
            />
          )}

          {/* Canvas overlay on top */}
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="absolute inset-0 w-full h-full rounded-3xl cursor-pointer"
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {/* Scratch progress bar */}
          {!revealedRef.current && !showWord && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[40%] h-1.5 bg-white/20 rounded-full overflow-hidden z-10">
              <motion.div
                className="h-full bg-[#22c55e] rounded-full"
                style={{ width: `${Math.min(100, Math.round(scratchPercent * 125))}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {/* Word label after correct answer */}
          {showWord && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center"
            >
              <span className="text-white font-bold text-2xl md:text-3xl uppercase tracking-wide">
                {wordText}
              </span>
            </motion.div>
          )}
        </div>

        {/* Letter choices - always visible, enabled after reveal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4 mt-2"
        >
          {letterChoices.map((letter) => (
            <motion.button
              key={letter}
              onClick={() => revealed && handleLetterTap(letter)}
              className={`w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center text-3xl md:text-4xl lg:text-5xl font-black uppercase transition-opacity ${
                selectedLetter === letter
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-white text-[#3e366b]'
              } ${!revealed ? 'opacity-40' : 'opacity-100'}`}
              style={{
                boxShadow: selectedLetter === letter
                  ? '0 5px 0 #16a34a'
                  : '0 5px 0 rgba(0,0,0,0.15)',
              }}
              animate={
                shakeWrong === letter
                  ? { x: [0, -10, 10, -10, 10, 0], backgroundColor: '#ef4444' }
                  : {}
              }
              transition={{ duration: 0.4 }}
              whileTap={!isProcessing.current && revealed ? { scale: 0.9, y: 3 } : {}}
              disabled={isProcessing.current || !revealed}
            >
              {letter}
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

const ScratchDiscover = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <ScratchDiscoverGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default ScratchDiscover;
