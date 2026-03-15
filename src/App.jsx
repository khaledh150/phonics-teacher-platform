import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import InAppBrowserGuard from './components/InAppBrowserGuard';
import CurriculumMap from './components/CurriculumMap';
import TeachingFlow from './components/TeachingFlow';
import PlaygroundHub from './components/PlaygroundHub';
import MagicFlashlight from './components/games/MagicFlashlight';
import BubbleSpell from './components/games/BubbleSpell';
import MonsterFeeder from './components/games/MonsterFeeder';
import WhackASound from './components/games/WhackASound';
import CatchTheDrop from './components/games/CatchTheDrop';
import BouncyMemory from './components/games/BouncyMemory';

// Increment this manually when you want to force a cache reset on deployed versions
const APP_VERSION = "2.0.0";

function App() {
  // Force refresh mechanism: clear cache when a new version is deployed
  useEffect(() => {
    const lastVersion = localStorage.getItem('last_installed_version');
    if (lastVersion !== APP_VERSION) {
      // Save the new version first to prevent reload loops
      localStorage.setItem('last_installed_version', APP_VERSION);

      // Clear all other localStorage keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== 'last_installed_version') {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
      }

      // Force a hard refresh (only if this isn't the first install)
      if (lastVersion !== null) {
        window.location.reload(true);
        return;
      }
    }
  }, []);

  const [screen, setScreen] = useState('curriculum'); // curriculum, teaching, playground
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [returnToGroups, setReturnToGroups] = useState(false);
  const [activeGame, setActiveGame] = useState(null);

  const handleSelectGroup = useCallback((group) => {
    window.speechSynthesis.cancel();
    setSelectedGroup(group);
    setScreen('teaching');
  }, []);

  const handleExitTeaching = useCallback(() => {
    window.speechSynthesis.cancel();
    setSelectedGroup(null);
    setReturnToGroups(true);
    setScreen('curriculum');
  }, []);

  const handleOpenPlayground = useCallback((group) => {
    window.speechSynthesis.cancel();
    setSelectedGroup(group);
    setActiveGame(null);
    setScreen('playground');
  }, []);

  const handleExitPlayground = useCallback(() => {
    window.speechSynthesis.cancel();
    setSelectedGroup(null);
    setActiveGame(null);
    setReturnToGroups(true);
    setScreen('curriculum');
  }, []);

  return (
    <InAppBrowserGuard>
      <div className="min-h-screen bg-[#d8e9fa]">
        {screen === 'curriculum' && (
          <CurriculumMap
            onSelectGroup={handleSelectGroup}
            onOpenPlayground={handleOpenPlayground}
            initialLevel={returnToGroups ? 1 : null}
            onLevelReset={() => setReturnToGroups(false)}
          />
        )}

        {screen === 'teaching' && selectedGroup && (
          <TeachingFlow
            group={selectedGroup}
            onExit={handleExitTeaching}
          />
        )}

        {screen === 'playground' && selectedGroup && !activeGame && (
          <PlaygroundHub
            group={selectedGroup}
            onBack={handleExitPlayground}
            onSelectGame={(gameId) => setActiveGame(gameId)}
          />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'flashlight' && (
          <MagicFlashlight
            group={selectedGroup}
            onBack={() => setActiveGame(null)}
          />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'bubble-spell' && (
          <BubbleSpell
            group={selectedGroup}
            onBack={() => setActiveGame(null)}
          />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'monster-feeder' && (
          <MonsterFeeder
            group={selectedGroup}
            onBack={() => setActiveGame(null)}
          />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'whack-a-sound' && (
          <WhackASound
            group={selectedGroup}
            onBack={() => setActiveGame(null)}
          />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'catch-drop' && (
          <CatchTheDrop
            group={selectedGroup}
            onBack={() => setActiveGame(null)}
          />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'bouncy-memory' && (
          <BouncyMemory
            group={selectedGroup}
            onBack={() => setActiveGame(null)}
          />
        )}
      </div>
    </InAppBrowserGuard>
  );
}

export default App;
