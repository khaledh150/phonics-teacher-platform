import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

import crab1 from '../../assets/characters/crab/crab-1.webp';
import crab2 from '../../assets/characters/crab/crab-2.webp';
import crab3 from '../../assets/characters/crab/crab-3.webp';
import crab4 from '../../assets/characters/crab/crab-4.webp';

// Pose mapping:
// crab-1: Actively tracing (mouth open, leaning in)
// crab-2: Spin dance frame A (side/up, claws up)
// crab-3: Spin dance frame B (back turned)
// crab-4: Default idle (front facing) + spin dance frame C

const CrabCompanion = ({ isActivelyTracing, isGameComplete, letterCompletedTrigger, isIdle }) => {
  const wrapperControls = useAnimation();
  const prevTriggerRef = useRef(letterCompletedTrigger);
  const [isDancing, setIsDancing] = useState(false);
  const danceTimerRef = useRef(null);

  // Letter complete → spin dance for 1.5s
  useEffect(() => {
    if (letterCompletedTrigger !== prevTriggerRef.current && !isGameComplete) {
      prevTriggerRef.current = letterCompletedTrigger;
      setIsDancing(true);
      wrapperControls.start({
        y: [0, -25, 0, -25, 0],
        transition: { duration: 1.5, ease: 'easeInOut' },
      });
      clearTimeout(danceTimerRef.current);
      danceTimerRef.current = setTimeout(() => setIsDancing(false), 1500);
    }
  }, [letterCompletedTrigger, isGameComplete, wrapperControls]);

  // Game complete → repeated spin dance
  useEffect(() => {
    if (isGameComplete) {
      setIsDancing(true);
      wrapperControls.start({
        y: [0, -25, 0, -25, 0],
        scale: [1, 1.1, 1, 1.08, 1],
        rotate: [0, -5, 0, 5, 0],
        transition: { duration: 1.8, repeat: Infinity, repeatDelay: 0.3 },
      });
    } else {
      wrapperControls.stop();
    }
    return () => clearTimeout(danceTimerRef.current);
  }, [isGameComplete, wrapperControls]);

  const showTracing = isActivelyTracing && !isDancing && !isGameComplete;
  const showDance = isDancing || isGameComplete;
  const showIdle = !showTracing && !showDance;

  // Spin dance keyframes: cycle crab-4 → crab-2 → crab-3 → repeat (only one visible at a time)
  const spinDuration = 1.5;
  const spinRepeat = isGameComplete ? Infinity : 0;

  return (
    <motion.div
      className="fixed z-[20] pointer-events-none"
      style={{
        bottom: '1%',
        left: '2%',
        width: 'clamp(160px, 30vw, 320px)',
        height: 'clamp(160px, 30vw, 320px)',
        willChange: 'transform',
      }}
      animate={wrapperControls}
    >
      <div className="relative w-full h-full">
        {/* crab-1: Tracing — lean in with mouth open */}
        <motion.img
          src={crab1}
          alt=""
          className="absolute inset-0 w-full h-full object-contain select-none"
          initial={false}
          animate={{
            opacity: showTracing ? 1 : 0,
            scale: showTracing ? 1.05 : 1,
            rotate: showTracing ? -5 : 0,
          }}
          transition={{
            opacity: { duration: 0.15 },
            scale: { duration: 0.3 },
            rotate: { duration: 0.3 },
          }}
          draggable={false}
        />

        {/* crab-4: Idle breathing + Spin dance frame C (front) */}
        <motion.img
          src={crab4}
          alt=""
          className="absolute inset-0 w-full h-full object-contain select-none"
          initial={false}
          animate={
            showDance
              ? { opacity: [1, 0, 0, 1, 0, 0, 1] }
              : showIdle
                ? { opacity: 1, scaleY: [1, 0.96, 1], y: [0, 2, 0] }
                : { opacity: 0 }
          }
          transition={
            showDance
              ? { opacity: { duration: spinDuration, repeat: spinRepeat, ease: 'linear' } }
              : showIdle
                ? {
                    opacity: { duration: 0.15 },
                    scaleY: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                  }
                : { opacity: { duration: 0.15 } }
          }
          draggable={false}
        />

        {/* crab-2: Spin dance frame A (side/up, claws up) */}
        <motion.img
          src={crab2}
          alt=""
          className="absolute inset-0 w-full h-full object-contain select-none"
          initial={false}
          animate={{
            opacity: showDance ? [0, 1, 0, 0, 1, 0, 0] : 0,
          }}
          transition={{
            opacity: showDance
              ? { duration: spinDuration, repeat: spinRepeat, ease: 'linear' }
              : { duration: 0.15 },
          }}
          draggable={false}
        />

        {/* crab-3: Spin dance frame B (back turned) */}
        <motion.img
          src={crab3}
          alt=""
          className="absolute inset-0 w-full h-full object-contain select-none"
          initial={false}
          animate={{
            opacity: showDance ? [0, 0, 1, 0, 0, 1, 0] : 0,
          }}
          transition={{
            opacity: showDance
              ? { duration: spinDuration, repeat: spinRepeat, ease: 'linear' }
              : { duration: 0.15 },
          }}
          draggable={false}
        />
      </div>
    </motion.div>
  );
};

export default React.memo(CrabCompanion);
