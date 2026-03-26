import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Lock, Maximize, BookOpen, Gamepad2, Settings, VolumeX, Volume2 } from 'lucide-react';
import { PHONICS_GROUPS } from '../data/phonicsData';
import wonderPhonicsLogo from '../assets/wonder-phonics-logo.webp';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { useMute } from '../contexts/MuteContext';

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

  useEffect(() => {
    if (initialLevel) {
      setSelectedLevel(initialLevel);
      setHasInteracted(true); // returning from teaching, skip splash
      if (onLevelReset) onLevelReset();
    }
  }, [initialLevel, onLevelReset]);

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // VO when entering group selection (after user has interacted)
  useEffect(() => {
    if (!hasInteracted) return;
    if (!selectedLevel) return;
    let cancelled = false;
    const run = async () => {
      // Wait briefly for welcome VO to finish if it's playing
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

      {/* Tap to Start overlay — shown only on first cold load */}
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

      {/* Top-left: Home (when in groups) + Fullscreen - Juicy 3D buttons */}
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

      {/* Top-right: Settings cog */}
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

        {/* Settings dropdown */}
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
                <div
                  className={`ml-auto w-10 h-5 rounded-full transition-all relative ${voMuted ? 'bg-red-400/30' : 'bg-[#22c55e]/30'}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${voMuted ? 'left-0.5 bg-red-400' : 'left-[22px] bg-[#22c55e]'}`}
                  />
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
            className="flex flex-col items-center w-full max-w-4xl px-4 py-8 md:py-12 relative z-10"
          >
            {/* Logo */}
            <img
              src={wonderPhonicsLogo}
              alt="Wonder Phonics"
              className="w-auto mx-auto object-contain mb-8 md:mb-12"
              style={{ height: isPC ? '380px' : 'min(50vw, 260px)', minHeight: isPC ? '320px' : 'min(45vw, 220px)' }}
            />

            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-8 md:mb-12">
              Choose Your Level
            </h2>

            {/* 6 Books Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 lg:gap-8 w-full max-w-2xl lg:max-w-4xl">
              {LEVELS.map((level, idx) => (
                <motion.button
                  key={level.id}
                  onClick={() => handleLevelClick(level)}
                  className={`relative flex flex-col items-center justify-center transition-all ${
                    level.locked
                      ? 'bg-white/20 cursor-not-allowed opacity-60'
                      : 'bg-white cursor-pointer'
                  }`}
                  style={{
                    borderRadius: '2.2rem',
                    borderWidth: '4px',
                    borderStyle: 'solid',
                    borderBottom: level.locked ? '4px solid rgba(174,144,253,0.3)' : `6px solid ${level.color}`,
                    borderColor: level.locked ? 'rgba(174,144,253,0.3)' : level.color,
                    padding: isPC ? '2.5rem 1.5rem' : 'min(5vw, 1.5rem) min(3vw, 1rem)',
                    minHeight: isPC ? '240px' : 'min(35vw, 160px)',
                    boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1, type: 'spring', bounce: 0.5, duration: 0.8 }}
                  whileHover={!level.locked ? { scale: 1.05, y: -4 } : {}}
                  whileTap={!level.locked ? { scale: 0.95, y: 4 } : {}}
                >
                  {level.locked ? (
                    <Lock
                      className="text-white/40"
                      style={{ width: isPC ? 72 : 'min(10vw, 40px)', height: isPC ? 72 : 'min(10vw, 40px)' }}
                    />
                  ) : (
                    <BookOpen
                      style={{
                        width: isPC ? 72 : 'min(10vw, 40px)',
                        height: isPC ? 72 : 'min(10vw, 40px)',
                        color: level.color,
                      }}
                    />
                  )}
                  <span
                    className="font-bold mt-2"
                    style={{
                      color: level.locked ? 'rgba(255,255,255,0.4)' : level.color,
                      fontSize: isPC ? '1.8rem' : 'min(4vw, 1.1rem)',
                    }}
                  >
                    {level.title}
                  </span>
                  {level.locked && (
                    <span className="text-xs lg:text-sm text-white/40 mt-1">Coming Soon</span>
                  )}
                </motion.button>
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
            className="flex flex-col items-center w-full max-w-5xl px-3 md:px-4 py-6 md:py-10 relative z-10"
          >
            {/* Spacer for top buttons */}
            <div className="h-10 md:h-12" />

            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-white mb-5 md:mb-8">
              Level 1 - Sound Groups
            </h2>

            {/* 20 Groups Grid - 3 per row */}
            <div className="grid grid-cols-3 gap-3 md:gap-5 lg:gap-6 w-full max-w-3xl lg:max-w-5xl pb-8">
              {PHONICS_GROUPS.map((group, idx) => (
                <div key={group.id} className="relative flex flex-col items-center">
                  <motion.button
                    onClick={() => {
                      // Block only the click that's part of the long-press gesture
                      if (justLongPressedRef.current) { justLongPressedRef.current = false; return; }
                      // Dismiss playground if open, then navigate
                      setLongPressGroup(null);
                      onSelectGroup(group);
                    }}
                    onPointerDown={() => {
                      justLongPressedRef.current = false;
                      longPressTimerRef.current = setTimeout(() => {
                        setLongPressGroup((prev) => prev === group.id ? null : group.id);
                        justLongPressedRef.current = true;
                      }, 500);
                    }}
                    onPointerUp={() => clearTimeout(longPressTimerRef.current)}
                    onPointerLeave={() => clearTimeout(longPressTimerRef.current)}
                    onContextMenu={(e) => e.preventDefault()}
                    className="flex flex-col items-center justify-center bg-white transition-all w-full select-none"
                    style={{
                      borderRadius: '2.2rem',
                      borderWidth: '3px',
                      borderStyle: 'solid',
                      borderColor: group.color,
                      borderBottom: `6px solid ${group.color}`,
                      padding: isPC ? '2rem 1.2rem' : 'min(4vw, 1.2rem) min(2.5vw, 0.8rem)',
                      minHeight: isPC ? '220px' : 'min(34vw, 150px)',
                      boxShadow: '0px 8px 0px rgba(0,0,0,0.1)',
                    }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05, type: 'spring', bounce: 0.5, duration: 0.8 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95, y: 4 }}
                  >
                    <span style={{ fontSize: isPC ? '4rem' : 'min(11vw, 3rem)', lineHeight: 1.2 }}>
                      {group.icon}
                    </span>
                    <span
                      className="font-bold mt-1"
                      style={{
                        color: group.color,
                        fontSize: isPC ? '1.5rem' : 'min(4.5vw, 1.15rem)',
                      }}
                    >
                      {group.title}
                    </span>
                    <span
                      className="text-[#3e366b]/70 text-center leading-tight mt-1 font-medium"
                      style={{ fontSize: isPC ? '1.2rem' : 'min(3.5vw, 0.95rem)' }}
                    >
                      {group.sounds.join(', ')}
                    </span>
                    {group.subtitle && (
                      <span
                        className="text-[#3e366b]/40 mt-0.5"
                        style={{ fontSize: isPC ? '0.9rem' : 'min(2.5vw, 0.65rem)' }}
                      >
                        {group.subtitle}
                      </span>
                    )}
                  </motion.button>

                  {/* Playground button — slides out from under the group button on long press */}
                  <AnimatePresence>
                    {longPressGroup === group.id && (
                      <motion.button
                        initial={{ opacity: 0, y: -20, scale: 0.6 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.6 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLongPressGroup(null);
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
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CurriculumMap;
