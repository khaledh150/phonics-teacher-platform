import React from 'react';

const GlassHUD = ({ variant = 'panel', children, className = '', style = {} }) => (
  <div
    className={`backdrop-blur-md ${variant === 'pill' ? 'rounded-full' : 'rounded-2xl'} ${className}`}
    style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      padding: variant === 'pill' ? 'clamp(4px, 1vh, 8px) clamp(10px, 2.5vh, 20px)' : 'clamp(8px, 2vh, 16px)',
      ...style,
    }}
  >
    {children}
  </div>
);

export default GlassHUD;
