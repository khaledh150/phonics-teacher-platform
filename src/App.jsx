import React, { useState, useCallback } from 'react';
import './App.css';
import InAppBrowserGuard from './components/InAppBrowserGuard';
import SettingsView from './components/SettingsView';
import PhonicsGame from './components/PhonicsGame';
import SummaryPop from './components/SummaryPop';
import LearnScreen from './components/LearnScreen';
import questions from './data/questions';
import { getSetQuestions } from './data/sets';

// Helper to get words for Learn Mode
const getLearnWords = (settings) => {
  // If a set is selected, use those words
  if (settings.setLetter) {
    const setQuestions = getSetQuestions(settings.setLetter, questions);
    return setQuestions.map(q => q.sound);
  }

  // Otherwise, filter by category
  const allWords = new Set();
  questions.forEach(q => q.choices.forEach(word => allWords.add(word)));
  const wordList = Array.from(allWords);

  switch (settings.learnCategory) {
    case 'cvc':
      // CVC words (3 letters, consonant-vowel-consonant)
      return wordList.filter(w => w.length === 3 && /^[^aeiou][aeiou][^aeiou]$/i.test(w));
    case 'digraphs':
      // Words with digraphs (sh, ch, th, wh, ph)
      return wordList.filter(w => /(sh|ch|th|wh|ph)/i.test(w));
    case 'magic-e':
      // Magic-e words (CVCe pattern)
      return wordList.filter(w => w.length >= 4 && /[aeiou].*e$/i.test(w));
    default:
      // All words
      return wordList;
  }
};

function App() {
  const [screen, setScreen] = useState('settings'); // settings, game, summary, learn
  const [gameSettings, setGameSettings] = useState(null);
  const [gameResults, setGameResults] = useState([]);
  const [learnWords, setLearnWords] = useState([]);
  // State persistence: remember last used settings for when user exits mid-game
  const [lastUsedSettings, setLastUsedSettings] = useState(null);

  const handleStartGame = useCallback((settings) => {
    setGameSettings(settings);
    setLastUsedSettings(settings); // Save for state persistence

    if (settings.mode === 'learn') {
      const words = getLearnWords(settings);
      setLearnWords(words);
      setScreen('learn');
    } else {
      setScreen('game');
    }
  }, []);

  const handleGameFinish = useCallback((results) => {
    setGameResults(results);
    setScreen('summary');
  }, []);

  const handleRestart = useCallback(() => {
    setScreen('game');
  }, []);

  const handleGoHome = useCallback(() => {
    setGameSettings(null);
    setGameResults([]);
    setLastUsedSettings(null); // Clear persisted settings
    setScreen('settings');
  }, []);

  // Exit game - preserves settings so user returns to settings with previous selections
  const handleExitGame = useCallback(() => {
    // Note: The confirmation modal is now handled in PhonicsGame for competition mode
    // For practice mode, PhonicsGame still uses window.confirm before calling this
    setGameSettings(null);
    setGameResults([]);
    setLearnWords([]);
    // Keep lastUsedSettings intact so SettingsView can use it
    setScreen('settings');
  }, []);

  // Exit learn mode
  const handleExitLearn = useCallback(() => {
    setGameSettings(null);
    setLearnWords([]);
    setScreen('settings');
  }, []);

  return (
    <InAppBrowserGuard>
    <div className="min-h-screen bg-[#d8e9fa]">
      {screen === 'settings' && (
        <SettingsView
          onStartGame={handleStartGame}
          initialSettings={lastUsedSettings}
        />
      )}

      {screen === 'game' && gameSettings && (
        <PhonicsGame
          settings={gameSettings}
          onFinish={handleGameFinish}
          onExit={handleExitGame}
        />
      )}

      {screen === 'summary' && (
        <SummaryPop
          results={gameResults}
          onRestart={handleRestart}
          onHome={handleGoHome}
        />
      )}

      {screen === 'learn' && learnWords.length > 0 && (
        <LearnScreen
          words={learnWords}
          onExit={handleExitLearn}
        />
      )}
    </div>
    </InAppBrowserGuard>
  );
}

export default App;
