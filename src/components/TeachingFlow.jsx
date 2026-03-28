import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, ChevronRight, ChevronLeft, SkipForward, Maximize } from 'lucide-react';
import SoundLearning from './SoundLearning';
import GroupSong from './GroupSong';
import FlashcardViewer from './FlashcardViewer';
import SoundBalloons from './SoundBalloons';
import ExerciseMatch from './ExerciseMatch';
import BlendingFactory from './BlendingFactory';
import SentenceScramble from './SentenceScramble';
import PlaygroundHub from './PlaygroundHub';
import MagicFlashlight from './games/MagicFlashlight';
import BubbleSpell from './games/BubbleSpell';
import MonsterFeeder from './games/MonsterFeeder';
import WhackASound from './games/WhackASound';
import CatchTheDrop from './games/CatchTheDrop';
import BouncyMemory from './games/BouncyMemory';
import ShadowMatch from './games/ShadowMatch';
import LilyPadHop from './games/LilyPadHop';
import MagicSandTracing from './games/MagicSandTracing';
import CarnivalWheel from './games/CarnivalWheel';
import ScratchDiscover from './games/ScratchDiscover';
import Preloader from './Preloader';
import { stopAllAudio } from '../utils/letterSounds';
import { playVO, stopVO, delay } from '../utils/audioPlayer';
import { triggerCelebration } from '../utils/confetti';
import { resetEncouragementCycles } from '../utils/encouragement';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const STEPS = ['sounds', 'song', 'words', 'balloons', 'exercise', 'blending', 'sentences'];

const STEP_MESSAGES = {
  sounds: ["Let's learn new sounds!", "Listen carefully...", "Get ready!"],
  song: ["Song time!", "Let's sing along...", "Here we go!"],
  words: ["Word flashcards!", "Read and listen...", "Let's read!"],
  balloons: ["Balloon popping!", "Pop the right sounds...", "Get ready!"],
  exercise: ["Match the pairs!", "Words and pictures...", "Let's play!"],
  blending: ["Blending Factory!", "Build the words...", "Let's blend!"],
  sentences: ["Sentence Scramble!", "Build the sentences...", "Let's go!"],
};

