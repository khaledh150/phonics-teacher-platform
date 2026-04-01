import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Canvas, Rect, Circle, Group, RoundedRect, LinearGradient, vec, Oval } from "@shopify/react-native-skia";
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";

// ============== BACKGROUND LAYER ==============
// Sky, bushes, water, ripples, cattails — renders BEHIND content
export function PondBackground({ mode = "eating" }) {
  const { width, height } = useWindowDimensions();
  const horizonY = Math.min(height * 0.16, 100);
  const waterTop = horizonY + 18;
  const waterH = height - waterTop;

  const flow = useSharedValue(0);
  useEffect(() => {
    flow.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
  }, []);

  const lines = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      const baseY = waterTop + (i / 6) * waterH * 0.7 + 30;
      for (let j = 0; j < 3; j++) {
        arr.push({ id: `${i}-${j}`, y: baseY + Math.random() * 35, off: Math.random() * width, w: 50 + Math.random() * 40, op: 0.32 + Math.random() * 0.22 });
      }
    }
    return arr;
  }, [width, height]);

  const lineX = lines.map(l => useDerivedValue(() => ((l.off + flow.value * (width + 180)) % (width + l.w + 50)) - l.w - 25));

  const bushBack = useMemo(() => [
    { cx: -10, cy: horizonY - 18, rx: 60, ry: 45 },
    { cx: width * 0.14, cy: horizonY - 32, rx: 70, ry: 55 },
    { cx: width * 0.34, cy: horizonY - 25, rx: 82, ry: 52 },
    { cx: width * 0.5, cy: horizonY - 40, rx: 90, ry: 60 },
    { cx: width * 0.66, cy: horizonY - 28, rx: 80, ry: 54 },
    { cx: width * 0.84, cy: horizonY - 22, rx: 68, ry: 48 },
    { cx: width + 10, cy: horizonY - 18, rx: 55, ry: 42 },
  ], [width, horizonY]);

  const bushFront = useMemo(() => [
    { cx: width * 0.07, cy: horizonY - 2, rx: 52, ry: 36 },
    { cx: width * 0.24, cy: horizonY - 7, rx: 58, ry: 40 },
    { cx: width * 0.44, cy: horizonY, rx: 64, ry: 38 },
    { cx: width * 0.62, cy: horizonY - 8, rx: 56, ry: 40 },
    { cx: width * 0.8, cy: horizonY - 3, rx: 60, ry: 38 },
    { cx: width * 0.96, cy: horizonY - 5, rx: 48, ry: 34 },
  ], [width, horizonY]);

  const cattails = useMemo(() => [
    { x: width * 0.02, h: 70, b: 28 },
    { x: width * 0.06, h: 58, b: 24 },
    { x: width * 0.04, h: 78, b: 30 },
    { x: width * 0.94, h: 65, b: 26 },
    { x: width * 0.97, h: 75, b: 29 },
    { x: width * 0.99, h: 60, b: 23 },
  ], [width]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Sky */}
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, waterTop)} colors={["#B8F4FF", "#A5EFFF", "#8BE8FF"]} />
      </Rect>

      {/* Back bushes */}
      {bushBack.map((b, i) => <Oval key={`bb${i}`} x={b.cx - b.rx} y={b.cy - b.ry} width={b.rx * 2} height={b.ry * 2} color="#0D9B5C" />)}

      {/* Front bushes */}
      {bushFront.map((b, i) => <Oval key={`bf${i}`} x={b.cx - b.rx} y={b.cy - b.ry} width={b.rx * 2} height={b.ry * 2} color="#15B86A" />)}

      {/* Water */}
      <Rect x={0} y={waterTop} width={width} height={waterH}>
        <LinearGradient start={vec(0, waterTop)} end={vec(0, height)} colors={["#4DD8F0", "#38CCE8", "#22C0E0"]} />
      </Rect>

      {/* Ripple lines */}
      {lines.map((l, i) => <RoundedRect key={l.id} x={lineX[i]} y={l.y} width={l.w} height={4} r={2} color="white" opacity={l.op} />)}

      {/* Cattails */}
      {cattails.map((c, i) => (
        <Group key={`ct${i}`}>
          <RoundedRect x={c.x - 3} y={height - c.h} width={6} height={c.h} r={3} color="#0D9B5C" />
          <RoundedRect x={c.x - 10} y={height - c.h - c.b + 5} width={20} height={c.b} r={10} color="#E8823A" />
        </Group>
      ))}
    </Canvas>
    </View>
  );
}

// ============== FOREGROUND LAYER ==============
// Plants at bottom edges — renders ON TOP of content (no animation needed)
export function PondForeground({ mode = "eating" }) {
  const { width, height } = useWindowDimensions();

  const fgPlants = useMemo(() => mode !== "eating" ? [] : [
    { cx: -18, cy: height + 35, r: 110 },
    { cx: 45, cy: height + 50, r: 90 },
    { cx: 110, cy: height + 62, r: 70 },
    { cx: width - 100, cy: height + 58, r: 75 },
    { cx: width - 38, cy: height + 45, r: 95 },
    { cx: width + 18, cy: height + 32, r: 105 },
  ], [mode, width, height]);

  if (fgPlants.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {fgPlants.map((p, i) => <Circle key={`fg${i}`} cx={p.cx} cy={p.cy} r={p.r} color={i % 2 === 0 ? "#0CAA4A" : "#12C456"} />)}
      </Canvas>
    </View>
  );
}

// ============== COMBINED (backward-compatible default) ==============
export default function StablePond({ children, mode = "eating" }) {
  return (
    <View style={styles.container}>
      <PondBackground mode={mode} />
      <View style={styles.content} pointerEvents="box-none">{children}</View>
      <PondForeground mode={mode} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#8BE8FF" },
  content: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
});
