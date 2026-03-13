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

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 2000);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  const handleStepComplete = useCallback(() => {
    setStepComplete(true);
  }, []);

  const handleNextStep = useCallback(() => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    if (stepIndex < STEPS.length - 1) {
      setStepComplete(false);
      setStepReady(false);
      setShowPreloader(true);
      setStepIndex((prev) => prev + 1);
    } else {
      onExit();
    }
  }, [stepIndex, onExit]);

  const handlePrevStep = useCallback(() => {
    window.speechSynthesis.cancel();
    stopAllAudio();
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
    onExit();
  };

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
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
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

      {/* Top left buttons: Home + Fullscreen */}
      <div className="fixed top-3 left-3 z-50 flex items-center gap-2">
        <button
          onClick={handleHomeClick}
          className="p-2 md:p-2.5 lg:p-3 rounded-full bg-[#b4d7ff]/80 hover:bg-[#9fc9ff] transition-all shadow-lg"
        >
          <Home className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 md:p-2.5 lg:p-3 rounded-full bg-[#b4d7ff]/80 hover:bg-[#9fc9ff] transition-all shadow-lg"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
        </button>
      </div>

      {/* Skip Step button */}
      <button
        onClick={handleSkipStep}
        className="fixed bottom-3 right-3 z-50 flex items-center gap-1 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white/40 hover:bg-white/70 text-[#3e366b]/50 hover:text-[#3e366b]/80 text-xs lg:text-sm font-medium transition-all backdrop-blur-sm"
      >
        Skip
        <SkipForward className="w-3 h-3 lg:w-4 lg:h-4" />
      </button>

      {/* Back one step button */}
      {stepIndex > 0 && (
        <button
          onClick={handlePrevStep}
          className="fixed bottom-3 left-3 z-50 flex items-center gap-1 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white/40 hover:bg-white/70 text-[#3e366b]/50 hover:text-[#3e366b]/80 text-xs lg:text-sm font-medium transition-all backdrop-blur-sm"
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
              className="px-7 py-3 md:px-10 md:py-4 lg:px-14 lg:py-5 rounded-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-base md:text-xl lg:text-2xl shadow-2xl flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  '0 8px 30px rgba(34,197,94,0.4)',
                  '0 8px 50px rgba(34,197,94,0.6)',
                  '0 8px 30px rgba(34,197,94,0.4)',
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
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl text-center max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Home className="w-12 h-12 md:w-16 md:h-16 text-[#4d79ff] mx-auto mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-[#3e366b] mb-2">
                Go Home?
              </h3>
              <p className="text-[#3e366b]/60 text-sm md:text-base mb-6">
                Your progress in this group will be lost.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-6 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-[#3e366b] font-semibold transition-all"
                >
                  Stay
                </button>
                <button
                  onClick={confirmExit}
                  className="px-6 py-3 rounded-full bg-[#4d79ff] hover:bg-[#3d69ef] text-white font-semibold transition-all shadow-lg"
                >
                  Go Home
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingFlow;