const TeachingFlow = ({ group, onExit }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [stepReady, setStepReady] = useState(false);
  const [showGroupFinish, setShowGroupFinish] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [activeGame, setActiveGame] = useState(null);

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Play "Let's learn!" VO during preloader for step 1
      if (stepIndex === 0) {
        await playVO("Let's learn!");
        if (cancelled) return;
        await delay(300);
        if (cancelled) return;
      }
      setShowPreloader(false);
    };
    // Minimum preloader display time
    const timer = setTimeout(() => { if (!cancelled) run(); }, 1500);
    return () => { cancelled = true; clearTimeout(timer); stopVO(); };
  }, [stepIndex]);

  const autoAdvanceTimerRef = useRef(null);
  const advancingRef = useRef(false);

  // Reset advancing guard whenever stepIndex changes (re-render complete)
  useEffect(() => {
    advancingRef.current = false;
  }, [stepIndex]);

  const handleNextStep = useCallback(() => {
    if (advancingRef.current) return; // prevent double-advance
    advancingRef.current = true;
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    if (stepIndex < STEPS.length - 1) {
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex((prev) => prev + 1);
    } else {
      setShowGroupFinish(true);
    }
  }, [stepIndex]);

  // Auto-advance after a brief delay when a step completes
  const handleStepComplete = useCallback(() => {
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleNextStep();
    }, 1200);
  }, [handleNextStep]);

  // Clear auto-advance timer on unmount or step change
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
      // Skip on last step (sentences) → go to playground
      setShowPlayground(true);
    } else if (stepIndex < STEPS.length - 1) {
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex((prev) => prev + 1);
    } else {
      onExit();
    }
  }, [stepIndex, currentStep, onExit]);

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

  // Reset encouragement cycles when starting a new group
  useEffect(() => {
    resetEncouragementCycles();
  }, [group]);

  // VO + confetti on group finish celebration
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
        return <SoundLearning group={group} onComplete={handleStepComplete} />;
      case 'song':
        return <GroupSong group={group} onComplete={handleStepComplete} />;
      case 'words':
        return <FlashcardViewer group={group} onComplete={handleStepComplete} />;
      case 'balloons':
        return <SoundBalloons group={group} onComplete={handleNextStep} />;
      case 'exercise':
        return <ExerciseMatch group={group} onComplete={handleNextStep} />;
      case 'blending':
        return <BlendingFactory group={group} onComplete={handleNextStep} />;
      case 'sentences':
        return <SentenceScramble group={group} onComplete={handleNextStep} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-gradient-to-b from-[#1a1147] to-[#2d1b69]">
      {/* Step Content - full screen */}
      <AnimatePresence mode="wait">
        {stepReady && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="h-full"
          >
            {renderStep()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preloader */}
      <Preloader
        isVisible={showPreloader}
        onExitComplete={() => setStepReady(true)}
        messages={STEP_MESSAGES[currentStep]}
      />

      {/* Top left buttons: Home + Fullscreen — z-[70] above results */}
      <div className="fixed top-3 left-3 z-[70] flex items-center gap-2">
        <motion.button
          onClick={handleHomeClick}
          className="p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
          style={{ borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.95, y: 3 }}
        >
          <Home className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
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
      {/* Group label - left corner, below nav buttons */}
      <div className="fixed top-[3.5rem] md:top-[4.2rem] lg:top-[4.5rem] left-3 z-[60]">
        <div
          className="rounded-full px-3 py-0.5 md:px-4 md:py-1 text-white font-semibold text-[10px] md:text-xs lg:text-sm flex items-center gap-1 whitespace-nowrap"
          style={{ backgroundColor: 'rgba(230, 0, 35, 0.25)', backdropFilter: 'blur(4px)' }}
        >
          <span className="text-xs md:text-sm">{group.icon}</span> {group.title}
        </div>
      </div>

      {/* Skip Step button — z-[70] to stay above results panels (z-[60]) */}
      <button
        onClick={handleSkipStep}
        className="fixed bottom-3 right-3 z-[70] flex items-center gap-1 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 text-xs lg:text-sm font-medium transition-all backdrop-blur-sm"
      >
        Skip
        <SkipForward className="w-3 h-3 lg:w-4 lg:h-4" />
      </button>

      {/* Back one step button — z-[70] to stay above results panels */}
      {stepIndex > 0 && (
        <button
          onClick={handlePrevStep}
          className="fixed bottom-3 left-3 z-[70] flex items-center gap-1 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 text-xs lg:text-sm font-medium transition-all backdrop-blur-sm"
        >
          <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4" />
          Back
        </button>
      )}

      {/* Floating step progress */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="flex items-center gap-1.5">
          {STEPS.map((step, idx) => (
            <div key={step} className="flex items-center">
              <div
                className={`rounded-full transition-all ${
                  idx < stepIndex
                    ? 'bg-[#22c55e]'
                    : idx === stepIndex
                    ? 'bg-[#4d79ff] ring-2 ring-[#4d79ff]/30'
                    : 'bg-white/40'
                }`}
                style={{
                  width: idx === stepIndex ? 10 : 7,
                  height: idx === stepIndex ? 10 : 7,
                }}
              />
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-px mx-0.5 ${idx < stepIndex ? 'bg-[#22c55e]/50' : 'bg-white/20'}`}
                  style={{ width: 12 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next Step button removed — steps auto-advance via handleStepComplete */}

      {/* Group Finish celebration */}
      <AnimatePresence>
        {showGroupFinish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, rgba(62,54,107,0.85) 0%, rgba(0,0,0,0.9) 100%)' }}
          >
            {/* Confetti handled by canvas-confetti (triggerCelebration) */}

            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="bg-[#2d1b69] p-8 md:p-12 text-center max-w-md mx-4 relative z-10"
              style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
            >
              {/* Trophy with glow */}
              <motion.div
                className="relative inline-block mb-4"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)', transform: 'scale(2.5)' }}
                  animate={{ scale: [2.5, 3, 2.5], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-7xl md:text-9xl block relative">&#127942;</span>
              </motion.div>

              <motion.h2
                className="text-3xl md:text-4xl font-bold text-[#6B3FA0] mb-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Group Master!
              </motion.h2>
              <motion.p
                className="text-base md:text-lg text-[#ae90fd] font-semibold mb-8"
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
                className="flex flex-col items-center gap-3"
              >
                <motion.button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    stopAllAudio();
                    stopVO();
                    setShowGroupFinish(false);
                    setShowPlayground(true);
                  }}
                  className="px-8 py-3 md:px-10 md:py-4 bg-[#8B5CF6] text-white font-bold text-base md:text-lg flex items-center gap-2"
                  style={{ borderRadius: '1.6rem', borderBottom: '5px solid #7C3AED', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 4 }}
                >
                  <span>🎮</span> Bonus Playground
                </motion.button>
                <motion.button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    stopAllAudio();
                    stopVO();
                    onExit();
                  }}
                  className="px-6 py-2 bg-white/20 text-white/80 font-semibold text-sm hover:bg-white/30 transition-all"
                  style={{ borderRadius: '1.2rem' }}
                  whileTap={{ scale: 0.95 }}
                >
                  Finish &amp; Go Home
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirmation modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="bg-gradient-to-b from-[#f0e6ff] to-[#dfd0f8] p-6 md:p-10 text-center max-w-sm mx-4 border-t-4 border-[#FFD000]"
              style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Home className="w-12 h-12 md:w-16 md:h-16 text-[#8B5CF6] mx-auto mb-4" />
              <h3 className="text-xl md:text-2xl text-[#3e366b] mb-2" style={{ fontFamily: '"Fredoka", "Bubblegum Sans", "Comic Sans MS", cursive', fontWeight: 700, textShadow: 'none' }}>
                Go Home?
              </h3>
              <p className="text-[#3e366b]/60 text-sm md:text-base mb-6">
                Your progress in this group will be lost.
              </p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-6 py-3 bg-[#FFD000] text-[#3e366b] font-bold transition-all"
                  style={{ borderRadius: '1.6rem', borderBottom: '4px solid #E0B800', boxShadow: '0px 4px 0px rgba(0,0,0,0.08)' }}
                  whileTap={{ scale: 0.95, y: 3 }}
                >
                  Stay
                </motion.button>
                <motion.button
                  onClick={confirmExit}
                  className="px-6 py-3 bg-[#FFD000] text-[#3e366b] font-bold transition-all"
                  style={{ borderRadius: '1.6rem', borderBottom: '4px solid #E0B800', boxShadow: '0px 4px 0px rgba(0,0,0,0.12)' }}
                  whileTap={{ scale: 0.95, y: 3 }}
                >
                  Go Home
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playground Hub & Games — rendered as full-screen overlays */}
      <AnimatePresence>
        {showPlayground && !activeGame && (
          <motion.div
            key="playground-hub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
          >
            <PlaygroundHub
              group={group}
              onBack={() => {
                setShowPlayground(false);
                onExit();
              }}
              onSelectGame={(gameId) => setActiveGame(gameId)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'flashlight' && (
          <motion.div
            key="game-flashlight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
          >
            <MagicFlashlight
              group={group}
              onBack={() => setActiveGame(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'bubble-spell' && (
          <motion.div
            key="game-bubble-spell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
          >
            <BubbleSpell
              group={group}
              onBack={() => setActiveGame(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'monster-feeder' && (
          <motion.div key="game-monster-feeder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <MonsterFeeder group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'whack-a-sound' && (
          <motion.div key="game-whack-a-sound" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <WhackASound group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'catch-drop' && (
          <motion.div key="game-catch-drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <CatchTheDrop group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'bouncy-memory' && (
          <motion.div key="game-bouncy-memory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <BouncyMemory group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'shadow-match' && (
          <motion.div key="game-shadow-match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <ShadowMatch group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'lily-pad-hop' && (
          <motion.div key="game-lily-pad-hop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <LilyPadHop group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'sand-tracing' && (
          <motion.div key="game-sand-tracing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <MagicSandTracing group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'carnival-wheel' && (
          <motion.div key="game-carnival-wheel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <CarnivalWheel group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame === 'scratch-discover' && (
          <motion.div key="game-scratch-discover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]">
            <ScratchDiscover group={group} onBack={() => setActiveGame(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingFlow;
