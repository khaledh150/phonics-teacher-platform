import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setVOMuted } from '../utils/audioPlayer';

const MuteContext = createContext({ voMuted: false, toggleVoMute: () => {} });

export const MuteProvider = ({ children }) => {
  const [voMuted, setVoMuted] = useState(false);

  // Sync React state with global audioPlayer flag
  useEffect(() => {
    setVOMuted(voMuted);
  }, [voMuted]);

  const toggleVoMute = useCallback(() => setVoMuted((m) => !m), []);

  return (
    <MuteContext.Provider value={{ voMuted, toggleVoMute }}>
      {children}
    </MuteContext.Provider>
  );
};

export const useMute = () => useContext(MuteContext);
