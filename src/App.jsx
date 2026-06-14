import React, { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import './App.css';
import InAppBrowserGuard from './components/shared/InAppBrowserGuard';
import { MuteProvider } from './contexts/MuteContext';
import SplashScreen from './components/shared/SplashScreen';
import CurriculumMap from './components/curriculum/CurriculumMap';
import TeachingFlow from './components/teaching/TeachingFlow';
import LandscapePrompt from './components/shared/LandscapePrompt';
import { playVO } from './utils/audioPlayer';
import { preloadGroup } from './utils/assetHelpers';

// Lazy-loaded game components — only fetched when user enters a game
const PlaygroundHub = lazy(() => import('./components/playground/PlaygroundHub'));
const MagicFlashlight = lazy(() => import('./components/playground/games/MagicFlashlight'));
const BubbleSpell = lazy(() => import('./components/playground/games/BubbleSpell'));
const MonsterFeeder = lazy(() => import('./components/playground/games/MonsterFeeder'));
const WhackASound = lazy(() => import('./components/playground/games/WhackASound'));
const CatchTheDrop = lazy(() => import('./components/playground/games/CatchTheDrop'));
const BouncyMemory = lazy(() => import('./components/playground/games/BouncyMemory'));
const ShadowMatch = lazy(() => import('./components/playground/games/ShadowMatch'));
const LilyPadHop = lazy(() => import('./components/playground/games/LilyPadHop'));
const MagicSandTracing = lazy(() => import('./components/playground/games/MagicSandTracing'));
const CarnivalWheel = lazy(() => import('./components/playground/games/CarnivalWheel'));
const ScratchDiscover = lazy(() => import('./components/playground/games/ScratchDiscover'));
const HungryFrogs = lazy(() => import('./components/playground/games/HungryFrogs'));
// const PhonicsSpellGame = lazy(() => import('./components/playground/games/PhonicsSpellGame'));

// Eagerly fetch all game chunks so selecting a game is instant
const preloadAllGames = () => {
  import('./components/playground/games/MagicFlashlight');
  import('./components/playground/games/BubbleSpell');
  import('./components/playground/games/MonsterFeeder');
  import('./components/playground/games/WhackASound');
  import('./components/playground/games/CatchTheDrop');
  import('./components/playground/games/BouncyMemory');
  import('./components/playground/games/ShadowMatch');
  import('./components/playground/games/LilyPadHop');
  import('./components/playground/games/MagicSandTracing');
  import('./components/playground/games/CarnivalWheel');
  import('./components/playground/games/ScratchDiscover');
  import('./components/playground/games/HungryFrogs');
};

// Increment this manually when you want to force a cache reset on deployed versions
const APP_VERSION = "2.5.73";

// Keys to preserve across version upgrades (progress data survives cache busts)
const PRESERVED_KEYS = ['last_installed_version', 'wp_progress'];

// Loading fallback for lazy-loaded components
const GameLoader = () => (
  <div className="fixed inset-0 bg-[#1a1147] flex items-center justify-center z-50">
    <div className="text-white text-2xl animate-pulse">Loading...</div>
  </div>
);

function App() {
  // Force refresh mechanism: clear cache when a new version is deployed
  useEffect(() => {
    const lastVersion = localStorage.getItem('last_installed_version');
    if (lastVersion !== APP_VERSION) {
      // Save the new version first to prevent reload loops
      localStorage.setItem('last_installed_version', APP_VERSION);

      // Clear all other localStorage keys (preserve progress data)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!PRESERVED_KEYS.includes(key)) {
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
  const [appStarted, setAppStarted] = useState(false);

  const handleSplashTap = useCallback(() => {
    setAppStarted(true);
    playVO('Welcome to Wonder Phonics!');
    // Non-blocking — don't let fullscreen/orientation delay the transition
    document.documentElement.requestFullscreen?.().catch(() => {});
    window.screen.orientation?.lock?.('landscape').catch(() => {});
  }, []);

  const handleSelectGroup = useCallback((group) => {
    window.speechSynthesis.cancel();
    preloadGroup(group.id);
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
    preloadGroup(group.id);
    preloadAllGames();
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

  // If app hasn't started yet, show splash screen only (no landscape enforcement)
  if (!appStarted) {
    return (
      <InAppBrowserGuard>
        <SplashScreen onStart={handleSplashTap} />
      </InAppBrowserGuard>
    );
  }

  return (
    <MuteProvider>
    <LandscapePrompt />
    <InAppBrowserGuard>
      <div className="min-h-screen bg-[#1a1147]">
        {screen === 'curriculum' && (
          <CurriculumMap
            onSelectGroup={handleSelectGroup}
            onOpenPlayground={handleOpenPlayground}
            initialLevel={returnToGroups ? (selectedGroup?.level || 1) : null}
            onLevelReset={() => setReturnToGroups(false)}
            skipSplash={true}
          />
        )}

        {screen === 'teaching' && selectedGroup && (
          <TeachingFlow
            group={selectedGroup}
            onExit={handleExitTeaching}
            onOpenPlayground={() => {
              setActiveGame(null);
              setScreen('playground');
            }}
          />
        )}

        <Suspense fallback={<GameLoader />}>
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

        {screen === 'playground' && selectedGroup && activeGame === 'shadow-match' && (
          <ShadowMatch group={selectedGroup} onBack={() => setActiveGame(null)} />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'lily-pad-hop' && (
          <LilyPadHop group={selectedGroup} onBack={() => setActiveGame(null)} />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'sand-tracing' && (
          <MagicSandTracing group={selectedGroup} onBack={() => setActiveGame(null)} />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'carnival-wheel' && (
          <CarnivalWheel group={selectedGroup} onBack={() => setActiveGame(null)} />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'scratch-discover' && (
          <ScratchDiscover group={selectedGroup} onBack={() => setActiveGame(null)} />
        )}

        {screen === 'playground' && selectedGroup && activeGame === 'hungry-frogs' && (
          <HungryFrogs group={selectedGroup} onBack={() => setActiveGame(null)} />
        )}
        </Suspense>
      </div>
    </InAppBrowserGuard>
    </MuteProvider>
  );
}

export default App;
