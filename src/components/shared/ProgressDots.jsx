import React from 'react';
import GlassHUD from './GlassHUD';

const ProgressDots = ({ total, current, accentColor = '#8B5CF6' }) => (
  <GlassHUD variant="pill" className="flex items-center gap-1.5">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className="rounded-full transition-all duration-300"
        style={{
          width: i === current ? 'clamp(10px, 2vh, 14px)' : 'clamp(7px, 1.5vh, 10px)',
          height: i === current ? 'clamp(10px, 2vh, 14px)' : 'clamp(7px, 1.5vh, 10px)',
          backgroundColor: i < current ? '#22c55e' : i === current ? accentColor : 'rgba(255,255,255,0.4)',
          boxShadow: i === current ? `0 0 0 3px ${accentColor}40` : 'none',
        }}
      />
    ))}
  </GlassHUD>
);

export default ProgressDots;
