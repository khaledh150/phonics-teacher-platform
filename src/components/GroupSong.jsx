import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import { getSoundMusic, getSoundVideo } from '../utils/assetHelpers';
import { speakWithVoice } from '../utils/speech';
import { playVO, stopVO, delay } from '../utils/audioPlayer';

const GroupSong = ({ group, onComplete }) => {
  const [currentSoundIdx, setCurrentSoundIdx] = useState(0);
  const [playMode, setPlayMode] = useState('idle'); // idle, playing-all, done
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const sounds = group.sounds;
  const currentSound = sounds[currentSoundIdx];

  const videoSrc = getSoundVideo(group.id, currentSound);
  const musicSrc = getSoundMusic(group.id, currentSound);

  const handleMediaEnd = useCallback(() => {
    if (currentSoundIdx < sounds.length - 1) {
      setCurrentSoundIdx((prev) => prev + 1);
    } else {
      setPlayMode('done');
      onComplete();
    }
  }, [currentSoundIdx, sounds.length, onComplete]);

  // Auto-advance during "playing-all" mode
  useEffect(() => {
    if (playMode !== 'playing-all') return;

    const playCurrentSound = () => {
      if (videoSrc && videoRef.current) {
        videoRef.current.play().catch(() => {});
      } else if (musicSrc && audioRef.current) {
        audioRef.current.play().catch(() => {});
      } else {
        speakWithVoice(currentSound, {
          rate: 0.7,
          onEnd: () => {
            setTimeout(handleMediaEnd, 500);
          },
        });
      }
    };

    const timer = setTimeout(playCurrentSound, 300);
    return () => clearTimeout(timer);
  }, [currentSoundIdx, playMode, videoSrc, musicSrc, currentSound, handleMediaEnd]);

  const handleStartSingAlong = () => {
    setCurrentSoundIdx(0);
    setPlayMode('playing-all');
  };

  const handlePause = () => {
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
    setPlayMode('idle');
  };

  const handleSkipSound = () => {
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
    handleMediaEnd();
  };

  // Play a single sound when tapping its bubble
  const handlePlaySingleSound = (idx) => {
    const sound = sounds[idx];
    setCurrentSoundIdx(idx);

    // If we're in playing-all mode, stop it
    if (playMode === 'playing-all') {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setPlayMode('idle');
    }

    // Use TTS for the individual sound
    speakWithVoice(sound, { rate: 0.7 });
  };

  // VO on mount - async sequenced
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await playVO('Sing along time!');
    };
    run();
    return () => { cancelled = true; stopVO(); };
  }, []);

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Top zone — title + video */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center px-4 md:px-16 lg:px-24"
        style={{ height: '50%', paddingTop: 'clamp(28px, 4vh, 56px)' }}>
        {/* Title */}
        <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-[#3e366b] mb-1 md:mb-2">
          Sing Along!
        </h2>
        <p className="text-[#3e366b]/50 text-xs md:text-sm lg:text-base mb-2 md:mb-4">
          Tap a sound to hear it, or Sing All
        </p>

        {/* Video/Visual area */}
        <div className="w-full rounded-2xl overflow-hidden shadow-xl bg-white border-4 border-[#ffd700]"
          style={{ maxWidth: 'clamp(300px, 80vw, 640px)', aspectRatio: '16/9' }}>
          {playMode === 'playing-all' && videoSrc ? (
            <video
              ref={videoRef}
              key={`video-${currentSoundIdx}`}
              className="w-full h-full object-cover"
              onEnded={handleMediaEnd}
            >
              <source src={videoSrc} />
            </video>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#ffd700]/10 to-[#ae90fd]/10">
              {playMode === 'done' ? (
                <>
                  <span className="text-5xl md:text-7xl lg:text-8xl mb-2">&#127881;</span>
                  <span className="text-lg md:text-2xl lg:text-3xl font-bold text-[#3e366b]">
                    Great Singing!
                  </span>
                </>
              ) : playMode === 'playing-all' ? (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <Volume2 className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 text-[#4d79ff]" />
                  </motion.div>
                  <span className="text-4xl md:text-6xl lg:text-7xl font-bold text-[#3e366b] mt-3">
                    {currentSound}
                  </span>
                  <span className="text-xs text-[#3e366b]/40 mt-1">
                    {currentSoundIdx + 1} / {sounds.length}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-5xl md:text-6xl lg:text-7xl mb-2">{group.icon}</span>
                  <span className="text-base md:text-lg lg:text-xl font-semibold text-[#3e366b]/60">
                    Ready to sing?
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio for play-all mode */}
      {playMode === 'playing-all' && musicSrc && !videoSrc && (
        <audio
          ref={audioRef}
          key={`audio-${currentSoundIdx}`}
          src={musicSrc}
          onEnded={handleMediaEnd}
        />
      )}

      {/* Middle zone — sound bubbles */}
      <div className="absolute inset-x-0 flex items-center justify-center px-6 md:px-16 lg:px-24"
        style={{ top: '53%' }}>
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 lg:gap-5">
          {sounds.map((sound, idx) => (
            <motion.button
              key={idx}
              onClick={() => handlePlaySingleSound(idx)}
              className={`rounded-full flex items-center justify-center font-bold shadow transition-all cursor-pointer ${
                idx < currentSoundIdx && playMode === 'playing-all'
                  ? 'bg-[#22c55e] text-white'
                  : idx === currentSoundIdx && playMode === 'playing-all'
                  ? 'bg-[#4d79ff] text-white ring-2 ring-[#4d79ff]/30'
                  : 'bg-white text-[#3e366b] border-2 border-[#ae90fd]/50 hover:border-[#4d79ff] hover:shadow-lg'
              }`}
              style={{
                width: 'clamp(48px, 13vw, 85px)',
                height: 'clamp(48px, 13vw, 85px)',
                fontSize: 'clamp(14px, 3.5vw, 30px)',
              }}
              animate={
                idx === currentSoundIdx && playMode === 'playing-all'
                  ? { scale: [1, 1.15, 1] }
                  : {}
              }
              transition={{ duration: 0.5, repeat: Infinity }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {sound}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom zone — controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center px-4"
        style={{ height: '22%' }}>
        <div className="flex items-center gap-4">
          {playMode === 'idle' || playMode === 'done' ? (
            <motion.button
              onClick={handleStartSingAlong}
              className="flex items-center gap-3 px-8 py-4 md:px-10 md:py-5 lg:px-14 lg:py-6 bg-[#FFD000] text-[#3e366b] font-bold text-lg md:text-xl lg:text-2xl"
              style={{ borderRadius: '1.6rem', borderBottom: '5px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              <Play className="w-6 h-6 md:w-7 md:h-7 lg:w-9 lg:h-9" fill="#3e366b" />
              {playMode === 'done' ? 'Play Again' : 'Sing All'}
            </motion.button>
          ) : (
            <>
              <motion.button
                onClick={handlePause}
                className="flex items-center gap-2 px-5 py-3 md:px-7 md:py-4 lg:px-9 lg:py-5 bg-white text-[#3e366b] font-bold text-base lg:text-lg border-2 border-[#ae90fd]"
                style={{ borderRadius: '1.6rem', borderBottom: '4px solid #d1d5db', boxShadow: '0px 4px 0px rgba(0,0,0,0.08)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95, y: 3 }}
              >
                <Pause className="w-5 h-5" />
                Pause
              </motion.button>
              <motion.button
                onClick={handleSkipSound}
                className="flex items-center gap-2 px-5 py-3 md:px-7 md:py-4 lg:px-9 lg:py-5 bg-[#6B3FA0] text-white font-bold text-base lg:text-lg"
                style={{ borderRadius: '1.6rem', borderBottom: '4px solid #4A2B70', boxShadow: '0px 4px 0px rgba(0,0,0,0.12)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95, y: 3 }}
              >
                <SkipForward className="w-5 h-5" />
                Skip
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupSong;
