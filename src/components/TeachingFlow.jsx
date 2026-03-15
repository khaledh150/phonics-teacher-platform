import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, ChevronRight, ChevronLeft, SkipForward, Maximize } from 'lucide-react';
import SoundLearning from './SoundLearning';
import GroupSong from './GroupSong';
import FlashcardViewer from './FlashcardViewer';
import SoundBalloons from './SoundBalloons';
import ExerciseMatch from './ExerciseMatch';
import BlendingFactory from './BlendingFactory';
import SentenceScramble from './SentenceScramble';
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

  const handleStepComplete = useCallback(() => {
    setStepComplete(true);
  }, []);

  const handleNextStep = useCallback(() => {
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
    if (stepIndex < STEPS.length - 1) {
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex((prev) => prev + 1);
    } else {
      onExit();
    }
  }, [stepIndex, onExit]);

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
    <div className="h-screen w-screen overflow-hidden relative bg-[#d8e9fa]">
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

      {/* Top left buttons: Home + Fullscreen + Group Label — z-[70] above results */}
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
        {/* Group label - always visible */}
        <div
          className="rounded-full px-3 py-1 md:px-4 md:py-1.5 text-white font-semibold text-xs md:text-sm lg:text-base"
          style={{ backgroundColor: group.color, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
        >
          {group.title}
        </div>
      </div>

      {/* Skip Step button — z-[70] to stay above results panels (z-[60]) */}
      <button
        onClick={handleSkipStep}
        className="fixed bottom-3 right-3 z-[70] flex items-center gap-1 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white/40 hover:bg-white/70 text-[#3e366b]/50 hover:text-[#3e366b]/80 text-xs lg:text-sm font-medium transition-all backdrop-blur-sm"
      >
        Skip
        <SkipForward className="w-3 h-3 lg:w-4 lg:h-4" />
      </button>

      {/* Back one step button — z-[70] to stay above results panels */}
      {stepIndex > 0 && (
        <button
          onClick={handlePrevStep}
          className="fixed bottom-3 left-3 z-[70] flex items-center gap-1 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white/40 hover:bg-white/70 text-[#3e366b]/50 hover:text-[#3e366b]/80 text-xs lg:text-sm font-medium transition-all backdrop-blur-sm"
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
                    : 'bg-[#3e366b]/20'
                }`}
                style={{
                  width: idx === stepIndex ? 10 : 7,
                  height: idx === stepIndex ? 10 : 7,
                }}
              />
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-px mx-0.5 ${idx < stepIndex ? 'bg-[#22c55e]/50' : 'bg-[#3e366b]/10'}`}
                  style={{ width: 12 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next Step Button */}
      <AnimatePresence>
        {stepComplete && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-12 lg:bottom-16 right-4 md:right-6 lg:right-10 z-50"
          >
            <motion.button
              onClick={handleNextStep}
              className="px-7 py-3 md:px-10 md:py-4 lg:px-14 lg:py-5 bg-[#22c55e] text-white font-bold text-base md:text-xl lg:text-2xl flex items-center gap-2"
              style={{ borderRadius: '1.6rem', borderBottom: '6px solid #16a34a', boxShadow: '0px 8px 0px rgba(0,0,0,0.12)' }}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95, y: 4 }}
              animate={{
                boxShadow: [
                  '0px 8px 0px rgba(0,0,0,0.12)',
                  '0px 8px 0px rgba(0,0,0,0.12), 0 0 20px rgba(34,197,94,0.5)',
                  '0px 8px 0px rgba(0,0,0,0.12)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {stepIndex < STEPS.length - 1 ? (
                <>
                  Next Step
                  <ChevronRight size={22} />
                </>
              ) : (
                <>
                  Complete!
                  <span className="text-xl">&#10003;</span>
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-white p-8 md:p-12 text-center max-w-md mx-4 relative z-10"
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
              >
                <motion.button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    stopAllAudio();
                    stopVO();
                    onExit();
                  }}
                  className="px-8 py-3 md:px-10 md:py-4 bg-[#E60023] text-white font-bold text-base md:text-lg"
                  style={{ borderRadius: '1.6rem', borderBottom: '5px solid #B3001B', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 4 }}
                >
                  Finish &#10003;
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
              className="bg-white p-6 md:p-10 text-center max-w-sm mx-4"
              style={{ borderRadius: '2.2rem', boxShadow: '0px 10px 0px rgba(0,0,0,0.12)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Home className="w-12 h-12 md:w-16 md:h-16 text-[#6B3FA0] mx-auto mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-[#6B3FA0] mb-2">
                Go Home?
              </h3>
              <p className="text-[#3e366b]/60 text-sm md:text-base mb-6">
                Your progress in this group will be lost.
              </p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-6 py-3 bg-gray-100 text-[#3e366b] font-semibold transition-all"
                  style={{ borderRadius: '1.6rem', borderBottom: '4px solid #d1d5db', boxShadow: '0px 4px 0px rgba(0,0,0,0.08)' }}
                  whileTap={{ scale: 0.95, y: 3 }}
                >
                  Stay
                </motion.button>
                <motion.button
                  onClick={confirmExit}
                  className="px-6 py-3 bg-[#6B3FA0] text-white font-semibold transition-all"
                  style={{ borderRadius: '1.6rem', borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.12)' }}
                  whileTap={{ scale: 0.95, y: 3 }}
                >
                  Go Home
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingFlow;
