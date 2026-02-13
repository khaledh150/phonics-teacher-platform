import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Home,
  Maximize,
  RotateCcw
} from 'lucide-react';
import { COMPETITION_SPEECH_RATE } from '../data/sets';
import { getBestVoice, speakWithVoice } from '../utils/speech';

// ============================================
// SHARED AUDIO CONTEXT
// ============================================
let sharedAudioContext = null;

const getAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

// Whoosh sound for transitions
const playWhoosh = () => {
  try {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);

    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};

// Fullscreen toggle
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

// ============================================
// DYNAMIC IMAGE LOADER
// Import all images from the assets folder using Vite's import.meta.glob
// ============================================
const imageModules = import.meta.glob('../assets/images/*.{png,jpg,jpeg,svg}', { eager: true });

const allImages = {};
Object.entries(imageModules).forEach(([path, module]) => {
  // Extract filename without extension: '../assets/images/cat.png' -> 'cat'
  const fileName = path.split('/').pop().replace(/\.(png|jpe?g|svg)$/, '');
  allImages[fileName.toLowerCase()] = module.default;
});

const getImagePath = (word) => {
  const lowerWord = word.toLowerCase();

  // Try different naming patterns
  const patterns = [
    lowerWord,
    `${lowerWord}_`,
    lowerWord.replace(/\s+/g, '_'),
  ];

  for (const pattern of patterns) {
    if (allImages[pattern]) {
      return allImages[pattern];
    }
  }

  return null;
};

// ============================================
// ANIMATION VARIANTS
// ============================================
const imageVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 500 : -500,
    opacity: 0,
    rotateY: direction > 0 ? 45 : -45,
  }),
  center: {
    x: 0,
    opacity: 1,
    rotateY: 0,
    transition: {
      x: { type: 'spring', stiffness: 260, damping: 25, delay: 0.1 },
      opacity: { duration: 0.4, delay: 0.1 },
      rotateY: { type: 'spring', stiffness: 200, damping: 20, delay: 0.1 },
    },
  },
  exit: (direction) => ({
    x: direction < 0 ? 500 : -500,
    opacity: 0,
    rotateY: direction < 0 ? 45 : -45,
    transition: {
      duration: 0.3,
    },
  }),
};

const wordVariants = {
  enter: (direction) => ({
    y: direction > 0 ? 100 : -100,
    opacity: 0,
    scale: 0.5,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      y: { type: 'spring', stiffness: 300, damping: 25, delay: 0.2 },
      opacity: { duration: 0.4, delay: 0.2 },
      scale: { type: 'spring', stiffness: 400, damping: 20, delay: 0.2 },
    },
  },
  exit: (direction) => ({
    y: direction < 0 ? 100 : -100,
    opacity: 0,
    scale: 0.5,
    transition: {
      duration: 0.2,
    },
  }),
};

