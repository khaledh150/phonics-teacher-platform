import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, View, Text, Image } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

// ============================================================================
// SPEECH BUBBLE - Shows picture or text
// ============================================================================
export function SpeechBubble({ content, type = "picture", size = 80, visible = true }) {
  const scale = useSharedValue(0);
  
  useEffect(() => {
    scale.value = visible ? withSpring(1, { damping: 12, stiffness: 200 }) : withTiming(0, { duration: 150 });
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value
  }));

  if (!visible && scale.value === 0) return null;

  return (
    <Animated.View style={[styles.speechBubble, { width: size + 30, height: size + 20 }, style]}>
      <View style={styles.bubbleInner}>
        {type === "picture" && content}
        {type === "text" && <Text style={styles.bubbleText}>{content}</Text>}
      </View>
      <View style={styles.bubbleTail} />
    </Animated.View>
  );
}

// ============================================================================
// MOTHER FROG - With tongue, speech bubble support, mouth animation for speaking
// ============================================================================
export const MotherFrog = forwardRef(function MotherFrog({
  bellyLetter,
  scale: propScale = 1,
  showTongue = true,
  tongueShared,
  speechBubbleContent = null,
  speechBubbleType = "picture",
  showSpeechBubble = false,
  onSpeakComplete
}, ref) {
  const mouthOpen = useSharedValue(0);
  const eyeSquint = useSharedValue(0);
  const blink = useSharedValue(0);
  const bounce = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  useEffect(() => {
    const doBlink = () => {
      blink.value = withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 80 }),
        withDelay(180, withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 80 })))
      );
    };
    doBlink();
    const interval = setInterval(doBlink, 3200);
    return () => clearInterval(interval);
  }, []);

  useImperativeHandle(ref, () => ({
    shoot: ({ targetX, targetY, frogCenterX, frogCenterY, onHit, onFullyDone }) => {
      if (tongueShared) {
        const dx = targetX - frogCenterX;
        const dy = targetY - frogCenterY;
        tongueShared.dx.value = dx;
        tongueShared.dy.value = dy;
        tongueShared.extend.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
        setTimeout(() => {
          tongueShared.extend.value = withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) });
        }, 240);
      }

      // Open mouth wide
      eyeSquint.value = withTiming(1, { duration: 60 });
      mouthOpen.value = withTiming(1, { duration: 80 });

      // onHit fires when tongue reaches the fly
      setTimeout(() => { if (onHit) onHit(); }, 140);

      // Retract timing — chomp after tongue retracts
      setTimeout(() => {
        setTimeout(() => {
          // Chomp — mouth closes with a chew
          mouthOpen.value = withSequence(
            withTiming(0.6, { duration: 40 }),
            withTiming(0.1, { duration: 50 }),
            withTiming(0.3, { duration: 40 }),
            withTiming(0, { duration: 60 })
          );
          eyeSquint.value = withTiming(0, { duration: 180 });
          // Satisfied bounce + pulse
          bounce.value = withSequence(
            withSpring(1, { damping: 7, stiffness: 350 }),
            withSpring(0, { damping: 10, stiffness: 180 })
          );
          if (onFullyDone) runOnJS(onFullyDone)();
        }, 220);
      }, 240);
    },
    speak: (text, callback) => {
      // No-op: speech removed. Call callback immediately.
      if (callback) callback();
    },
    celebrate: () => {
      bounce.value = withSequence(withSpring(1.5, { damping: 5, stiffness: 350 }), withSpring(0, { damping: 9, stiffness: 180 }));
    }
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bounce.value, [0, 1, 1.5], [0, -15, -20]) },
      { scale: propScale * interpolate(bounce.value, [0, 0.5, 1, 1.5], [1, 1.08, 1.12, 1]) }
    ]
  }));

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.02]) }]
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.min(interpolate(eyeSquint.value, [0, 1], [1, 0.08]), interpolate(blink.value, [0, 1], [1, 0.08])) }]
  }));

  const mouthStyle = useAnimatedStyle(() => {
    const openAmount = mouthOpen.value;
    return {
      width: interpolate(openAmount, [0, 0.6, 1], [100, 130, 170]),
      height: interpolate(openAmount, [0, 0.6, 1], [12, 45, 88]),
      borderRadius: interpolate(openAmount, [0, 0.6, 1], [6, 22, 44])
    };
  });

  return (
    <Animated.View style={[styles.motherContainer, containerStyle]}>
      {/* Speech Bubble */}
      {showSpeechBubble && (
        <View style={styles.speechBubblePosition}>
          <SpeechBubble content={speechBubbleContent} type={speechBubbleType} visible={showSpeechBubble} />
        </View>
      )}

      <View style={styles.motherLilyPad}>
        <Svg width="320" height="85" viewBox="0 0 320 85">
          <Defs><LinearGradient id="mLilyG" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#22C55E" /><Stop offset="100%" stopColor="#15803D" /></LinearGradient></Defs>
          <Ellipse cx="160" cy="50" rx="155" ry="35" fill="url(#mLilyG)" />
          <Path d="M160 15 L147 50 L173 50 Z" fill="#4DD8F0" />
          <G stroke="#0F6B32" strokeWidth="2" opacity="0.4"><Path d="M160 50 L45 42" /><Path d="M160 50 L275 42" /><Path d="M160 50 L160 82" /></G>
        </Svg>
      </View>

      <Animated.View style={[styles.motherBodyWrap, breatheStyle]}>
        <View style={[styles.mBackLeg, styles.mBackLegL]} />
        <View style={[styles.mBackLeg, styles.mBackLegR]} />

        <View style={styles.motherBody}>
          <Svg width="280" height="260" viewBox="0 0 280 260">
            <Defs>
              <LinearGradient id="mBodyG" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#B8F000" /><Stop offset="100%" stopColor="#9BD400" /></LinearGradient>
              <LinearGradient id="mBellyG" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#D4F34A" /><Stop offset="100%" stopColor="#C5E636" /></LinearGradient>
            </Defs>
            <Ellipse cx="35" cy="140" rx="35" ry="26" fill="#9BD400" />
            <Circle cx="14" cy="156" r="13" fill="#8BC400" />
            <Circle cx="28" cy="165" r="11" fill="#8BC400" />
            <Circle cx="44" cy="168" r="11" fill="#8BC400" />
            <Ellipse cx="245" cy="140" rx="35" ry="26" fill="#9BD400" />
            <Circle cx="266" cy="156" r="13" fill="#8BC400" />
            <Circle cx="252" cy="165" r="11" fill="#8BC400" />
            <Circle cx="236" cy="168" r="11" fill="#8BC400" />
            <Ellipse cx="140" cy="128" rx="92" ry="88" fill="url(#mBodyG)" />
            <Ellipse cx="140" cy="162" rx="72" ry="70" fill="url(#mBellyG)" />
            <Ellipse cx="70" cy="232" rx="30" ry="20" fill="#9BD400" />
            <Ellipse cx="210" cy="232" rx="30" ry="20" fill="#9BD400" />
          </Svg>

          <View style={styles.mBellyLetterBox}>
            <Text style={styles.mBellyLetter}>{bellyLetter || ""}</Text>
          </View>

          <View style={styles.mEyesBox}>
            <View style={styles.mEyeOuter}>
              <Animated.View style={[styles.mEyeInner, eyeStyle]}>
                <View style={styles.mPupil}><View style={styles.mSparkle} /></View>
              </Animated.View>
            </View>
            <View style={styles.mEyeOuter}>
              <Animated.View style={[styles.mEyeInner, eyeStyle]}>
                <View style={styles.mPupil}><View style={styles.mSparkle} /></View>
              </Animated.View>
            </View>
          </View>

          <View style={styles.mMouthBox}>
            <Animated.View style={[styles.mMouth, mouthStyle]}>
              <View style={styles.mMouthInner} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
});

