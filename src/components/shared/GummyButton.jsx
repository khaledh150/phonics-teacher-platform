import React from 'react';
import { motion } from 'framer-motion';

const VARIANTS = {
  yellow: {
    bg: 'linear-gradient(180deg, var(--btn-yellow-light) 0%, var(--btn-yellow) 100%)',
    shadow: 'var(--btn-yellow-shadow)',
    border: '#FFF',
    text: 'var(--text-dark)',
  },
  purple: {
    bg: 'linear-gradient(180deg, var(--btn-purple-light) 0%, var(--btn-purple) 100%)',
    shadow: 'var(--btn-purple-shadow)',
    border: '#C4B5FD',
    text: '#FFF',
  },
  green: {
    bg: 'linear-gradient(180deg, var(--btn-green-light) 0%, var(--btn-green) 100%)',
    shadow: 'var(--btn-green-shadow)',
    border: '#FFF',
    text: '#FFF',
  },
  red: {
    bg: 'linear-gradient(180deg, #FF6B6B 0%, #E60023 100%)',
    shadow: '#B8001B',
    border: '#FFF',
    text: '#FFF',
  },
  ghost: {
    bg: 'rgba(255,255,255,0.15)',
    shadow: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.25)',
    text: 'rgba(255,255,255,0.85)',
  },
};

const GummyButton = ({
  variant = 'yellow',
  shape = 'pill', // 'pill' | 'circle'
  size, // explicit size for circle buttons (e.g. 'clamp(36px, 10vh, 56px)')
  onClick,
  children,
  className = '',
  style = {},
  disabled = false,
  ...motionProps
}) => {
  const v = VARIANTS[variant] || VARIANTS.yellow;
  const isCircle = shape === 'circle';

  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      className={`relative overflow-hidden flex items-center justify-center font-extrabold ${isCircle ? 'rounded-full p-1' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      style={{
        background: v.bg,
        border: `clamp(2px, 0.5vh, 3px) solid ${v.border}`,
        borderRadius: isCircle ? '9999px' : 'clamp(1rem, 4vh, 2rem)',
        boxShadow: `0 clamp(3px, 1vh, 6px) 0 ${v.shadow}, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)`,
        color: v.text,
        ...(isCircle && size ? { width: size, height: size } : {}),
        ...(!isCircle ? { padding: 'clamp(10px, 2.5vh, 16px) clamp(20px, 5vh, 40px)', fontSize: 'clamp(0.85rem, 3vh, 1.2rem)' } : {}),
        ...style,
      }}
      whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.9, y: 3, boxShadow: `0 0px 0 ${v.shadow}` }}
      disabled={disabled}
      {...motionProps}
    >
      {/* Shine overlay */}
      <div className="absolute top-0 left-[15%] right-[15%] h-[25%] bg-white/40 rounded-full pointer-events-none" />
      {children}
    </motion.button>
  );
};

export default GummyButton;
