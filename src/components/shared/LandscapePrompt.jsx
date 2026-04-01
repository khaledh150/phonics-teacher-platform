import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LandscapePrompt = ({ disabled = false }) => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Show on any screen that is in portrait mode (height > width)
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowPrompt(isPortrait && !disabled);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 100));

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [disabled]);

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8"
          style={{
            background: 'linear-gradient(135deg, #1a1147 0%, #2d1b69 50%, #1a1147 100%)',
          }}
        >
          {/* Rotating phone icon */}
          <motion.div
            animate={{ rotate: [0, -90, -90, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.7, 1] }}
            style={{ fontSize: 'clamp(5rem, 18vw, 9rem)' }}
          >
            📱
          </motion.div>

          <div className="text-center px-8">
            <p className="text-white font-bold mb-3" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}>
              Rotate Your Device
            </p>
            <p className="text-white/60" style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)' }}>
              Please turn your device sideways for the best experience
            </p>
          </div>

          {/* Landscape icon hint */}
          <div className="flex items-center gap-4 mt-2">
            <div
              className="border-3 border-white/30 rounded-lg flex items-center justify-center"
              style={{ width: 'clamp(36px, 8vw, 56px)', height: 'clamp(54px, 12vw, 84px)' }}
            >
              <div className="w-2 h-2 rounded-full bg-white/30" />
            </div>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-white/50"
              style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}
            >
              →
            </motion.span>
            <div
              className="border-3 border-[#4d79ff]/60 rounded-lg flex items-center justify-center"
              style={{ width: 'clamp(54px, 12vw, 84px)', height: 'clamp(36px, 8vw, 56px)' }}
            >
              <div className="w-2 h-2 rounded-full bg-[#4d79ff]/60" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LandscapePrompt;
