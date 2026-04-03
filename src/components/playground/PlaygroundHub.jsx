import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Pencil, Droplets, Puzzle, Ticket, Ghost, Hammer, Search, RotateCw, Flashlight, Sparkles, Gamepad2, Mic } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio } from '../../utils/letterSounds';
import frogSheet from '../../assets/characters/set-cute-drawing-frogs.svg';
import hotairBalloonImg from '../../assets/backgrounds/sky/hotair-balloon.webp';
import ScrollNavOverlay from '../shared/ScrollNavOverlay';
import GameControlBar from '../shared/GameControlBar';

// Inline frog sprite component (same pattern as LilyPadHop)
const FrogSprite = ({ size = 60 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
    viewBox="1265 75 680 510" width={size} height={size * (510 / 680)}
    style={{ display: 'block' }}>
    <image href={frogSheet} x="0" y="0" width="2000" height="2000" />
  </svg>
);

const LUCIDE_ICONS = {
  Pencil, Droplets, Puzzle, Ticket, Ghost, Hammer, Search, RotateCw, Flashlight, Mic,
};

// Order: Sand Tracing, Bubble Spell, Catch the Drop, Lily Pad Hop, Match & Remember,
//        Scratch & Find, Monster Feeder, Whack-a-Sound, Shadow Match, Carnival Wheel, Magic Flashlight
const GAMES = [
  {
    id: 'sand-tracing',
    title: 'Sand Tracing',
    icon: 'Pencil',
    color: '#F59E0B',
    borderColor: '#D97706',
    unlocked: true,
    description: 'Trace letters in sand!',
  },
  {
    id: 'bubble-spell',
    title: 'Bubble Spell',
    icon: 'Droplets',
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
    icon: 'Puzzle',
    color: '#8B5CF6',
    borderColor: '#7C3AED',
    unlocked: true,
    description: 'Match words and pictures!',
  },
  {
    id: 'scratch-discover',
    title: 'Scratch & Find',
    icon: 'Ticket',
    color: '#10B981',
    borderColor: '#059669',
    unlocked: true,
    description: 'Scratch to reveal pictures!',
  },
  {
    id: 'monster-feeder',
    title: 'Monster Feeder',
    icon: 'Ghost',
    color: '#FF6B9D',
    borderColor: '#E0527E',
    unlocked: true,
    description: 'Feed real words to the monster!',
  },
  {
    id: 'whack-a-sound',
    title: 'Whack-a-Sound',
    icon: 'Hammer',
    color: '#F59E0B',
    borderColor: '#D97706',
    unlocked: true,
    description: 'Whack the matching letter!',
  },
  {
    id: 'shadow-match',
    title: 'Shadow Match',
    icon: 'Search',
    color: '#6B3FA0',
    borderColor: '#5A2D91',
    unlocked: true,
    description: 'Match pictures to shadows!',
  },
  {
    id: 'carnival-wheel',
    title: 'Carnival Wheel',
    icon: 'RotateCw',
    color: '#EF4444',
    borderColor: '#DC2626',
    unlocked: true,
    description: 'Spin and match sounds!',
  },
  {
    id: 'flashlight',
    title: 'Magic Flashlight',
    icon: 'Flashlight',
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
  {
    id: 'phonics-spell',
    title: 'Say & Spell',
    icon: 'Mic',
    color: '#8B5CF6',
    borderColor: '#7C3AED',
    unlocked: true,
    description: 'Say each sound, then blend!',
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
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.6, duration: 0.9 } },
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
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
    };
  }, []);

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
        <Sparkles key={i} className="absolute text-yellow-300/15 pointer-events-none"
          style={{ left: `${15 + i * 30}%`, top: `${20 + (i % 2) * 30}%`, width: `${22 + i * 4}px`, height: `${22 + i * 4}px` }} />
      ))}

      {/* Back + Fullscreen buttons */}
      <GameControlBar onBack={handleBack} />

      {/* Title */}
      <motion.div
        className="text-center mb-6 md:mb-8 z-10 pt-16 md:pt-20 flex-shrink-0"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-[#E2D4FF] flex items-center justify-center gap-3">
          <Gamepad2 className="text-[#FFD000] w-8 h-8 md:w-12 md:h-12" />
          Bonus Playground
        </h1>
        <p className="text-white/80 text-sm md:text-base mt-2 font-semibold flex items-center justify-center gap-2">
          <span className="flex items-center justify-center bg-white/20 rounded-full w-5 h-5">
            <Sparkles className="w-3 h-3 text-[#FFD000]" />
          </span>
          {group.title} Games
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
              {row.map((game) => {
                const IconComponent = LUCIDE_ICONS[game.icon];
                return (
                <motion.button
                  key={game.id}
                  variants={cardVariants}
                  onClick={() => game.unlocked && onSelectGame(game.id)}
                  disabled={!game.unlocked}
                  className={`relative flex flex-row items-center gap-3 md:gap-4 shrink-0 font-bold transition-all overflow-hidden ${
                    game.unlocked ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                  style={{
                    background: game.unlocked
                      ? 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(245,245,255,1) 100%)'
                      : 'linear-gradient(145deg, rgba(200,200,220,1) 0%, rgba(180,180,200,1) 100%)',
                    border: `clamp(2px, 0.6vh, 4px) solid ${game.unlocked ? game.color : '#888'}`,
                    borderRadius: 'clamp(1rem, 4vh, 2.5rem)',
                    boxShadow: game.unlocked
                      ? `0 clamp(3px, 1.5vh, 6px) 0 ${game.color}, 0 clamp(4px, 2vh, 10px) clamp(6px, 2.5vh, 15px) rgba(0,0,0,0.2), inset 0 clamp(2px, 1vh, 4px) 0 rgba(255,255,255,0.9)`
                      : `0 clamp(3px, 1.5vh, 6px) 0 #888, 0 clamp(4px, 2vh, 10px) clamp(6px, 2.5vh, 15px) rgba(0,0,0,0.2)`,
                    width: 'clamp(240px, 45vw, 320px)',
                    height: 'clamp(165px, 33vw, 225px)',
                    paddingLeft: 'clamp(14px, 3vw, 24px)',
                    paddingRight: 'clamp(14px, 3vw, 24px)',
                  }}
                  whileHover={game.unlocked ? { scale: 1.05, y: -4 } : {}}
                  whileTap={game.unlocked ? { scale: 0.95, y: 6, boxShadow: `0 0px 0 ${game.color}` } : {}}
                >
                  {/* White shine overlay */}
                  <div className="absolute top-0 left-0 right-0 pointer-events-none"
                    style={{ height: '45%', borderRadius: 'clamp(1rem, 4vh, 2.5rem) clamp(1rem, 4vh, 2.5rem) 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)' }} />

                  {/* Lock overlay */}
                  {!game.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10"
                      style={{ borderRadius: 'clamp(1rem, 4vh, 2.5rem)' }}>
                      <Lock className="w-8 h-8 md:w-10 md:h-10 text-[#888]" />
                    </div>
                  )}

                  <div className="shrink-0 flex items-center justify-center relative z-[1]">
                    {game.icon === 'frog-sprite' ? (
                      <motion.div className="flex items-center justify-center bg-[#f0ecfc] rounded-full"
                        style={{ width: 'clamp(40px, 10vw, 65px)', height: 'clamp(40px, 10vw, 65px)' }}
                        animate={{ y: [-2, 2, -2], rotate: [-3, 3, -3] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                        <FrogSprite size={45} />
                      </motion.div>
                    ) : game.icon === 'hotair-balloon' ? (
                      <motion.div className="flex items-center justify-center bg-[#f0ecfc] rounded-full"
                        style={{ width: 'clamp(40px, 10vw, 65px)', height: 'clamp(40px, 10vw, 65px)' }}
                        animate={{ y: [-2, 2, -2], rotate: [-3, 3, -3] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                        <img src={hotairBalloonImg} alt="" className="select-none" style={{ width: '50%', height: '50%', objectFit: 'contain' }} draggable={false} />
                      </motion.div>
                    ) : IconComponent ? (
                      <motion.div className="flex items-center justify-center bg-[#f0ecfc] rounded-full"
                        style={{ width: 'clamp(40px, 10vw, 65px)', height: 'clamp(40px, 10vw, 65px)' }}
                        animate={{ y: [-2, 2, -2], rotate: [-3, 3, -3] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                        <IconComponent style={{ width: '50%', height: '50%', color: game.color }} />
                      </motion.div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start min-w-0 relative z-[1]">
                    <span
                      className="text-sm md:text-base lg:text-lg leading-tight font-extrabold"
                      style={{ color: game.unlocked ? game.color : '#888' }}
                    >
                      {game.title}
                    </span>
                    {game.unlocked && game.description && (
                      <span className="text-xs md:text-sm mt-0.5 leading-tight font-medium" style={{ color: 'rgba(62,54,107,0.7)' }}>
                        {game.description}
                      </span>
                    )}
                    {!game.unlocked && (
                      <span className="text-xs md:text-sm text-[#888]/60 mt-0.5 font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </motion.button>
                );
              })}
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaygroundHub;
