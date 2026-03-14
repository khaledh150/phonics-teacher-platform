import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2, Film, Music } from 'lucide-react';
import { getSoundVideo, getSoundMusic } from '../utils/assetHelpers';
import { speakWithVoice } from '../utils/speech';
import { playLetterSound, getLetterSoundUrl } from '../utils/letterSounds';

const SoundLearning = ({ group, onComplete }) => {
  const [soundIndex, setSoundIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const audioRef = useRef(null);

  const sounds = group.sounds;
  const currentSound = sounds[soundIndex];
  const isLastSound = soundIndex === sounds.length - 1;

  const videoSrc = getSoundVideo(group.id, currentSound);
  const musicSrc = getSoundMusic(group.id, currentSound);

  useEffect(() => {
    setVideoError(false);
    setMusicError(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [soundIndex]);

  useEffect(() => {
    const timer = setTimeout(() => {
      speakSound(currentSound);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentSound]);

  const speakSound = useCallback((sound) => {
    const url = getLetterSoundUrl(sound);
    if (url) {
      setIsSpeaking(true);
      playLetterSound(sound)
        .then(() => setIsSpeaking(false))
        .catch(() => {
          speakWithVoice(sound, {
            rate: 0.7,
            onStart: () => setIsSpeaking(true),
            onEnd: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          });
        });
    } else {
      speakWithVoice(sound, {
        rate: 0.7,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  }, []);

  const goNext = () => {
    if (isLastSound) {
      onComplete();
    } else {
      setSoundIndex((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (soundIndex > 0) {
      setSoundIndex((prev) => prev - 1);
    }
  };

  const handlePlayMusic = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Sound counter - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-30">
        <div className="bg-white/60 backdrop-blur-sm rounded-full px-3 py-1 md:px-4 md:py-1.5 lg:px-5 lg:py-2">
          <span className="text-[#3e366b]/60 font-semibold text-xs md:text-sm lg:text-base">
            {soundIndex + 1} / {sounds.length}
          </span>
        </div>
      </div>

      {/* Video zone — pinned to top 38% of screen */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center px-4 md:px-16 lg:px-24"
        style={{ height: '38%', paddingTop: 'clamp(36px, 6vh, 64px)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSound + '-top'}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center w-full"
          >
            {/* Video Player */}
            <div
              className="w-full rounded-2xl overflow-hidden shadow-xl bg-white border-3 border-[#ae90fd]"
              style={{
                maxWidth: 'clamp(320px, 85vw, 580px)',
                aspectRatio: '16/9',
              }}
            >
              {videoSrc && !videoError ? (
                <video
                  key={videoSrc}
                  className="w-full h-full object-cover"
                  controls
                  onError={() => setVideoError(true)}
                >
                  <source src={videoSrc} />
                </video>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#ae90fd]/10 to-[#4d79ff]/10">
                  <Film className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 text-[#ae90fd]/40 mb-1" />
                  <span className="text-[#3e366b]/40 text-sm md:text-sm lg:text-base font-medium">Video Coming Soon</span>
                </div>
              )}
            </div>

            {/* Music button */}
            {musicSrc && !musicError ? (
              <div className="flex items-center gap-3 mt-2 md:mt-3 lg:mt-4">
                <audio ref={audioRef} src={musicSrc} onError={() => setMusicError(true)} />
                <motion.button
                  onClick={handlePlayMusic}
                  className="flex items-center gap-1.5 px-5 py-2.5 lg:px-6 lg:py-3 bg-[#FFD000] transition-colors"
                  style={{ borderRadius: '1.6rem', borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 3 }}
                >
                  <Music className="w-5 h-5 md:w-5 md:h-5 lg:w-6 lg:h-6 text-[#3e366b]" />
                  <span className="text-sm md:text-sm lg:text-base font-semibold text-[#3e366b]">Play Song</span>
                </motion.button>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Letter zone — positioned below speaker, slightly higher on big screens */}
      <div className="absolute inset-x-0 flex items-start justify-center px-4 top-[58%] lg:top-[55%]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSound + '-letter'}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center"
          >
            <motion.span
              className="font-bold leading-none text-center"
              style={{
                fontSize: 'clamp(16rem, 50vw, 24rem)',
                color: isSpeaking ? '#E60023' : '#3e366b',
                textShadow: isSpeaking
                  ? '0 0 30px rgba(230, 0, 35, 0.5), 0 4px 20px rgba(62, 54, 107, 0.15)'
                  : '0 4px 20px rgba(62, 54, 107, 0.15)',
                transition: 'color 0.3s ease, text-shadow 0.3s ease',
              }}
              animate={isSpeaking
                ? { scale: [1, 1.15, 1], rotate: [0, -3, 3, 0] }
                : { scale: [1, 1.03, 1] }
              }
              transition={isSpeaking
                ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              {currentSound}
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Speaker button - fixed center, aligned with yellow nav buttons */}
      <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40">
        <motion.button
          onClick={() => speakSound(currentSound)}
          className="p-4 md:p-5 lg:p-5 bg-[#6B3FA0] transition-colors"
          style={{ borderRadius: '1.6rem', borderBottom: '5px solid #4A2B70', boxShadow: '0px 6px 0px rgba(0,0,0,0.12)' }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9, y: 4 }}
          animate={
            isSpeaking
              ? { scale: [1, 1.15, 1, 1.15, 1] }
              : {}
          }
          transition={
            isSpeaking
              ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
              : {}
          }
        >
          <Volume2 className="w-8 h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 text-white" />
        </motion.button>
      </div>

      {/* Navigation Arrows */}
      {soundIndex > 0 && (
        <motion.button
          onClick={goPrev}
          className="fixed left-2 md:left-6 lg:left-10 top-1/2 -translate-y-1/2 z-40 p-3 md:p-4 lg:p-5 bg-[#FFD000] transition-all"
          style={{ borderRadius: '1.6rem', borderBottom: '5px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
          whileHover={{ scale: 1.15, x: -5 }}
          whileTap={{ scale: 0.9, y: 4 }}
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#3e366b]" />
        </motion.button>
      )}

      <motion.button
        onClick={goNext}
        className="fixed right-2 md:right-6 lg:right-10 top-1/2 -translate-y-1/2 z-40 p-3 md:p-4 lg:p-5 bg-[#FFD000] transition-all"
        style={{ borderRadius: '1.6rem', borderBottom: '5px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
        whileHover={{ scale: 1.15, x: 5 }}
        whileTap={{ scale: 0.9, y: 4 }}
      >
        <ChevronRight className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#3e366b]" />
      </motion.button>
    </div>
  );
};

export default SoundLearning;
