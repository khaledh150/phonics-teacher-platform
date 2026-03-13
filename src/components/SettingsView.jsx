import React, { useState, useEffect, useRef } from 'react';
import { Play, Trophy, Gamepad2, BookOpen, Maximize, ChevronRight, X, Settings, Printer } from 'lucide-react';
import { SET_LETTERS } from '../data/sets';
import { openPrintableSheet } from './PrintableView';
import wonderPhonicsLogo from '../assets/wonder-phonics-logo.png';
import { getBestVoice } from '../utils/speech';

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

const SettingsView = ({ onStartGame, initialSettings }) => {
  const [activePopup, setActivePopup] = useState(null);
  const [showPracticeSettings, setShowPracticeSettings] = useState(false);
  const [selectedSet, setSelectedSet] = useState(initialSettings?.setLetter || null);
  const [questionCount, setQuestionCount] = useState(initialSettings?.questionCount || 10);
  const [speed, setSpeed] = useState(initialSettings?.speed || 0.75);
  const [isPC, setIsPC] = useState(false);
  const voiceRef = useRef(null);

  // Cancel any ongoing speech when returning to settings page
  useEffect(() => {
    window.speechSynthesis.cancel();
    // Also cancel on interval to ensure it stops - more aggressive, 2 seconds
    const cancelInterval = setInterval(() => {
      window.speechSynthesis.cancel();
    }, 100);
    // Clear after 2 seconds
    const timeout = setTimeout(() => clearInterval(cancelInterval), 2000);
    return () => {
      clearInterval(cancelInterval);
      clearTimeout(timeout);
    };
  }, []);

  // Detect PC (large screen >= 1024px width)
  useEffect(() => {
    const checkIsPC = () => {
      setIsPC(window.innerWidth >= 1024);
    };
    checkIsPC();
    window.addEventListener('resize', checkIsPC);
    return () => window.removeEventListener('resize', checkIsPC);
  }, []);

  // Load high-quality voices
  useEffect(() => {
    const loadVoices = () => {
      voiceRef.current = getBestVoice();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Removed tile dictation to prevent speech from continuing after leaving modes

  // Start game handlers - cancel any speech before starting
  const handleStartLearn = () => {
    window.speechSynthesis.cancel();
    requestFullscreen();
    onStartGame({
      mode: 'learn',
      questionCount: 100,
      speed: 0.75,
      setLetter: null,
      learnCategory: 'all',
    });
  };

  const handleStartPractice = () => {
    window.speechSynthesis.cancel();
    requestFullscreen();
    onStartGame({
      mode: 'practice',
      questionCount,
      speed,
      setLetter: null,
      learnCategory: null,
    });
  };

  const handleStartCompetition = () => {
    if (!selectedSet) return;
    window.speechSynthesis.cancel();
    requestFullscreen();
    onStartGame({
      mode: 'competition',
      questionCount: 60,
      speed: 0.75,
      setLetter: selectedSet,
      learnCategory: null,
    });
  };

  const handlePrint = () => {
    if (selectedSet) {
      openPrintableSheet(selectedSet);
    }
  };

  // Close popup when clicking outside
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setActivePopup(null);
      setShowPracticeSettings(false);
    }
  };

  // PC-specific styles
  const pcLogoStyle = isPC ? { height: '200px', marginTop: '-3rem' } : {};
  const pcTileStyle = isPC ? { padding: '1.5rem', minWidth: '200px', minHeight: '260px' } : {};
  const pcNumberStyle = isPC ? { fontSize: '80px' } : {};
  const pcIconSize = isPC ? 64 : undefined;
  const pcLabelStyle = isPC ? { fontSize: '1.4rem' } : {};

  // Responsive tile styles for phone/tablet using viewport units
  const tileStyle = isPC ? pcTileStyle : {
    width: 'min(28vw, 140px)',
    height: 'min(35vw, 175px)',
    padding: 'min(3vw, 16px)'
  };
  const logoStyle = isPC ? pcLogoStyle : {
    height: 'min(22vw, 120px)'
  };
  const numberStyle = isPC ? pcNumberStyle : {
    fontSize: 'min(12vw, 56px)'
  };
  const iconSizeStyle = isPC ? { width: pcIconSize, height: pcIconSize } : {
    width: 'min(10vw, 48px)',
    height: 'min(10vw, 48px)'
  };
  const labelStyle = isPC ? pcLabelStyle : {
    fontSize: 'min(4vw, 18px)'
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 landscape:p-3 md:p-6 overflow-auto relative"
      style={{ background: 'linear-gradient(135deg, #d8e9fa 0%, #e8f4ff 50%, #f0e6ff 100%)' }}
    >
      {/* Animated background particles */}
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
              background: ['#ae90fd15', '#4d79ff15', '#ffd70015', '#f093fb15'][i % 4],
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-3 right-3 md:top-4 md:right-4 z-50 p-2 md:p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
        title="Toggle Fullscreen"
      >
        <Maximize className="w-5 h-5 md:w-6 md:h-6 text-[#3e366b]" />
      </button>

      {/* Logo - Responsive sizing, bigger than tiles */}
      <div className="mb-6 landscape:mb-4 md:mb-10 relative z-10" style={isPC ? { marginBottom: '3rem' } : {}}>
        <img
          src={wonderPhonicsLogo}
          alt="Wonder Phonics"
          className="w-auto mx-auto rounded-xl md:rounded-2xl shadow-lg object-contain"
          style={{ ...logoStyle, minHeight: isPC ? '140px' : 'min(25vw, 130px)' }}
        />
      </div>

      {/* Three Main Tiles with Arrows */}
      <div
        className="flex flex-col landscape:flex-row md:flex-row items-center justify-center w-full relative z-10"
        style={isPC ? { gap: '1.5rem', maxWidth: '100%' } : { gap: 'min(2vw, 12px)', maxWidth: '72rem' }}
      >

        {/* Tile 1: Learn */}
        <button
          onClick={() => setActivePopup('learn')}
          className="flex flex-col items-center justify-center rounded-2xl md:rounded-3xl bg-white border-4 border-[#ae90fd] shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
          style={{ ...tileStyle, borderWidth: isPC ? '5px' : '4px', borderRadius: isPC ? '2rem' : '1rem' }}
        >
          <span className="font-black text-[#ae90fd] leading-none" style={numberStyle}>1</span>
          <BookOpen
            className="text-[#ae90fd] my-2"
            style={iconSizeStyle}
          />
          <span className="font-semibold text-[#3e366b]" style={labelStyle}>Learn</span>
        </button>

        {/* Arrow 1 */}
        <div className="hidden landscape:flex md:flex items-center justify-center">
          <ChevronRight
            className="text-[#4d79ff]"
            style={isPC ? { width: 40, height: 40, strokeWidth: 3 } : { width: 28, height: 28, strokeWidth: 2.5 }}
          />
        </div>
        <div className="landscape:hidden md:hidden flex items-center justify-center rotate-90">
          <ChevronRight style={{ width: 'min(5vw, 24px)', height: 'min(5vw, 24px)', strokeWidth: 2 }} className="text-[#4d79ff]" />
        </div>

        {/* Tile 2: Practice */}
        <button
          onClick={() => setActivePopup('practice')}
          className="flex flex-col items-center justify-center rounded-2xl md:rounded-3xl bg-white border-4 border-[#4d79ff] shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
          style={{ ...tileStyle, borderWidth: isPC ? '5px' : '4px', borderRadius: isPC ? '2rem' : '1rem' }}
        >
          <span className="font-black text-[#4d79ff] leading-none" style={numberStyle}>2</span>
          <Gamepad2
            className="text-[#4d79ff] my-2"
            style={iconSizeStyle}
          />
          <span className="font-semibold text-[#3e366b]" style={labelStyle}>Practice</span>
        </button>

        {/* Arrow 2 */}
        <div className="hidden landscape:flex md:flex items-center justify-center">
          <ChevronRight
            className="text-[#ffd700]"
            style={isPC ? { width: 40, height: 40, strokeWidth: 3 } : { width: 28, height: 28, strokeWidth: 2.5 }}
          />
        </div>
        <div className="landscape:hidden md:hidden flex items-center justify-center rotate-90">
          <ChevronRight style={{ width: 'min(5vw, 24px)', height: 'min(5vw, 24px)', strokeWidth: 2 }} className="text-[#ffd700]" />
        </div>

        {/* Tile 3: Competition */}
        <button
          onClick={() => setActivePopup('competition')}
          className="flex flex-col items-center justify-center rounded-2xl md:rounded-3xl bg-white border-4 border-[#ffd700] shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
          style={{ ...tileStyle, borderWidth: isPC ? '5px' : '4px', borderRadius: isPC ? '2rem' : '1rem' }}
        >
          <span className="font-black text-[#ffd700] leading-none" style={numberStyle}>3</span>
          <Trophy
            className="text-[#ffd700] my-2"
            style={iconSizeStyle}
          />
          <span className="font-semibold text-[#3e366b]" style={labelStyle}>Competition</span>
        </button>
      </div>

      {/* ==================== POP-UP PANELS ==================== */}

      {/* Learn Mode Pop-up */}
      {activePopup === 'learn' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center relative">
            <button
              onClick={() => setActivePopup(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-all"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>

            <BookOpen className="w-20 h-20 md:w-24 md:h-24 text-[#ae90fd] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold text-[#3e366b] mb-8">Learn Mode</h2>

            <button
              onClick={handleStartLearn}
              className="w-full py-6 md:py-8 rounded-2xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-2xl md:text-3xl flex items-center justify-center gap-4 shadow-xl hover:shadow-2xl transition-all"
            >
              <Play className="w-10 h-10 md:w-12 md:h-12" fill="white" />
              START
            </button>
          </div>
        </div>
      )}

      {/* Practice Mode Pop-up */}
      {activePopup === 'practice' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center relative">
            <button
              onClick={() => setActivePopup(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-all"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>

            <Gamepad2 className="w-20 h-20 md:w-24 md:h-24 text-[#4d79ff] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold text-[#3e366b] mb-8">Practice Mode</h2>

            {showPracticeSettings && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl text-left">
                <label className="block text-[#3e366b] font-semibold mb-2 text-sm">
                  Questions
                </label>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[10, 20, 50, 100].map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`p-2 rounded-lg font-bold text-sm transition-all ${
                        questionCount === count
                          ? 'bg-[#4d79ff] text-white'
                          : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-[#4d79ff]'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>

                <label className="block text-[#3e366b] font-semibold mb-2 text-sm">
                  Speed: {speed.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-[#4d79ff]"
                />
              </div>
            )}

            <button
              onClick={handleStartPractice}
              className="w-full py-6 md:py-8 rounded-2xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-2xl md:text-3xl flex items-center justify-center gap-4 shadow-xl hover:shadow-2xl transition-all"
            >
              <Play className="w-10 h-10 md:w-12 md:h-12" fill="white" />
              START
            </button>

            <button
              onClick={() => setShowPracticeSettings(!showPracticeSettings)}
              className="mt-4 text-gray-400 text-sm underline hover:text-gray-600 transition-all flex items-center justify-center gap-1 mx-auto"
            >
              <Settings className="w-4 h-4" />
              {showPracticeSettings ? 'Hide settings' : 'Change settings'}
            </button>
          </div>
        </div>
      )}

      {/* Competition Mode Pop-up */}
      {activePopup === 'competition' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center relative">
            <button
              onClick={() => setActivePopup(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-all"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>

            <Trophy className="w-20 h-20 md:w-24 md:h-24 text-[#ffd700] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold text-[#3e366b] mb-6">Competition Mode</h2>

            <div className="mb-6">
              <label className="block text-[#3e366b] font-semibold mb-3 text-lg">
                Select Set
              </label>
              <div className="grid grid-cols-5 gap-2">
                {SET_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => setSelectedSet(letter)}
                    className={`p-3 md:p-4 rounded-xl font-bold text-xl md:text-2xl transition-all ${
                      selectedSet === letter
                        ? 'bg-[#ffd700] text-[#3e366b] shadow-lg scale-110'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartCompetition}
              disabled={!selectedSet}
              className={`w-full py-6 md:py-8 rounded-2xl font-bold text-2xl md:text-3xl flex items-center justify-center gap-4 shadow-xl transition-all ${
                selectedSet
                  ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white hover:shadow-2xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-10 h-10 md:w-12 md:h-12" fill={selectedSet ? 'white' : '#9ca3af'} />
              {selectedSet ? `START SET ${selectedSet}` : 'SELECT A SET'}
            </button>

            {/* Print Answer Sheet link */}
            {selectedSet && (
              <button
                onClick={handlePrint}
                className="mt-4 text-gray-400 text-sm underline hover:text-gray-600 transition-all flex items-center justify-center gap-1 mx-auto"
              >
                <Printer className="w-4 h-4" />
                Print answer sheet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
