import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Lock, Maximize, BookOpen, Gamepad2, Settings, VolumeX, Volume2, Sparkles } from 'lucide-react';
import { PHONICS_GROUPS } from '../../data/phonicsData';
import wonderPhonicsLogo from '../../assets/wonderkids-logo.webp';
import group1Img from '../../assets/lvl1/group-1.png';
import group2Img from '../../assets/lvl1/group-2.png';
import group3Img from '../../assets/lvl1/group-3.png';
import group4Img from '../../assets/lvl1/group-4.png';
import group5Img from '../../assets/lvl1/group-5.png';
import group6Img from '../../assets/lvl1/group-6.png';
import group7Img from '../../assets/lvl1/group-7.png';
import group8Img from '../../assets/lvl1/group-8.png';
import group9Img from '../../assets/lvl1/group-9.png';
import group10Img from '../../assets/lvl1/group-10.png';
import group11Img from '../../assets/lvl1/group-11.png';
import group12Img from '../../assets/lvl1/group-12.png';
import group13Img from '../../assets/lvl1/group-13.png';
import group14Img from '../../assets/lvl1/group-14.png';
import group15Img from '../../assets/lvl1/group-15.png';
import group16Img from '../../assets/lvl1/group-16.png';
import group17Img from '../../assets/lvl1/group-17.png';
import group18Img from '../../assets/lvl1/group-18.png';
import group19Img from '../../assets/lvl1/group-19.png';
import group20Img from '../../assets/lvl1/group-20.png';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { getDisplaySound } from '../../utils/letterSounds';
import { useMute } from '../../contexts/MuteContext';
import ScrollNavOverlay from '../shared/ScrollNavOverlay';

// Group images map — all 20 groups linked
const GROUP_IMAGES = {
  1: group1Img, 2: group2Img, 3: group3Img, 4: group4Img, 5: group5Img,
  6: group6Img, 7: group7Img, 8: group8Img, 9: group9Img, 10: group10Img,
  11: group11Img, 12: group12Img, 13: group13Img, 14: group14Img, 15: group15Img,
  16: group16Img, 17: group17Img, 18: group18Img, 19: group19Img, 20: group20Img
};

// Shared card dimensions — used by level buttons, group cards, and playground game cards
const CARD_W = 'clamp(180px, min(35vw, 55vh), 380px)';
const CARD_H = 'clamp(130px, min(26vw, 42vh), 280px)';
const CARD_RADIUS = 'clamp(1.6rem, 5vh, 3.2rem)';

