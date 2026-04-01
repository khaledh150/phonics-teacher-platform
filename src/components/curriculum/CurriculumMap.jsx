import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Lock, Maximize, BookOpen, Gamepad2, Settings, VolumeX, Volume2 } from 'lucide-react';
import { PHONICS_GROUPS } from '../../data/phonicsData';
import wonderPhonicsLogo from '../../assets/wonder-phonics-logo.webp';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { getDisplaySound } from '../../utils/letterSounds';
import { useMute } from '../../contexts/MuteContext';
import ScrollNavOverlay from '../shared/ScrollNavOverlay';

// Reusable group card
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
      className="flex flex-col items-center justify-center bg-white transition-all select-none"
      style={{
        borderRadius: '2.2rem',
        borderWidth: '3px',
        borderStyle: 'solid',
        borderColor: group.color,
        borderBottom: `6px solid ${group.color}`,
        width: isPC ? '310px' : 'clamp(230px, 44vw, 310px)',
        height: isPC ? '210px' : 'clamp(155px, 32vw, 210px)',
        boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.04, type: 'spring', bounce: 0.5, duration: 0.8 }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95, y: 4 }}
    >
      <span style={{ fontSize: isPC ? '3.5rem' : 'clamp(2.5rem, 8vw, 3.5rem)', lineHeight: 1.2 }}>
        {group.icon}
      </span>
      <span
        className="font-bold mt-1 leading-tight text-center"
        style={{ color: group.color, fontSize: isPC ? '1.25rem' : 'clamp(0.85rem, 3.2vw, 1.2rem)' }}
      >
        {group.title}
      </span>
      <span
        className="text-[#3e366b]/60 text-center leading-tight font-medium mt-0.5"
        style={{ fontSize: isPC ? '0.9rem' : 'clamp(0.6rem, 2.4vw, 0.85rem)' }}
      >
        {group.sounds.map(getDisplaySound).join(', ')}
      </span>
    </motion.button>

    <AnimatePresence>
      {longPressGroup === group.id && (
        <motion.button
          initial={{ opacity: 0, y: -16, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenPlayground(group);
          }}
          className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-[#8B5CF6] text-white font-bold text-xs md:text-sm rounded-full shadow-lg"
          style={{
            borderBottom: '4px solid #7C3AED',
            boxShadow: '0px 5px 0px rgba(0,0,0,0.12), 0 0 15px rgba(139,92,246,0.4)',
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92, y: 3 }}
        >
          <Gamepad2 className="w-4 h-4" />
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

const CurriculumMap = ({ onSelectGroup, onOpenPlayground, initialLevel, onLevelReset }) => {
  const [selectedLevel, setSelectedLevel] = useState(initialLevel || null);
  const [isPC, setIsPC] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const welcomePlayingRef = useRef(false);
  const [longPressGroup, setLongPressGroup] = useState(null);
  const longPressTimerRef = useRef(null);
  const justLongPressedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const { voMuted, toggleVoMute } = useMute();
  const levelScrollRef = useRef(null);
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
    document.documentElement.requestFullscreen?.().catch(() => {});
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
      className="min-h-screen flex flex-col items-center overflow-auto relative"
      style={{ background: 'linear-gradient(180deg, #1a1147 0%, #2d1b69 100%)' }}
    >
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse"
            style={{
              width: Math.random() * 100 + 50,
              height: Math.random() * 100 + 50,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: ['#ae90fd20', '#4d79ff20', '#ffd70020', '#f093fb20'][i % 4],
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Tap to Start overlay */}
      <AnimatePresence>
        {!hasInteracted && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer"
            style={{ background: 'radial-gradient(ellipse at center, #2d1b69 0%, #1a1147 100%)' }}
            onClick={handleTapToStart}
          >
            <motion.img
              src={wonderPhonicsLogo}
              alt="Wonder Phonics"
              className="w-auto mx-auto object-contain mb-8"
              style={{ height: isPC ? '420px' : 'min(70vw, 340px)' }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="px-10 py-5 bg-[#FFD000] text-[#3e366b] font-bold text-xl md:text-2xl lg:text-3xl"
              style={{ borderRadius: '2rem', borderBottom: '6px solid #E0B800', boxShadow: '0px 8px 0px rgba(0,0,0,0.12)' }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              Tap to Start!
            </motion.div>
            <span className="fixed bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs md:text-sm font-medium whitespace-nowrap">
              &copy; 2026 Wonder Kids Co. All rights reserved.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-left: Home + Fullscreen */}
      <div className="fixed top-3 left-3 md:top-4 md:left-4 z-50 flex items-center gap-2">
        {selectedLevel && (
          <motion.button
            onClick={() => setSelectedLevel(null)}
            className="p-2 md:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
            style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            whileTap={{ scale: 0.95, y: 3, borderBottomWidth: '1px' }}
            title="Back to Levels"
          >
            <Home className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-[#3e366b]" />
          </motion.button>
        )}
        <motion.button
          onClick={toggleFullscreen}
          className="p-2 md:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          title="Toggle Fullscreen"
        >
          <Maximize className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-[#3e366b]" />
        </motion.button>
      </div>

      {/* Top-right: Settings */}
      <div className="fixed top-3 right-3 md:top-4 md:right-4 z-50">
        <motion.button
          onClick={() => setShowSettings((s) => !s)}
          className="p-2 md:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
          title="Settings"
        >
          <Settings className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-[#3e366b]" />
        </motion.button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="absolute top-full right-0 mt-2 bg-[#2d1b69] border border-white/10 p-3 md:p-4 min-w-[180px]"
              style={{ borderRadius: '1.2rem', boxShadow: '0px 8px 24px rgba(0,0,0,0.3)' }}
            >
              <button
                onClick={toggleVoMute}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all"
              >
                {voMuted ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-[#22c55e]" />
                )}
                <span className="text-white text-sm font-medium">
                  {voMuted ? 'VO Muted' : 'VO On'}
                </span>
                <div className={`ml-auto w-10 h-5 rounded-full transition-all relative ${voMuted ? 'bg-red-400/30' : 'bg-[#22c55e]/30'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${voMuted ? 'left-0.5 bg-red-400' : 'left-[22px] bg-[#22c55e]'}`} />
                </div>
              </button>
              <p className="text-white/30 text-xs mt-2 px-3">
                Mutes instructions, idle reminders &amp; encouragements
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {!selectedLevel ? (
          /* ========== LEVEL SELECTION ========== */
          <motion.div
            key="levels"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-center w-full h-screen relative z-10"
          >
            {/* Logo */}
            <img
              src={wonderPhonicsLogo}
              alt="Wonder Phonics"
              className="w-auto mx-auto object-contain mb-2 md:mb-4"
              style={{ height: isPC ? '280px' : 'min(32vw, 180px)', minHeight: isPC ? '220px' : 'min(28vw, 150px)' }}
            />

            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-white mb-3 md:mb-5">
              Choose Your Level
            </h2>

            {/* 6 Level buttons — 2 rows of 3 */}
            <div className="flex flex-col items-center gap-3 md:gap-4">
              {[LEVELS.slice(0, 3), LEVELS.slice(3, 6)].map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-3 md:gap-5 lg:gap-6 justify-center">
                  {row.map((level, idx) => (
                    <motion.button
                      key={level.id}
                      onClick={() => handleLevelClick(level)}
                      className={`relative flex flex-col items-center justify-center transition-all shrink-0 ${
                        level.locked
                          ? 'bg-white/20 cursor-not-allowed opacity-60'
                          : 'bg-white cursor-pointer'
                      }`}
                      style={{
                        borderRadius: '2.2rem',
                        borderWidth: '3px',
                        borderStyle: 'solid',
                        borderBottom: level.locked ? '4px solid rgba(174,144,253,0.3)' : `6px solid ${level.color}`,
                        borderColor: level.locked ? 'rgba(174,144,253,0.3)' : level.color,
                        width: isPC ? '180px' : 'clamp(100px, 22vw, 160px)',
                        height: isPC ? '180px' : 'clamp(100px, 22vw, 160px)',
                        boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                      }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (rowIdx * 3 + idx) * 0.08, type: 'spring', bounce: 0.5, duration: 0.8 }}
                      whileHover={!level.locked ? { scale: 1.05, y: -4 } : {}}
                      whileTap={!level.locked ? { scale: 0.95, y: 4 } : {}}
                    >
                      {level.locked ? (
                        <Lock
                          className="text-white/40"
                          style={{ width: isPC ? 48 : 'clamp(24px, 6vw, 40px)', height: isPC ? 48 : 'clamp(24px, 6vw, 40px)' }}
                        />
                      ) : (
                        <BookOpen
                          style={{
                            width: isPC ? 48 : 'clamp(24px, 6vw, 40px)',
                            height: isPC ? 48 : 'clamp(24px, 6vw, 40px)',
                            color: level.color,
                          }}
                        />
                      )}
                      <span
                        className="font-bold mt-1.5"
                        style={{
                          color: level.locked ? 'rgba(255,255,255,0.4)' : level.color,
                          fontSize: isPC ? '1.2rem' : 'clamp(0.7rem, 2.5vw, 1rem)',
                        }}
                      >
                        {level.title}
                      </span>
                      {level.locked && (
                        <span className="text-white/40 mt-0.5" style={{ fontSize: isPC ? '0.8rem' : 'clamp(0.5rem, 1.8vw, 0.7rem)' }}>Coming Soon</span>
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
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center w-full min-h-screen relative z-10 overflow-y-auto"
          >
            {/* Title at top */}
            <div className="pt-14 md:pt-16 mb-4 md:mb-6">
              <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-white text-center">
                Level 1 - Sound Groups
              </h2>
            </div>

            {/* Row 1: Groups 1-7 */}
            <div className="w-full relative mb-3 md:mb-4">
              <ScrollNavOverlay scrollRef={groupRow1Ref} />
              <div
                ref={groupRow1Ref}
                className="w-full overflow-x-auto scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex gap-3 md:gap-4 lg:gap-5 px-6 pb-2">
                  {PHONICS_GROUPS.slice(0, 7).map((group, idx) => (
                    <GroupCard
                      key={group.id}
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
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Groups 8-14 */}
            <div className="w-full relative mb-3 md:mb-4">
              <ScrollNavOverlay scrollRef={groupRow2Ref} />
              <div
                ref={groupRow2Ref}
                className="w-full overflow-x-auto scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex gap-3 md:gap-4 lg:gap-5 px-6 pb-2">
                  {PHONICS_GROUPS.slice(7, 14).map((group, idx) => (
                    <GroupCard
                      key={group.id}
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
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Groups 15-20 */}
            <div className="w-full relative">
              <ScrollNavOverlay scrollRef={groupRow3Ref} />
              <div
                ref={groupRow3Ref}
                className="w-full overflow-x-auto scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex gap-3 md:gap-4 lg:gap-5 px-6 pb-2">
                  {PHONICS_GROUPS.slice(14, 20).map((group, idx) => (
                    <GroupCard
                      key={group.id}
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
