// src/games/tracing/ParticleLayer.js
import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const BURST_COUNT = 180;
const TRAIL_COUNT = 48;

const PALETTE = [
  "rgba(255,107,157,0.95)", // pink
  "rgba(124,58,237,0.95)",  // purple
  "rgba(255,211,42,0.95)",  // yellow
  "rgba(168,230,207,0.95)", // mint
  "rgba(61,204,199,0.95)",  // teal
  "rgba(255,165,2,0.95)",   // orange
];

const hash01 = (n) => {
  "worklet";
  const x = Math.sin(n * 999.123) * 10000;
  return x - Math.floor(x);
};

function BurstParticle({ seed, progress, width, height, color }) {
  const st = useAnimatedStyle(() => {
    const t = progress.value; // 0..1
    if (t <= 0.0001) return { opacity: 0 };

    const eased = Easing.out(Easing.cubic)(t);

    const baseX = hash01(seed * 1.7) * width;
    const baseY = hash01(seed * 2.3) * height;

    const ang = hash01(seed * 3.1) * Math.PI * 2;
    const dist = 220 + hash01(seed * 4.9) * 820;

    const dx = Math.cos(ang) * dist * eased;
    const dy = Math.sin(ang) * dist * eased - 260 * eased;

    const size = 7 + hash01(seed * 5.7) * 18;

    const opacity = t < 0.70 ? 1 : Math.max(0, 1 - (t - 0.70) / 0.30);
    const scale = 0.9 + 0.8 * (1 - Math.abs(0.5 - t) * 2);

    return {
      opacity,
      transform: [
        { translateX: baseX + dx - size / 2 },
        { translateY: baseY + dy - size / 2 },
        { scale },
      ],
    };
  }, [width, height]);

  return <Animated.View pointerEvents="none" style={[styles.burst, { backgroundColor: color }, st]} />;
}

function TrailParticle({ idx, triggerSV, followX, followY, active, color }) {
  const x = useSharedValue(-9999);
  const y = useSharedValue(-9999);
  const o = useSharedValue(0);
  const s = useSharedValue(0.7);

  const size = 6 + (idx % 9) * 2;

  useAnimatedReaction(
    () => triggerSV.value,
    (cur, prev) => {
      if (cur === prev) return;
      if (!active.value) return;

      // Spread spawns
      if ((cur + idx) % 3 !== 0) return;

      const fx = followX.value;
      const fy = followY.value;

      const ang = hash01(idx * 12.3 + cur * 0.7) * Math.PI * 2;
      const r = 18 + hash01(idx * 7.7 + cur * 1.1) * 70;

      x.value = fx - size / 2;
      y.value = fy - size / 2;
      o.value = 0.95;
      s.value = 0.75;

      x.value = withTiming(fx + Math.cos(ang) * r - size / 2, { duration: 300, easing: Easing.out(Easing.quad) });
      y.value = withTiming(fy + Math.sin(ang) * r - size / 2, { duration: 300, easing: Easing.out(Easing.quad) });

      s.value = withTiming(1.35, { duration: 300, easing: Easing.out(Easing.quad) });
      o.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    },
    []
  );

  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.trail,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        st,
      ]}
    />
  );
}

export default function ParticleLayer({ width, height, burstTrigger, trailTriggerSV, followX, followY, active }) {
  const burstProgress = useSharedValue(0);

  const burstSeeds = useMemo(() => Array.from({ length: BURST_COUNT }, (_, i) => i + 1), []);
  const trailIdx = useMemo(() => Array.from({ length: TRAIL_COUNT }, (_, i) => i + 1), []);

  useEffect(() => {
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, { duration: 980, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstTrigger]);

  return (
    <>
      {trailTriggerSV && followX && followY && active &&
        trailIdx.map((n) => (
          <TrailParticle
            key={`tr-${n}`}
            idx={n}
            triggerSV={trailTriggerSV}
            followX={followX}
            followY={followY}
            active={active}
            color={PALETTE[n % PALETTE.length]}
          />
        ))}

      {burstSeeds.map((n) => (
        <BurstParticle
          key={`b-${n}`}
          seed={n}
          progress={burstProgress}
          width={width}
          height={height}
          color={PALETTE[n % PALETTE.length]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  trail: {
    position: "absolute",
  },
});
