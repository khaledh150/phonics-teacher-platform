import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, ChevronLeft, SkipForward, Maximize, Music, BookOpen, Target, Sparkles, Puzzle, Factory, MessageSquare } from 'lucide-react';
import SoundLearning from './steps/SoundLearning';
import GroupSong from './steps/GroupSong';
import FlashcardViewer from './steps/FlashcardViewer';
import SoundBalloons from './steps/SoundBalloons';
import ExerciseMatch from './steps/ExerciseMatch';
import BlendingFactory from './steps/BlendingFactory';
import SentenceScramble from './steps/SentenceScramble';
import Preloader from '../shared/Preloader';
import { stopAllAudio } from '../../utils/letterSounds';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { triggerCelebration } from '../../utils/confetti';
import { resetEncouragementCycles } from '../../utils/encouragement';
import { trackGroupStep, trackGroupCompleted } from '../../utils/progress';
import { preloadGroup } from '../../utils/assetHelpers';

// Lazy-loaded playground & game components
const PlaygroundHub = lazy(() => import('../playground/PlaygroundHub'));
const MagicFlashlight = lazy(() => import('../playground/games/MagicFlashlight'));
const BubbleSpell = lazy(() => import('../playground/games/BubbleSpell'));
const MonsterFeeder = lazy(() => import('../playground/games/MonsterFeeder'));
const WhackASound = lazy(() => import('../playground/games/WhackASound'));
const CatchTheDrop = lazy(() => import('../playground/games/CatchTheDrop'));
const BouncyMemory = lazy(() => import('../playground/games/BouncyMemory'));
const ShadowMatch = lazy(() => import('../playground/games/ShadowMatch'));
const LilyPadHop = lazy(() => import('../playground/games/LilyPadHop'));
const MagicSandTracing = lazy(() => import('../playground/games/MagicSandTracing'));
const CarnivalWheel = lazy(() => import('../playground/games/CarnivalWheel'));
const ScratchDiscover = lazy(() => import('../playground/games/ScratchDiscover'));
const HungryFrogs = lazy(() => import('../playground/games/HungryFrogs'));
const PhonicsSpellGame = lazy(() => import('../playground/games/PhonicsSpellGame'));

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const STEPS = ['sounds', 'words', 'balloons', 'exercise', 'blending', 'sentences'];

const STEP_META = {
  sounds: { label: 'Sounds', icon: Sparkles, emoji: '🔤' },
  song: { label: 'Song', icon: Music, emoji: '🎵' },
  words: { label: 'Words', icon: BookOpen, emoji: '📖' },
  balloons: { label: 'Balloons', icon: Target, emoji: '🎈' },
  exercise: { label: 'Match', icon: Puzzle, emoji: '🧩' },
  blending: { label: 'Blend', icon: Factory, emoji: '🏭' },
  sentences: { label: 'Sentences', icon: MessageSquare, emoji: '💬' },
};

const STEP_MESSAGES = {
  sounds: ["Let's learn new sounds!", "Listen carefully...", "Get ready!"],
  song: ["Song time!", "Let's sing along...", "Here we go!"],
  words: ["Word flashcards!", "Read and listen...", "Let's read!"],
  balloons: ["Balloon popping!", "Pop the right sounds...", "Get ready!"],
  exercise: ["Match the pairs!", "Words and pictures...", "Let's play!"],
  blending: ["Blending Factory!", "Build the words...", "Let's blend!"],
  sentences: ["Sentence Scramble!", "Build the sentences...", "Let's go!"],
};

