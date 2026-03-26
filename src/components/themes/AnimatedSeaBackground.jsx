import React from 'react';
import { motion } from 'framer-motion';

// Sea aerial view layers
import sandLineLowerImg from '../../assets/backgrounds/beach/sea-aerial-view/sand-line-lower.png';
import waterLineImg from '../../assets/backgrounds/beach/sea-aerial-view/water-line.png';
import foamImg from '../../assets/backgrounds/beach/sea-aerial-view/foam.png';
import seaImg from '../../assets/backgrounds/beach/sea-aerial-view/sea.png';
import wave1 from '../../assets/backgrounds/beach/sea-aerial-view/wave-1.png';
import wave2 from '../../assets/backgrounds/beach/sea-aerial-view/wave-2.png';
import wave3 from '../../assets/backgrounds/beach/sea-aerial-view/wave-3.png';
import wave4 from '../../assets/backgrounds/beach/sea-aerial-view/wave-4.png';
import wave5 from '../../assets/backgrounds/beach/sea-aerial-view/wave-5.png';
import wave6 from '../../assets/backgrounds/beach/sea-aerial-view/wave-6.png';
import wave7 from '../../assets/backgrounds/beach/sea-aerial-view/wave-7.png';
import wave8 from '../../assets/backgrounds/beach/sea-aerial-view/wave-8.png';
import wave9 from '../../assets/backgrounds/beach/sea-aerial-view/wave-9.png';
import wave10 from '../../assets/backgrounds/beach/sea-aerial-view/wave-10.png';
import wave11 from '../../assets/backgrounds/beach/sea-aerial-view/wave-11.png';
import wave12 from '../../assets/backgrounds/beach/sea-aerial-view/wave-12.png';
import wave13 from '../../assets/backgrounds/beach/sea-aerial-view/wave-13.png';
import wave14 from '../../assets/backgrounds/beach/sea-aerial-view/wave-14.png';
import wave15 from '../../assets/backgrounds/beach/sea-aerial-view/wave-15.png';
import wave16 from '../../assets/backgrounds/beach/sea-aerial-view/wave-16.png';

const WAVES = [
  wave1, wave2, wave3, wave4, wave5, wave6, wave7, wave8,
  wave9, wave10, wave11, wave12, wave13, wave14, wave15, wave16,
];

const imgStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };

const AnimatedSeaBackground = () => {
  return (
    <div
      className="absolute top-0 left-0 w-full overflow-hidden pointer-events-none"
      style={{ height: 'clamp(80px, 18vh, 200px)', zIndex: 0 }}
    >
      {/* Sea wrapper — rotated + scaled to turn corner art into a horizontal top border */}
      <motion.div
        className="absolute inset-0"
        style={{
          transform: 'rotate(-38deg) scale(1.8)',
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {/* Base sand color */}
        <div className="absolute inset-0" style={{ backgroundColor: '#E8D4A2' }} />

        {/* Sand line lower (z-10) */}
        <img
          src={sandLineLowerImg}
          alt=""
          draggable={false}
          className="select-none"
          style={{ ...imgStyle, zIndex: 10 }}
        />

        {/* Shoreline group: water-line, foam, sea — ebb & flow animation */}
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, 8, 0], x: [0, -4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Water line (z-20) */}
          <img
            src={waterLineImg}
            alt=""
            draggable={false}
            className="select-none"
            style={{ ...imgStyle, zIndex: 20 }}
          />
          {/* Foam (z-30) */}
          <img
            src={foamImg}
            alt=""
            draggable={false}
            className="select-none"
            style={{ ...imgStyle, zIndex: 30 }}
          />
          {/* Sea (z-40) */}
          <img
            src={seaImg}
            alt=""
            draggable={false}
            className="select-none"
            style={{ ...imgStyle, zIndex: 40 }}
          />
        </motion.div>

        {/* 16 Wave layers — staggered sway animations (z-50) */}
        {WAVES.map((src, i) => (
          <motion.img
            key={`wave-${i}`}
            src={src}
            alt=""
            draggable={false}
            className="select-none"
            style={{ ...imgStyle, zIndex: 50 }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              x: [-3, 3, -3],
              y: [-2, 2, -2],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default React.memo(AnimatedSeaBackground);
