import { useRef, useCallback } from 'react';

/**
 * Sand particle system hook for MagicSandTracing.
 * Manages particle emission, physics update, and Canvas2D rendering.
 */
class SandParticles {
  constructor() { this.p = []; }

  emit(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 0.1 + Math.random() * Math.PI * 0.8;
      const spd = 1.2 + Math.random() * 2.5;
      this.p.push({
        x, y,
        vx: Math.cos(a) * spd * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.abs(Math.sin(a)) * spd * 0.5 + 0.3,
        life: 1, decay: 0.015 + Math.random() * 0.02,
        size: 6 + Math.random() * 10, hue: 35 + Math.random() * 25,
      });
    }
  }

  update() {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
      if (p.life <= 0) this.p.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.p) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = `hsl(${p.hue}, 85%, ${50 + (1 - p.life) * 25}%)`;
      ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, ${p.life * 0.6})`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() { this.p = []; }
}

const useSandParticles = () => {
  const particlesRef = useRef(new SandParticles());

  const emit = useCallback((x, y, count) => {
    particlesRef.current.emit(x, y, count);
  }, []);

  const update = useCallback(() => {
    particlesRef.current.update();
  }, []);

  const draw = useCallback((ctx) => {
    particlesRef.current.draw(ctx);
  }, []);

  const clear = useCallback(() => {
    particlesRef.current.clear();
  }, []);

  return { emit, update, draw, clear };
};

export default useSandParticles;
export { SandParticles };