// Reusable gummy group card with image + name footer
const GroupCard = ({ group, idx, isPC, onSelect, onLongPress, longPressGroup, longPressTimerRef, justLongPressedRef, onOpenPlayground }) => {
  const groupImg = GROUP_IMAGES[group.id];
  return (
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
        className="flex flex-col items-stretch select-none relative overflow-hidden"
        style={{
          borderRadius: CARD_RADIUS,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(240,240,250,1) 100%)',
          border: `clamp(2.5px, 0.7vh, 4.5px) solid ${group.color}`,
          width: CARD_W,
          height: CARD_H,
          boxShadow: `0 clamp(3px, 1.5vh, 6px) 0 ${group.color}, 0 clamp(4px, 2vh, 12px) rgba(0,0,0,0.25), inset 0 clamp(2px, 1vh, 4px) 0 rgba(255,255,255,0.8)`,
        }}
        initial={idx < 8 ? { opacity: 0, scale: 0.5, y: 30 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: idx < 8 ? idx * 0.05 : 0, type: 'spring', bounce: 0.6, duration: 0.8 }}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 6, boxShadow: `0 0px 0 ${group.color}, 0 2px 3px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.9)` }}
      >
        {/* Image area — fills the card edge to edge */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {groupImg ? (
            <img src={groupImg} alt={group.title} className="w-full h-full object-cover translate-y-1" draggable={false} />
          ) : (
            <motion.div
              style={{ width: isPC ? '70px' : 'clamp(35px, 10vh, 70px)', height: isPC ? '70px' : 'clamp(35px, 10vh, 70px)' }}
              className="flex items-center justify-center bg-[#f0ecfc] rounded-full"
              animate={{ y: [-2, 2, -2], rotate: [-3, 3, -3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles style={{ width: '50%', height: '50%', color: group.color }} />
            </motion.div>
          )}
        </div>

        {/* Footer label — group name + sounds */}
        <div className="flex flex-col items-center justify-center px-2 py-0.5 md:py-1" style={{ gap: '1px' }}>
          <span className="font-extrabold text-center tracking-tight leading-tight"
            style={{
              color: '#3e366b',
              fontSize: isPC ? '1rem' : 'clamp(0.65rem, 2.8vh, 1rem)',
            }}>
            {group.title}
          </span>
          <span className="font-extrabold text-center leading-tight truncate max-w-full"
            style={{
              color: group.color,
              fontSize: isPC ? '0.85rem' : 'clamp(0.6rem, 2.5vh, 0.85rem)',
            }}>
            {group.sounds.map(s => getDisplaySound(s)).join(', ')}
          </span>
        </div>
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
};

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

const CurriculumMap = ({ onSelectGroup, onOpenPlayground, initialLevel, onLevelReset, onAppStarted, skipSplash }) => {
  const [selectedLevel, setSelectedLevel] = useState(initialLevel || null);
  const [isPC, setIsPC] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(!!initialLevel || !!skipSplash);
  const returnedFromTeachingRef = useRef(!!initialLevel);
  const welcomePlayingRef = useRef(false);
  const [showTransitionLoader, setShowTransitionLoader] = useState(false);
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
    setShowTransitionLoader(true);
    onAppStarted?.();
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.('landscape').catch(() => { });
    } catch { }
    welcomePlayingRef.current = true;
    await playVO('Welcome to Wonder Phonics!');
    welcomePlayingRef.current = false;
    setHasInteracted(true);
    setTimeout(() => setShowTransitionLoader(false), 100);
  };

  const handleLevelClick = async (level) => {
    if (level.locked) return;
    setShowTransitionLoader(true);
    stopVO();
    setSelectedLevel(level.id);
    setTimeout(() => setShowTransitionLoader(false), 100);
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
                marginBottom: 'clamp(30px, 10vh, 100px)',
                boxShadow: '0 clamp(4px, 1.5vh, 8px) 0 #E0B800'
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95, y: 6, boxShadow: '0 0px 0 #E0B800' }}
            >
              Tap to Start!
            </motion.div>

            {/* Copyright Statement */}
            <span className="fixed bottom-2 left-1/2 -translate-x-1/2 text-[#3e366b]/40 font-bold z-10 whitespace-nowrap" style={{ fontSize: 'clamp(0.6rem, 2.5vh, 0.85rem)' }}>
              &copy; 2026 Wonder Kids Co. All rights reserved.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transition loading overlay */}
      <AnimatePresence>
        {showTransitionLoader && (
          <motion.div
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1147] via-[#2d1b69] to-[#1a1147]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}>
              <BookOpen className="w-20 h-20 md:w-28 md:h-28 text-white" strokeWidth={1.5} />
            </motion.div>
            <p className="mt-6 text-lg md:text-2xl font-bold text-white animate-pulse">Loading...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Left Controls */}
      <div className="fixed top-3 left-3 md:top-4 md:left-4 z-40 flex items-center gap-2 md:gap-3 pointer-events-auto">
        {selectedLevel && (
          <motion.button
            onClick={() => setSelectedLevel(null)}
            className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden flex items-center justify-center p-1"
            style={{
              width: isPC ? '60px' : 'clamp(36px, 10vh, 56px)',
              height: isPC ? '60px' : 'clamp(36px, 10vh, 56px)',
              border: 'clamp(2.5px, 0.6vh, 3.5px) solid #FFFFFF',
              boxShadow: '0 clamp(3px, 1vh, 6px) 0 rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.1)'
            }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9, y: 3 }}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
            <Home style={{ width: '70%', height: '70%' }} className="text-[#3e366b]" />
          </motion.button>
        )}
        <motion.button
          onClick={toggleFullscreen}
          className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden hidden sm:flex items-center justify-center p-1"
          style={{
            width: isPC ? '60px' : 'clamp(36px, 10vh, 56px)',
            height: isPC ? '60px' : 'clamp(36px, 10vh, 56px)',
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #FFFFFF',
            boxShadow: '0 clamp(3px, 1vh, 6px) 0 rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.1)'
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3 }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <Maximize style={{ width: '70%', height: '70%' }} className="text-[#3e366b]" />
        </motion.button>
      </div>

      <div className="absolute top-2 right-2 md:fixed md:top-4 md:right-4 z-50">
        <motion.button
          onClick={() => setShowSettings((s) => !s)}
          className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden flex items-center justify-center p-1"
          style={{
            width: isPC ? '60px' : 'clamp(36px, 10vh, 56px)',
            height: isPC ? '60px' : 'clamp(36px, 10vh, 56px)',
            border: 'clamp(2.5px, 0.6vh, 3.5px) solid #FFFFFF',
            boxShadow: '0 clamp(3px, 1vh, 6px) 0 rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.1)'
          }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9, y: 3 }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
          <Settings style={{ width: '70%', height: '70%' }} className="text-[#3e366b]" />
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

            {/* Scrollable row — same dimensions as group cards */}
            <div className="w-full overflow-x-auto scrollbar-hide px-4 md:px-8" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex w-max items-center justify-start pb-2" style={{ gap: isPC ? '24px' : 'clamp(10px, 2.5vh, 24px)' }}>
                {LEVELS.map((level, idx) => (
                  <motion.button
                    key={level.id}
                    onClick={() => handleLevelClick(level)}
                    className={`relative flex flex-col items-center justify-center shrink-0 overflow-hidden ${level.locked ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
                      }`}
                    style={{
                      borderRadius: CARD_RADIUS,
                      background: level.locked ? 'linear-gradient(145deg, rgba(200,200,220,1) 0%, rgba(180,180,200,1) 100%)' : `linear-gradient(145deg, rgba(255,255,255,1) 0%, #F5F5FF 100%)`,
                      border: `clamp(2px, 0.6vh, 4px) solid ${level.locked ? '#888' : level.color}`,
                      width: CARD_W,
                      height: CARD_H,
                      boxShadow: level.locked
                        ? '0 clamp(3px, 1.5vh, 6px) 0 #777, 0 clamp(4px, 2vh, 10px) rgba(0,0,0,0.2)'
                        : `0 clamp(3px, 1.5vh, 6px) 0 ${level.color}, 0 clamp(4px, 2vh, 10px) clamp(6px, 2.5vh, 15px) rgba(0,0,0,0.3), inset 0 clamp(2px, 1vh, 4px) 0 rgba(255,255,255,0.9)`,
                    }}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, type: 'spring', bounce: 0.6, duration: 0.8 }}
                    whileHover={!level.locked ? { scale: 1.05, y: -3 } : {}}
                    whileTap={!level.locked ? { scale: 0.95, y: 6, boxShadow: `0 0px 0 ${level.color}` } : {}}
                  >
                    {level.locked ? (
                      <Lock className="text-[#666]" style={{ width: 'clamp(28px, 8vh, 50px)', height: 'clamp(28px, 8vh, 50px)' }} />
                    ) : (
                      <motion.div animate={{ y: [-1, 1, -1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                        <BookOpen style={{ width: 'clamp(45px, 14vh, 90px)', height: 'clamp(45px, 14vh, 90px)', color: level.color }} />
                      </motion.div>
                    )}

                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="font-black tracking-wide leading-none"
                        style={{
                          color: level.locked ? '#888' : '#2e1a47',
                          fontSize: isPC ? '1.4rem' : 'clamp(1rem, 4vh, 1.6rem)',
                          textShadow: '0 1px 2px rgba(255,255,255,0.8)'
                        }}>
                        {level.title}
                      </span>
                    </div>

                    {level.locked && (
                      <span className="text-[#666]/90 font-bold bg-white/60 px-2 rounded-full mt-1" style={{ fontSize: isPC ? '0.7rem' : 'clamp(0.5rem, 2vh, 0.7rem)' }}>
                        Soon
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
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
              paddingTop: isPC ? '80px' : 'clamp(60px, 15vh, 100px)',
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
                  Level 1 - CVC
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
