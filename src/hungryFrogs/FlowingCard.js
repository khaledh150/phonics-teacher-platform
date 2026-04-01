import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import Svg, { Ellipse, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, withDelay, Easing, runOnJS, cancelAnimation, interpolate } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { getWordImage } from "../../utils/wordImages";

const DefPic = ({ word, size }) => (
  <View style={[styles.defPic, { width: size, height: size }]}>
    <Text style={styles.defTxt}>{(word || "?").slice(0, 3).toUpperCase()}</Text>
  </View>
);

// Text card component (shows word text instead of picture)
const TextContent = ({ word, size }) => (
  <View style={[styles.textContent, { width: size, height: size }]}>
    <Text style={styles.wordText}>{word}</Text>
  </View>
);

// Single particle — hook called at component top level (not inside .map)
function BurstParticleItem({ x, y, angle, speed, size, color, progress }) {
  const style = useAnimatedStyle(() => {
    const dist = speed * progress.value;
    return {
      position: "absolute",
      left: x + Math.cos(angle) * dist - size / 2,
      top: y + Math.sin(angle) * dist - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      opacity: interpolate(progress.value, [0, 0.3, 1], [1, 1, 0]),
      transform: [{ scale: interpolate(progress.value, [0, 0.5, 1], [0.5, 1.2, 0.3]) }]
    };
  });
  return <Animated.View style={style} />;
}

// Particle burst effect
function ParticleBurst({ x, y, color, onComplete }) {
  const particles = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      angle: (i / 12) * Math.PI * 2,
      speed: 80 + Math.random() * 60,
      size: 8 + Math.random() * 10,
    })), []);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }, (fin) => {
      if (fin && onComplete) runOnJS(onComplete)();
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 500 }]} pointerEvents="none">
      {particles.map(p => (
        <BurstParticleItem key={p.id} x={x} y={y} angle={p.angle} speed={p.speed} size={p.size} color={color} progress={progress} />
      ))}
    </View>
  );
}

// Flowing Lily Pad (keeps moving regardless of card state)
function FlowingLilyPad({ x, y }) {
  return (
    <View style={[styles.lilyPadOnly, { left: x - 60, top: y }]}>
      <Svg width="120" height="50" viewBox="0 0 120 50">
        <Defs>
          <LinearGradient id="lpG" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#2ECC71"/>
            <Stop offset="100%" stopColor="#1E8449"/>
          </LinearGradient>
        </Defs>
        <Ellipse cx="60" cy="28" rx="58" ry="22" fill="url(#lpG)"/>
        {/* Scalloped white edge */}
        <Path d="M10 28 Q15 18 25 22 Q35 16 45 22 Q55 16 65 22 Q75 16 85 22 Q95 16 105 22 Q110 28 105 34 Q95 40 85 34 Q75 40 65 34 Q55 40 45 34 Q35 40 25 34 Q15 38 10 28" fill="none" stroke="white" strokeWidth="3" opacity="0.6"/>
        <Path d="M60 6 L52 28 L68 28 Z" fill="#4DD8F0"/>
      </Svg>
    </View>
  );
}

