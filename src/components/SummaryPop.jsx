import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle, XCircle, RotateCcw, Home, Trophy, Maximize, Volume2 } from 'lucide-react';
import { COMPETITION_SPEECH_RATE } from '../data/sets';
import { getBestVoice, speakWithVoice } from '../utils/speech';

// Confetti Component
const Confetti = () => {
  const colors = ['#4d79ff', '#ae90fd', '#ffd700', '#60a5fa', '#b4d7ff'];

  const pieces = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: Math.random() * 10 + 8,
      rotation: Math.random() * 360,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            borderRadius: piece.id % 2 === 0 ? '50%' : '2px',
            animationDelay: `${piece.delay}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// Shared AudioContext to avoid browser limits
let sharedAudioContext = null;

const getAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

// Pop sound for each result
const playPop = () => {
  try {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600 + Math.random() * 400;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};

// Fullscreen toggle
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

// Speak a word using high-quality voice via shared utility
const speakWord = (word) => {
  speakWithVoice(word, { rate: COMPETITION_SPEECH_RATE });
};

const SummaryPop = ({ results, onRestart, onHome }) => {
  const [resultsData, setResultsData] = useState([]);
  const [displayedResults, setDisplayedResults] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const listRef = useRef(null);
  const animationStartedRef = useRef(false);

  // Load voices on mount
  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  // Initialize resultsData from props on mount
  useEffect(() => {
    if (results && Array.isArray(results) && results.length > 0) {
      setResultsData([...results]);
    }
  }, [results]);

  const isCompetitionMode = resultsData.length > 0 && resultsData[0]?.isCompetitionMode === true;

  const correctCount = isCompetitionMode
    ? resultsData.length
    : resultsData.filter((r) => r?.correct === true).length;

  const percentage = resultsData.length > 0
    ? Math.round((correctCount / resultsData.length) * 100)
    : 0;

  // Animate results with sound
  useEffect(() => {
    if (animationStartedRef.current || resultsData.length === 0) return;
    animationStartedRef.current = true;

    let index = 0;
    const allResults = [...resultsData];

    const interval = setInterval(() => {
      if (index < allResults.length) {
        const currentResult = allResults[index];

        if (currentResult) {
          // Play sound first, then add result (ensures sync with animation)
          playPop();
          setDisplayedResults((prev) => [...prev, currentResult]);
        }

        index++;

        if (listRef.current) {
          setTimeout(() => {
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight;
            }
          }, 50);
        }
      } else {
        clearInterval(interval);
        setAnimationComplete(true);

        setTimeout(() => {
          setShowStats(true);
          // Show confetti for competition mode always, or practice mode if >= 70%
          if (isCompetitionMode || percentage >= 70) {
            setShowConfetti(true);
          }
        }, 500);
      }
    }, 100); // Faster animation for 60 questions

    return () => clearInterval(interval);
  }, [resultsData, isCompetitionMode, percentage]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 landscape:p-1 md:p-4 md:landscape:p-2 lg:p-4 relative bg-gradient-to-b from-[#1a1147] to-[#2d1b69]">
      {showConfetti && <Confetti />}

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-2 right-2 landscape:top-1 landscape:right-1 md:top-3 md:right-3 lg:top-4 lg:right-4 z-50 p-2 md:p-3 lg:p-3 rounded-full bg-[#ae90fd] hover:bg-[#c4b0ff] transition-all shadow-lg"
        title="Toggle Fullscreen"
      >
        <Maximize className="w-5 h-5 md:w-6 md:h-6 lg:w-6 lg:h-6 text-white" />
      </button>

      {/* Results Panel - Responsive for all screen sizes */}
      <div
        className="rounded-2xl landscape:rounded-xl md:rounded-3xl md:landscape:rounded-2xl lg:rounded-[2.7rem] shadow-xl p-4 landscape:p-2 landscape:px-3 md:p-6 md:landscape:p-4 lg:p-8 w-full max-w-4xl md:max-w-5xl lg:max-w-4xl flex flex-col h-[90vh] landscape:h-[95vh] md:h-[88vh] md:landscape:h-[92vh] lg:h-[85vh]"
        style={{ background: 'linear-gradient(150deg, #2d1b69 65%, #1a1147 100%)' }}
      >
        {/* Header */}
        <div className="text-center mb-2 landscape:mb-1 md:mb-4 md:landscape:mb-2 lg:mb-4 shrink-0">
          <h2 className="text-2xl landscape:text-lg md:text-3xl md:landscape:text-2xl lg:text-4xl font-bold text-white mb-1 landscape:mb-0 md:mb-2 lg:mb-2">
            {isCompetitionMode ? 'Answer Key' : 'Results'}
          </h2>
          <p className="text-sm landscape:text-xs md:text-base md:landscape:text-sm lg:text-base text-gray-500">
            {displayedResults.length} of {resultsData.length} questions
          </p>
        </div>

        {/* Scrollable Results List - Responsive spacing */}
        <div
          ref={listRef}
          className="results-scrollable flex-1 overflow-y-auto space-y-2 landscape:space-y-1 md:space-y-3 md:landscape:space-y-2 lg:space-y-2 min-h-0 pr-1 md:pr-2 lg:pr-2"
        >
          {resultsData && resultsData.length > 0 ? (
            displayedResults.map((item, idx) => {
              if (!item) return null;

              // Competition mode: [Q#] [Correct Word] [Listen Icon]
              if (isCompetitionMode) {
                return (
                  <div
                    key={idx}
                    className="result-pop flex items-center gap-2 landscape:gap-2 md:gap-4 md:landscape:gap-3 lg:gap-4 p-3 landscape:p-1.5 landscape:px-2 md:p-4 md:landscape:p-3 lg:p-4 rounded-lg landscape:rounded-md md:rounded-xl lg:rounded-xl bg-blue-50 border-2 border-blue-200"
                  >
                    <span className="text-lg landscape:text-sm md:text-2xl md:landscape:text-xl lg:text-2xl font-bold text-[#4d79ff] w-10 landscape:w-8 md:w-14 lg:w-14 text-center shrink-0">
                      {item.questionNumber || idx + 1}
                    </span>
                    <span className="font-bold text-xl landscape:text-base md:text-3xl md:landscape:text-2xl lg:text-3xl text-gray-700 flex-1">
                      {item.sound || 'Unknown'}
                    </span>
                    <button
                      onClick={() => speakWord(item.sound)}
                      className="speaker-button shrink-0"
                      title="Play word"
                    >
                      <Volume2 className="text-[#ae90fd] w-6 h-6 landscape:w-5 landscape:h-5 md:w-8 md:h-8 md:landscape:w-7 md:landscape:h-7 lg:w-8 lg:h-8" />
                    </button>
                  </div>
                );
              }

              // Practice mode: [Q#] [Correct/Incorrect] [Word] [Listen Icon]
              return (
                <div
                  key={idx}
                  className={`result-pop flex items-center gap-2 landscape:gap-2 md:gap-4 md:landscape:gap-3 lg:gap-4 p-3 landscape:p-1.5 landscape:px-2 md:p-4 md:landscape:p-3 lg:p-4 rounded-lg landscape:rounded-md md:rounded-xl lg:rounded-xl ${
                    item.correct
                      ? 'bg-green-900/30 border-2 border-green-500/30'
                      : 'bg-red-900/30 border-2 border-red-500/30'
                  }`}
                >
                  <span className="text-lg landscape:text-sm md:text-2xl md:landscape:text-xl lg:text-2xl font-bold text-white/40 w-10 landscape:w-8 md:w-14 lg:w-14 text-center shrink-0">
                    {item.questionNumber || idx + 1}
                  </span>
                  {item.correct ? (
                    <CheckCircle className="text-green-500 shrink-0 w-5 h-5 landscape:w-4 landscape:h-4 md:w-7 md:h-7 md:landscape:w-6 md:landscape:h-6 lg:w-7 lg:h-7" />
                  ) : (
                    <XCircle className="text-red-500 shrink-0 w-5 h-5 landscape:w-4 landscape:h-4 md:w-7 md:h-7 md:landscape:w-6 md:landscape:h-6 lg:w-7 lg:h-7" />
                  )}
                  <span className="font-semibold text-xl landscape:text-base md:text-2xl md:landscape:text-xl lg:text-2xl text-gray-700 flex-1">
                    {item.sound || 'Unknown'}
                  </span>
                  <button
                    onClick={() => speakWord(item.sound)}
                    className="speaker-button shrink-0"
                    title="Play word"
                  >
                    <Volume2 className="text-[#ae90fd] w-6 h-6 landscape:w-5 landscape:h-5 md:w-7 md:h-7 md:landscape:w-6 md:landscape:h-6 lg:w-7 lg:h-7" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-400 py-4 landscape:py-2 md:py-6 lg:py-8">
              No results to display
            </div>
          )}
        </div>

        {/* Stats Section */}
        {showStats && (
          <div className="mascot-bounce-in mt-2 landscape:mt-1 md:mt-4 md:landscape:mt-2 lg:mt-4 shrink-0">
            {isCompetitionMode ? (
              <div className="text-center p-2 landscape:p-1.5 md:p-3 md:landscape:p-2 lg:p-3 rounded-xl landscape:rounded-lg md:rounded-2xl lg:rounded-2xl bg-gradient-to-r from-blue-900/30 to-sky-900/30 border-2 border-blue-500/30">
                <div className="flex items-center justify-center gap-2 md:gap-3 lg:gap-3">
                  <Trophy className="text-[#ffd700] w-6 h-6 landscape:w-5 landscape:h-5 md:w-8 md:h-8 md:landscape:w-6 md:landscape:h-6 lg:w-8 lg:h-8" />
                  <div>
                    <span className="text-lg landscape:text-base md:text-2xl md:landscape:text-xl lg:text-2xl font-bold text-[#4d79ff]">
                      Complete!
                    </span>
                    <span className="text-gray-600 ml-2 md:ml-3 lg:ml-3 text-sm landscape:text-xs md:text-base md:landscape:text-sm lg:text-base">
                      {resultsData.length} questions
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-center p-2 landscape:p-1.5 md:p-3 md:landscape:p-2 lg:p-3 rounded-xl landscape:rounded-lg md:rounded-2xl lg:rounded-2xl ${
                percentage >= 90
                  ? 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-2 border-yellow-500/30'
                  : percentage >= 70
                    ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-500/30'
                    : 'bg-gradient-to-r from-blue-900/30 to-sky-900/30 border-2 border-blue-500/30'
              }`}>
                <div className="flex items-center justify-center gap-2 md:gap-4 lg:gap-4">
                  {percentage >= 90 && (
                    <Trophy className="text-[#ffd700] w-6 h-6 landscape:w-5 landscape:h-5 md:w-8 md:h-8 md:landscape:w-6 md:landscape:h-6 lg:w-8 lg:h-8" />
                  )}
                  <div>
                    <span className="text-2xl landscape:text-xl md:text-4xl md:landscape:text-3xl lg:text-4xl font-bold text-[#4d79ff]">
                      {percentage}%
                    </span>
                    <span className="text-gray-600 ml-2 md:ml-3 lg:ml-3 text-sm landscape:text-xs md:text-base md:landscape:text-sm lg:text-base">
                      {correctCount} / {resultsData.length} correct
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        {showStats && (
          <div className="flex justify-center gap-2 landscape:gap-2 md:gap-4 md:landscape:gap-3 lg:gap-4 mt-2 landscape:mt-1 md:mt-4 md:landscape:mt-2 lg:mt-4 shrink-0">
            <button
              onClick={onRestart}
              className="flex items-center justify-center gap-1 md:gap-2 lg:gap-2 px-4 landscape:px-3 md:px-6 md:landscape:px-5 lg:px-6 py-2 landscape:py-1.5 md:py-3 md:landscape:py-2 lg:py-3 bg-[#ae90fd] text-white rounded-full font-bold hover:bg-[#c4b0ff] transition-all shadow-lg text-sm landscape:text-xs md:text-base lg:text-base"
            >
              <RotateCcw className="w-4 h-4 landscape:w-3 landscape:h-3 md:w-5 md:h-5 lg:w-5 lg:h-5" />
              Try Again
            </button>
            <button
              onClick={onHome}
              className="flex items-center justify-center gap-1 md:gap-2 lg:gap-2 px-4 landscape:px-3 md:px-6 md:landscape:px-5 lg:px-6 py-2 landscape:py-1.5 md:py-3 md:landscape:py-2 lg:py-3 bg-[#ae90fd] text-white rounded-full font-bold hover:bg-[#c4b0ff] transition-all shadow-lg text-sm landscape:text-xs md:text-base lg:text-base"
            >
              <Home className="w-4 h-4 landscape:w-3 landscape:h-3 md:w-5 md:h-5 lg:w-5 lg:h-5" />
              Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPop;