const TeachingFlow = ({ group, onExit, onOpenPlayground }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [stepReady, setStepReady] = useState(false);
  const [stepComponentReady, setStepComponentReady] = useState(false);
  const minTimeElapsedRef = useRef(false);
  const [showGroupFinish, setShowGroupFinish] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [showStepNav, setShowStepNav] = useState(false);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const currentStep = STEPS[stepIndex];

  // Use vh based sizing checks for component consistency
  const [isPC, setIsPC] = useState(false);
  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Readiness-based preloader: wait for BOTH minimum time AND step component ready
  const tryHidePreloader = useCallback(() => {
    if (minTimeElapsedRef.current && stepComponentReady) {
      setShowPreloader(false);
    }
  }, [stepComponentReady]);

  useEffect(() => {
    // Reset for each new step
    minTimeElapsedRef.current = false;
    setStepComponentReady(false);
    setStepReady(false);

    let cancelled = false;
    if (stepIndex === 0) playVO("Let's learn!");
    // Fixed 1s loading screen — long enough to feel intentional, short enough to not annoy
    const timer = setTimeout(() => {
      if (!cancelled) {
        minTimeElapsedRef.current = true;
        tryHidePreloader();
      }
    }, 1000);
    // Fallback: force hide if step never signals ready
    const fallback = setTimeout(() => { if (!cancelled) setShowPreloader(false); }, 1500);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(fallback); stopVO(); };
  }, [stepIndex, tryHidePreloader]);

  // When step component signals ready, try to hide preloader
  useEffect(() => {
    if (stepComponentReady) tryHidePreloader();
  }, [stepComponentReady, tryHidePreloader]);

  const handleStepReady = useCallback(() => {
    setStepComponentReady(true);
  }, []);

  const autoAdvanceTimerRef = useRef(null);
  const advancingRef = useRef(false);

  useEffect(() => {
    advancingRef.current = false;
  }, [stepIndex]);

  const handleNextStep = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    if (stepIndex < STEPS.length - 1) {
      const nextStep = stepIndex + 1;
      trackGroupStep(group.id, nextStep + 1);
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex(nextStep);
    } else {
      trackGroupCompleted(group.id);
      setShowGroupFinish(true);
    }
  }, [stepIndex]);

  const handleStepComplete = useCallback(() => {
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleNextStep();
    }, 1200);
  }, [handleNextStep]);

  useEffect(() => {
    return () => clearTimeout(autoAdvanceTimerRef.current);
  }, [stepIndex]);

  const handlePrevStep = useCallback(() => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    if (stepIndex > 0) {
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex((prev) => prev - 1);
    }
  }, [stepIndex]);

  const handleSkipStep = useCallback(() => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    if (currentStep === 'sentences') {
      if (onOpenPlayground) onOpenPlayground();
      else onExit();
      return;
    } else if (stepIndex < STEPS.length - 1) {
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex((prev) => prev + 1);
    } else {
      onExit();
    }
  }, [stepIndex, currentStep, onExit]);

  const handleJumpToStep = useCallback((targetIdx) => {
    if (targetIdx === stepIndex) {
      setShowStepNav(false);
      return;
    }
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    setShowStepNav(false);
    setStepComplete(false);
    setStepReady(false);
    setShowPreloader(true);
    setStepIndex(targetIdx);
  }, [stepIndex]);

  const makeLongPressHandlers = useCallback((shortTapAction) => ({
    onTouchStart: () => {
      longPressTriggeredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        setShowStepNav(true);
      }, 500);
    },
    onTouchEnd: (e) => {
      clearTimeout(longPressTimerRef.current);
      if (longPressTriggeredRef.current) {
        e.preventDefault();
        longPressTriggeredRef.current = false;
      } else {
        shortTapAction();
      }
    },
    onMouseDown: () => {
      longPressTriggeredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        setShowStepNav(true);
      }, 500);
    },
    onMouseUp: () => {
      clearTimeout(longPressTimerRef.current);
      if (!longPressTriggeredRef.current) {
        shortTapAction();
      }
      longPressTriggeredRef.current = false;
    },
    onMouseLeave: () => {
      clearTimeout(longPressTimerRef.current);
      longPressTriggeredRef.current = false;
    },
    onContextMenu: (e) => e.preventDefault(),
  }), []);

  const skipLongPress = useMemo(() => makeLongPressHandlers(handleSkipStep), [makeLongPressHandlers, handleSkipStep]);
  const backLongPress = useMemo(() => makeLongPressHandlers(handlePrevStep), [makeLongPressHandlers, handlePrevStep]);

  const handleHomeClick = () => {
    setShowExitConfirm(true);
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    onExit();
  };

  useEffect(() => {
    resetEncouragementCycles();
  }, [group]);

  useEffect(() => {
    preloadGroup(group.id);
  }, [group.id]);

  useEffect(() => {
    if (!showGroupFinish) return;
    triggerCelebration();
    let cancelled = false;
    const run = async () => {
      await delay(800);
      if (cancelled) return;
      await playVO('You did it!');
      if (cancelled) return;
      await delay(300);
      if (cancelled) return;
      await playVO('You are a Phonics Master!');
      if (cancelled) return;
      await delay(400);
      if (cancelled) return;
      await playVO('Hooray!');
    };
    run();
    return () => { cancelled = true; stopVO(); };
  }, [showGroupFinish]);

  const renderStep = () => {
    switch (currentStep) {
      case 'sounds':
        return <SoundLearning group={group} onComplete={handleStepComplete} onReady={handleStepReady} active={stepReady} />;
      case 'song':
        return <GroupSong group={group} onComplete={handleStepComplete} onReady={handleStepReady} active={stepReady} />;
      case 'words':
        return <FlashcardViewer group={group} onComplete={handleStepComplete} onReady={handleStepReady} active={stepReady} />;
      case 'balloons':
        return <SoundBalloons group={group} onComplete={handleNextStep} onReady={handleStepReady} active={stepReady} />;
      case 'exercise':
        return <ExerciseMatch group={group} onComplete={handleNextStep} onReady={handleStepReady} active={stepReady} />;
      case 'blending':
        return <BlendingFactory group={group} onComplete={handleNextStep} onReady={handleStepReady} active={stepReady} />;
      case 'sentences':
        return <SentenceScramble group={group} onComplete={handleNextStep} onReady={handleStepReady} active={stepReady} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1e1252 0%, #3a2287 100%)' }}>

      {/* Step Content - always rendered (behind preloader) so it can init assets */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="h-[100dvh] w-full z-10 relative"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Preloader */}
      <Preloader
        isVisible={showPreloader}
        onExitComplete={() => setStepReady(true)}
        messages={STEP_MESSAGES[currentStep]}
      />

      {/* Navigation Layer */}
      <div className="fixed inset-0 pointer-events-none z-[70]">

        {/* Top left buttons: Home + Fullscreen (Soft Gummy) */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4 flex items-center pointer-events-auto" style={{ gap: 'clamp(8px, 1.5vh, 16px)' }}>
          <motion.button
            onClick={handleHomeClick}
            className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden flex items-center justify-center p-1"
            style={{
              width: 'clamp(35px, 6vw, 65px)', height: 'clamp(36px, 10vh, 56px)',
              border: 'clamp(2.5px, 0.6vh, 3.5px) solid #FFFFFF',
              boxShadow: '0 clamp(3px, 1vh, 5px) 0 rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)'
            }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9, y: 3 }}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
            <Home style={{ width: '70%', height: '70%' }} className="text-[#3e366b]" />
          </motion.button>

          <motion.button
            onClick={toggleFullscreen}
            className="rounded-full bg-gradient-to-b from-[#FFE55C] to-[#FFD000] relative overflow-hidden hidden sm:flex items-center justify-center p-1"
            style={{
              width: 'clamp(36px, 10vh, 56px)', height: 'clamp(36px, 10vh, 56px)',
              border: 'clamp(2.5px, 0.6vh, 3.5px) solid #FFFFFF',
              boxShadow: '0 clamp(3px, 1vh, 5px) 0 rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)'
            }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9, y: 3 }}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/60 rounded-full pointer-events-none" />
            <Maximize style={{ width: '70%', height: '70%' }} className="text-[#3e366b]" />
          </motion.button>
        </div>

        {/* Group label - Positioned top-right consistently, but moves below speaker in SoundBalloons */}
        <div
          className="absolute right-3 md:right-4 z-40 flex flex-col items-end pointer-events-auto transition-all duration-500"
          style={{ top: STEPS[stepIndex] === 'balloons' ? '28%' : '3%' }}
        >
          <motion.div
            className="rounded-full text-white font-extrabold flex items-center justify-center bg-white/10 backdrop-blur-sm"
            style={{
              padding: 'clamp(4px, 1vh, 6px) clamp(10px, 2.5vh, 18px)',
              fontSize: 'clamp(0.65rem, 2vh, 0.9rem)',
              border: '1px solid rgba(255,255,255,0.2)',
              gap: 'clamp(4px, 1vh, 8px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center justify-center bg-white/20 rounded-full" style={{ width: 'clamp(16px, 4vh, 24px)', height: 'clamp(16px, 4vh, 24px)' }}>
              <Sparkles className="text-[#FFD000]" style={{ width: '60%', height: '60%' }} />
            </div>
            {group.title}
          </motion.div>
        </div>

        {/* Bottom Bar: Back, Progress, Skip */}
        <div className="absolute bottom-4 left-2 right-2 md:bottom-5 md:left-4 md:right-4 flex justify-between items-center pointer-events-auto px-2">

          {/* Back Button (Soft Pill) */}
          <div className="w-[80px] md:w-[120px] flex justify-start">
            {stepIndex > 0 && (
              <motion.button
                {...backLongPress}
                className="flex items-center justify-center font-bold text-white transition-all overflow-hidden relative"
                style={{
                  height: 'clamp(32px, 8vh, 48px)',
                  padding: '0 clamp(12px, 3vh, 24px)',
                  borderRadius: 'clamp(1rem, 4vh, 2rem)',
                  background: '#FFD000',
                  border: '1px solid #000000',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                  fontSize: 'clamp(0.75rem, 2.5vh, 1rem)',
                  gap: 'clamp(2px, 0.5vh, 4px)',
                  color: '#000000'
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -2, filter: 'brightness(1.1)' }}
                whileTap={{ y: 2, boxShadow: '0 0px 0 #000000' }}
              >
                <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/40 rounded-full pointer-events-none" />
                <ChevronLeft style={{ width: 'clamp(12px, 3.2vh, 16px)', height: 'clamp(12px, 3.2vh, 16px)' }} className="text-black" />
                <span className="text-black">Back</span>
              </motion.button>
            )}
          </div>

          {/* Floating step progress dots — hidden during gameplay steps so they don't block taps */}
          <div
            className={`flex items-center justify-center cursor-pointer ${STEPS[stepIndex] !== 'sounds' && STEPS[stepIndex] !== 'words' ? 'hidden' : ''}`}
            style={{ padding: 'clamp(4px, 1vh, 8px)' }}
            onClick={() => setShowStepNav(true)}
          >
            <div className="flex items-center" style={{ gap: 'clamp(10px, 2vh, 18px)' }}>
              {STEPS.map((step, idx) => (
                <div key={step} className="flex items-center">
                  <motion.div
                    className={`rounded-full transition-all ${idx < stepIndex
                      ? 'bg-[#22c55e]'
                      : idx === stepIndex
                        ? 'bg-[#4d79ff] ring-1 ring-[#4d79ff]/40'
                        : 'bg-white/20'
                      }`}
                    style={{
                      width: idx === stepIndex ? 'clamp(6px, 1.5vh, 10px)' : 'clamp(4px, 1vh, 6px)',
                      height: idx === stepIndex ? 'clamp(6px, 1.5vh, 10px)' : 'clamp(4px, 1vh, 6px)',
                      boxShadow: idx <= stepIndex ? '0 0 6px currentColor' : 'none'
                    }}
                    animate={idx === stepIndex ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-[2px] rounded-full mx-[clamp(1px,0.2vh,3px)] ${idx < stepIndex ? 'bg-[#22c55e]/60' : 'bg-white/10'}`}
                      style={{ width: 'clamp(4px, 1vh, 10px)' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Skip Button (Soft Pill) */}
          <div className="w-[80px] md:w-[120px] flex justify-end">
            <motion.button
              {...skipLongPress}
              className="flex items-center justify-center font-bold transition-all overflow-hidden relative"
              style={{
                height: 'clamp(32px, 8vh, 48px)',
                padding: '0 clamp(12px, 3vh, 24px)',
                borderRadius: 'clamp(1rem, 4vh, 2rem)',
                background: '#FFD000',
                border: '1px solid #000000',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                color: '#000000',
                fontSize: 'clamp(0.75rem, 2.5vh, 1rem)',
                gap: 'clamp(2px, 0.5vh, 4px)'
              }}
              whileHover={{ y: -2, filter: 'brightness(1.1)' }}
              whileTap={{ y: 2, scale: 0.95 }}
            >
              Skip
              <SkipForward style={{ width: 'clamp(12px, 3vh, 16px)', height: 'clamp(12px, 3vh, 16px)' }} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Step navigator — Modal without blur overlaps */}
      <AnimatePresence>
        {showStepNav && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[75] bg-black/60"
              onClick={() => setShowStepNav(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed bottom-[12vh] left-1/2 -translate-x-1/2 z-[76] w-max max-w-[95vw]"
            >
              <div
                className="flex items-center justify-center p-2 md:p-3"
                style={{
                  gap: 'clamp(4px, 1vh, 12px)',
                  borderRadius: 'clamp(1rem, 4vh, 2rem)',
                  background: 'linear-gradient(135deg, rgba(45,27,105,0.95) 0%, rgba(62,54,107,0.95) 100%)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {STEPS.map((step, idx) => {
                  const meta = STEP_META[step];
                  const isActive = idx === stepIndex;
                  const isCompleted = idx < stepIndex;
                  return (
                    <motion.button
                      key={step}
                      onClick={() => handleJumpToStep(idx)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`flex flex-col items-center justify-center transition-all relative ${isActive
                        ? 'bg-[#4d79ff]/30 border-2 border-[#4d79ff]/50'
                        : isCompleted
                          ? 'bg-[#22c55e]/15 hover:bg-[#22c55e]/25 border-2 border-transparent'
                          : 'hover:bg-white/10 border-2 border-transparent'
                        }`}
                      style={{
                        padding: 'clamp(6px, 1.5vh, 12px) clamp(8px, 2vh, 16px)',
                        borderRadius: 'clamp(0.8rem, 2vh, 1.2rem)',
                        gap: 'clamp(2px, 0.5vh, 4px)',
                        minWidth: 'clamp(45px, 12vh, 70px)'
                      }}
                      whileTap={{ scale: 0.92 }}
                    >
                      <span style={{ fontSize: 'clamp(1.2rem, 3.5vh, 1.8rem)' }}>{meta.emoji}</span>
                      <span className={`font-bold leading-tight ${isActive ? 'text-[#4d79ff]' : isCompleted ? 'text-[#22c55e]' : 'text-white/50'
                        }`} style={{ fontSize: 'clamp(0.5rem, 1.5vh, 0.75rem)' }}>
                        {meta.label}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="stepNavIndicator"
                          className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[20%] h-[4px] rounded-full bg-[#4d79ff]"
                        />
                      )}
                      {isCompleted && (
                        <div className="absolute top-0 right-0 rounded-full bg-[#22c55e] flex items-center justify-center" style={{ width: 'clamp(10px, 2.5vh, 14px)', height: 'clamp(10px, 2.5vh, 14px)', transform: 'translate(25%, -25%)' }}>
                          <span className="text-white font-bold" style={{ fontSize: 'clamp(6px, 1.5vh, 8px)' }}>✓</span>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Group Finish celebration Modal (Gummy style) */}
      <AnimatePresence>
        {showGroupFinish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden"
            style={{ background: 'rgba(30, 18, 82, 0.9)' }}
          >
            <motion.div
              initial={{ scale: 0.5, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="bg-gradient-to-b from-[#f0e6ff] to-[#dfd0f8] text-center border-[4px] border-[#FFF] relative z-10 mx-4"
              style={{
                borderRadius: 'clamp(1.5rem, 5vh, 3rem)',
                padding: 'clamp(20px, 5vh, 40px) clamp(30px, 8vh, 60px)',
                boxShadow: '0 clamp(8px, 2.5vh, 15px) 0 #A78BFA, 0 clamp(10px, 4vh, 30px) rgba(0,0,0,0.4), inset 0 clamp(4px, 1.5vh, 8px) 0 rgba(255,255,255,0.9)'
              }}
            >
              <div className="absolute top-0 left-[15%] right-[15%] h-[20%] bg-white/60 rounded-full pointer-events-none" />

              <motion.div
                className="relative inline-flex items-center justify-center mb-2"
                style={{ height: 'clamp(80px, 20vh, 120px)' }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)', transform: 'scale(1.5)' }}
                  animate={{ scale: [1.5, 2, 1.5], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="relative" style={{ fontSize: 'clamp(4rem, 12vh, 6rem)' }}>&#127942;</span>
              </motion.div>

              <motion.h2
                className="font-extrabold text-[#6B3FA0] mb-1 leading-tight"
                style={{ fontSize: 'clamp(1.8rem, 6vh, 2.5rem)', textShadow: '0 2px 4px rgba(255,255,255,0.8)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Group Master!
              </motion.h2>
              <motion.p
                className="text-[#8B5CF6] font-bold mb-6"
                style={{ fontSize: 'clamp(1rem, 3vh, 1.25rem)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {group.title} Complete
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="flex flex-col items-center"
                style={{ gap: 'clamp(10px, 2.5vh, 16px)' }}
              >
                <motion.button
                  onClick={() => {
                    window.speechSynthesis.cancel(); stopAllAudio(); stopVO();
                    setShowGroupFinish(false);
                    if (onOpenPlayground) onOpenPlayground();
                    else onExit();
                  }}
                  className="bg-gradient-to-b from-[#A78BFA] to-[#7C3AED] text-white font-extrabold flex items-center justify-center relative overflow-hidden"
                  style={{
                    borderRadius: 'clamp(1rem, 4vh, 2rem)',
                    border: 'clamp(2px, 0.5vh, 4px) solid #C4B5FD',
                    padding: 'clamp(10px, 2.5vh, 16px) clamp(24px, 6vh, 48px)',
                    fontSize: 'clamp(1rem, 3.5vh, 1.4rem)',
                    boxShadow: '0 clamp(4px, 1vh, 6px) 0 #5B21B6, 0 clamp(6px, 2vh, 10px) rgba(139,92,246,0.3)',
                    gap: 'clamp(6px, 1.5vh, 12px)'
                  }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 4, boxShadow: '0 0px 0 #5B21B6' }}
                >
                  <div className="absolute top-0 left-[15%] right-[15%] h-[25%] bg-white/30 rounded-full pointer-events-none" />
                  <span style={{ fontSize: '1.2em' }}>🎮</span> Bonus Playground
                </motion.button>
                <motion.button
                  onClick={() => {
                    window.speechSynthesis.cancel(); stopAllAudio(); stopVO(); onExit();
                  }}
                  className="bg-transparent text-[#6B3FA0] font-bold opacity-70 hover:opacity-100 transition-opacity"
                  style={{ fontSize: 'clamp(0.8rem, 2vh, 1rem)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  Finish &amp; Go Home
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirmation modal (Revamped clean solid style) */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-[#24135e] text-center border-[4px] border-[#8B5CF6] relative overflow-hidden"
              style={{
                borderRadius: 'clamp(1.5rem, 5vh, 2.5rem)',
                padding: 'clamp(20px, 5vh, 32px) clamp(24px, 6vh, 40px)',
                boxShadow: '0 clamp(10px, 3.5vh, 25px) rgba(0,0,0,0.6)',
                maxWidth: '90vw'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center" style={{ marginBottom: 'clamp(8px, 2vh, 16px)' }}>
                <Home className="text-[#FFD000]" style={{ width: 'clamp(40px, 10vh, 64px)', height: 'clamp(40px, 10vh, 64px)' }} />
              </div>
              <h3
                className="text-white font-extrabold leading-tight mb-2"
                style={{ fontSize: 'clamp(1.5rem, 5vh, 2rem)' }}
              >
                Go Home?
              </h3>
              <p className="text-white/90 font-bold" style={{ fontSize: 'clamp(0.85rem, 2.5vh, 1rem)', marginBottom: 'clamp(16px, 4vh, 24px)' }}>
                Your progress here will be lost.
              </p>

              <div className="flex justify-center" style={{ gap: 'clamp(10px, 2.5vh, 20px)' }}>
                <motion.button
                  onClick={() => setShowExitConfirm(false)}
                  className="bg-[#3e366b]/40 text-white font-bold rounded-full relative"
                  style={{
                    padding: 'clamp(8px, 2vh, 12px) clamp(16px, 4vh, 32px)',
                    fontSize: 'clamp(0.9rem, 2.5vh, 1.1rem)',
                    border: 'clamp(2px, 0.5vh, 3px) solid rgba(255,255,255,0.4)',
                  }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.95, y: 2 }}
                >
                  Stay
                </motion.button>
                <motion.button
                  onClick={confirmExit}
                  className="bg-gradient-to-b from-[#FFE55C] to-[#FFD000] text-white font-extrabold rounded-full relative"
                  style={{
                    padding: 'clamp(8px, 2vh, 12px) clamp(16px, 4vh, 32px)',
                    fontSize: 'clamp(0.9rem, 2.5vh, 1.1rem)',
                    border: 'clamp(2px, 0.5vh, 3px) solid #FFF',
                    boxShadow: '0 clamp(3px, 1vh, 5px) 0 #D4A000, 0 2px 10px rgba(0,0,0,0.2)'
                  }}
                  whileTap={{ scale: 0.95, y: 3, boxShadow: '0 0px 0 #D4A000' }}
                >
                  <span style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}>Go Home</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={<div className="fixed inset-0 bg-[#1a1147] flex items-center justify-center z-[90]"><div className="text-white text-2xl animate-pulse">Loading...</div></div>}>
        {showPlayground && !activeGame && (
          <PlaygroundHub
            group={group}
            onBack={() => setShowPlayground(false)}
            onSelectGame={(gameId) => setActiveGame(gameId)}
          />
        )}
        {showPlayground && activeGame && (() => {
          const GAME_MAP = {
            'flashlight': MagicFlashlight,
            'bubble-spell': BubbleSpell,
            'monster-feeder': MonsterFeeder,
            'whack-a-sound': WhackASound,
            'catch-drop': CatchTheDrop,
            'bouncy-memory': BouncyMemory,
            'shadow-match': ShadowMatch,
            'lily-pad-hop': LilyPadHop,
            'sand-tracing': MagicSandTracing,
            'carnival-wheel': CarnivalWheel,
            'scratch-discover': ScratchDiscover,
            'hungry-frogs': HungryFrogs,
            'phonics-spell': PhonicsSpellGame,
          };
          const GameComponent = GAME_MAP[activeGame];
          if (!GameComponent) return null;
          return <GameComponent group={group} onBack={() => setActiveGame(null)} />;
        })()}
      </Suspense>
    </div>
  );
};

export default TeachingFlow;