const pulseAnimation = {
  scale: [1, 1.03, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// Heartbeat animation for speaker when speaking
const heartbeatAnimation = {
  scale: [1, 1.15, 1, 1.15, 1],
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// ============================================
// LEARN SCREEN COMPONENT
// ============================================
const LearnScreen = ({ words, onExit }) => {
  const [[currentIndex, direction], setCurrentIndex] = useState([0, 0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [imageError, setImageError] = useState(false);

  const voiceRef = useRef(null);
  const autoPlayTimerRef = useRef(null);
  const speechTimeoutRef = useRef(null);

  const currentWord = words[currentIndex];
  const imagePath = getImagePath(currentWord);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      voiceRef.current = getBestVoice();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  // Speak word function - uses speakWithVoice for fresh high-quality voice
  const speakWord = useCallback((word) => {
    speakWithVoice(word, {
      rate: COMPETITION_SPEECH_RATE,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  // Auto-speak when word changes (with 800ms delay)
  useEffect(() => {
    setImageError(false);

    speechTimeoutRef.current = setTimeout(() => {
      speakWord(currentWord);
    }, 800);

    return () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, [currentWord, speakWord]);

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlay) {
      autoPlayTimerRef.current = setInterval(() => {
        goToNext();
      }, 5000);
    } else {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    }

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isAutoPlay, currentIndex]);

  const goToNext = () => {
    playWhoosh();
    setCurrentIndex(([prev]) => [
      prev === words.length - 1 ? 0 : prev + 1,
      1
    ]);
  };

  const goToPrev = () => {
    playWhoosh();
    setCurrentIndex(([prev]) => [
      prev === 0 ? words.length - 1 : prev - 1,
      -1
    ]);
  };

  const handleManualSpeak = () => {
    speakWord(currentWord);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlay(!isAutoPlay);
  };

  // Handle exit - stop all speech and timers before exiting
  const handleExit = () => {
    window.speechSynthesis.cancel();
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    onExit();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'r' || e.key === 'R') {
        handleManualSpeak();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWord]);

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#d8e9fa]">
      {/* Animated background particles - using app colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 80 + 40,
              height: Math.random() * 80 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: ['#ae90fd20', '#4d79ff20', '#ffd70020', '#f093fb20'][i % 4],
            }}
            animate={{
              y: [0, -20, 0],
              x: [0, Math.random() * 15 - 7, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Top Controls - matches competition mode positioning */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
          title="Toggle Fullscreen"
        >
          <Maximize size={24} className="text-[#3e366b]" />
        </button>
        <button
          onClick={handleExit}
          className="p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
          title="Exit to Home"
        >
          <Home size={24} className="text-[#3e366b]" />
        </button>
      </div>

      {/* Progress indicator */}
      <div className="absolute top-3 left-3 landscape:top-2 landscape:left-2 md:top-5 md:left-5 lg:top-8 lg:left-8 z-40">
        <div className="bg-[#ae90fd] rounded-full px-4 py-2 md:px-6 md:py-3 shadow-lg">
          <span className="text-white font-bold text-base landscape:text-sm md:text-xl lg:text-2xl">
            {currentIndex + 1} / {words.length}
          </span>
        </div>
      </div>

      {/* Main Content - Vertical: Image above, Speaker center, Word below. Landscape/Tablet/PC: Row layout */}
      <div className="h-full w-full flex flex-col landscape:flex-row md:flex-row items-center justify-center px-4 landscape:px-16 md:px-12 lg:px-20 py-16 landscape:py-4 md:py-8">

        {/* Portrait Phone: Vertical stack with speaker in center of screen */}
        {/* Image - raised up in portrait */}
        <div className="landscape:flex-1 md:flex-1 flex items-center justify-center mb-2 landscape:mb-0 md:mb-0">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentWord + '-image'}
              custom={direction}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="relative"
            >
              {imagePath && !imageError ? (
                <motion.img
                  src={imagePath}
                  alt={currentWord}
                  onError={() => setImageError(true)}
                  className="w-40 h-40 landscape:w-52 landscape:h-52 md:w-72 md:h-72 md:landscape:w-64 md:landscape:h-64 lg:w-[26rem] lg:h-[26rem] object-contain rounded-3xl shadow-2xl bg-white p-3 landscape:p-4 md:p-5 lg:p-8 border-4 border-[#ae90fd]"
                  style={{
                    boxShadow: '0 20px 40px -12px rgba(174, 144, 253, 0.4), 0 0 40px rgba(77, 121, 255, 0.2)',
                  }}
                  animate={pulseAnimation}
                />
              ) : (
                <motion.div
                  className="w-40 h-40 landscape:w-52 landscape:h-52 md:w-72 md:h-72 md:landscape:w-64 md:landscape:h-64 lg:w-[26rem] lg:h-[26rem] rounded-3xl shadow-2xl bg-white flex items-center justify-center border-4 border-[#ae90fd]"
                  style={{
                    boxShadow: '0 20px 40px -12px rgba(174, 144, 253, 0.4), 0 0 40px rgba(77, 121, 255, 0.2)',
                  }}
                  animate={pulseAnimation}
                >
                  <span className="text-6xl landscape:text-7xl md:text-8xl lg:text-[9rem] text-[#ae90fd]">
                    {currentWord.charAt(0).toUpperCase()}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Speaker Button - center of screen in portrait, between image and word in landscape */}
        <div className="flex items-center justify-center py-3 landscape:py-0 landscape:px-6 md:px-8 lg:px-10">
          <motion.button
            onClick={handleManualSpeak}
            className="p-5 landscape:p-4 md:p-6 lg:p-8 rounded-full bg-[#4d79ff] hover:bg-[#3d69ef] transition-colors shadow-xl"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            animate={isSpeaking ? heartbeatAnimation : {}}
          >
            <Volume2
              className="w-12 h-12 landscape:w-10 landscape:h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white"
            />
          </motion.button>
        </div>

        {/* Word - below speaker in portrait */}
        <div className="landscape:flex-1 md:flex-1 flex items-center justify-center mt-2 landscape:mt-0 md:mt-0">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentWord + '-word'}
              custom={direction}
              variants={wordVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-center"
            >
              <motion.h1
                className="text-6xl landscape:text-6xl md:text-9xl md:landscape:text-8xl lg:text-[11rem] font-bold text-[#3e366b] tracking-wide"
                style={{
                  textShadow: '0 4px 12px rgba(62, 54, 107, 0.2)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {currentWord}
              </motion.h1>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Arrows */}
      <motion.button
        onClick={goToPrev}
        className="fixed left-2 landscape:left-2 md:left-4 lg:left-8 top-1/2 -translate-y-1/2 z-40 p-3 landscape:p-2 md:p-5 lg:p-6 rounded-full bg-[#ffd700] hover:bg-[#e6c200] transition-all shadow-xl"
        whileHover={{ scale: 1.15, x: -5 }}
        whileTap={{ scale: 0.9 }}
      >
        <ChevronLeft className="w-8 h-8 landscape:w-6 landscape:h-6 md:w-12 md:h-12 lg:w-14 lg:h-14 text-[#3e366b]" />
      </motion.button>

      <motion.button
        onClick={goToNext}
        className="fixed right-2 landscape:right-2 md:right-4 lg:right-8 top-1/2 -translate-y-1/2 z-40 p-3 landscape:p-2 md:p-5 lg:p-6 rounded-full bg-[#ffd700] hover:bg-[#e6c200] transition-all shadow-xl"
        whileHover={{ scale: 1.15, x: 5 }}
        whileTap={{ scale: 0.9 }}
      >
        <ChevronRight className="w-8 h-8 landscape:w-6 landscape:h-6 md:w-12 md:h-12 lg:w-14 lg:h-14 text-[#3e366b]" />
      </motion.button>

      {/* Bottom Controls - Center buttons raised up */}
      <div className="fixed bottom-6 landscape:bottom-3 md:bottom-8 lg:bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 md:gap-4">
        {/* Auto-play toggle - individual pill */}
        <motion.button
          onClick={toggleAutoPlay}
          className={`flex items-center gap-2 px-5 py-2.5 landscape:px-4 landscape:py-2 md:px-6 md:py-3 lg:px-8 lg:py-4 rounded-full font-bold transition-all shadow-lg ${
            isAutoPlay
              ? 'bg-[#ae90fd] text-white'
              : 'bg-white text-[#3e366b] hover:bg-gray-100 border-2 border-[#ae90fd]'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isAutoPlay ? (
            <>
              <Pause className="w-5 h-5 landscape:w-4 landscape:h-4 md:w-6 md:h-6" />
              <span className="text-sm landscape:text-xs md:text-base lg:text-lg">Pause</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 landscape:w-4 landscape:h-4 md:w-6 md:h-6" />
              <span className="text-sm landscape:text-xs md:text-base lg:text-lg">Auto-Play</span>
            </>
          )}
        </motion.button>

        {/* Restart button - individual pill */}
        <motion.button
          onClick={() => {
            playWhoosh();
            setCurrentIndex([0, -1]);
          }}
          className="flex items-center gap-2 px-5 py-2.5 landscape:px-4 landscape:py-2 md:px-6 md:py-3 lg:px-8 lg:py-4 rounded-full bg-white text-[#3e366b] hover:bg-gray-100 border-2 border-[#f093fb] font-bold transition-all shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RotateCcw className="w-5 h-5 landscape:w-4 landscape:h-4 md:w-6 md:h-6" />
          <span className="text-sm landscape:text-xs md:text-base lg:text-lg hidden landscape:hidden md:inline">Restart</span>
        </motion.button>
      </div>

      {/* Keyboard shortcuts hint - PC only, fixed right corner */}
      <div className="fixed bottom-8 right-8 z-30 hidden lg:block">
        <div className="text-[#3e366b]/50 text-sm">
          <span className="bg-[#b4d7ff] rounded px-2 py-1 mr-2">←</span>
          <span className="bg-[#b4d7ff] rounded px-2 py-1 mr-2">→</span>
          <span className="text-[#3e366b]/40">Navigate</span>
          <span className="mx-3">|</span>
          <span className="bg-[#b4d7ff] rounded px-2 py-1 mr-2">R</span>
          <span className="text-[#3e366b]/40">Repeat</span>
        </div>
      </div>
    </div>
  );
};

export default LearnScreen;
