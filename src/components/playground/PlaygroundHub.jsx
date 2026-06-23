import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Maximize } from 'lucide-react';
import { playVO, stopVO, delay, stopWordVO } from '../../utils/audioPlayer';
import { stopAllAudio } from '../../utils/letterSounds';
import frogSheet from '../../assets/characters/set-cute-drawing-frogs.svg';
import hotairBalloonImg from '../../assets/backgrounds/sky/hotair-balloon.webp';
import ScrollNavOverlay from '../shared/ScrollNavOverlay';

// Inline frog sprite component (same pattern as LilyPadHop)
const FrogSprite = ({ size = 60 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
    viewBox="1265 75 680 510" width={size} height={size * (510 / 680)}
    style={{ display: 'block' }}>
    <image href={frogSheet} x="0" y="0" width="2000" height="2000" />
  </svg>
);

// Order: Sand Tracing, Bubble Spell, Catch the Drop, Lily Pad Hop, Match & Remember,
//        Scratch & Find, Monster Feeder, Whack-a-Sound, Shadow Match, Carnival Wheel, Magic Flashlight
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
    id: 'bubble-spell',
    title: 'Bubble Spell',
    icon: '🫧',
    color: '#4ECDC4',
    borderColor: '#38B2AC',
    unlocked: true,
    description: 'Pop bubbles to spell words!',
  },
  {
    id: 'catch-drop',
    title: 'Sky Catcher',
    icon: 'hotair-balloon',
    color: '#22C55E',
    borderColor: '#16A34A',
    unlocked: true,
    description: 'Catch the right sounds!',
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
    id: 'bouncy-memory',
    title: 'Match & Remember',
    icon: '🧩',
    color: '#8B5CF6',
    borderColor: '#7C3AED',
    unlocked: true,
    description: 'Match words and pictures!',
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
    id: 'shadow-match',
    title: 'Shadow Match',
    icon: '🔍',
    color: '#6B3FA0',
    borderColor: '#5A2D91',
    unlocked: true,
    description: 'Match pictures to shadows!',
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
    id: 'flashlight',
    title: 'Magic Flashlight',
    icon: '🔦',
    color: '#FFD000',
    borderColor: '#E0B800',
    unlocked: true,
    description: 'Find the hidden pictures!',
  },
  {
    id: 'hungry-frogs',
    title: 'Hungry Frogs',
    icon: 'frog-sprite',
    color: '#2ECC71',
    borderColor: '#1E8449',
    unlocked: true,
    description: 'Feed words to the frog!',
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

// Split games into rows of 5
const ROWS = [];
for (let i = 0; i < GAMES.length; i += 5) {
  ROWS.push(GAMES.slice(i, i + 5));
}

const PlaygroundHub = ({ group, onBack, onSelectGame }) => {
  const mountedRef = useRef(true);
  const rowRefs = useRef([]);

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
      stopWordVO();
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
    stopWordVO();
    stopAllAudio();
    stopVO();
    onBack();
  };

  return (
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden scrollbar-hide relative flex flex-col items-center"
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

      {/* Back + Fullscreen buttons — gummy style matching CurriculumMap */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button
          onClick={handleBack}
          className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden"
          style={{
            width: 'clamp(36px, 10vh, 56px)', height: 'clamp(36px, 10vh, 56px)',
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #3e366b',
            boxShadow: '0 4px 0 #D4A000, 0 4px 12px rgba(0,0,0,0.1)'
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <ArrowLeft style={{ width: '65%', height: '65%' }} className="text-[#3e366b]" />
        </motion.button>
        <motion.button
          onClick={toggleFullscreen}
          className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden"
          style={{
            width: 'clamp(36px, 10vh, 56px)', height: 'clamp(36px, 10vh, 56px)',
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #3e366b',
            boxShadow: '0 4px 0 #D4A000, 0 4px 12px rgba(0,0,0,0.1)'
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <Maximize style={{ width: '65%', height: '65%' }} className="text-[#3e366b]" />
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

      {/* Game grid — rows of 5, swipeable with glass arrows */}
      <div className="w-full z-10 pb-8 flex flex-col gap-3 md:gap-4">
        {ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="w-full relative">
            <ScrollNavOverlay scrollRef={{ get current() { return rowRefs.current[rowIdx]; } }} />
            <div
              ref={(el) => { rowRefs.current[rowIdx] = el; }}
              className="w-full overflow-x-auto scrollbar-hide"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <motion.div
                className="flex gap-3 md:gap-4 lg:gap-5 px-4 md:px-8 pb-2"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
              {row.map((game) => (
                <motion.button
                  key={game.id}
                  variants={cardVariants}
                  onClick={() => game.unlocked && onSelectGame(game.id)}
                  disabled={!game.unlocked}
                  className={`relative flex flex-row items-center gap-3 shrink-0 font-bold select-none ${
                    game.unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  }`}
                  style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(245,245,255,1) 100%)',
                    border: `clamp(2px, 0.6vh, 4px) solid ${game.unlocked ? game.color : '#888'}`,
                    boxShadow: game.unlocked
                      ? `0 clamp(3px, 1.5vh, 6px) 0 ${game.color}, 0 clamp(4px, 2vh, 10px) clamp(6px, 2.5vh, 15px) rgba(0,0,0,0.2), inset 0 clamp(2px, 1vh, 4px) 0 rgba(255,255,255,0.9)`
                      : '0 clamp(3px, 1.5vh, 6px) 0 #777, 0 clamp(4px, 2vh, 10px) rgba(0,0,0,0.2)',
                    width: 'clamp(150px, 42vh, 280px)',
                    height: 'clamp(105px, 30vh, 210px)',
                    borderRadius: 'clamp(1rem, 4vh, 2.5rem)',
                    paddingLeft: 'clamp(10px, 2vw, 20px)',
                    paddingRight: 'clamp(10px, 2vw, 20px)',
                  }}
                  whileHover={game.unlocked ? { scale: 1.05, y: -4 } : {}}
                  whileTap={game.unlocked ? { scale: 0.95, y: 6, boxShadow: `0 0px 0 ${game.color}` } : {}}
                >
                  {/* Lock overlay */}
                  {!game.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[clamp(1rem,4vh,2.5rem)] bg-black/20 z-10">
                      <Lock className="w-8 h-8 md:w-10 md:h-10 text-white/60" />
                    </div>
                  )}

                  <div className="shrink-0 flex items-center justify-center">
                    {game.icon === 'frog-sprite' ? (
                      <FrogSprite size={45} />
                    ) : game.icon === 'hotair-balloon' ? (
                      <img src={hotairBalloonImg} alt="" className="select-none" style={{ width: 45, height: 45, objectFit: 'contain' }} draggable={false} />
                    ) : (
                      <span style={{ fontSize: 'clamp(1.5rem, 5vh, 2.5rem)' }}>{game.icon}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span
                      className="leading-tight font-extrabold"
                      style={{ color: game.unlocked ? game.color : '#888', fontSize: 'clamp(0.85rem, 3.5vh, 1.3rem)' }}
                    >
                      {game.title}
                    </span>
                    {game.unlocked && game.description && (
                      <span className="text-[#3e366b]/60 mt-0.5 leading-tight font-medium" style={{ fontSize: 'clamp(0.6rem, 2.2vh, 0.95rem)' }}>
                        {game.description}
                      </span>
                    )}
                    {!game.unlocked && (
                      <span className="text-xs md:text-sm text-[#888] mt-0.5 font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaygroundHub;
