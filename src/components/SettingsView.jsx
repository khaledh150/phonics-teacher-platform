import React, { useState } from 'react';
import { Play, Trophy, Shuffle, Volume2, Gauge, Maximize, Clock, Printer, BookOpen } from 'lucide-react';
import { SET_LETTERS, COMPETITION_TOTAL_TIME } from '../data/sets';
import { openPrintableSheet } from './PrintableView';
import wonderPhonicsLogo from '../assets/wonder-phonics-logo.jpeg';

// Word categories for Learn Mode
const LEARN_CATEGORIES = [
  { id: 'all', name: 'All Words', description: 'All unique words' },
  { id: 'cvc', name: 'CVC', description: 'cat, dog, pen...' },
  { id: 'digraphs', name: 'Digraphs', description: 'ship, chat, thin...' },
  { id: 'magic-e', name: 'Magic E', description: 'cake, bike, note...' },
];

// Fullscreen toggle
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

// Request fullscreen (for auto-fullscreen on start)
const requestFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch((e) => {
      console.warn('Fullscreen request failed:', e);
    });
  }
};

// Format time as M:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SettingsView = ({ onStartGame, initialSettings }) => {
  // State persistence: use initialSettings if provided (when user exits mid-game)
  const [mode, setMode] = useState(initialSettings?.mode || 'practice');
  const [questionCount, setQuestionCount] = useState(initialSettings?.questionCount || 10);
  const [speed, setSpeed] = useState(initialSettings?.speed || 0.75);
  const [selectedSet, setSelectedSet] = useState(initialSettings?.setLetter || null);
  const [learnCategory, setLearnCategory] = useState(initialSettings?.learnCategory || 'all');

  const handleStart = () => {
    // Competition and Learn modes require a set selection
    if (mode === 'competition' && !selectedSet) {
      return;
    }
    if (mode === 'learn' && !selectedSet && learnCategory === 'all') {
      // Learn mode can start without set if category is selected
    }

    requestFullscreen();

    onStartGame({
      mode,
      questionCount: mode === 'competition' ? 60 : questionCount,
      speed,
      setLetter: (mode === 'competition' || mode === 'learn') ? selectedSet : null,
      learnCategory: mode === 'learn' ? learnCategory : null,
    });
  };

  const handleSetSelect = (letter) => {
    setSelectedSet(letter);
  };

  const handlePrint = () => {
    if (selectedSet) {
      openPrintableSheet(selectedSet);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-2 landscape:p-2 md:p-4 md:landscape:p-3 lg:p-4 bg-[#d8e9fa] overflow-auto">
      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-2 right-2 md:top-3 md:right-3 lg:top-4 lg:right-4 z-50 p-2 md:p-3 lg:p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
        title="Toggle Fullscreen"
      >
        <Maximize className="w-5 h-5 md:w-6 md:h-6 lg:w-6 lg:h-6 text-[#3e366b]" />
      </button>

      <div
        className="rounded-3xl landscape:rounded-2xl md:rounded-[2rem] md:landscape:rounded-3xl lg:rounded-[2.7rem] shadow-xl p-4 landscape:p-3 md:p-8 md:landscape:p-5 lg:p-10 w-full max-w-2xl md:max-w-3xl lg:max-w-2xl fade-in"
        style={{ background: 'linear-gradient(150deg, #f0f7ff 65%, #e6f0ff 100%)' }}
      >
        {/* Logo */}
        <div className="text-center mb-4 landscape:mb-2 md:mb-6 md:landscape:mb-4 lg:mb-8">
          <img
            src={wonderPhonicsLogo}
            alt="Wonder Phonics"
            className="h-40 landscape:h-28 md:h-56 md:landscape:h-40 lg:h-72 w-auto mx-auto mb-2 landscape:mb-1 md:mb-3 rounded-2xl shadow-lg object-contain"
          />
          <p className="text-gray-500 text-sm md:text-lg md:landscape:text-base lg:text-lg">Select your mode and settings</p>
        </div>

        {/* Content Area */}
        <div>
          {/* Mode Selection - 3 Modes: Learn, Practice, Competition */}
          <div className="mb-4 landscape:mb-3 md:mb-6 md:landscape:mb-4 lg:mb-8">
            <label className="block text-[#3e366b] font-semibold mb-2 landscape:mb-1.5 md:mb-3 lg:mb-4 text-sm landscape:text-xs md:text-base lg:text-lg">
              Game Mode
            </label>
            <div className="grid grid-cols-3 gap-2.5 landscape:gap-1.5 md:gap-4 md:landscape:gap-3 lg:gap-5">
              {/* Learn Mode - purple frame only, no background */}
              <button
                onClick={() => setMode('learn')}
                className={`p-3 landscape:p-2 md:p-5 md:landscape:p-3 lg:p-6 rounded-2xl landscape:rounded-xl md:rounded-2xl lg:rounded-[2rem] border-3 transition-all flex flex-col items-center gap-1 landscape:gap-0.5 md:gap-2 lg:gap-3 ${
                  mode === 'learn'
                    ? 'border-[#ae90fd] bg-white'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <BookOpen
                  className={`w-6 h-6 landscape:w-5 landscape:h-5 md:w-8 md:h-8 md:landscape:w-6 md:landscape:h-6 lg:w-10 lg:h-10 ${mode === 'learn' ? 'text-[#ae90fd]' : 'text-gray-400'}`}
                />
                <span className={`font-semibold text-sm landscape:text-xs md:text-lg md:landscape:text-sm lg:text-xl ${
                  mode === 'learn' ? 'text-[#ae90fd]' : 'text-gray-600'
                }`}>
                  Learn
                </span>
                <span className="text-[10px] md:text-sm lg:text-base text-gray-400 hidden landscape:hidden md:block text-center">Watch & listen</span>
              </button>

              {/* Practice Mode */}
              <button
                onClick={() => {
                  setMode('practice');
                  setSelectedSet(null);
                }}
                className={`p-3 landscape:p-2 md:p-5 md:landscape:p-3 lg:p-6 rounded-2xl landscape:rounded-xl md:rounded-2xl lg:rounded-[2rem] border-3 transition-all flex flex-col items-center gap-1 landscape:gap-0.5 md:gap-2 lg:gap-3 ${
                  mode === 'practice'
                    ? 'border-[#4d79ff] bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Shuffle
                  className={`w-6 h-6 landscape:w-5 landscape:h-5 md:w-8 md:h-8 md:landscape:w-6 md:landscape:h-6 lg:w-10 lg:h-10 ${mode === 'practice' ? 'text-[#4d79ff]' : 'text-gray-400'}`}
                />
                <span className={`font-semibold text-sm landscape:text-xs md:text-lg md:landscape:text-sm lg:text-xl ${
                  mode === 'practice' ? 'text-[#4d79ff]' : 'text-gray-600'
                }`}>
                  Practice
                </span>
                <span className="text-[10px] md:text-sm lg:text-base text-gray-400 hidden landscape:hidden md:block text-center">Tap to answer</span>
              </button>

              {/* Competition Mode - Yellow border only, no yellow background */}
              <button
                onClick={() => setMode('competition')}
                className={`p-3 landscape:p-2 md:p-5 md:landscape:p-3 lg:p-6 rounded-2xl landscape:rounded-xl md:rounded-2xl lg:rounded-[2rem] border-3 transition-all flex flex-col items-center gap-1 landscape:gap-0.5 md:gap-2 lg:gap-3 ${
                  mode === 'competition'
                    ? 'border-[#ffd700] bg-white'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Trophy
                  className={`w-6 h-6 landscape:w-5 landscape:h-5 md:w-8 md:h-8 md:landscape:w-6 md:landscape:h-6 lg:w-10 lg:h-10 ${mode === 'competition' ? 'text-[#ffd700]' : 'text-gray-400'}`}
                />
                <span className={`font-semibold text-sm landscape:text-xs md:text-lg md:landscape:text-sm lg:text-xl ${
                  mode === 'competition' ? 'text-[#3e366b]' : 'text-gray-600'
                }`}>
                  Competition
                </span>
                <span className="text-[10px] md:text-sm lg:text-base text-gray-400 hidden landscape:hidden md:block text-center">60 questions</span>
              </button>
            </div>
          </div>

          {/* Competition Set Selection - 10 Buttons (A-J) */}
          {mode === 'competition' && (
            <div className="mb-4 landscape:mb-3 md:mb-6 md:landscape:mb-4 lg:mb-8 fade-in">
              <label className="block text-[#3e366b] font-semibold mb-2 landscape:mb-1.5 md:mb-3 lg:mb-4 text-sm landscape:text-xs md:text-base lg:text-lg">
                Select Question Set
              </label>
              <div className="grid grid-cols-5 gap-2 landscape:gap-1.5 md:gap-3 md:landscape:gap-2 lg:gap-4">
                {SET_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => handleSetSelect(letter)}
                    className={`p-2.5 landscape:p-1.5 md:p-4 md:landscape:p-3 lg:p-5 rounded-xl md:rounded-2xl lg:rounded-2xl font-bold text-lg landscape:text-base md:text-2xl md:landscape:text-xl lg:text-3xl transition-all ${
                      selectedSet === letter
                        ? 'bg-[#ffd700] text-[#3e366b] shadow-lg scale-105'
                        : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-[#4d79ff] hover:bg-blue-50'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>

              {/* Competition Info */}
              <div className="mt-3 landscape:mt-2 md:mt-4 md:landscape:mt-3 lg:mt-5 p-2.5 landscape:p-1.5 md:p-4 md:landscape:p-3 lg:p-5 rounded-xl md:rounded-2xl lg:rounded-2xl bg-[#e6f0ff] border-2 border-[#b4d7ff]">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-[#4d79ff]" />
                  <span className="text-[#3e366b] font-bold text-sm landscape:text-xs md:text-lg md:landscape:text-base lg:text-xl">
                    Total Time: {formatTime(COMPETITION_TOTAL_TIME)}
                  </span>
                </div>
                <p className="text-center text-gray-500 text-xs landscape:text-[10px] md:text-sm lg:text-base mt-1">
                  60 questions • 4 seconds per question
                </p>
              </div>
            </div>
          )}

          {/* Learn Mode Selection */}
          {mode === 'learn' && (
            <div className="mb-3 landscape:mb-2 md:mb-5 md:landscape:mb-3 lg:mb-6 fade-in">
              {/* Category Selection */}
              <label className="block text-[#3e366b] font-semibold mb-1.5 landscape:mb-1 md:mb-2 lg:mb-3 text-sm landscape:text-xs md:text-base lg:text-lg">
                Choose Category
              </label>
              <div className="grid grid-cols-2 gap-1.5 landscape:gap-1 md:gap-2 md:landscape:gap-1.5 lg:gap-3 mb-3 landscape:mb-1.5 md:mb-3">
                {LEARN_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setLearnCategory(cat.id);
                      setSelectedSet(null);
                    }}
                    className={`p-1.5 landscape:p-1 md:p-2 md:landscape:p-1.5 lg:p-3 rounded-lg md:rounded-xl lg:rounded-xl font-semibold text-xs landscape:text-[10px] md:text-sm lg:text-base transition-all text-left ${
                      learnCategory === cat.id && !selectedSet
                        ? 'bg-[#ae90fd] text-white shadow-lg'
                        : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    <div className="font-bold">{cat.name}</div>
                    <div className={`text-[10px] landscape:text-[9px] md:text-xs ${learnCategory === cat.id && !selectedSet ? 'text-white/80' : 'text-gray-400'}`}>
                      {cat.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* OR Set Selection */}
              <div className="flex items-center gap-2 my-2 landscape:my-1 md:my-3">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-gray-400 text-xs landscape:text-[10px] font-medium">OR select a set</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              <div className="grid grid-cols-5 gap-1.5 landscape:gap-1 md:gap-2 md:landscape:gap-1.5 lg:gap-3">
                {SET_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => {
                      setSelectedSet(letter);
                      setLearnCategory(null);
                    }}
                    className={`p-1.5 landscape:p-1 md:p-3 md:landscape:p-2 lg:p-3 rounded-lg md:rounded-xl lg:rounded-xl font-bold text-base landscape:text-sm md:text-xl md:landscape:text-lg lg:text-2xl transition-all ${
                      selectedSet === letter
                        ? 'bg-[#ae90fd] text-white shadow-lg scale-105'
                        : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>

              {/* Learn Mode Info */}
              <div className="mt-2 landscape:mt-1 md:mt-3 md:landscape:mt-2 lg:mt-4 p-1.5 landscape:p-1 md:p-3 md:landscape:p-2 lg:p-4 rounded-xl md:rounded-2xl lg:rounded-2xl bg-purple-50 border-2 border-[#ae90fd]">
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-3 h-3 md:w-4 md:h-4 lg:w-5 lg:h-5 text-purple-600" />
                  <span className="text-purple-700 font-bold text-xs landscape:text-[10px] md:text-base md:landscape:text-sm lg:text-lg">
                    Interactive Learning
                  </span>
                </div>
                <p className="text-center text-purple-500 text-[10px] landscape:text-[9px] md:text-xs lg:text-sm mt-0.5">
                  See images • Hear words • Learn at your pace
                </p>
              </div>
            </div>
          )}

          {/* Question Count (Practice Mode Only) */}
          {mode === 'practice' && (
            <div className="mb-4 landscape:mb-3 md:mb-6 md:landscape:mb-4 lg:mb-8 fade-in">
              <label className="block text-[#3e366b] font-semibold mb-2 landscape:mb-1.5 md:mb-3 lg:mb-4 text-sm landscape:text-xs md:text-base lg:text-lg">
                Number of Questions
              </label>
              <div className="grid grid-cols-4 gap-2 landscape:gap-1.5 md:gap-3 md:landscape:gap-2 lg:gap-4">
                {[10, 20, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`p-2.5 landscape:p-1.5 md:p-4 md:landscape:p-3 lg:p-5 rounded-xl md:rounded-2xl lg:rounded-2xl font-bold text-base landscape:text-sm md:text-xl md:landscape:text-lg lg:text-2xl transition-all ${
                      questionCount === count
                        ? 'bg-[#4d79ff] text-white shadow-lg'
                        : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-[#4d79ff]'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Speed Control (Practice Mode Only) */}
          {mode === 'practice' && (
            <div className="mb-4 landscape:mb-3 md:mb-6 md:landscape:mb-4 lg:mb-8 fade-in">
              <label className="block text-[#3e366b] font-semibold mb-2 landscape:mb-1.5 md:mb-3 lg:mb-4 text-sm landscape:text-xs md:text-base lg:text-lg flex items-center gap-2">
                <Gauge className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-[#ae90fd]" />
                Speech Speed: {speed.toFixed(2)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#4d79ff] h-2 md:h-3"
              />
              <div className="flex justify-between text-xs landscape:text-[10px] md:text-sm lg:text-base text-gray-400 mt-1 md:mt-2">
                <span>Slower</span>
                <span>Default</span>
                <span>Faster</span>
              </div>
            </div>
          )}
        </div>

        {/* Start Button Section */}
        <div className="mt-4 landscape:mt-2 md:mt-6 lg:mt-8">
          {/* Button Row - Start and Print */}
          <div className={`flex gap-2 md:gap-3 lg:gap-3 ${(mode === 'competition' && selectedSet) || mode === 'learn' ? '' : 'flex-col'}`}>
            {/* Start Button */}
            <button
              onClick={handleStart}
              disabled={mode === 'competition' && !selectedSet}
              className={`flex-1 text-sm landscape:text-xs md:text-lg md:landscape:text-base lg:text-xl py-2.5 landscape:py-1.5 md:py-3 md:landscape:py-2 lg:py-4 flex items-center justify-center gap-2 md:gap-3 lg:gap-3 rounded-full font-bold transition-all shadow-lg ${
                mode === 'competition' && !selectedSet
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : mode === 'learn'
                    ? 'bg-[#ae90fd] text-white hover:bg-[#9d7ff0]'
                    : 'bg-[#b4d7ff] text-[#3e366b] hover:bg-[#9fc9ff]'
              }`}
            >
              {mode === 'learn' ? (
                <BookOpen className="w-4 h-4 md:w-6 md:h-6 lg:w-7 lg:h-7" />
              ) : (
                <Play className="w-4 h-4 md:w-6 md:h-6 lg:w-7 lg:h-7" fill={mode === 'competition' && !selectedSet ? '#9ca3af' : '#3e366b'} />
              )}
              {mode === 'competition'
                ? selectedSet
                  ? `Start Set ${selectedSet}`
                  : 'Select a Set'
                : mode === 'learn'
                  ? selectedSet
                    ? `Learn Set ${selectedSet}`
                    : 'Start Learning'
                  : 'Start Game'
              }
            </button>

            {/* Print Answer Sheet Button - Only in Competition Mode with Set Selected */}
            {mode === 'competition' && selectedSet && (
              <button
                onClick={handlePrint}
                className="px-4 md:px-6 lg:px-8 py-2.5 landscape:py-1.5 md:py-3 md:landscape:py-2 lg:py-4 flex items-center justify-center gap-2 rounded-full font-bold transition-all shadow-lg bg-white border-2 border-[#4d79ff] text-[#4d79ff] hover:bg-blue-50 whitespace-nowrap"
                title="Print Answer Sheet"
              >
                <Printer className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
                <span className="text-xs md:text-sm lg:text-base">Print Answer Sheet</span>
              </button>
            )}
          </div>

          {/* Voice Info */}
          <div className="mt-2 landscape:mt-1 md:mt-3 lg:mt-4 text-center text-gray-400 text-[10px] landscape:text-[9px] md:text-xs lg:text-sm flex items-center justify-center gap-1.5">
            <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4 text-[#ae90fd]" />
            <span className="hidden landscape:hidden md:inline">
              {mode === 'competition'
                ? 'Deterministic sets matching printed answer sheets'
                : mode === 'learn'
                  ? 'Watch images and listen to high-quality pronunciation'
                  : 'Using high-quality Google/Neural voice synthesis'
              }
            </span>
            <span className="md:hidden">
              {mode === 'competition'
                ? 'Matches printed sheets'
                : mode === 'learn'
                  ? 'Watch & listen'
                  : 'Voice synthesis enabled'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
