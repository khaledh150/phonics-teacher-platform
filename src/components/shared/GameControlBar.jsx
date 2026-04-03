import React from 'react';
import { ArrowLeft, Maximize } from 'lucide-react';
import GummyButton from './GummyButton';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

const btnSize = 'clamp(32px, 8vh, 48px)';
const iconStyle = { width: '50%', height: '50%' };

const GameControlBar = ({ onBack, className = '' }) => (
  <div className={`fixed top-3 left-3 z-[70] flex items-center gap-2 ${className}`}>
    <GummyButton variant="yellow" shape="circle" size={btnSize} onClick={onBack}>
      <ArrowLeft style={iconStyle} className="text-[var(--text-dark)]" />
    </GummyButton>
    <GummyButton variant="yellow" shape="circle" size={btnSize} onClick={toggleFullscreen}>
      <Maximize style={iconStyle} className="text-[var(--text-dark)]" />
    </GummyButton>
  </div>
);

export default GameControlBar;
