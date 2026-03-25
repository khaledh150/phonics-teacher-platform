import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Maximize } from 'lucide-react';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { stopAllAudio } from '../utils/letterSounds';
import frogSheet from '../assets/characters/set-cute-drawing-frogs.svg';

// Inline frog sprite component (same pattern as LilyPadHop)
const FrogSprite = ({ size = 60 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
    viewBox="1265 75 680 510" width={size} height={size * (510 / 680)}
    style={{ display: 'block' }}>
    <image href={frogSheet} x="0" y="0" width="2000" height="2000" />
  </svg>
);

const GAMES = [
  {
    id: 'sand-tracing',
    title: 'Sand Tracing',
    icon: '✏️',
    color: '#F59E0B',
    borderColor: '#D97706',
    unlocked: true,
    description: 'Trace letters in sand!',
  },
  {
    id: 'flashlight',
    title: 'Magic Flashlight',
    icon: '🔦',
    color: '#FFD000',
    borderColor: '#E0B800',
    unlocked: true,
    description: 'Find the hidden pictures!',
  },
  {
    id: 'bubble-spell',
    title: 'Bubble Spell',
    icon: '🫧',
    color: '#4ECDC4',
    borderColor: '#38B2AC',
    unlocked: true,
    description: 'Pop bubbles to spell words!',
  },
  {
    id: 'monster-feeder',
    title: 'Monster Feeder',
    icon: '👾',
    color: '#FF6B9D',
    borderColor: '#E0527E',
    unlocked: true,
    description: 'Feed real words to the monster!',
  },
  {
    id: 'whack-a-sound',
    title: 'Whack-a-Sound',
    icon: '🔨',
    color: '#F59E0B',
    borderColor: '#D97706',
    unlocked: true,
    description: 'Whack the matching letter!',
  },
  {
    id: 'catch-drop',
    title: 'Catch the Drop',
    icon: '🛒',
    color: '#22C55E',
    borderColor: '#16A34A',
    unlocked: true,
    description: 'Catch the right sounds!',
  },
  {
    id: 'bouncy-memory',
    title: 'Bouncy Memory',
    icon: '🧠',
    color: '#8B5CF6',
    borderColor: '#7C3AED',
    unlocked: true,
    description: 'Match words and pictures!',
  },
  {
    id: 'shadow-match',
    title: 'Shadow Match',
    icon: '🔍',
    color: '#6B3FA0',
    borderColor: '#5A2D91',
    unlocked: true,
    description: 'Match pictures to shadows!',
  },
  {
    id: 'lily-pad-hop',
    title: 'Lily Pad Hop',
    icon: 'frog-sprite',
    color: '#6ACBED',
    borderColor: '#4BA8D0',
    unlocked: true,
    description: 'Help the frog hop!',
  },
  {
    id: 'carnival-wheel',
    title: 'Carnival Wheel',
    icon: '🎡',
    color: '#EF4444',
    borderColor: '#DC2626',
    unlocked: true,
    description: 'Spin and match sounds!',
  },
  {
    id: 'scratch-discover',
    title: 'Scratch & Find',
    icon: '🎟️',
    color: '#10B981',
    borderColor: '#059669',
    unlocked: true,
    description: 'Scratch to reveal pictures!',
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.8 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
};

const PlaygroundHub = ({ group, onBack, onSelectGame }) => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const run = async () => {
      await playVO('Welcome to the Playground!');
      if (cancelled) return;
      await delay(300);
      if (cancelled) return;
      await playVO('Choose a game to play!');
    };
    run();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    onBack();
  };

  return (
    <div className="h-screen w-screen overflow-y-auto relative flex flex-col items-center"
      style={{ background: 'linear-gradient(135deg, #1a1147 0%, #2d1b69 30%, #4a2c8a 60%, #6B3FA0 100%)' }}
    >
      {/* Floating sparkle decorations */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute text-yellow-300/20 pointer-events-none"
          style={{
            left: `${15 + i * 30}%`,
            top: `${20 + (i % 2) * 30}%`,
            fontSize: `${22 + i * 4}px`,
          }}
        >
          ✦
        </div>
      ))}

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

      {/* Title */}
      <motion.div
        className="text-center mb-6 md:mb-8 z-10 pt-16 md:pt-20 flex-shrink-0"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >

        <h1
          className="text-3xl md:text-5xl lg:text-6xl font-black text-[#FFD000]"
          style={{ textShadow: 'none', WebkitTextStroke: '0' }}
        >
          <span className="mr-2">🎮</span>
          Bonus Playground
          <span className="ml-2">🎮</span>
        </h1>
        <p className="text-white/80 text-sm md:text-base mt-2 font-semibold">
          {group.icon} {group.title} Games
        </p>
      </motion.div>

      {/* Game grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 lg:gap-6 px-4 md:px-8 max-w-4xl z-10 pb-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {GAMES.map((game) => (
          <motion.button
            key={game.id}
            variants={cardVariants}
            onClick={() => game.unlocked && onSelectGame(game.id)}
            disabled={!game.unlocked}
            className={`relative flex flex-col items-center justify-center p-5 md:p-6 lg:p-8 rounded-[1.6rem] font-bold transition-all ${
              game.unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
            }`}
            style={{
              backgroundColor: game.unlocked ? game.color : '#3a3260',
              borderBottom: `5px solid ${game.unlocked ? game.borderColor : '#2a2250'}`,
              boxShadow: game.unlocked
                ? `0px 6px 0px rgba(0,0,0,0.12)`
                : '0px 6px 0px rgba(0,0,0,0.12)',
            }}
            whileHover={game.unlocked ? { scale: 1.08, y: -4 } : {}}
            whileTap={game.unlocked ? { scale: 0.95, y: 4 } : {}}
          >
            {/* Lock overlay */}
            {!game.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[1.6rem] bg-black/20 z-10">
                <Lock className="w-8 h-8 md:w-10 md:h-10 text-white/60" />
              </div>
            )}

            <div className="mb-3 flex items-center justify-center">
              {game.icon === 'frog-sprite' ? (
                <FrogSprite size={70} />
              ) : (
                <span className="text-5xl md:text-6xl lg:text-7xl">{game.icon}</span>
              )}
            </div>
            <span
              className="text-sm md:text-base lg:text-lg text-center leading-tight font-extrabold"
              style={{ color: game.unlocked ? '#fff' : '#888' }}
            >
              {game.title}
            </span>
            {game.unlocked && game.description && (
              <span className="text-xs md:text-sm text-white/70 mt-1 text-center font-medium">
                {game.description}
              </span>
            )}
            {!game.unlocked && (
              <span className="text-xs md:text-sm text-white/40 mt-1 font-medium">
                Coming Soon
              </span>
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

export default PlaygroundHub;
