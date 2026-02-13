import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, X, Maximize } from 'lucide-react';
import questions from '../data/questions';
import {
  getSetQuestions,
  COMPETITION_TOTAL_TIME,
  COMPETITION_MS_PER_QUESTION,
  COMPETITION_SPEECH_RATE
} from '../data/sets';
import { getBestVoice, speakWithVoice } from '../utils/speech';

// ============================================
// WEB AUDIO API SOUND EFFECTS
// Shared AudioContext to avoid browser limits
// ============================================

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

const playStartBuzz = () => {
  try {
    const audioContext = getAudioContext();
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator1.frequency.value = 440;
    oscillator2.frequency.value = 554;
    oscillator1.type = 'square';
    oscillator2.type = 'square';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.4);
    oscillator2.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};

const playClick = () => {
  try {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1200;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};

const playCorrect = () => {
  try {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};

const playIncorrect = () => {
  try {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};

// ============================================
// PRACTICE MODE: Create 300-word pool
// ============================================

const createPracticePool = () => {
  const pool = [];

  questions.forEach((q) => {
    q.choices.forEach((word, wordIndex) => {
      pool.push({
        id: `${q.id}-${wordIndex}`,
        originalQuestionId: q.id,
        sound: word,
        choices: q.choices,
        correctIndex: wordIndex,
      });
    });
  });

  return pool;
};

const shuffleArray = (arr) => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const selectUniqueTargets = (pool, count) => {
  const shuffled = shuffleArray(pool);
  const selected = [];
  const usedWords = new Set();

  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (!usedWords.has(item.sound)) {
      usedWords.add(item.sound);

      // Shuffle the choices and update correctIndex so answer isn't always in same position
      const correctWord = item.sound;
      const shuffledChoices = shuffleArray([...item.choices]);
      const newCorrectIndex = shuffledChoices.indexOf(correctWord);

      selected.push({
        ...item,
        choices: shuffledChoices,
        correctIndex: newCorrectIndex,
      });
    }
  }

  return selected;
};

// Fullscreen functions
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

// Format time as M:SS
const formatTime = (seconds) => {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// EXIT CONFIRMATION MODAL
// ============================================
const ExitModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div
        className="rounded-[2rem] shadow-2xl p-8 max-w-md mx-4 text-center"
        style={{ background: 'linear-gradient(150deg, #f0f7ff 65%, #e6f0ff 100%)' }}
      >
        <h2 className="text-2xl font-bold text-[#3e366b] mb-4">
          Exit Competition?
        </h2>
        <p className="text-gray-600 mb-8">
          Are you sure you want to exit the competition? Your progress will be lost.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-8 py-3 bg-gray-200 text-gray-700 rounded-full font-bold hover:bg-gray-300 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-8 py-3 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-all"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const PhonicsGame = ({ settings, onFinish, onExit }) => {
  const [phase, setPhase] = useState('countdown');
  const [countdown, setCountdown] = useState(4);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gameQuestions, setGameQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [canAnswer, setCanAnswer] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isPC, setIsPC] = useState(false);

  // Competition states
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(COMPETITION_TOTAL_TIME);

  const voiceRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const hasPlayedStartBuzz = useRef(false);
  const blitzTimerRef = useRef(null);
  const questionIntervalRef = useRef(null);
  const speechDelayTimeoutRef = useRef(null); // Track the 500ms delay between number and word
  const resultsRef = useRef([]);
  const startTimeRef = useRef(null);
  const competitionStoppedRef = useRef(false);
  const speechCancelIntervalRef = useRef(null); // Repeated cancel for stubborn speech

  const isCompetition = settings.mode === 'competition';

  // Cancel any previous speech when component mounts
  useEffect(() => {
    window.speechSynthesis.cancel();
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

  // Initialize game questions
  useEffect(() => {
    let selectedQuestions;

    if (isCompetition && settings.setLetter) {
      selectedQuestions = getSetQuestions(settings.setLetter, questions);
    } else {
      const pool = createPracticePool();
      selectedQuestions = selectUniqueTargets(pool, settings.questionCount);
    }

    setGameQuestions(selectedQuestions);
  }, [settings, isCompetition]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      voiceRef.current = getBestVoice();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      competitionStoppedRef.current = true;
      window.speechSynthesis.cancel();
      if (blitzTimerRef.current) clearInterval(blitzTimerRef.current);
      if (questionIntervalRef.current) clearTimeout(questionIntervalRef.current);
      if (speechDelayTimeoutRef.current) clearTimeout(speechDelayTimeoutRef.current);
      if (speechCancelIntervalRef.current) clearInterval(speechCancelIntervalRef.current);
    };
  }, []);

  // Countdown sequence: 3, 2, 1, Go!
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (countdown > 1) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 1) {
      if (!hasPlayedStartBuzz.current) {
        hasPlayedStartBuzz.current = true;
        playStartBuzz();
      }
      const timer = setTimeout(() => setCountdown(0), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setPhase('playing');
    }
  }, [phase, countdown]);

  const getCountdownDisplay = () => {
    if (countdown === 4) return '3';
    if (countdown === 3) return '2';
    if (countdown === 2) return '1';
    if (countdown === 1) return 'Go!';
    return '';
  };

  // Speak number, pause, then speak word - returns callback when speech completes
  // Uses speakWithVoice for fresh high-quality voice every time
  const speakBlitz = useCallback((questionNumber, word, onSpeechComplete) => {
    // Don't speak if competition has stopped
    if (competitionStoppedRef.current) {
      return;
    }

    setIsSpeaking(true);

    // First: speak the question number
    speakWithVoice(String(questionNumber), {
      rate: 1.0,
      onEnd: () => {
        // Don't continue if competition stopped
        if (competitionStoppedRef.current) {
          setIsSpeaking(false);
          return;
        }
        // Pause between number and word (500ms delay)
        speechDelayTimeoutRef.current = setTimeout(() => {
          if (competitionStoppedRef.current) {
            setIsSpeaking(false);
            return;
          }
          // Then: speak the word at slower rate for clarity
          speakWithVoice(word, {
            rate: COMPETITION_SPEECH_RATE,
            onEnd: () => {
              setIsSpeaking(false);
              if (onSpeechComplete && !competitionStoppedRef.current) onSpeechComplete();
            },
            onError: () => {
              setIsSpeaking(false);
              if (onSpeechComplete && !competitionStoppedRef.current) onSpeechComplete();
            },
          });
        }, 500);
      },
      onError: () => {
        setIsSpeaking(false);
        if (onSpeechComplete && !competitionStoppedRef.current) onSpeechComplete();
      },
    });
  }, []);

  // Practice mode speech - uses speakWithVoice for fresh high-quality voice
  const speakText = useCallback((text, onComplete) => {
    speakWithVoice(text, {
      rate: settings.speed,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        if (onComplete) onComplete();
      },
      onError: () => {
        setIsSpeaking(false);
        if (onComplete) onComplete();
      },
    });
  }, [settings.speed]);

  // ============================================
  // EXACT 4-SECOND CYCLE COMPETITION LOGIC
  // ============================================
  const runBlitzCompetition = useCallback(() => {
    if (gameQuestions.length === 0) return;

    startTimeRef.current = Date.now();
    let questionIndex = 0;
    let questionStartTime = 0;

    // Start the main countdown timer (updates every 100ms for smooth display)
    blitzTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, COMPETITION_TOTAL_TIME - elapsed);
      setTotalTimeRemaining(remaining);

      // End when time is up
      if (remaining <= 0) {
        competitionStoppedRef.current = true;
        clearInterval(blitzTimerRef.current);
        blitzTimerRef.current = null;
        if (questionIntervalRef.current) {
          clearTimeout(questionIntervalRef.current);
          questionIntervalRef.current = null;
        }
        if (speechDelayTimeoutRef.current) {
          clearTimeout(speechDelayTimeoutRef.current);
          speechDelayTimeoutRef.current = null;
        }
        window.speechSynthesis.cancel();
        setPhase('competitionFinished');
      }
    }, 100);

    // Function to process each question with EXACT 4-second cycle
    const processQuestion = () => {
      // Check if stopped
      if (competitionStoppedRef.current) {
        return;
      }
      if (questionIndex >= gameQuestions.length) {
        // All questions done
        competitionStoppedRef.current = true;
        if (blitzTimerRef.current) {
          clearInterval(blitzTimerRef.current);
          blitzTimerRef.current = null;
        }
        if (speechDelayTimeoutRef.current) {
          clearTimeout(speechDelayTimeoutRef.current);
          speechDelayTimeoutRef.current = null;
        }
        window.speechSynthesis.cancel();
        setPhase('competitionFinished');
        return;
      }

      const question = gameQuestions[questionIndex];

      // Mark the start time of this question's 4-second cycle
      questionStartTime = Date.now();

      // Update current index for display
      setCurrentIndex(questionIndex);

      // Record result with targetIdx for proper replay in SummaryPop
      const resultItem = {
        questionId: question.id,
        questionNumber: questionIndex + 1,
        choices: question.choices,
        targetIdx: question.targetIdx,
        sound: question.sound,
        isCompetitionMode: true,
      };

      setResults((prev) => {
        const newResults = [...prev, resultItem];
        resultsRef.current = newResults;
        return newResults;
      });

      const currentQuestionIndex = questionIndex;
      questionIndex++;

      // Speak number, pause, then word at targetIdx - callback fires when speech completes
      speakBlitz(currentQuestionIndex + 1, question.sound, () => {
        // Calculate remaining time in the 4-second cycle
        const elapsedInCycle = Date.now() - questionStartTime;
        const remainingInCycle = Math.max(0, COMPETITION_MS_PER_QUESTION - elapsedInCycle);

        // Schedule next question to complete the exact 4-second cycle
        questionIntervalRef.current = setTimeout(processQuestion, remainingInCycle);
      });
    };

    // Start the first question immediately
    processQuestion();
  }, [gameQuestions, speakBlitz]);

  // Start blitz when playing phase begins (competition mode)
  useEffect(() => {
    if (phase === 'playing' && isCompetition && gameQuestions.length > 0) {
      competitionStoppedRef.current = false; // Reset stop flag
      setTotalTimeRemaining(COMPETITION_TOTAL_TIME);
      runBlitzCompetition();
    }
  }, [phase, isCompetition, gameQuestions, runBlitzCompetition]);

  // FORCE STOP everything when competition finishes
  useEffect(() => {
    if (phase === 'competitionFinished') {
      // Ensure stop flag is set
      competitionStoppedRef.current = true;

      // Clear all timers
      if (blitzTimerRef.current) {
        clearInterval(blitzTimerRef.current);
        blitzTimerRef.current = null;
      }
      if (questionIntervalRef.current) {
        clearTimeout(questionIntervalRef.current);
        questionIntervalRef.current = null;
      }
      if (speechDelayTimeoutRef.current) {
        clearTimeout(speechDelayTimeoutRef.current);
        speechDelayTimeoutRef.current = null;
      }
      if (speechCancelIntervalRef.current) {
        clearInterval(speechCancelIntervalRef.current);
        speechCancelIntervalRef.current = null;
      }

      // Force cancel speech immediately
      window.speechSynthesis.cancel();

      // Set up a repeated cancel interval to catch any stubborn speech
      // This will run every 100ms for 2 seconds to ensure speech is killed
      let cancelCount = 0;
      speechCancelIntervalRef.current = setInterval(() => {
        window.speechSynthesis.cancel();
        cancelCount++;
        if (cancelCount >= 20) { // 2 seconds worth
          clearInterval(speechCancelIntervalRef.current);
          speechCancelIntervalRef.current = null;
        }
      }, 100);
    }

    // Cleanup on unmount
    return () => {
      if (speechCancelIntervalRef.current) {
        clearInterval(speechCancelIntervalRef.current);
        speechCancelIntervalRef.current = null;
      }
    };
  }, [phase]);

  // Practice mode: Speak current word
  const speakWord = useCallback(() => {
    if (gameQuestions.length === 0 || currentIndex >= gameQuestions.length) return;

    const word = gameQuestions[currentIndex].sound;
    speakText(word, () => {
      setCanAnswer(true);
    });
  }, [gameQuestions, currentIndex, speakText]);

  // Handle question changes (practice mode only)
  useEffect(() => {
    if (phase !== 'playing' || gameQuestions.length === 0 || isCompetition) return;

    if (!hasSpokenRef.current) {
      hasSpokenRef.current = true;
      setCanAnswer(false);
      const timer = setTimeout(speakWord, 300);
      return () => clearTimeout(timer);
    }
  }, [phase, currentIndex, gameQuestions, isCompetition, speakWord]);

  // Reset hasSpoken when index changes (practice mode)
  useEffect(() => {
    if (!isCompetition) {
      hasSpokenRef.current = false;
    }
  }, [currentIndex, isCompetition]);

  // Handle answer selection (Practice mode only)
  const handleAnswer = (choiceIndex) => {
    if (!canAnswer || feedback || isCompetition) return;

    playClick();

    const question = gameQuestions[currentIndex];
    const isCorrect = choiceIndex === question.correctIndex;

    if (isCorrect) {
      playCorrect();
    } else {
      playIncorrect();
    }

    const resultItem = {
      questionId: question.id,
      questionNumber: currentIndex + 1,
      sound: question.sound,
      correct: isCorrect,
      userAnswer: question.choices[choiceIndex],
      correctAnswer: question.choices[question.correctIndex],
      isCompetitionMode: false,
    };

    setResults((prev) => {
      const newResults = [...prev, resultItem];
      resultsRef.current = newResults;
      return newResults;
    });

    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
      setFeedback(null);
      setCanAnswer(false);
      hasSpokenRef.current = false;

      if (currentIndex + 1 >= gameQuestions.length) {
        setPhase('finished');
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }, 800);
  };

  // Handle replay sound (Practice mode only)
  const handleReplay = () => {
    if (!isSpeaking && canAnswer && !isCompetition) {
      speakWord();
    }
  };

  // Handle exit button click
  const handleExitClick = () => {
    if (isCompetition && phase === 'playing') {
      setShowExitModal(true);
    } else {
      // Set stop flag and cancel speech and timers before exiting
      competitionStoppedRef.current = true;
      window.speechSynthesis.cancel();
      if (blitzTimerRef.current) clearInterval(blitzTimerRef.current);
      if (questionIntervalRef.current) clearTimeout(questionIntervalRef.current);
      if (speechDelayTimeoutRef.current) clearTimeout(speechDelayTimeoutRef.current);
      if (speechCancelIntervalRef.current) clearInterval(speechCancelIntervalRef.current);
      onExit();
    }
  };

  // Handle exit confirmation
  const handleExitConfirm = () => {
    // Set stop flag and clean up all timers
    competitionStoppedRef.current = true;
    if (blitzTimerRef.current) clearInterval(blitzTimerRef.current);
    if (questionIntervalRef.current) clearTimeout(questionIntervalRef.current);
    if (speechDelayTimeoutRef.current) clearTimeout(speechDelayTimeoutRef.current);
    if (speechCancelIntervalRef.current) clearInterval(speechCancelIntervalRef.current);
    window.speechSynthesis.cancel();
    setShowExitModal(false);
    onExit();
  };

  // Handle show answer key button click (Competition mode)
  const handleShowAnswerKey = () => {
    const finalResults = resultsRef.current.length > 0 ? resultsRef.current : results;
    onFinish(finalResults);
  };

  // Finish game for practice mode
  useEffect(() => {
    if (phase === 'finished') {
      const finalResults = resultsRef.current.length > 0 ? resultsRef.current : results;
      onFinish(finalResults);
    }
  }, [phase, results, onFinish]);

  const currentQuestion = gameQuestions[currentIndex] || gameQuestions[0];
  const progress = gameQuestions.length > 0
    ? ((currentIndex + 1) / gameQuestions.length) * 100
    : 0;

  // ============================================
  // COUNTDOWN SCREEN
  // ============================================
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#d8e9fa]">
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
            title="Toggle Fullscreen"
          >
            <Maximize size={24} className="text-[#3e366b]" />
          </button>
          <button
            onClick={handleExitClick}
            className="p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
            title="Exit"
          >
            <X size={24} className="text-[#3e366b]" />
          </button>
        </div>

        <div className="text-center">
          <p className="text-3xl text-gray-500 mb-8 fade-in">
            {isCompetition ? `Get Ready! Set ${settings.setLetter}` : 'Get Ready!'}
          </p>
          <div
            key={countdown}
            className="countdown-number text-[30vh] font-bold"
            style={{ color: countdown === 1 ? '#fd90d7' : '#4d79ff' }}
          >
            {getCountdownDisplay()}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // COMPETITION FINISHED SCREEN
  // ============================================
  if (phase === 'competitionFinished') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#d8e9fa] p-2">
        <div className="fixed top-2 right-2 landscape:top-1 landscape:right-1 md:top-3 md:right-3 lg:top-4 lg:right-4 z-50 flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 md:p-3 lg:p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-5 h-5 md:w-6 md:h-6 lg:w-6 lg:h-6 text-[#3e366b]" />
          </button>
        </div>

        <div
          className="text-center p-6 landscape:p-4 landscape:py-3 md:p-10 md:landscape:p-6 lg:p-12 rounded-2xl landscape:rounded-xl md:rounded-3xl lg:rounded-[2.7rem] shadow-xl max-w-2xl mx-2 md:mx-4 lg:mx-4"
          style={{ background: 'linear-gradient(150deg, #f0f7ff 65%, #e6f0ff 100%)' }}
        >
          <div className="text-5xl landscape:text-3xl md:text-7xl md:landscape:text-5xl lg:text-8xl mb-3 landscape:mb-1 md:mb-5 lg:mb-6">🏆</div>
          <h1 className="text-3xl landscape:text-2xl md:text-5xl md:landscape:text-3xl lg:text-6xl font-bold text-[#3e366b] mb-2 landscape:mb-1 md:mb-3 lg:mb-4">
            Time's Up!
          </h1>
          <p className="text-lg landscape:text-base md:text-2xl md:landscape:text-xl lg:text-2xl text-gray-500 mb-2 landscape:mb-1 md:mb-3 lg:mb-4">
            Set {settings.setLetter} Complete
          </p>
          <p className="text-base landscape:text-sm md:text-xl md:landscape:text-lg lg:text-xl text-[#4d79ff] font-bold mb-4 landscape:mb-2 md:mb-6 lg:mb-8">
            {resultsRef.current.length} questions played
          </p>
          <p className="text-sm landscape:text-xs md:text-lg md:landscape:text-base lg:text-lg text-gray-400 mb-4 landscape:mb-2 md:mb-8 lg:mb-10">
            Students can now check their answer sheets
          </p>

          <button
            onClick={handleShowAnswerKey}
            className="px-8 landscape:px-6 md:px-10 md:landscape:px-8 lg:px-12 py-3 landscape:py-2 md:py-4 md:landscape:py-3 lg:py-5 text-lg landscape:text-base md:text-xl md:landscape:text-lg lg:text-2xl font-bold bg-[#4d79ff] text-white rounded-full hover:bg-[#3d69ef] transition-all shadow-lg"
          >
            Show Answers
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN GAME SCREEN - FIXED LAYOUT (NO SHIFTS)
  // ============================================
  if (phase === 'playing' && currentQuestion) {
    return (
      <div className="h-screen flex flex-col bg-[#d8e9fa] overflow-hidden">
        {/* Exit Modal */}
        {showExitModal && (
          <ExitModal
            onConfirm={handleExitConfirm}
            onCancel={() => setShowExitModal(false)}
          />
        )}

        {/* Top Right Buttons - Fixed Position (Fullscreen left, Exit right) */}
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
            title="Toggle Fullscreen"
          >
            <Maximize size={24} className="text-[#3e366b]" />
          </button>
          <button
            onClick={handleExitClick}
            className="p-3 rounded-full bg-[#b4d7ff] hover:bg-[#9fc9ff] transition-all shadow-lg"
            title="Exit"
          >
            <X size={24} className="text-[#3e366b]" />
          </button>
        </div>

        {/* Top Bar - Phone: normal, Phone Landscape: compact, Tablet: bigger, Desktop: full */}
        <div className="shrink-0 p-3 landscape:p-1 landscape:px-2 md:p-4 md:landscape:p-2 md:landscape:px-3 lg:p-6">
          <div className="flex flex-col max-w-[50%] landscape:max-w-[45%] md:max-w-[50%] lg:max-w-lg">
            {/* Question Counter & Mode */}
            <div className="flex items-center gap-3 landscape:gap-2 md:gap-4 lg:gap-4 mb-1 landscape:mb-0.5 md:mb-2 lg:mb-2">
              <span className="text-2xl landscape:text-xl md:text-3xl md:landscape:text-2xl lg:text-3xl font-bold text-[#3e366b]">
                Q{currentIndex + 1} / {gameQuestions.length}
              </span>
              <span className="text-base landscape:text-base md:text-xl md:landscape:text-lg lg:text-xl text-gray-500">
                {isCompetition ? `Set ${settings.setLetter}` : 'Practice'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 landscape:h-1.5 md:h-3 md:landscape:h-2 lg:h-3 bg-gray-200 rounded-full overflow-hidden mb-1 landscape:mb-0 md:mb-2 md:landscape:mb-1 lg:mb-2">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #ae90fd 0%, #4d79ff 50%, #ffd700 100%)'
                }}
              />
            </div>

            {/* Timer - Competition Only - Pulses red at last 10 seconds */}
            {isCompetition && (
              <div className={`flex items-center gap-2 px-4 py-1.5 landscape:px-3 landscape:py-1 landscape:mt-1 md:px-5 md:py-2 md:landscape:px-4 md:landscape:py-1.5 md:landscape:mt-1 lg:px-6 lg:py-3 rounded-full w-fit transition-colors ${
                totalTimeRemaining <= 10
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-[#ffd700]'
              }`}>
                <span className={`text-2xl landscape:text-xl md:text-3xl md:landscape:text-2xl lg:text-4xl font-bold ${
                  totalTimeRemaining <= 10 ? 'text-white animate-pulse' : 'text-[#3e366b]'
                }`}>
                  {formatTime(totalTimeRemaining)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - CARDS are the center focus, speaker above */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div
            className="flex flex-col items-center"
            style={isPC
              ? { marginTop: '-5vh' }
              : { marginTop: '-8vh' }
            }
          >
            {/* Speaker Icon - small, above cards */}
            <div
              className="flex items-center justify-center shrink-0"
              style={{ marginBottom: isPC ? '2rem' : 'min(5vw, 28px)' }}
            >
              {isCompetition ? (
                <div
                  className={`rounded-full bg-white/50 ${isSpeaking ? 'speaker-pulse' : ''}`}
                  style={{ padding: isPC ? '1rem' : 'min(2.5vw, 12px)' }}
                >
                  <Volume2
                    style={{
                      width: isPC ? 70 : 'min(10vw, 44px)',
                      height: isPC ? 70 : 'min(10vw, 44px)',
                      color: '#ae90fd'
                    }}
                    strokeWidth={1.5}
                  />
                </div>
              ) : (
                <button
                  onClick={handleReplay}
                  disabled={isSpeaking}
                  className={`rounded-full bg-white/50 hover:bg-white/80 transition-all ${
                    isSpeaking ? 'speaker-pulse' : ''
                  }`}
                  style={{ padding: isPC ? '1rem' : 'min(2.5vw, 12px)' }}
                >
                  <Volume2
                    style={{
                      width: isPC ? 60 : 'min(9vw, 40px)',
                      height: isPC ? 60 : 'min(9vw, 40px)',
                      color: '#ae90fd'
                    }}
                    strokeWidth={1.5}
                  />
                </button>
              )}
            </div>

            {/* Instruction Text */}
            {!isCompetition && (
              <div
                className="flex items-center justify-center shrink-0 text-gray-500"
                style={{
                  marginBottom: isPC ? '1.5rem' : 'min(4vw, 20px)',
                  fontSize: isPC ? '1.25rem' : 'min(4vw, 18px)'
                }}
              >
                {isSpeaking ? 'Listen carefully...' : 'Tap the correct word!'}
              </div>
            )}

            {/* Choice Cards - THE MAIN CONTENT at eye level */}
            <div
              className="grid grid-cols-3 shrink-0"
              style={{
                gap: isPC ? '2rem' : 'min(4vw, 20px)',
                width: isPC ? '56rem' : 'min(88vw, 420px)',
                padding: isPC ? '0 1rem' : '0'
              }}
            >
              {currentQuestion.choices.map((choice, index) => {
                let cardClass = 'shadow-lg transition-colors aspect-square';

                if (!isCompetition) {
                  cardClass += ' cursor-pointer hover:scale-105 transition-transform';

                  if (feedback) {
                    if (index === currentQuestion.correctIndex) {
                      cardClass += ' correct-flash';
                    } else if (feedback === 'incorrect' && results[results.length - 1]?.userAnswer === choice) {
                      cardClass += ' incorrect-flash';
                    }
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => !isCompetition && handleAnswer(index)}
                    disabled={isCompetition || !canAnswer || feedback}
                    className={`${cardClass} flex items-center justify-center`}
                    style={{
                      background: 'linear-gradient(150deg, #f0f7ff 65%, #e6f0ff 100%)',
                      padding: isPC ? '1.5rem' : 'min(3vw, 14px)',
                      borderRadius: isPC ? '2rem' : 'min(4vw, 18px)'
                    }}
                  >
                    <span
                      className="font-bold text-gray-700 text-center leading-none"
                      style={{ fontSize: isPC ? '9vh' : 'min(9vw, 52px)' }}
                    >
                      {choice}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#d8e9fa]">
      <div className="text-2xl text-gray-500">Loading...</div>
    </div>
  );
};

export default PhonicsGame;
