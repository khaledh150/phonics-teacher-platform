import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2, Film, Music } from 'lucide-react';
import { getSoundVideo, getSoundMusic, getSoundYouTube } from '../../../utils/assetHelpers';
import { speakWithVoice } from '../../../utils/speech';
import { playLetterSound, getLetterSoundUrl, getDisplaySound } from '../../../utils/letterSounds';
import { playVO, playLetterVO, stopVO, delay } from '../../../utils/audioPlayer';

// Shared glass-arrow navigation overlay with swipe + tap-to-reveal
const NavOverlay = ({ onPrev, onNext }) => {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });

  const show = () => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 2500);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const handlePointerDown = (e) => {
    touchStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > 50 && absDx > absDy * 1.5) {
      if (dx < 0 && onNext) onNext();
      else if (dx > 0 && onPrev) onPrev();
    } else if (absDx < 10 && absDy < 10) {
      show();
    }
  };

  return (
    <>
      {/* Invisible swipe/tap catcher — sits behind interactive elements */}
      <div
        className="fixed inset-0 z-30"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'pan-y' }}
      />
      {/* Glass arrows */}
      <AnimatePresence>
        {visible && onPrev && (
          <motion.button
            key="nav-prev"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="fixed left-2 md:left-4 top-1/2 -translate-y-1/2 z-50 p-2.5 md:p-3 rounded-2xl backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
          </motion.button>
        )}
        {visible && onNext && (
          <motion.button
            key="nav-next"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 z-50 p-2.5 md:p-3 rounded-2xl backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

// For multi-letter sounds like "ew", "ai", "ch" — play each letter name individually
const playMultiLetterVO = async (sound) => {
  // Strip hyphens for sounds like "a-e" → "ae"
  const cleaned = sound.replace(/-/g, '');
  if (cleaned.length <= 1) {
    // Single letter — use normal letter VO
    await playLetterVO(sound);
    return;
  }
  // Multi-letter: play each letter name one by one
  for (let i = 0; i < cleaned.length; i++) {
    await playLetterVO(cleaned[i]);
    if (i < cleaned.length - 1) {
      await delay(200);
    }
  }
};

const SoundLearning = ({ group, onComplete, onReady, active }) => {
  const [soundIndex, setSoundIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const sounds = group.sounds;
  const currentSound = sounds[soundIndex];
  const isLastSound = soundIndex === sounds.length - 1;

  const youtubeSrc = getSoundYouTube(group.id, currentSound);
  const videoSrc = getSoundVideo(group.id, currentSound);
  const musicSrc = getSoundMusic(group.id, currentSound);

  const reminderRef = useRef(null);
  const [showReminder, setShowReminder] = useState(false);
  const autoAdvanceRef = useRef(null);

  // Signal readiness to parent (DOM-based step, ready immediately)
  useEffect(() => { onReady?.(); }, []);

  // Start idle reminder timer — plays "Tap the speaker" VO after 6s of no interaction
  const startReminderTimer = useCallback(() => {
    clearTimeout(reminderRef.current);
    setShowReminder(false);
    reminderRef.current = setTimeout(() => {
      setShowReminder(true);
      playVO('Tap the speaker to hear it again!');
    }, 6000);
  }, []);

  const clearReminder = useCallback(() => {
    clearTimeout(reminderRef.current);
    setShowReminder(false);
  }, []);

  const cancelledRef = useRef(false);
  const goNextRef = useRef(null);

  // Play a single letter sound and return a promise
  const playOnce = useCallback((sound) => {
    return new Promise((resolve) => {
      const url = getLetterSoundUrl(sound);
      if (url) {
        setIsSpeaking(true);
        playLetterSound(sound)
          .then(() => { setIsSpeaking(false); resolve(); })
          .catch(() => {
            speakWithVoice(sound, {
              rate: 0.7,
              onStart: () => setIsSpeaking(true),
              onEnd: () => { setIsSpeaking(false); resolve(); },
              onError: () => { setIsSpeaking(false); resolve(); },
            });
          });
      } else {
        speakWithVoice(sound, {
          rate: 0.7,
          onStart: () => setIsSpeaking(true),
          onEnd: () => { setIsSpeaking(false); resolve(); },
          onError: () => { setIsSpeaking(false); resolve(); },
        });
      }
    });
  }, []);

  // Single play — used when user taps the speaker button
  const speakOnce = useCallback(async (sound) => {
    stopVO();
    clearTimeout(reminderRef.current);
    cancelledRef.current = false;
    await playOnce(sound);
    if (!cancelledRef.current) startReminderTimer();
  }, [playOnce, startReminderTimer]);

  // Full sequence: play → "Say it with me!" → play → "Listen closely..." → play → reminder
  const speakSound = useCallback(async (sound) => {
    stopVO();
    clearTimeout(reminderRef.current);
    cancelledRef.current = false;

    // 1st play
    await playOnce(sound);
    if (cancelledRef.current) return;
    await delay(800);
    if (cancelledRef.current) return;
    // "Say it with me!" + 2nd play
    await playVO('Say it with me!');
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await playOnce(sound);
    if (cancelledRef.current) return;
    await delay(1000);
    if (cancelledRef.current) return;
    // "Listen closely..." + 3rd play
    await playVO('Listen closely...');
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await playOnce(sound);
    if (cancelledRef.current) return;
    // Auto-advance after VO sequence completes — video is optional, user can play manually
    clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      if (!cancelledRef.current) goNextRef.current?.();
    }, 1500);
  }, [playOnce, group, startReminderTimer]);

  useEffect(() => {
    if (!active) return; // Wait for preloader to finish before starting VO
    setVideoError(false);
    setMusicError(false);
    clearReminder();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    let cancelled = false;
    const run = async () => {
      if (soundIndex > 0) {
        await delay(400);
        if (cancelled) return;
      }
      // "Let's learn the sound of letter..." + letter name VO for every sound
      // For multi-letter sounds (ew, ai, ch, etc.) play each letter name individually
      await playVO("Let's learn the sound of letter..");
      if (cancelled) return;
      await playMultiLetterVO(currentSound);
      if (cancelled) return;
      await delay(400);
      if (cancelled) return;
      speakSound(currentSound);
    };
    run();
    return () => {
      cancelled = true;
      cancelledRef.current = true;
      stopVO();
      clearReminder();
      clearTimeout(autoAdvanceRef.current);
      window.speechSynthesis.cancel();
    };
  }, [active, currentSound, speakSound, clearReminder]);

  const goNext = () => {
    cancelledRef.current = true;
    clearReminder();
    clearTimeout(autoAdvanceRef.current);
    stopVO();
    window.speechSynthesis.cancel();
    if (isLastSound) {
      onComplete();
    } else {
      setSoundIndex((prev) => prev + 1);
    }
  };
  goNextRef.current = goNext;

  const goPrev = () => {
    cancelledRef.current = true;
    clearReminder();
    clearTimeout(autoAdvanceRef.current);
    stopVO();
    window.speechSynthesis.cancel();
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

  // When user plays the video, pause all VO/TTS and cancel auto-advance
  const handleVideoPlay = useCallback(() => {
    setVideoPlaying(true);
    cancelledRef.current = true;
    clearTimeout(autoAdvanceRef.current);
    clearReminder();
    stopVO();
    window.speechSynthesis.cancel();
  }, [clearReminder]);

  // When video pauses/ends, resume idle reminder
  const handleVideoPause = useCallback(() => {
    setVideoPlaying(false);
    startReminderTimer();
  }, [startReminderTimer]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Title + Progress — top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-30 flex flex-col items-center gap-1">
        <motion.span
          className="text-base md:text-xl lg:text-2xl font-bold text-white/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Learn the Sound!
        </motion.span>
        <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-0.5 md:px-4 md:py-1">
          <span className="text-white/50 font-semibold text-xs md:text-sm lg:text-base">
            {soundIndex + 1} / {sounds.length}
          </span>
        </div>
      </div>

      {/* Speaker button - mid-right and centered vertically to avoid video overlap */}
      <div className="fixed left-[62%] top-[45%] -translate-x-1/2 -translate-y-1/2 z-40">
        <motion.button
          onClick={() => { clearReminder(); speakOnce(currentSound); }}
          className={`relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#A78BFA] to-[#7C3AED]`}
          style={{
            width: 'clamp(44px, 11vh, 68px)',
            height: 'clamp(44px, 11vh, 68px)',
            borderRadius: '1.2rem',
            border: 'clamp(2px, 0.5vh, 4px) solid #3e366b',
            boxShadow: showReminder
              ? '0px 4px 0px #5B21B6, 0 0 24px rgba(139,92,246,0.6)'
              : '0px 4px 0px #5B21B6',
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9, y: 3 }}
          animate={
            isSpeaking
              ? { scale: [1, 1.25, 1, 1.25, 1], rotate: [0, -5, 5, 0] }
              : showReminder
              ? { scale: [1, 1.12, 1] }
              : {}
          }
          transition={{ duration: isSpeaking ? 0.6 : 1.2, repeat: Infinity }}
        >
          <div className="absolute top-0 left-1/4 right-1/4 h-1/4 bg-white/40 rounded-full pointer-events-none" />
          <Volume2 className="w-[70%] h-[70%] text-white" />
        </motion.button>
      </div>

      {/* Main content — portrait: stacked, landscape: side-by-side */}
      <div className="absolute inset-0 top-12 flex flex-col landscape:flex-row items-center justify-center landscape:justify-evenly px-4 landscape:px-8 gap-0 landscape:gap-4">

        {/* LEFT in landscape / TOP in portrait: Video */}
        <div className="flex flex-col items-center justify-center landscape:flex-1 landscape:max-w-[50%]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSound + '-top'}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center w-full"
            >
              <div
                className="w-full rounded-2xl overflow-hidden shadow-xl bg-white/10 border-3 border-[#ae90fd] relative z-[35]"
                style={{
                  maxWidth: 'clamp(280px, min(85vw, 45vw), 560px)',
                  aspectRatio: '16/9',
                }}
              >
                {youtubeSrc ? (
                  <iframe
                    key={youtubeSrc}
                    className="w-full h-full"
                    src={youtubeSrc}
                    title={`Letter ${currentSound} Song`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : videoSrc && !videoError ? (
                  <video
                    ref={videoRef}
                    key={videoSrc}
                    className="w-full h-full object-cover"
                    controls
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onEnded={handleVideoPause}
                    onError={() => setVideoError(true)}
                  >
                    <source src={videoSrc} />
                  </video>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#ae90fd]/10 to-[#4d79ff]/10">
                    <Film className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 text-[#ae90fd]/40 mb-1" />
                    <span className="text-white/40 text-sm md:text-sm lg:text-base font-medium">Video Coming Soon</span>
                  </div>
                )}
              </div>

              {musicSrc && !musicError ? (
                <div className="flex items-center gap-3 mt-2 md:mt-3">
                  <audio ref={audioRef} src={musicSrc} onError={() => setMusicError(true)} />
                  <motion.button
                    onClick={handlePlayMusic}
                    className="flex items-center gap-1.5 px-5 py-2.5 lg:px-6 lg:py-3 bg-[#FFD000] transition-colors"
                    style={{ borderRadius: '1.6rem', borderBottom: '4px solid #E0B800', boxShadow: '0px 6px 0px rgba(0,0,0,0.1)' }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95, y: 3 }}
                  >
                    <Music className="w-5 h-5 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" />
                    <span className="text-sm md:text-sm lg:text-base font-semibold text-white">Play Song</span>
                  </motion.button>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT in landscape / BOTTOM in portrait: Letter */}
        <div className="flex flex-col items-center justify-center landscape:flex-1">
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
                  fontSize: 'clamp(10rem, min(35vw, 35vh), 18rem)',
                  color: isSpeaking ? '#E60023' : '#ffffff',
                  textShadow: isSpeaking
                    ? '0 0 30px rgba(230, 0, 35, 0.5), 0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 4px 20px rgba(0, 0, 0, 0.3)',
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
                {getDisplaySound(currentSound)}
              </motion.span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Swipe + tap-to-show navigation overlay */}
      <NavOverlay onPrev={soundIndex > 0 ? goPrev : null} onNext={goNext} />

    </div>
  );
};

export default SoundLearning;
