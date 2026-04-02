import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Lock, Maximize, BookOpen, Gamepad2, Settings, VolumeX, Volume2, Sparkles } from 'lucide-react';
import { PHONICS_GROUPS } from '../../data/phonicsData';
import wonderPhonicsLogo from '../../assets/wonder-phonics-logo.webp';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { getDisplaySound } from '../../utils/letterSounds';
import { useMute } from '../../contexts/MuteContext';
import ScrollNavOverlay from '../shared/ScrollNavOverlay';

// Reusable gummy group card (Scaling aggressively with VH for landscape constraint)
const GroupCard = ({ group, idx, isPC, onSelect, onLongPress, longPressGroup, longPressTimerRef, justLongPressedRef, onOpenPlayground }) => (
  <div className="relative flex flex-col items-center shrink-0">
    <motion.button
      onClick={() => {
        if (justLongPressedRef.current) { justLongPressedRef.current = false; return; }
        onSelect(group);
      }}
      onPointerDown={() => {
        justLongPressedRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
          onLongPress(group.id);
          justLongPressedRef.current = true;
        }, 500);
      }}
      onPointerUp={() => clearTimeout(longPressTimerRef.current)}
      onPointerLeave={() => clearTimeout(longPressTimerRef.current)}
      onContextMenu={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center transition-all select-none relative overflow-hidden"
      style={{
        borderRadius: 'clamp(1rem, 4vh, 2.5rem)',
        background: 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(245,245,255,1) 100%)',
        border: `clamp(2px, 0.6vh, 4px) solid ${group.color}`,
        width: isPC ? '300px' : 'clamp(120px, 45vh, 280px)',
        height: isPC ? '200px' : 'clamp(80px, 24vh, 190px)',
        boxShadow: `0 clamp(3px, 1.5vh, 6px) 0 ${group.color}, 0 clamp(4px, 2vh, 10px) clamp(6px, 2.5vh, 15px) rgba(0,0,0,0.2), inset 0 clamp(2px, 1vh, 4px) 0 rgba(255,255,255,0.9)`,
      }}
      initial={{ opacity: 0, scale: 0.5, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: idx * 0.05, type: 'spring', bounce: 0.6, duration: 0.9 }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95, y: 6, boxShadow: `0 0px 0 ${group.color}, 0 2px 3px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.9)` }}
    >
      <div className="absolute top-0 left-[15%] right-[15%] h-[25%] bg-white/50 rounded-full pointer-events-none" />

      {/* Animated soft shape placeholder for Mascot Lotties */}
      <motion.div 
        style={{ width: isPC ? '70px' : 'clamp(30px, 10vh, 75px)', height: isPC ? '70px' : 'clamp(30px, 10vh, 75px)' }}
        className="flex items-center justify-center bg-[#f0ecfc] rounded-full mt-1"
        animate={{ y: [-2, 2, -2], rotate: [-4, 4, -4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
         <Sparkles className="text-[#A78BFA]" style={{ width: '50%', height: '50%', color: group.color }} />
      </motion.div>

      <span
        className="font-extrabold mt-1 leading-tight text-center tracking-wide"
        style={{ color: group.color, fontSize: isPC ? '1.4rem' : 'clamp(0.75rem, 3.5vh, 1.3rem)' }}
      >
        {group.title}
      </span>
      <span
        className="text-[#3e366b]/70 text-center leading-tight font-bold mt-0.5 mb-1 px-2 py-[2px]"
        style={{ fontSize: isPC ? '0.9rem' : 'clamp(0.45rem, 2vh, 0.85rem)', background: `${group.color}20`, borderRadius: '1rem' }}
      >
        {group.sounds.map(getDisplaySound).join(', ')}
      </span>
    </motion.button>

    <AnimatePresence>
      {longPressGroup === group.id && (
        <motion.button
          initial={{ opacity: 0, y: -20, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenPlayground(group);
          }}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-[#A78BFA] to-[#7C3AED] text-white font-extrabold rounded-full z-10"
          style={{
            fontSize: isPC ? '1rem' : 'clamp(0.65rem, 2.5vh, 1rem)',
            border: '2px solid #6D28D9',
            boxShadow: '0 3px 0 #5B21B6, 0 6px 10px rgba(139,92,246,0.3), inset 0 2px 0 rgba(255,255,255,0.4)',
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #5B21B6, 0 2px 4px rgba(139,92,246,0.3)' }}
        >
          <Gamepad2 className="w-3 h-3 md:w-5 md:h-5" />
          Playground
        </motion.button>
      )}
    </AnimatePresence>
  </div>
);

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const LEVELS = [
  { id: 1, title: 'Level 1', color: '#4d79ff', locked: false },
  { id: 2, title: 'Level 2', color: '#ae90fd', locked: true },
  { id: 3, title: 'Level 3', color: '#22c55e', locked: true },
  { id: 4, title: 'Level 4', color: '#ffd700', locked: true },
  { id: 5, title: 'Level 5', color: '#f093fb', locked: true },
  { id: 6, title: 'Level 6', color: '#ff6b9d', locked: true },
];

const CurriculumMap = ({ onSelectGroup, onOpenPlayground, initialLevel, onLevelReset, onAppStarted }) => {
  const [selectedLevel, setSelectedLevel] = useState(initialLevel || null);
  const [isPC, setIsPC] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(!!initialLevel);
  const returnedFromTeachingRef = useRef(!!initialLevel);
  const welcomePlayingRef = useRef(false);
  const [longPressGroup, setLongPressGroup] = useState(null);
  const longPressTimerRef = useRef(null);
  const justLongPressedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const { voMuted, toggleVoMute } = useMute();
  const groupRow1Ref = useRef(null);
  const groupRow2Ref = useRef(null);
  const groupRow3Ref = useRef(null);

  useEffect(() => {
    if (initialLevel) {
      setSelectedLevel(initialLevel);
      setHasInteracted(true);
      if (onLevelReset) onLevelReset();
    }
  }, [initialLevel, onLevelReset]);

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!hasInteracted) return;
    if (!selectedLevel) return;
    let cancelled = false;
    const run = async () => {
      if (welcomePlayingRef.current) {
        await delay(200);
        if (cancelled) return;
      }
      stopVO();
      await delay(50);
      if (cancelled) return;
      playVO('Choose a group to start!');
    };
    run();
    return () => { cancelled = true; stopVO(); };
  }, [selectedLevel, hasInteracted]);

  const handleTapToStart = async () => {
    setHasInteracted(true);
    onAppStarted?.();
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.('landscape').catch(() => {});
    } catch {}
    welcomePlayingRef.current = true;
    await playVO('Welcome to Wonder Phonics!');
    welcomePlayingRef.current = false;
  };

  const handleLevelClick = (level) => {
    if (level.locked) return;
    setSelectedLevel(level.id);
  };

  const handleSelectGroup = (group) => {
    setLongPressGroup(null);
    onSelectGroup(group);
  };

  const handleLongPress = (groupId) => {
    setLongPressGroup((prev) => prev === groupId ? null : groupId);
  };

  const handleOpenPlayground = (group) => {
    setLongPressGroup(null);
    onOpenPlayground(group);
  };

  return (
    <div
      className={`flex flex-col items-center relative ${!selectedLevel ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh] overflow-y-auto overflow-x-hidden'}`}
      style={{ background: 'linear-gradient(135deg, #1e1252 0%, #3a2287 100%)' }}
    >
      {/* Tap to Start overlay (First Screen) */}
      <AnimatePresence>
        {!hasInteracted && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-[#1e1252]"
            onClick={handleTapToStart}
          >
            {/* Enlarged Logo on Splash */}
            <motion.img
              src={wonderPhonicsLogo}
              alt="Wonder Phonics"
              className="w-auto mx-auto object-contain z-10 px-4"
              style={{ 
                height: isPC ? '420px' : 'clamp(200px, 60vh, 450px)', 
                marginBottom: isPC ? '32px' : 'clamp(10px, 5vh, 32px)',
                filter: 'drop-shadow(0 15px 20px rgba(0,0,0,0.5))' 
              }}
              animate={{ scale: [1, 1.03, 1], y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
              className="relative bg-gradient-to-b from-[#FFE55C] to-[#FFD000] text-[#3e366b] font-extrabold z-10 mx-6 text-center overflow-hidden"
              style={{ 
                borderRadius: 'clamp(1.5rem, 5vh, 3rem)', 
                border: 'clamp(2px, 0.8vh, 4px) solid #FFF',
                padding: isPC ? '20px 48px' : 'clamp(10px, 3.5vh, 24px) clamp(24px, 8vh, 48px)',
                fontSize: isPC ? '2.5rem' : 'clamp(1.4rem, 6vh, 2.5rem)',
                marginBottom: 'clamp(30px, 10vh, 100px)', /* Raises the button up on phones */
                boxShadow: '0 clamp(4px, 1.5vh, 8px) 0 #E0B800, 0 clamp(10px, 3vh, 25px) rgba(0,0,0,0.3)' 
              }}
              animate={{ scale: [1, 1.05, 1], rotate: [-1, 1, -1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95, y: 6, boxShadow: '0 0px 0 #E0B800' }}
            >
              <div className="absolute top-1 left-[15%] right-[15%] h-[20%] bg-white/50 rounded-full pointer-events-none" />
              Tap to Start!
            </motion.div>

            {/* Copyright Statement */}
            <span className="fixed bottom-2 left-1/2 -translate-x-1/2 text-white/40 font-bold z-10 whitespace-nowrap" style={{ fontSize: 'clamp(0.6rem, 2.5vh, 0.85rem)' }}>
              &copy; 2026 Wonder Kids Co. All rights reserved.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Controls */}
      <div className="absolute top-2 left-2 md:fixed md:top-4 md:left-4 z-50 flex items-center gap-2 md:gap-4">
        {selectedLevel && (
          <motion.button
            onClick={() => setSelectedLevel(null)}
            className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden flex items-center justify-center p-1"
            style={{
              width: isPC ? '60px' : 'clamp(32px, 10vh, 60px)',
              height: isPC ? '60px' : 'clamp(32px, 10vh, 60px)',
              border: '2px solid #FFF',
              boxShadow: '0 clamp(3px, 1vh, 6px) 0 #D4A000, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)'
            }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full" />
            <Home style={{ width: '60%', height: '60%' }} className="text-[#3e366b]" />
          </motion.button>
        )}
        <motion.button
          onClick={toggleFullscreen}
          className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden hidden sm:flex items-center justify-center p-1"
          style={{
            width: isPC ? '60px' : 'clamp(32px, 10vh, 60px)',
            height: isPC ? '60px' : 'clamp(32px, 10vh, 60px)',
            border: '2px solid #FFF',
            boxShadow: '0 clamp(3px, 1vh, 6px) 0 #D4A000, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)'
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full" />
          <Maximize style={{ width: '60%', height: '60%' }} className="text-[#3e366b]" />
        </motion.button>
      </div>

      <div className="absolute top-2 right-2 md:fixed md:top-4 md:right-4 z-50">
        <motion.button
          onClick={() => setShowSettings((s) => !s)}
          className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden flex items-center justify-center p-1"
          style={{
            width: isPC ? '60px' : 'clamp(32px, 10vh, 60px)',
            height: isPC ? '60px' : 'clamp(32px, 10vh, 60px)',
            border: '2px solid #FFF',
            boxShadow: '0 clamp(3px, 1vh, 6px) 0 #D4A000, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)'
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3, boxShadow: '0 0px 0 #D4A000' }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full" />
          <Settings style={{ width: '60%', height: '60%' }} className="text-[#3e366b]" />
        </motion.button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.8, rotateX: -20 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.8, rotateX: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute top-full right-0 mt-2 bg-gradient-to-b from-[#3a2287] to-[#24135e] border-[3px] border-[#8B5CF6] p-2 md:p-4 w-max"
              style={{ borderRadius: 'clamp(1rem, 3vh, 1.5rem)', boxShadow: '0 6px 0 #170d38' }}
            >
              <button
                onClick={toggleVoMute}
                className="flex items-center gap-2 md:gap-3 w-full px-2 py-1.5 md:px-3 md:py-2 rounded-xl hover:bg-white/10 transition-all font-bold text-white text-sm md:text-base"
              >
                {voMuted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-[#FF6B9D]" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-[#22c55e]" />}
                <span>{voMuted ? 'VO Muted' : 'VO On'}</span>
                <div className={`ml-auto w-8 h-4 md:w-10 md:h-5 rounded-full transition-all relative shadow-inner ${voMuted ? 'bg-[#FF6B9D]/30 border border-[#FF6B9D]' : 'bg-[#22c55e]/30 border border-[#22c55e]'}`}>
                  <motion.div 
                    layout
                    className={`absolute top-[1px] w-3 h-3 md:w-4 md:h-4 rounded-full shadow-md ${voMuted ? 'left-[1px] bg-[#FF6B9D]' : 'left-[16px] md:left-[21px] bg-[#22c55e]'}`} 
                  />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {!selectedLevel ? (
          /* ========== LEVEL SELECTION (Second Screen) ========== */
          <motion.div
            key="levels"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, y: -50 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
            className="flex flex-col items-center justify-center w-full h-[100dvh] relative z-10 px-2 overflow-hidden"
          >
            {/* Enlarged Logo on Level Selection */}
            <motion.img
              src={wonderPhonicsLogo}
              alt="Wonder Phonics"
              className="w-auto mx-auto object-contain z-10"
              style={{ 
                height: isPC ? '280px' : 'clamp(100px, 35vh, 260px)', 
                marginBottom: 'clamp(4px, 1.5vh, 16px)',
                filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.4))' 
              }}
              animate={{ y: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <h2 
              className="font-extrabold text-white drop-shadow-lg tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-[#E2D4FF] text-center"
              style={{
                fontSize: isPC ? '2rem' : 'clamp(1rem, 4vh, 2.2rem)',
                marginBottom: 'clamp(8px, 2vh, 20px)'
              }}
            >
              Choose Your Level
            </h2>

            <div className="flex flex-col items-center w-full max-w-5xl px-2" style={{ gap: isPC ? '24px' : 'clamp(6px, 2.5vh, 20px)' }}>
              {[LEVELS.slice(0, 3), LEVELS.slice(3, 6)].map((row, rowIdx) => (
                <div key={rowIdx} className="flex flex-row flex-nowrap justify-center w-full" style={{ gap: isPC ? '32px' : 'clamp(8px, 2.5vh, 24px)' }}>
                  {row.map((level, idx) => (
                    <motion.button
                      key={level.id}
                      onClick={() => handleLevelClick(level)}
                      className={`relative flex flex-col items-center justify-center transition-all shrink-0 overflow-hidden ${
                        level.locked ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
                      }`}
                      style={{
                        borderRadius: 'clamp(1rem, 4vh, 2rem)',
                        background: level.locked ? 'linear-gradient(145deg, rgba(200,200,220,1) 0%, rgba(180,180,200,1) 100%)' : `linear-gradient(145deg, rgba(255,255,255,1) 0%, #F5F5FF 100%)`,
                        border: `clamp(2px, 0.5vh, 4px) solid ${level.locked ? '#888' : level.color}`,
                        width: isPC ? '160px' : 'clamp(80px, 22vh, 160px)',
                        height: isPC ? '160px' : 'clamp(80px, 22vh, 160px)',
                        boxShadow: level.locked 
                          ? '0 clamp(3px, 1vh, 6px) 0 #777, 0 clamp(4px, 1.5vh, 8px) rgba(0,0,0,0.2)' 
                          : `0 clamp(4px, 1.5vh, 8px) 0 ${level.color}, 0 clamp(6px, 2vh, 12px) rgba(0,0,0,0.3)`,
                      }}
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: (rowIdx * 3 + idx) * 0.08, type: 'spring', bounce: 0.6, duration: 0.8 }}
                      whileHover={!level.locked ? { scale: 1.05, y: -3 } : {}}
                      whileTap={!level.locked ? { scale: 0.95, y: 6, boxShadow: `0 0px 0 ${level.color}` } : {}}
                    >
                      <div className="absolute top-0 left-[15%] right-[15%] h-[25%] bg-white/60 rounded-full pointer-events-none" />

                      {level.locked ? (
                        <div className="relative flex items-center justify-center p-1" style={{ marginBottom: 'clamp(1px, 0.5vh, 4px)' }}>
                          <Lock className="text-[#666]" style={{ width: isPC ? '40px' : 'clamp(20px, 7vh, 40px)', height: isPC ? '40px' : 'clamp(20px, 7vh, 40px)' }} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center p-1" style={{ marginBottom: 'clamp(1px, 0.5vh, 4px)' }}>
                          <motion.div animate={{ y: [-1, 1, -1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                             <BookOpen style={{ width: isPC ? '44px' : 'clamp(22px, 7.5vh, 44px)', height: isPC ? '44px' : 'clamp(22px, 7.5vh, 44px)', color: level.color }} />
                          </motion.div>
                        </div>
                      )}
                      
                      <span
                        className="font-extrabold tracking-wide leading-none"
                        style={{
                          color: level.locked ? '#666' : level.color,
                          fontSize: isPC ? '1.2rem' : 'clamp(0.7rem, 3vh, 1.2rem)',
                        }}
                      >
                        {level.title}
                      </span>
                      
                      {level.locked && (
                         <span className="text-[#666]/90 font-bold bg-white/60 px-2 rounded-full" style={{ marginTop: 'clamp(1px, 0.5vh, 3px)', fontSize: isPC ? '0.7rem' : 'clamp(0.45rem, 1.5vh, 0.7rem)' }}>
                           Soon
                         </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ========== GROUP SELECTION (Level 1) ========== */
          <motion.div
            key="groups"
            initial={returnedFromTeachingRef.current ? false : { opacity: 0, x: '100vw' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100vw' }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
            className="flex flex-col items-center w-full min-h-[100dvh] relative z-10 scrollbar-hide"
            style={{ 
              paddingTop: isPC ? '80px' : 'clamp(60px, 15vh, 100px)', /* Creates a safe-area so title avoids the fixed Top-left Buttons */
              paddingBottom: isPC ? '40px' : 'clamp(20px, 8vh, 60px)'
            }}
          >
            {/* Title at top */}
            <div className="w-full flex justify-center px-2" style={{ marginBottom: isPC ? '24px' : 'clamp(8px, 2vh, 24px)' }}>
              <motion.div 
                className="bg-[rgba(255,255,255,0.1)] border border-white/20 px-5 rounded-full shadow-lg flex justify-center items-center"
                style={{ paddingBlock: 'clamp(3px, 1vh, 10px)' }}
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <h2 
                  className="font-extrabold text-white text-center drop-shadow-md"
                  style={{ fontSize: isPC ? '1.8rem' : 'clamp(0.9rem, 4vh, 1.8rem)' }}
                >
                  Level 1 - Sound Groups
                </h2>
              </motion.div>
            </div>

            {/* Row 1: Groups 1-7 */}
            <div className="w-full relative" style={{ marginBottom: isPC ? '24px' : 'clamp(4px, 1.5vh, 24px)' }}>
              <ScrollNavOverlay scrollRef={groupRow1Ref} />
              <div
                ref={groupRow1Ref}
                className="w-full overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 md:px-8 scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex w-max items-center justify-start pb-2" style={{ gap: isPC ? '24px' : 'clamp(10px, 2.5vh, 24px)' }}>
                  {PHONICS_GROUPS.slice(0, 7).map((group, idx) => (
                    <div key={group.id} className="snap-center">
                      <GroupCard
                        group={group}
                        idx={idx}
                        isPC={isPC}
                        onSelect={handleSelectGroup}
                        onLongPress={handleLongPress}
                        longPressGroup={longPressGroup}
                        longPressTimerRef={longPressTimerRef}
                        justLongPressedRef={justLongPressedRef}
                        onOpenPlayground={handleOpenPlayground}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Groups 8-14 */}
            <div className="w-full relative" style={{ marginBottom: isPC ? '24px' : 'clamp(4px, 1.5vh, 24px)' }}>
              <ScrollNavOverlay scrollRef={groupRow2Ref} />
              <div
                ref={groupRow2Ref}
                className="w-full overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 md:px-8 scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex w-max items-center justify-start pb-2" style={{ gap: isPC ? '24px' : 'clamp(10px, 2.5vh, 24px)' }}>
                  {PHONICS_GROUPS.slice(7, 14).map((group, idx) => (
                    <div key={group.id} className="snap-center">
                      <GroupCard
                        group={group}
                        idx={idx + 7}
                        isPC={isPC}
                        onSelect={handleSelectGroup}
                        onLongPress={handleLongPress}
                        longPressGroup={longPressGroup}
                        longPressTimerRef={longPressTimerRef}
                        justLongPressedRef={justLongPressedRef}
                        onOpenPlayground={handleOpenPlayground}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Groups 15-20 */}
            <div className="w-full relative" style={{ paddingBottom: '10px' }}>
              <ScrollNavOverlay scrollRef={groupRow3Ref} />
              <div
                ref={groupRow3Ref}
                className="w-full overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 md:px-8 scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex w-max items-center justify-start pb-2" style={{ gap: isPC ? '24px' : 'clamp(10px, 2.5vh, 24px)' }}>
                  {PHONICS_GROUPS.slice(14, 20).map((group, idx) => (
                    <div key={group.id} className="snap-center">
                      <GroupCard
                        group={group}
                        idx={idx + 14}
                        isPC={isPC}
                        onSelect={handleSelectGroup}
                        onLongPress={handleLongPress}
                        longPressGroup={longPressGroup}
                        longPressTimerRef={longPressTimerRef}
                        justLongPressedRef={justLongPressedRef}
                        onOpenPlayground={handleOpenPlayground}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CurriculumMap;