// Main FlowingCard component
export default function FlowingCard({ 
  id, 
  word, 
  image, 
  leafX,  // Leaf position (controlled externally)
  leafY,
  screenWidth, 
  screenHeight, 
  onPickUp,
  onDrop, 
  onFeed,
  isPickedUp = false,
  showType = "picture", // "picture" or "text"
  colorIndex = 0,
  frogPosition,
  disabled = false
}) {
  const cardX = useSharedValue(leafX - 45); // Center card on leaf (leaf center = leafX, card is 90 wide)
  const cardY = useSharedValue(leafY - 45); // Card sits centered on top of leaf
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const bobOffset = useSharedValue(0);
  const isDragging = useRef(false);

  const colors = ["#E040FB", "#7C4DFF", "#40C4FF", "#69F0AE", "#FFAB40", "#FF5252", "#EA80FC", "#64FFDA", "#FF6B9D", "#8BC34A"];
  const cardColor = colors[colorIndex % colors.length];

  // Bob animation when on leaf
  useEffect(() => {
    if (!isPickedUp) {
      bobOffset.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(-5, { duration: 900, easing: Easing.inOut(Easing.sin) })
        ), -1, true
      );
    } else {
      cancelAnimation(bobOffset);
      bobOffset.value = 0;
    }
  }, [isPickedUp]);

  // Update card position to follow leaf when not picked up
  useEffect(() => {
    if (!isDragging.current && !isPickedUp) {
      cardX.value = leafX - 45; // Center card on leaf
      cardY.value = leafY - 45; // Card sits centered on top of leaf
    }
  }, [leafX, leafY, isPickedUp]);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      isDragging.current = true;
      scale.value = withSpring(1.15, { damping: 10, stiffness: 300 });
      if (onPickUp) runOnJS(onPickUp)(id, word);
    })
    .onUpdate((e) => {
      cardX.value = e.absoluteX - 45;
      cardY.value = e.absoluteY - 45;
      rotation.value = e.velocityX * 0.008;
    })
    .onEnd((e) => {
      isDragging.current = false;
      rotation.value = withSpring(0);
      scale.value = withSpring(1);

      // Check if dropped on frog
      if (frogPosition) {
        const dx = e.absoluteX - frogPosition.x;
        const dy = e.absoluteY - frogPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          // Fed to frog
          if (onFeed) runOnJS(onFeed)(id, word, e.absoluteX, e.absoluteY);
          return;
        }
      }

      // Not fed - disappear quickly without burst animation
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.3, { duration: 150 });

      if (onDrop) runOnJS(onDrop)(id, word, e.absoluteX, e.absoluteY);
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: cardX.value },
      { translateY: cardY.value + (isPickedUp ? 0 : bobOffset.value) },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` }
    ]
  }));

  const wordImg = getWordImage(image) || getWordImage(word);

  return (
    <>
      {/* Lily pad always visible and flowing */}
      <FlowingLilyPad x={leafX} y={leafY} />

      {/* Card - can be picked up */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.cardOnly, cardStyle]}>
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <View style={styles.cardInner}>
              {showType === "picture" ? (
                wordImg ? <Image source={wordImg} style={{ width: 64, height: 64, borderRadius: 6 }} resizeMode="contain" /> : <DefPic word={word} size={64}/>
              ) : (
                <TextContent word={word} size={64} />
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

// Component for managing multiple flowing cards with fixed spacing
export function FlowingCardManager({
  cards,
  screenWidth,
  screenHeight,
  flowSpeed = 60,
  cardSpacing = 180,
  onPickUp,
  onDrop,
  onFeed,
  showType = "picture",
  frogPosition,
  disabled = false
}) {
  const [leafPositions, setLeafPositions] = useState({});
  const [pickedUpCards, setPickedUpCards] = useState(new Set());
  const removedCardsRef = useRef(new Set());
  const lastTime = useRef(Date.now());
  const prevCardIdsRef = useRef('');

  // Initialize positions when cards change (new word or first load)
  useEffect(() => {
    if (cards.length === 0) return;

    // Build a signature from card IDs to detect when the card set changes
    const cardIdSig = cards.map(c => c.id).sort().join(',');
    if (cardIdSig === prevCardIdsRef.current) return;

    prevCardIdsRef.current = cardIdSig;
    removedCardsRef.current = new Set();
    setPickedUpCards(new Set());

    const positions = {};
    const baseY = screenHeight * 0.68;
    cards.forEach((card, i) => {
      positions[card.id] = {
        x: -cardSpacing - i * cardSpacing,
        y: baseY,
        baseY: baseY
      };
    });
    setLeafPositions(positions);
  }, [cards, screenHeight, cardSpacing]);

  // Animate flowing
  useEffect(() => {
    let frameId;
    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - lastTime.current) / 1000, 0.1);
      lastTime.current = now;

      setLeafPositions(prev => {
        const newPositions = {};
        const xValues = Object.values(prev).map(p => p.x);
        const minX = xValues.length > 0 ? Math.min(...xValues) : -cardSpacing;

        Object.entries(prev).forEach(([id, pos]) => {
          let newX = pos.x + flowSpeed * dt;
          // Wrap around when off screen
          if (newX > screenWidth + 100) {
            newX = minX - cardSpacing;
          }
          // Wavy sine flow — vertical oscillation based on x position
          const waveY = Math.sin(newX * 0.012) * 14;
          newPositions[id] = { ...pos, x: newX, y: pos.baseY + waveY };
        });
        return newPositions;
      });

      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [flowSpeed, screenWidth, cardSpacing]);

  const handlePickUp = (id, word) => {
    setPickedUpCards(prev => new Set([...prev, id]));
    if (onPickUp) onPickUp(id, word);
  };

  const handleDrop = (id, word, x, y) => {
    setPickedUpCards(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Mark card as removed
    removedCardsRef.current.add(id);
    // Remove from positions
    setLeafPositions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (onDrop) onDrop(id, word, x, y);
  };

  const handleFeed = (id, word, x, y) => {
    setPickedUpCards(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Mark card as removed
    removedCardsRef.current.add(id);
    // Remove from positions
    setLeafPositions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (onFeed) onFeed(id, word, x, y);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {cards.map((card, i) => {
        // Skip if card was removed
        if (removedCardsRef.current.has(card.id)) return null;
        const pos = leafPositions[card.id];
        if (!pos) return null;
        return (
          <FlowingCard
            key={card.id}
            id={card.id}
            word={card.word}
            image={card.image}
            leafX={pos.x}
            leafY={pos.y}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            onPickUp={handlePickUp}
            onDrop={handleDrop}
            onFeed={handleFeed}
            isPickedUp={pickedUpCards.has(card.id)}
            showType={showType}
            colorIndex={i}
            frogPosition={frogPosition}
            disabled={disabled}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lilyPadOnly: { position: "absolute", zIndex: 50 },
  cardOnly: { position: "absolute", width: 90, height: 90, zIndex: 100 },
  card: { width: 85, height: 85, borderRadius: 14, padding: 4, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  cardInner: { flex: 1, backgroundColor: "white", borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  defPic: { backgroundColor: "#F0F0F0", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  defTxt: { fontSize: 20, fontWeight: "bold", color: "#666" },
  textContent: { alignItems: "center", justifyContent: "center", padding: 4 },
  wordText: { fontSize: 22, fontWeight: "bold", color: "#333", textAlign: "center" },
});