// ============================================================================
// BABY FROG - With mouth animation for speaking
// ============================================================================
export const BabyFrog = forwardRef(function BabyFrog({ 
  x, y, label, 
  isTarget = false, 
  isEating = false, 
  showRefusal = false, 
  feedCount = 0, 
  shouldJump = false, 
  onJumpComplete, 
  screenHeight = 400,
  scale: propScale = 0.55
}, ref) {
  const mouthOpen = useSharedValue(0);
  const bounce = useSharedValue(0);
  const shake = useSharedValue(0);
  const eyeSquint = useSharedValue(0);
  const jumpOut = useSharedValue(0);
  const breathe = useSharedValue(0);

  const baseScale = propScale + feedCount * 0.05;

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  useEffect(() => {
    if (isTarget) {
      mouthOpen.value = withSpring(1, { damping: 8, stiffness: 320 });
      eyeSquint.value = withTiming(0.4, { duration: 80 });
    } else {
      mouthOpen.value = withSpring(0, { damping: 10, stiffness: 180 });
      eyeSquint.value = withTiming(0, { duration: 120 });
    }
  }, [isTarget]);

  useEffect(() => {
    if (isEating) {
      mouthOpen.value = withSequence(withTiming(1.3, { duration: 60 }), withTiming(0.4, { duration: 70 }), withTiming(0, { duration: 90 }));
      eyeSquint.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 180 }));
      bounce.value = withSequence(withSpring(1, { damping: 6, stiffness: 400 }), withSpring(0, { damping: 10, stiffness: 180 }));
    }
  }, [isEating]);

  useEffect(() => {
    if (showRefusal) {
      shake.value = withSequence(withTiming(-12, { duration: 30 }), withTiming(12, { duration: 30 }), withTiming(-10, { duration: 30 }), withTiming(10, { duration: 30 }), withTiming(-6, { duration: 30 }), withTiming(0, { duration: 35 }));
      eyeSquint.value = withSequence(withTiming(0.7, { duration: 40 }), withTiming(0, { duration: 250 }));
    }
  }, [showRefusal]);

  useEffect(() => {
    if (shouldJump) {
      jumpOut.value = withSequence(withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }), withTiming(2, { duration: 300, easing: Easing.in(Easing.quad) }));
      setTimeout(() => { if (onJumpComplete) onJumpComplete(); }, 700);
    }
  }, [shouldJump]);

  useImperativeHandle(ref, () => ({
    speak: (text, callback) => {
      // No-op: speech removed. Call callback immediately.
      if (callback) callback();
    },
  }));

  const containerStyle = useAnimatedStyle(() => {
    const bounceY = interpolate(bounce.value, [0, 1], [0, -22]);
    const scaleB = interpolate(bounce.value, [0, 1], [1, 1.15]);
    const jumpY = interpolate(jumpOut.value, [0, 1, 2], [0, -80, 200]);
    const jumpScale = interpolate(jumpOut.value, [0, 1, 2], [1, 1.2, 0.3]);
    const jumpOpacity = interpolate(jumpOut.value, [0, 1.5, 2], [1, 1, 0]);
    const rotation = interpolate(jumpOut.value, [0, 1, 2], [0, -15, 45]);
    return {
      opacity: jumpOpacity,
      transform: [{ translateX: shake.value }, { translateY: bounceY + jumpY }, { scale: scaleB * jumpScale * baseScale }, { rotate: `${rotation}deg` }]
    };
  });

  const mouthStyle = useAnimatedStyle(() => {
    const openAmount = Math.max(isTarget ? 1 : 0, mouthOpen.value);
    return {
      width: interpolate(openAmount, [0, 0.5, 1, 1.3], [100, 120, 160, 175]),
      height: interpolate(openAmount, [0, 0.5, 1, 1.3], [12, 35, 80, 92]),
      borderRadius: interpolate(openAmount, [0, 0.5, 1, 1.3], [6, 18, 40, 46])
    };
  });

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(eyeSquint.value, [0, 1], [1, 0.12]) }]
  }));

  const topPos = Math.max(y - 130, screenHeight * 0.02);

  return (
    <Animated.View style={[styles.babyContainer, { left: x - 140, top: topPos }, containerStyle]}>
      <View style={styles.babyLilyPad}>
        <Svg width="320" height="85" viewBox="0 0 320 85">
          <Defs><LinearGradient id="bLilyG" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#22C55E" /><Stop offset="100%" stopColor="#15803D" /></LinearGradient></Defs>
          <Ellipse cx="160" cy="50" rx="155" ry="35" fill="url(#bLilyG)" />
          <Path d="M160 15 L147 50 L173 50 Z" fill="#4DD8F0" />
          <G stroke="#0F6B32" strokeWidth="2" opacity="0.4"><Path d="M160 50 L45 42" /><Path d="M160 50 L275 42" /><Path d="M160 50 L160 82" /></G>
        </Svg>
      </View>

      <Animated.View style={styles.babyBodyWrap}>
        <View style={[styles.mBackLeg, styles.mBackLegL]} />
        <View style={[styles.mBackLeg, styles.mBackLegR]} />

        <View style={styles.motherBody}>
          <Svg width="280" height="260" viewBox="0 0 280 260">
            <Defs>
              <LinearGradient id="bBodyG" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#B8F000" /><Stop offset="100%" stopColor="#9BD400" /></LinearGradient>
              <LinearGradient id="bBellyG" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#D4F34A" /><Stop offset="100%" stopColor="#C5E636" /></LinearGradient>
            </Defs>
            <Ellipse cx="35" cy="140" rx="35" ry="26" fill="#9BD400" />
            <Circle cx="14" cy="156" r="13" fill="#8BC400" />
            <Circle cx="28" cy="165" r="11" fill="#8BC400" />
            <Circle cx="44" cy="168" r="11" fill="#8BC400" />
            <Ellipse cx="245" cy="140" rx="35" ry="26" fill="#9BD400" />
            <Circle cx="266" cy="156" r="13" fill="#8BC400" />
            <Circle cx="252" cy="165" r="11" fill="#8BC400" />
            <Circle cx="236" cy="168" r="11" fill="#8BC400" />
            <Ellipse cx="140" cy="128" rx="92" ry="88" fill="url(#bBodyG)" />
            <Ellipse cx="140" cy="162" rx="72" ry="70" fill="url(#bBellyG)" />
            <Ellipse cx="70" cy="232" rx="30" ry="20" fill="#9BD400" />
            <Ellipse cx="210" cy="232" rx="30" ry="20" fill="#9BD400" />
          </Svg>

          <View style={styles.mBellyLetterBox}>
            <Text style={styles.mBellyLetter}>{label}</Text>
          </View>

          <View style={styles.mEyesBox}>
            <View style={styles.mEyeOuter}>
              <Animated.View style={[styles.mEyeInner, eyeStyle]}>
                <View style={styles.mPupil}><View style={styles.mSparkle} /></View>
              </Animated.View>
            </View>
            <View style={styles.mEyeOuter}>
              <Animated.View style={[styles.mEyeInner, eyeStyle]}>
                <View style={styles.mPupil}><View style={styles.mSparkle} /></View>
              </Animated.View>
            </View>
          </View>

          <View style={styles.mMouthBox}>
            <Animated.View style={[styles.mMouth, mouthStyle]}>
              <View style={styles.mMouthInner} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
});

