import React from 'react';
import { ArrowLeft, Maximize } from 'lucide-react';
import GummyButton from './GummyButton';

const toggleFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

const btnSize = 'clamp(36px, 10vh, 56px)';
const iconStyle = { width: '45%', height: '45%' };

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
