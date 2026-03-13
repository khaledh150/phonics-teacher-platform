import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import InAppBrowserGuard from './components/InAppBrowserGuard';
import CurriculumMap from './components/CurriculumMap';
import TeachingFlow from './components/TeachingFlow';

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

  const [screen, setScreen] = useState('curriculum'); // curriculum, teaching
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [returnToGroups, setReturnToGroups] = useState(false);

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

  return (
    <InAppBrowserGuard>
      <div className="min-h-screen bg-[#d8e9fa]">
        {screen === 'curriculum' && (
          <CurriculumMap
            onSelectGroup={handleSelectGroup}
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
      </div>
    </InAppBrowserGuard>
  );
}

export default App;
