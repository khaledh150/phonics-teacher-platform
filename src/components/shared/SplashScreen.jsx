import React from 'react';
import { motion } from 'framer-motion';
import wonderPhonicsLogo from '../../assets/wonderkids-logo.webp';

const SplashScreen = ({ onStart }) => {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1e1252 0%, #3a2287 100%)' }}
      onClick={onStart}
    >
      {/* Logo — scales for both portrait and landscape */}
      <motion.img
        src={wonderPhonicsLogo}
        alt="Wonder Phonics"
        className="w-auto mx-auto object-contain z-10 px-4"
        style={{
          height: 'clamp(160px, min(50vh, 45vw), 420px)',
          marginBottom: 'clamp(10px, 4vh, 32px)',
          filter: 'drop-shadow(0 15px 20px rgba(0,0,0,0.5))',
        }}
        animate={{ scale: [1, 1.03, 1], y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Tap to Start button */}
      <motion.div
        className="relative bg-gradient-to-b from-[#FFE55C] to-[#FFD000] text-[#3e366b] font-extrabold z-10 mx-6 text-center overflow-hidden"
        style={{
          borderRadius: 'clamp(1.5rem, 5vh, 3rem)',
          border: 'clamp(2px, 0.8vh, 4px) solid #FFF',
          padding: 'clamp(10px, 3.5vh, 24px) clamp(24px, 8vh, 48px)',
          fontSize: 'clamp(1.4rem, min(6vh, 5vw), 2.5rem)',
          boxShadow: '0 clamp(4px, 1.5vh, 8px) 0 #E0B800',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95, y: 6, boxShadow: '0 0px 0 #E0B800' }}
      >
        Tap to Start!
      </motion.div>

      {/* Copyright */}
      <span
        className="fixed bottom-2 left-1/2 -translate-x-1/2 text-white/30 font-bold z-10 whitespace-nowrap"
        style={{ fontSize: 'clamp(0.6rem, 2.5vh, 0.85rem)' }}
      >
        &copy; 2026 Wonder Kids Co. All rights reserved.
      </span>
    </div>
  );
};

export default SplashScreen;
