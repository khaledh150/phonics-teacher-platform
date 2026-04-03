import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import GummyButton from './GummyButton';
import { triggerCelebration } from '../../utils/confetti';

const GameResultCard = ({
  title = 'Great Job!',
  subtitle = '',
  accentColor = '#4ECDC4',
  icon: IconComponent, // Lucide icon component
  onPlayAgain,
  onBack,
  backLabel = 'Back to Playground',
  playAgainLabel = 'Play Again',
  children, // optional extra content
}) => {
  useEffect(() => {
    triggerCelebration();
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Card */}
      <motion.div
        initial={{ scale: 0, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.6, duration: 0.9, delay: 0.15 }}
        className="text-center mx-4 relative overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          borderRadius: 'clamp(1.5rem, 5vh, 3rem)',
          border: `clamp(3px, 0.8vh, 5px) solid ${accentColor}`,
          padding: 'clamp(24px, 6vh, 48px) clamp(32px, 8vh, 64px)',
          boxShadow: `0 clamp(4px, 1.5vh, 8px) 0 ${accentColor}, 0 clamp(6px, 2vh, 15px) rgba(0,0,0,0.2), inset 0 clamp(2px, 1vh, 4px) 0 rgba(255,255,255,0.9)`,
          maxWidth: 'min(90vw, 420px)',
        }}
      >
        {/* Shine */}
        <div className="absolute top-0 left-[15%] right-[15%] h-[12%] bg-white/50 rounded-full pointer-events-none" />

        {/* Icon */}
        {IconComponent && (
          <motion.div
            className="flex items-center justify-center mx-auto mb-3 rounded-full"
            style={{
              width: 'clamp(48px, 12vh, 80px)',
              height: 'clamp(48px, 12vh, 80px)',
              backgroundColor: `${accentColor}20`,
              border: `3px solid ${accentColor}40`,
            }}
            animate={{ y: [-3, 3, -3], rotate: [-3, 3, -3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <IconComponent style={{ width: '50%', height: '50%', color: accentColor }} />
          </motion.div>
        )}

        {/* Title */}
        <h2 className="font-bold" style={{ fontSize: 'clamp(1.4rem, 5vh, 2rem)', color: 'var(--text-dark)' }}>
          {title}
        </h2>

        {/* Subtitle */}
        {subtitle && (
          <p className="font-semibold mt-1 mb-4" style={{ fontSize: 'clamp(0.8rem, 2.5vh, 1.1rem)', color: 'var(--text-dark)', opacity: 0.6 }}>
            {subtitle}
          </p>
        )}

        {children}

        {/* Buttons */}
        <div className="flex flex-col items-center gap-3 mt-5">
          {onPlayAgain && (
            <GummyButton variant="green" onClick={onPlayAgain}>
              {playAgainLabel}
            </GummyButton>
          )}
          {onBack && (
            <GummyButton variant="ghost" onClick={onBack} style={{ fontSize: 'clamp(0.75rem, 2.5vh, 1rem)' }}>
              {backLabel}
            </GummyButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GameResultCard;
