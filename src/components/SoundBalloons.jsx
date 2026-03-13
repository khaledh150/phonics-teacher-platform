import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { playLetterSound, getLetterSoundUrl } from '../utils/letterSounds';
import { speakWithVoice } from '../utils/speech';

let sharedCtx = null;
const getCtx = () => {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
};

const playBoing = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch (e) { /* silent */ }
};

const playPopSound = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    noise.connect(noiseGain); noiseGain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(100, ctx.currentTime);
    noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    noise.start(ctx.currentTime); noise.stop(ctx.currentTime + 0.1);
  } catch (e) { /* silent */ }
};

const playCountdownTick = (isGo) => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    if (isGo) {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) { /* silent */ }
};

const BALLOON_COLORS = [
  '#FF1E56', '#00C9A7', '#FFD000', '#FF6600', '#8B00FF',
  '#0080FF', '#E60023', '#00CC44', '#FF9500', '#00B894',
];

const BALLOON_SIZE = { min: 90, vw: 24, max: 170 };
const TIME_PER_SOUND = 10;

let balloonIdCounter = 0;

const SoundBalloons = ({ group, onComplete }) => {
  const [balloons, setBalloons] = useState([]);
  const [particles, setParticles] = useState([]);
  const [shakingId, setShakingId] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);

  // Display state - updated from refs
  const [displayTargetIdx, setDisplayTargetIdx] = useState(0);
  const [displayTimeLeft, setDisplayTimeLeft] = useState(TIME_PER_SOUND);
  const [displayTarget, setDisplayTarget] = useState(group.sounds[0]);

  const spawnIntervalRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const soundScoresRef = useRef({});

  // Core game state - refs only, no React state dependency chains
  const targetIdxRef = useRef(0);
  const targetSoundRef = useRef(group.sounds[0]);
  const timeLeftRef = useRef(TIME_PER_SOUND);
  const gameOverRef = useRef(false);

  const sounds = group.sounds;

  const announceSound = useCallback((sound) => {
    const url = getLetterSoundUrl(sound);
    if (url) {
      setTimeout(() => playLetterSound(sound).catch(() => {}), 300);
    } else {
      setTimeout(() => speakWithVoice(sound, { rate: 0.7 }), 300);
    }
  }, []);

  // Reset on mount, cleanup on unmount
  useEffect(() => {
    gameOverRef.current = false;
    targetIdxRef.current = 0;
    targetSoundRef.current = sounds[0];
    timeLeftRef.current = TIME_PER_SOUND;
    soundScoresRef.current = {};
    return () => {
      gameOverRef.current = true;
      clearInterval(timerRef.current);
      clearInterval(spawnIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sounds]);

  // 3-2-1-GO countdown
  useEffect(() => {
    if (gameStarted) return;
    playCountdownTick(false);
    const timers = [
      setTimeout(() => { setCountdown(2); playCountdownTick(false); }, 1000),
      setTimeout(() => { setCountdown(1); playCountdownTick(false); }, 2000),
      setTimeout(() => { setCountdown(0); playCountdownTick(true); }, 3000),
      setTimeout(() => {
        setGameStarted(true);
        announceSound(sounds[0]);
      }, 3700),
    ];
    return () => timers.forEach(clearTimeout);
  }, [gameStarted, sounds, announceSound]);

  // Single game timer - one setInterval, all logic via refs
  useEffect(() => {
    if (!gameStarted) return;

    timeLeftRef.current = TIME_PER_SOUND;

    timerRef.current = setInterval(() => {
      if (gameOverRef.current) {
        clearInterval(timerRef.current);
        return;
      }

      timeLeftRef.current -= 1;
      setDisplayTimeLeft(timeLeftRef.current);

      if (timeLeftRef.current <= 0) {
        // Time's up for this sound - advance
        const nextIdx = targetIdxRef.current + 1;

        if (nextIdx >= sounds.length) {
          // All sounds done
          gameOverRef.current = true;
          clearInterval(timerRef.current);
          clearInterval(spawnIntervalRef.current);
          setShowResults(true);
        } else {
          // Move to next sound
          targetIdxRef.current = nextIdx;
          targetSoundRef.current = sounds[nextIdx];
          timeLeftRef.current = TIME_PER_SOUND;

          setDisplayTargetIdx(nextIdx);
          setDisplayTimeLeft(TIME_PER_SOUND);
          setDisplayTarget(sounds[nextIdx]);

          // Clear non-popped balloons
          setBalloons(prev => prev.filter(b => b.popped));

          announceSound(sounds[nextIdx]);
        }
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameStarted, sounds, announceSound]);

  // Spawn balloons - reads target from ref
  useEffect(() => {
    if (gameOverRef.current || !gameStarted) return;

    const spawnBalloon = () => {
      if (gameOverRef.current) return;

      const containerW = containerRef.current?.offsetWidth || 600;
      const balloonW = Math.min(Math.max(BALLOON_SIZE.min, containerW * BALLOON_SIZE.vw / 100), BALLOON_SIZE.max);
      const currentTarget = targetSoundRef.current;

      // 60% chance of correct letter
      const isTarget = Math.random() < 0.6;
      const sound = isTarget ? currentTarget : sounds[Math.floor(Math.random() * sounds.length)];
      const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
      const maxX = containerW - balloonW - 20;

      const newBalloon = {
        id: balloonIdCounter++,
        sound, color,
        x: Math.random() * maxX + 10,
        y: 110,
        speed: 0.18 + Math.random() * 0.18,
        swayOffset: Math.random() * Math.PI * 2,
        swayAmp: 8 + Math.random() * 12,
        size: balloonW,
        popped: false,
      };

      setBalloons((prev) => {
        const active = prev.filter((b) => !b.popped && b.y > -15);
        if (active.length >= 18) return prev;
        return [...prev, newBalloon];
      });
    };

    // Burst of initial balloons
    for (let i = 0; i < 6; i++) {
      setTimeout(spawnBalloon, i * 80);
    }
    spawnIntervalRef.current = setInterval(spawnBalloon, 400);
    return () => clearInterval(spawnIntervalRef.current);
  }, [sounds, gameStarted, displayTargetIdx]);

  // Animate balloons
  useEffect(() => {
    if (!gameStarted) return;
    let lastTime = performance.now();
    const animate = (now) => {
      const dt = (now - lastTime) / 16.67;
      lastTime = now;
      setBalloons((prev) => {
        return prev
          .map((b) => {
            if (b.popped) return b;
            const sway = Math.sin((now / 1000) + b.swayOffset) * b.swayAmp;
            return { ...b, y: b.y - b.speed * dt, currentX: b.x + sway };
          })
          .filter((b) => b.y > -20 || b.popped);
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [gameStarted]);

  const spawnParticles = (x, y, color) => {
    const np = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i, x, y, color,
      angle: (i / 12) * Math.PI * 2,
      speed: 2 + Math.random() * 4,
      size: 4 + Math.random() * 8,
    }));
    setParticles((prev) => [...prev, ...np]);
    setTimeout(() => setParticles((prev) => prev.filter((p) => !np.find((n) => n.id === p.id))), 600);
  };

  const handleBalloonClick = useCallback((balloon) => {
    if (balloon.popped || shakingId) return;

    const currentTarget = targetSoundRef.current;

    if (balloon.sound === currentTarget) {
      playPopSound();
      playLetterSound(balloon.sound).catch(() => {});
      const containerH = containerRef.current?.offsetHeight || 600;
      spawnParticles(balloon.currentX || balloon.x, (balloon.y / 100) * containerH, balloon.color);
      setBalloons((prev) => prev.map((b) => b.id === balloon.id ? { ...b, popped: true } : b));
      soundScoresRef.current[currentTarget] = (soundScoresRef.current[currentTarget] || 0) + 1;
    } else {
      playBoing();
      setShakingId(balloon.id);
      setTimeout(() => setShakingId(null), 500);
    }
  }, [shakingId]);

  const handleReplaySound = () => {
    announceSound(targetSoundRef.current);
  };

  const handleFinish = () => {
    setShowResults(false);
    onComplete();
  };

  const totalPopped = Object.values(soundScoresRef.current).reduce((a, b) => a + b, 0);
  const progress = (displayTargetIdx + (1 - displayTimeLeft / TIME_PER_SOUND)) / sounds.length;

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden select-none">
      {/* Sky */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #87CEEB 0%, #B8E4F0 40%, #E8F8E0 100%)',
      }} />

      {/* Clouds */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`cloud-${i}`}
          className="absolute rounded-full bg-white/60"
          style={{
            width: `clamp(80px, 20vw, 200px)`,
            height: `clamp(30px, 8vw, 70px)`,
            top: `${8 + i * 12}%`,
            left: `${10 + i * 22}%`,
          }}
          animate={{ x: [0, 30, 0] }}
          transition={{ duration: 8 + i * 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Header: progress + timer + replay - top right */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-end px-4 pt-3 md:pt-4 lg:pt-6">
        <div className="flex items-center gap-2">
          <div className="bg-white/70 backdrop-blur-sm rounded-full px-3 py-1 lg:px-4 lg:py-1.5 flex items-center gap-2">
            <span className="text-xs lg:text-sm text-[#3e366b]/50 font-medium">
              {displayTargetIdx + 1}/{sounds.length}
            </span>
            <div className="w-16 md:w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#22c55e] rounded-full"
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              />
            </div>
          </div>
          {/* Timer */}
          <div className={`bg-white/70 backdrop-blur-sm rounded-full px-3 py-1 font-bold text-sm ${displayTimeLeft <= 3 ? 'text-red-500' : 'text-[#3e366b]/70'}`}>
            {displayTimeLeft}s
          </div>
          <motion.button
            onClick={handleReplaySound}
            className="p-2 lg:p-2.5 rounded-full bg-[#4d79ff] shadow-lg"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
          >
            <Volume2 className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Balloons */}
      <AnimatePresence>
        {balloons.map((balloon) => {
          if (balloon.popped) return (
            <motion.div
              key={balloon.id}
              className="absolute"
              style={{
                left: balloon.currentX || balloon.x,
                top: `${balloon.y}%`,
                width: balloon.size,
                height: balloon.size * 1.2,
              }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: [1.3, 0], opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          );

          return (
            <motion.button
              key={balloon.id}
              className="absolute cursor-pointer z-20"
              style={{
                left: balloon.currentX || balloon.x,
                top: `${balloon.y}%`,
                width: balloon.size,
                height: balloon.size * 1.2,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
              }}
              onClick={() => handleBalloonClick(balloon)}
              animate={shakingId === balloon.id ? { x: [0, -10, 10, -10, 10, 0], rotate: [0, -5, 5, -5, 5, 0] } : {}}
              transition={shakingId === balloon.id ? { duration: 0.4 } : {}}
              whileTap={{ scale: 0.9 }}
            >
              <svg viewBox="0 0 100 130" className="w-full h-full">
                <defs>
                  <radialGradient id={`grad-${balloon.id}`} cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                    <stop offset="40%" stopColor={balloon.color} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={balloon.color} />
                  </radialGradient>
                </defs>
                <ellipse cx="50" cy="50" rx="42" ry="48" fill={`url(#grad-${balloon.id})`} />
                <ellipse cx="50" cy="50" rx="42" ry="48" fill="none" stroke={balloon.color} strokeWidth="2" opacity="0.5" />
                <ellipse cx="36" cy="34" rx="8" ry="12" fill="white" opacity="0.45" transform="rotate(-20, 36, 34)" />
                <polygon points="47,97 53,97 50,103" fill={balloon.color} />
                <path d="M50,103 Q48,115 52,128" fill="none" stroke="#999" strokeWidth="1" />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center font-bold text-white pointer-events-none"
                style={{
                  fontSize: `${balloon.size * 0.35}px`,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  paddingBottom: `${balloon.size * 0.25}px`,
                }}
              >
                {balloon.sound}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Burst particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full z-30 pointer-events-none"
          style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ x: Math.cos(p.angle) * p.speed * 30, y: Math.sin(p.angle) * p.speed * 30, scale: 0, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[8%] z-10" style={{
        background: 'linear-gradient(180deg, #7BC67E 0%, #5AA85D 100%)',
        borderTopLeftRadius: '50% 20px',
        borderTopRightRadius: '50% 20px',
      }} />

      {/* 3-2-1-GO Countdown */}
      <AnimatePresence mode="wait">
        {!gameStarted && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none"
          >
            <motion.span
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="font-black"
              style={{
                fontSize: 'clamp(8rem, 30vw, 16rem)',
                color: countdown === 0 ? '#22c55e' : '#3e366b',
                textShadow: '0 4px 30px rgba(0,0,0,0.15)',
              }}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results screen */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, rgba(62,54,107,0.85) 0%, rgba(0,0,0,0.9) 100%)' }}
          >
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={`confetti-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: `${Math.random() * 100}%`, top: -20,
                  width: 6 + Math.random() * 8, height: 6 + Math.random() * 8,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  backgroundColor: BALLOON_COLORS[i % BALLOON_COLORS.length],
                }}
                animate={{ y: ['0vh', '110vh'], x: [0, (Math.random() - 0.5) * 100], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)] }}
                transition={{ duration: 2 + Math.random() * 3, delay: Math.random() * 2, repeat: Infinity, ease: 'linear' }}
              />
            ))}

            {[...Array(20)].map((_, i) => (
              <motion.div
                key={`spark-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 60}%`,
                  width: 3 + Math.random() * 5, height: 3 + Math.random() * 5,
                  backgroundColor: '#ffd700',
                }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1 + Math.random(), delay: Math.random() * 3, repeat: Infinity }}
              />
            ))}

            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl text-center max-w-sm md:max-w-md mx-4 relative z-10"
            >
              <motion.div
                className="relative inline-block mb-3"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="text-6xl md:text-8xl block">&#127880;</span>
              </motion.div>

              <motion.h2
                className="text-2xl md:text-3xl font-bold text-[#3e366b] mb-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Amazing Popping!
              </motion.h2>

              <motion.p
                className="text-lg md:text-xl text-[#ae90fd] font-semibold mb-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <span className="text-4xl md:text-5xl font-bold block mb-1" style={{ color: group.color }}>{totalPopped}</span>
                balloons popped!
              </motion.p>

              <motion.button
                onClick={handleFinish}
                className="px-8 py-3 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-bold text-base md:text-lg shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Next Step &rarr;
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SoundBalloons;