// ============================================================================
// PHONICS BUG (FLY) - Flies left to right across screen
// ============================================================================
export function PhonicsBug({
  id,
  startX,
  y,
  speed = 50,
  delay = 0,
  screenWidth,
  letter,
  onPress,
  disabled,
  isBeingEaten,
  targetX,
  targetY,
  onPositionUpdate
}) {
  const posX = useSharedValue(startX);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const wingFlap = useSharedValue(0);
  const wobbleY = useSharedValue(0);
  const currentX = useRef(startX);

  // Initialize and start left-to-right movement
  useEffect(() => {
    // Pop in animation
    scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 180 }));

    // Start wing flapping
    wingFlap.value = withRepeat(withTiming(1, { duration: 90 }), -1, true);

    // Gentle vertical wobble
    wobbleY.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8, { duration: 500, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    );

    // Move from left to right
    const endX = screenWidth + 100;
    const duration = ((endX - startX) / speed) * 1000;
    posX.value = withDelay(delay, withTiming(endX, {
      duration,
      easing: Easing.linear
    }));
  }, []);

  // Handle being eaten — fly gets pulled to frog mouth by tongue
  useEffect(() => {
    if (isBeingEaten && targetX !== undefined && targetY !== undefined) {
      // Fly travels to mouth over 220ms matching tongue retract
      posX.value = withTiming(targetX, { duration: 220, easing: Easing.inOut(Easing.quad) });
      wobbleY.value = withTiming(targetY - y, { duration: 220, easing: Easing.inOut(Easing.quad) });
      // Shrink as it approaches mouth
      scale.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) });
      opacity.value = withDelay(200, withTiming(0, { duration: 50 }));
    }
  }, [isBeingEaten, targetX, targetY]);

  const style = useAnimatedStyle(() => {
    // Update ref for tap position tracking
    currentX.current = posX.value;
    return {
      opacity: opacity.value,
      transform: [
        { translateX: posX.value - 50 },
        { translateY: y - 45 + wobbleY.value },
        { scale: scale.value }
      ]
    };
  });

  const leftWing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(wingFlap.value, [0, 1], [-35, 25])}deg` }]
  }));
  const rightWing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(wingFlap.value, [0, 1], [35, -25])}deg` }]
  }));

  const handlePress = (event) => {
    if (onPress) {
      // Pass tap coordinates
      const tapX = event.nativeEvent.pageX;
      const tapY = event.nativeEvent.pageY;
      onPress(tapX, tapY);
    }
  };

  return (
    <Animated.View style={[styles.bugBox, style]}>
      <Pressable onPress={handlePress} disabled={disabled || isBeingEaten} style={styles.bugPress}>
        <Animated.View style={[styles.bugWing, styles.bugWingL, leftWing]} />
        <Animated.View style={[styles.bugWing, styles.bugWingR, rightWing]} />
        <View style={styles.bugBody}><Text style={styles.bugLetter}>{letter}</Text></View>
        <View style={styles.bugAntennae}>
          <View style={[styles.bugAntenna, styles.bugAntennaL]}><View style={styles.bugBall} /></View>
          <View style={[styles.bugAntenna, styles.bugAntennaR]}><View style={styles.bugBall} /></View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// HAND TUTORIAL - Simple emoji hand like tracing game
// ============================================================================
export function HandTutorial({ fromX, fromY, toX, toY, visible }) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      progress.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(400, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })),
          withDelay(300, withTiming(0, { duration: 0 }))
        ), -1, false
      );
    } else {
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [fromX, toX]) - 25 },
      { translateY: interpolate(progress.value, [0, 1], [fromY, toY]) - 10 },
      { scale: interpolate(progress.value, [0, 0.1, 0.9, 1], [1, 0.9, 0.9, 1]) }
    ]
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.handBox, style]} pointerEvents="none">
      <Text style={styles.handEmoji}>👆</Text>
    </Animated.View>
  );
}

// ============================================================================
// SCREEN-LEVEL TONGUE — rendered outside frog to avoid Android overflow clipping
// ============================================================================
export function ScreenTongue({ tongueShared, mouthX, mouthY }) {
  const style = useAnimatedStyle(() => {
    const ext = tongueShared.extend.value;
    if (ext < 0.01) return { opacity: 0, width: 0, height: 0 };

    const dx = tongueShared.dx.value * ext;
    const dy = tongueShared.dy.value * ext;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Thick tongue — single solid piece with rounded ends
    const thick = 28;
    // RN transforms are from center, so translate center of rect to midpoint of tongue line
    const rad = angle * (Math.PI / 180);
    const cx = (len / 2) * Math.cos(rad);
    const cy = (len / 2) * Math.sin(rad);

    return {
      opacity: 1,
      width: len,
      height: thick,
      borderRadius: thick / 2,
      transform: [
        { translateX: cx },
        { translateY: cy - thick / 2 },
        { rotate: `${angle}deg` },
      ],
    };
  });

  return (
    <View style={{ position: 'absolute', left: mouthX, top: mouthY, zIndex: 150 }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', backgroundColor: '#E53935' }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  motherContainer: { alignItems: "center", justifyContent: "flex-end" },
  motherLilyPad: { position: "absolute", bottom: 0 },
  motherBodyWrap: { alignItems: "center", marginBottom: 25 },
  motherBody: { width: 280, height: 260, alignItems: "center" },
  mBackLeg: { position: "absolute", bottom: 48, width: 70, height: 46, backgroundColor: "#8BC400", borderRadius: 24 },
  mBackLegL: { left: 22, transform: [{ rotate: "-16deg" }] },
  mBackLegR: { right: 22, transform: [{ rotate: "16deg" }] },
  mBellyLetterBox: { position: "absolute", top: 138, alignItems: "center", justifyContent: "center" },
  mBellyLetter: { fontSize: 78, fontWeight: "900", color: "white", textShadowColor: "rgba(0,0,0,0.16)", textShadowRadius: 5, textShadowOffset: { width: 0, height: 3 } },
  mEyesBox: { position: "absolute", top: 5, flexDirection: "row", gap: 44 },
  mEyeOuter: { width: 78, height: 78, backgroundColor: "white", borderRadius: 39, borderWidth: 4, borderColor: "#B8F000", alignItems: "center", justifyContent: "center" },
  mEyeInner: { width: 58, height: 58, backgroundColor: "#1B5E20", borderRadius: 29, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  mPupil: { width: 34, height: 34, backgroundColor: "#0D2E10", borderRadius: 17, alignItems: "center", paddingTop: 6 },
  mSparkle: { width: 12, height: 12, backgroundColor: "white", transform: [{ rotate: "45deg" }] },
  mMouthBox: { position: "absolute", top: 88, alignItems: "center" },
  mMouth: { width: 100, height: 12, backgroundColor: "#2D5016", overflow: "hidden", alignItems: "center", justifyContent: "flex-end" },
  mMouthInner: { position: "absolute", bottom: 0, width: "100%", height: "100%", backgroundColor: "#7A1530" },
  babyContainer: { position: "absolute", width: 280, alignItems: "center" },
  babyLilyPad: { position: "absolute", bottom: 0 },
  babyBodyWrap: { alignItems: "center", marginBottom: 25 },
  bugBox: { position: "absolute", zIndex: 200 },
  bugPress: { width: 100, height: 90, alignItems: "center", justifyContent: "center" },
  bugWing: { position: "absolute", top: 18, width: 40, height: 34, backgroundColor: "#D4A5FF", borderRadius: 18, opacity: 0.88 },
  bugWingL: { left: 5 },
  bugWingR: { right: 5 },
  bugBody: { width: 60, height: 54, backgroundColor: "#8B2FC9", borderRadius: 27, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  bugLetter: { fontSize: 26, fontWeight: "900", color: "white", textShadowColor: "rgba(0,0,0,0.18)", textShadowRadius: 2 },
  bugAntennae: { position: "absolute", top: 4, width: 42, flexDirection: "row", justifyContent: "space-between" },
  bugAntenna: { width: 3, height: 15, backgroundColor: "#2C163D", borderRadius: 2 },
  bugAntennaL: { transform: [{ rotate: "-22deg" }] },
  bugAntennaR: { transform: [{ rotate: "22deg" }] },
  bugBall: { position: "absolute", top: -4, left: -4, width: 11, height: 11, backgroundColor: "#2C163D", borderRadius: 6 },
  handBox: { position: "absolute", zIndex: 1000 },
  handEmoji: { fontSize: 50 },
  speechBubble: { backgroundColor: "white", borderRadius: 16, padding: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  speechBubblePosition: { position: "absolute", top: -100, left: -60, zIndex: 100 },
  bubbleInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleText: { fontSize: 24, fontWeight: "bold", color: "#333" },
  bubbleTail: { position: "absolute", bottom: -12, left: "50%", marginLeft: -10, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 14, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "white" },
});