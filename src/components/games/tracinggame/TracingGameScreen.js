// 🎮 Wonder-Phonics TracingGameScreen (Skia + Reanimated 3)
// - Sounds: Uppercase CENTER → trace → slide LEFT (no duplicates) → Lowercase RIGHT → trace → both POP & BURST → next sound
// - Words (after all sounds): UPPERCASE ONLY
//   Letter 1 traces CENTER → slides into centered word slots → letter 2 traces CENTER → ... → full word POP & BURST → next word
// - Fixes in this version:
//   1) Word letters are UPPERCASE only
//   2) Word layout scales + spaces to avoid overlap (including 3rd letter appearance) and stays centered with no overflow
//   3) End-of-word pop no longer overlaps weirdly (better spacing + uniform group pop scale)
//   4) Theme/background transitions are crossfaded for smoothness
//   5) Keeps worklet-safety (no non-worklet called on UI thread) and stable hook order

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient as SkiaLinearGradient,
  Path,
  Skia,
  vec,
} from "@shopify/react-native-skia";

import { getTracingGlyphForTarget } from "../games/tracing/tracingPaths";
import TracingBackgrounds from "../games/tracing/TracingBackgrounds";
import ParticleLayer from "../games/tracing/ParticleLayer";
import { PHONICS_GROUPS } from "../data/phonicsData";

const TRACING_PATTERNS = {
  horizontalRainbow: {
    colors: ["#FFEB3B", "#FFC0CB", "#FF6B9D", "#4DD0E1", "#FF9800", "#B2FF59"],
    intervals: [12, 4],
  },
  purpleStars: {
    colors: ["#9C4DCC", "#7B1FA2", "#9C4DCC"],
    intervals: [6, 6],
  },
  limeGreen: {
    colors: ["#C6FF00", "#AEEA00", "#C6FF00"],
    intervals: [14, 4],
  },
};

const THEME_CONFIGS = {
  autumn: { bg: "autumn", animal: "🦔", pattern: "purpleStars" },
  beach: { bg: "beach", animal: "🐠", pattern: "limeGreen" },
  space: { bg: "space", animal: "👽", pattern: "horizontalRainbow" },
};

const THEME_ROTATION = ["space", "autumn", "beach"];

const PATH_CORRIDOR_WIDTH = 80;
const ANIMAL_GRAB_RADIUS = 70;

// ------------ Geometry helpers ------------
const generateSmoothPath = (normalizedPoints, width, height, centerX, centerY) => {
  if (!normalizedPoints || normalizedPoints.length === 0) return { points: [], pathString: "", isDot: false };
  const screenPoints = normalizedPoints.map(([nx, ny]) => ({
    x: centerX + (nx - 0.5) * width,
    y: centerY + (ny - 0.5) * height,
  }));
  if (screenPoints.length === 1) return { points: screenPoints, pathString: "", isDot: true };

  const path = Skia.Path.Make();
  path.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    const prev = screenPoints[i - 1];
    const curr = screenPoints[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    if (i === 1) path.lineTo(midX, midY);
    else path.quadTo(prev.x, prev.y, midX, midY);
  }
  const last = screenPoints[screenPoints.length - 1];
  path.lineTo(last.x, last.y);
  return { points: screenPoints, pathString: path.toSVGString(), isDot: false };
};

const generateDots = (points, isUppercase) => {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  let totalLength = 0;
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
    segments.push(totalLength);
  }

  const numDots = isUppercase
    ? totalLength < 250
      ? 6
      : totalLength < 400
        ? 7
        : totalLength < 550
          ? 8
          : 9
    : totalLength < 200
      ? 4
      : totalLength < 350
        ? 5
        : 6;

  const dots = [];
  for (let i = 0; i <= numDots; i++) {
    const targetLength = (i / numDots) * totalLength;
    let accLength = 0;
    let segmentIndex = 0;
    for (let j = 0; j < segments.length; j++) {
      if (targetLength <= segments[j]) {
        segmentIndex = j;
        break;
      }
      accLength = segments[j];
    }
    const denom = segments[segmentIndex] - accLength;
    const t = denom > 0 ? (targetLength - accLength) / denom : 0;
    const p1 = points[segmentIndex];
    const p2 = points[Math.min(segmentIndex + 1, points.length - 1)];
    dots.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      index: i,
      percentage: i / numDots,
    });
  }
  return dots;
};

const projectToPath = (points, x, y, currentIndex) => {
  "worklet";
  if (!points || points.length === 0) return { x, y, index: 0, distance: 9999, isInCorridor: false };

  const searchStart = Math.max(0, currentIndex - 3);
  const searchEnd = Math.min(points.length, currentIndex + 28);

  let closestDist = Infinity;
  let closestIdx = currentIndex;
  let closestPoint = points[Math.min(currentIndex, points.length - 1)];

  for (let i = searchStart; i < searchEnd; i++) {
    const dx = points[i].x - x;
    const dy = points[i].y - y;
    const dist = dx * dx + dy * dy;
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
      closestPoint = points[i];
    }
  }

  const distance = Math.sqrt(closestDist);
  const isInCorridor = distance <= PATH_CORRIDOR_WIDTH;
  return { x: closestPoint.x, y: closestPoint.y, index: closestIdx, distance, isInCorridor };
};

// ------------ Dots (checkpoint) ------------
const CheckpointDot = React.memo(function CheckpointDot({
  cx,
  cy,
  index,
  currentDotIndex,
  traceProgress,
  percentage,
}) {
  const opacity = useDerivedValue(() => {
    "worklet";
    if (traceProgress.value >= percentage) return 0;
    if (currentDotIndex.value >= index) return 0.95;
    return 0;
  });

  return (
    <Circle cx={cx} cy={cy} r={11} color="#FFFFFF" opacity={opacity}>
      <BlurMask blur={2} style="solid" />
    </Circle>
  );
});

// ------------ Main screen ------------
export default function TracingGameScreen({ route, navigation }) {
  const { group: routeGroup } = route.params || {};
  const { width: W, height: H } = useWindowDimensions();

  // --- Data resolution (route group preferred) ---
  const resolvedGroup = useMemo(() => {
    if (routeGroup?.sounds?.length) return routeGroup;
    if (routeGroup?.id) return PHONICS_GROUPS.find((g) => g.id === routeGroup.id) || routeGroup;
    return PHONICS_GROUPS[0];
  }, [routeGroup]);

  const groupSounds = useMemo(() => resolvedGroup?.sounds || ["s", "a", "t", "i", "p", "n"], [resolvedGroup]);
  const groupWords = useMemo(() => {
    const w = resolvedGroup?.words || [];
    // allow either {word:"sat"} objects or direct strings
    return w.map((x) => (typeof x === "string" ? x : x.word)).filter(Boolean).map((s) => String(s).toUpperCase());
  }, [resolvedGroup]);

  // --- Flow state ---
  const [mode, setMode] = useState("sounds"); // "sounds" | "words"
  const [soundIndex, setSoundIndex] = useState(0);
  const [letterCase, setLetterCase] = useState("upper"); // sounds-only: "upper" | "lower"
  const [wordIndex, setWordIndex] = useState(0);
  const [wordLetterIndex, setWordLetterIndex] = useState(0);

  // --- Stroke state for ACTIVE letter ---
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [completedStrokes, setCompletedStrokes] = useState([]);
  const [burstKey, setBurstKey] = useState(0);

  // --- Sounds pinned state (uppercase stays left while lowercase is traced) ---
  const [pinnedUppercase, setPinnedUppercase] = useState(null); // { target, themeKey }

  // --- Words pinned letters (completed letters in the current word) ---
  const [pinnedWordLetters, setPinnedWordLetters] = useState([]); // [{ char, slotIndex }]
  const [hideActiveLetter, setHideActiveLetter] = useState(false);

  // --- Theme / background crossfade ---
  const themeIndex = useMemo(() => {
    // rotate primarily by soundIndex in sounds mode; by wordIndex in words mode
    const idx = mode === "sounds" ? soundIndex : wordIndex;
    return idx % THEME_ROTATION.length;
  }, [mode, soundIndex, wordIndex]);

  const themeKey = useMemo(() => THEME_ROTATION[themeIndex], [themeIndex]);
  const theme = useMemo(() => THEME_CONFIGS[themeKey], [themeKey]);
  const pattern = TRACING_PATTERNS[theme.pattern];
  const animalEmoji = theme.animal;

  const [bgA, setBgA] = useState(theme.bg);
  const [bgB, setBgB] = useState(theme.bg);
  const bgFade = useSharedValue(1);

  const commitBgTo = useCallback(
    (nextBg) => {
      setBgA(nextBg);
      setBgB(nextBg);
      bgFade.value = 1;
    },
    [bgFade]
  );

  useEffect(() => {
    if (bgA === theme.bg) return;
    const nextBg = theme.bg;
    setBgB(nextBg);
    bgFade.value = 0;
    bgFade.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }, (f) => {
      if (f) runOnJS(commitBgTo)(nextBg);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.bg]);

  const bgAStyle = useAnimatedStyle(() => ({ opacity: 1 - bgFade.value }));
  const bgBStyle = useAnimatedStyle(() => ({ opacity: bgFade.value }));

  // --- Layout constants (keep same aesthetic, but responsive) ---
  const screenWidth = W;
  const screenHeight = H;
  const centerX = screenWidth / 2;
  const centerY = screenHeight * 0.48;

  const leftX = screenWidth * 0.32;
  const rightX = screenWidth * 0.68;

  // Base letter sizing
  // Keep the same visual size as the original letter-only version (no unintended upscaling)
  const baseWidth = Math.min(screenWidth * 0.42, screenHeight * 0.58);
  const baseLetterWidth = baseWidth * 1.3;
  const baseLetterHeightUpper = baseWidth * 1.1;
  const baseLetterHeightLower = baseWidth * 1.32;

  // --- Words layout (UPPERCASE only) ---
  const currentWordUpper = useMemo(() => {
    const w = groupWords[wordIndex] || "";
    return String(w).toUpperCase();
  }, [groupWords, wordIndex]);

  const wordLen = currentWordUpper.length;

  const wordLayout = useMemo(() => {
    // Keep words comfortably centered with safe margins (no edge-cramping, no overlap)
    const availableWidth = screenWidth * 0.76;

    // Approx glyph width relative to our placeholder box
    const glyphW = baseLetterWidth * 0.74;

    // Scale DOWN only when needed so longer words fit; never upscale above single-letter size
    const rawScale = wordLen > 0 ? availableWidth / (wordLen * glyphW * 1.18) : 1;
    const scale = Math.max(0.66, Math.min(1.0, rawScale));

    // Spacing tuned to avoid overlap while staying compact (no huge gaps)
    const slotSpacing = glyphW * scale * 1.12;

    const slots = Array.from({ length: wordLen }, (_, i) => {
      const offset = (i - (wordLen - 1) / 2) * slotSpacing;
      return { x: centerX + offset, y: centerY, scale };
    });

    return { scale, slots, slotSpacing };
  }, [screenWidth, centerX, centerY, baseLetterWidth, wordLen]);

  // --- Active target char (single char) ---
  const activeTarget = useMemo(() => {
    if (mode === "sounds") {
      const sound = groupSounds[soundIndex] || "A";
      return letterCase === "upper" ? sound.toUpperCase() : sound.toLowerCase();
    }
    // words: UPPERCASE only
    return currentWordUpper[wordLetterIndex] || "A";
  }, [mode, groupSounds, soundIndex, letterCase, currentWordUpper, wordLetterIndex]);

  const activeIsLowercase = useMemo(() => activeTarget.toLowerCase() === activeTarget, [activeTarget]);

  // --- Active letter placement ---
  const activeCenter = useMemo(() => {
    if (mode === "sounds") {
      if (letterCase === "upper") return { x: centerX, y: centerY };
      return { x: rightX, y: centerY };
    }

    // words: first two letters trace in the center, then subsequent letters trace at their slot (to avoid overlap)
    if (wordLetterIndex === 0 || wordLetterIndex === 1) {
      return { x: centerX, y: centerY };
    }
    const slot = wordLayout.slots[wordLetterIndex] || { x: centerX, y: centerY };
    return { x: slot.x, y: slot.y };
  }, [mode, letterCase, centerX, centerY, rightX, wordLetterIndex, wordLayout]);

  // In words mode, use scaled letter size (bigger & safe)
  const activeLetterWidth = useMemo(() => {
    if (mode === "words") return baseLetterWidth * wordLayout.scale;
    return baseLetterWidth;
  }, [mode, baseLetterWidth, wordLayout.scale]);

  const activeLetterHeight = useMemo(() => {
    if (mode === "words") return baseLetterHeightUpper * wordLayout.scale;
    return activeIsLowercase ? baseLetterHeightLower : baseLetterHeightUpper;
  }, [mode, activeIsLowercase, baseLetterHeightLower, baseLetterHeightUpper, wordLayout.scale]);

  // --- Glyph strokes for active target ---
  const glyphData = useMemo(() => getTracingGlyphForTarget(activeTarget), [activeTarget]);

  const screenStrokes = useMemo(() => {
    const strokes = glyphData?.strokes || [];
    return strokes.map((stroke) => {
      const { points, pathString, isDot } = generateSmoothPath(
        stroke.points,
        activeLetterWidth,
        activeLetterHeight,
        activeCenter.x,
        activeCenter.y
      );
      return {
        points,
        pathString,
        isDot,
        dots: isDot ? [] : generateDots(points, !activeIsLowercase), // uppercase gets more dots
      };
    });
  }, [glyphData, activeLetterWidth, activeLetterHeight, activeCenter.x, activeCenter.y, activeIsLowercase]);

  const currentStroke = screenStrokes[strokeIndex];

  const startPoint = useMemo(() => {
    const s = currentStroke;
    if (!s) return { x: activeCenter.x, y: activeCenter.y };
    return s.dots?.[0] || s.points?.[0] || { x: activeCenter.x, y: activeCenter.y };
  }, [currentStroke, activeCenter.x, activeCenter.y]);

  // --- Shared Values (animal & tracing) ---
  const animalX = useSharedValue(startPoint.x);
  const animalY = useSharedValue(startPoint.y);
  const animalRotation = useSharedValue(0);
  const animalScale = useSharedValue(1);
  const isTracing = useSharedValue(false);
  const traceProgress = useSharedValue(0);
  const lastProjectionIndex = useSharedValue(0);
  const trailTrigger = useSharedValue(0);
  const isAnimalActive = useSharedValue(false);

  const currentDotIndex = useSharedValue(-1);

  // Slide + pop animations (visual-only, avoids duplicates)
  const slideX = useSharedValue(0);
  const slideY = useSharedValue(0);

  const wordPopScale = useSharedValue(1);
  const pairPopScale = useSharedValue(1);

  // Tutorial (kept, but disabled during words for simplicity)
  const inactivityTimer = useRef(null);
  const lastInteractionTime = useRef(Date.now());
  const tutorialProgress = useSharedValue(0);
  const tutorialOpacity = useSharedValue(0);
  const showTutorial = useSharedValue(false);

  const resetInactivity = useCallback(() => {
    lastInteractionTime.current = Date.now();
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    if (mode !== "sounds") return;
    if (strokeIndex !== 0 || letterCase !== "upper" || currentStroke?.isDot) return;

    inactivityTimer.current = setTimeout(() => {
      if (Date.now() - lastInteractionTime.current >= 5000) {
        showTutorial.value = true;
        tutorialOpacity.value = withTiming(1, { duration: 300 });
        tutorialProgress.value = withTiming(
          1,
          { duration: 2000, easing: Easing.inOut(Easing.ease) },
          (finished) => {
            if (finished) {
              tutorialOpacity.value = withTiming(0, { duration: 300 }, (f) => {
                if (f) showTutorial.value = false;
              });
            }
          }
        );
      }
    }, 5000);
  }, [mode, strokeIndex, letterCase, currentStroke, showTutorial, tutorialOpacity, tutorialProgress]);

  // --- Dots sequencing timer (JS thread only) ---
  const dotTimers = useRef([]);
  const clearDotTimers = useCallback(() => {
    dotTimers.current.forEach((t) => clearTimeout(t));
    dotTimers.current = [];
  }, []);

  const scheduleDots = useCallback(
    (stroke) => {
      clearDotTimers();
      currentDotIndex.value = -1;
      if (!stroke || stroke.isDot) return;
      const dotCount = stroke.dots.length;
      for (let i = 0; i < dotCount; i++) {
        const id = setTimeout(() => {
          currentDotIndex.value = i;
        }, 520 + i * 100);
        dotTimers.current.push(id);
      }
    },
    [clearDotTimers, currentDotIndex]
  );

  // --- On stroke change: drop animal + show dots sequence ---
  useEffect(() => {
    const s = screenStrokes[strokeIndex];
    const nextStart = s?.dots?.[0] || s?.points?.[0] || { x: activeCenter.x, y: activeCenter.y };

    clearDotTimers();
    currentDotIndex.value = -1;

    // Cancel any slide/pop from previous step
    cancelAnimation(slideX);
    cancelAnimation(slideY);
    slideX.value = 0;
    slideY.value = 0;

    cancelAnimation(wordPopScale);
    cancelAnimation(pairPopScale);
    wordPopScale.value = 1;
    pairPopScale.value = 1;

    // Reset tracing
    traceProgress.value = 0;
    lastProjectionIndex.value = 0;
    isTracing.value = false;

    // Animal intro
    if (strokeIndex === 0) {
      animalX.value = nextStart.x;
      animalY.value = -100;
      animalScale.value = 1;
      animalRotation.value = 0;
      isAnimalActive.value = true;

      animalY.value = withTiming(
        nextStart.y,
        { duration: 860, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            animalRotation.value = withSequence(
              withTiming(Math.PI * 10, { duration: 950, easing: Easing.inOut(Easing.cubic) }),
              withTiming(0, { duration: 0 })
            );
            runOnJS(scheduleDots)(s);
            runOnJS(resetInactivity)();
          }
        }
      );
    } else {
      // quick pop to new stroke start
      isAnimalActive.value = false;
      animalRotation.value = withTiming(Math.PI * 2, { duration: 400 });
      animalScale.value = withTiming(0.1, { duration: 280, easing: Easing.in(Easing.back(2)) }, (f) => {
        if (f) {
          animalX.value = nextStart.x;
          animalY.value = nextStart.y;
          animalRotation.value = 0;
          animalScale.value = withSequence(
            withTiming(1.3, { duration: 200, easing: Easing.out(Easing.back(2.5)) }),
            withTiming(1, { duration: 150 })
          );
          isAnimalActive.value = true;
          runOnJS(scheduleDots)(s);
        }
      });
    }

    // Back handler
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      navigation.goBack();
      return true;
    });

    return () => {
      backHandler.remove();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTarget, strokeIndex]);

  // --- Derived traced path (Skia) ---
  const tracedPath = useDerivedValue(() => {
    "worklet";
    if (!currentStroke || traceProgress.value === 0 || currentStroke.isDot) return Skia.Path.Make();

    const pts = currentStroke.points;
    const targetIndex = Math.floor(traceProgress.value * (pts.length - 1));

    const p = Skia.Path.Make();
    if (targetIndex > 0) {
      p.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= targetIndex; i++) p.lineTo(pts[i].x, pts[i].y);
    }
    return p;
  });

  // --- Animal style ---
  const animalStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animalX.value - 32 },
      { translateY: animalY.value - 32 },
      { rotate: `${animalRotation.value}rad` },
      { scale: animalScale.value * (isTracing.value ? 1.15 : 1) },
    ],
  }));

  // --- Tutorial hand style ---
  const tutorialHandStyle = useAnimatedStyle(() => {
    if (!showTutorial.value || !currentStroke || currentStroke.isDot) {
      return { opacity: 0, transform: [{ translateX: -1000 }, { translateY: -1000 }] };
    }
    const idx = Math.floor(tutorialProgress.value * (currentStroke.points.length - 1));
    const point = currentStroke.points[idx] || currentStroke.points[0];
    return {
      opacity: tutorialOpacity.value,
      transform: [{ translateX: point.x - 28 }, { translateY: point.y - 28 }, { scale: tutorialOpacity.value }],
    };
  });

  // --- Slide transforms for the ACTIVE completed letter ---
  const slideTransform = useDerivedValue(() => {
    "worklet";
    return [{ translateX: slideX.value }, { translateY: slideY.value }];
  });

  // --- Word group pop transform (applies to completed letters group only) ---
  const wordGroupTransform = useDerivedValue(() => {
    "worklet";
    const s = wordPopScale.value;
    return [{ translateX: centerX * (1 - s) }, { translateY: centerY * (1 - s) }, { scale: s }];
  });

  // --- Pair pop transform (applies to pinned upper + active lower when finishing a sound) ---
  const pairGroupTransform = useDerivedValue(() => {
    "worklet";
    const s = pairPopScale.value;
    return [{ translateX: centerX * (1 - s) }, { translateY: centerY * (1 - s) }, { scale: s }];
  });

  // --- Utility: reset tracing state (JS) ---
  const resetTracingForNewLetter = useCallback(() => {
    setStrokeIndex(0);
    setCompletedStrokes([]);
    traceProgress.value = 0;
    lastProjectionIndex.value = 0;
    currentDotIndex.value = -1;
    clearDotTimers();
  }, [clearDotTimers, currentDotIndex, lastProjectionIndex, traceProgress]);

  // --- Completion handlers ---
  const advanceSoundOrWords = useCallback(() => {
    if (mode === "sounds") {
      const next = soundIndex + 1;
      if (next < groupSounds.length) {
        setSoundIndex(next);
        setLetterCase("upper");
        setPinnedUppercase(null);
        resetTracingForNewLetter();
      } else {
        // Finished all sounds → start words
        setMode("words");
        setWordIndex(0);
        setWordLetterIndex(0);
        setPinnedWordLetters([]);
        setHideActiveLetter(false);
        setPinnedUppercase(null);
        resetTracingForNewLetter();
      }
      return;
    }

    // words
    const nextWord = wordIndex + 1;
    if (nextWord < groupWords.length) {
      setWordIndex(nextWord);
      setWordLetterIndex(0);
      setPinnedWordLetters([]);
      setHideActiveLetter(false);
      resetTracingForNewLetter();
    } else {
      navigation.goBack();
    }
  }, [
    mode,
    soundIndex,
    groupSounds.length,
    resetTracingForNewLetter,
    wordIndex,
    groupWords.length,
    navigation,
  ]);

  const startNextWordLetter = useCallback(
    (nextIdx) => {
      setHideActiveLetter(false);
      setWordLetterIndex(nextIdx);
      setPinnedWordLetters((prev) => prev);
      resetTracingForNewLetter();
    },
    [resetTracingForNewLetter]
  );

  const pinUppercaseAndStartLowercase = useCallback(() => {
    setPinnedUppercase({ target: activeTarget, themeKey });
    setLetterCase("lower");
    resetTracingForNewLetter();
  }, [activeTarget, themeKey, resetTracingForNewLetter]);

  const pinWordLetterAndAdvance = useCallback(
    (slotIndex) => {
      const ch = activeTarget; // already uppercase in words
      setPinnedWordLetters((prev) => [...prev, { char: ch, slotIndex }]);
      const next = wordLetterIndex + 1;
      if (next < currentWordUpper.length) {
        startNextWordLetter(next);
      
      } else {
        // full word formed → POP & BURST → next word
        // Hide active letter now that it is pinned to avoid a duplicate overlap during the pop.
        setHideActiveLetter(true);

        wordPopScale.value = withSequence(
          withTiming(1.12, { duration: 220, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 160 })
        );
        setTimeout(() => setBurstKey((k) => k + 3), 320);

        setTimeout(() => {
          setHideActiveLetter(false);
          advanceSoundOrWords();
        }, 1100);
      }
    },
    [
      activeTarget,
      wordLetterIndex,
      currentWordUpper.length,
      startNextWordLetter,
      wordPopScale,
      advanceSoundOrWords,
    ]
  );

  const handleLetterCompleted = useCallback(() => {
    // Fly animal away (visual continuity)
    isAnimalActive.value = true;
    animalX.value = withTiming(screenWidth + 120, { duration: 900, easing: Easing.in(Easing.quad) });
    animalY.value = withTiming(-120, { duration: 900, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) isAnimalActive.value = false;
    });

    // Small burst for completed letter
    setTimeout(() => setBurstKey((k) => k + 1), 180);

    // SOUND MODE: uppercase → slide left, then start lowercase; lowercase → pop both, then next sound
    if (mode === "sounds") {
      if (letterCase === "upper") {
        // slide the completed uppercase from center to left slot smoothly (no duplicate)
        slideX.value = 0;
        slideY.value = 0;
        slideX.value = withTiming(leftX - centerX, { duration: 720, easing: Easing.out(Easing.cubic) }, (f) => {
          if (f) runOnJS(pinUppercaseAndStartLowercase)();
        });
        return;
      }

      // lowercase completed
      pairPopScale.value = withSequence(
        withTiming(1.12, { duration: 220, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 160 })
      );
      setTimeout(() => setBurstKey((k) => k + 2), 320);
      setTimeout(() => {
        setPinnedUppercase(null);
        advanceSoundOrWords();
      }, 1100);
      return;
    }

    // WORD MODE: slide completed letter into its slot (UPPERCASE)
    const slot = wordLayout.slots[wordLetterIndex] || { x: centerX, y: centerY };

    // In words mode, letters 0 & 1 trace in center; letters 2+ trace at their slot already.
    // Slide distance must be computed from the active letter's current anchor (to avoid overlap / jump).
    const baseX = (wordLetterIndex === 0 || wordLetterIndex === 1) ? centerX : activeCenter.x;
    const deltaX = slot.x - baseX;

    slideX.value = 0;
    slideY.value = 0;

    // If we're already at the slot (common for 2+), pin immediately without animating
    if (Math.abs(deltaX) < 0.5) {
      setTimeout(() => pinWordLetterAndAdvance(wordLetterIndex), 20);
      return;
    }

    slideX.value = withTiming(deltaX, { duration: 720, easing: Easing.out(Easing.cubic) }, (f) => {
      if (f) runOnJS(pinWordLetterAndAdvance)(wordLetterIndex);
    });
  }, [
    mode,
    letterCase,
    animalX,
    animalY,
    isAnimalActive,
    screenWidth,
    slideX,
    slideY,
    leftX,
    centerX,
    activeCenter,
    pinUppercaseAndStartLowercase,
    pairPopScale,
    wordLayout.slots,
    wordLetterIndex,
    pinWordLetterAndAdvance,
    advanceSoundOrWords,
  ]);

  const handleStrokeCompletion = useCallback(() => {
    const nextStroke = strokeIndex + 1;
    setCompletedStrokes((prev) => [...prev, strokeIndex]);

    if (nextStroke < screenStrokes.length) {
      setTimeout(() => setStrokeIndex(nextStroke), 220);
      return;
    }

    // Finished all strokes for this letter
    handleLetterCompleted();
  }, [strokeIndex, screenStrokes.length, handleLetterCompleted]);

  // --- Gestures ---
  const tapGesture = Gesture.Tap().onEnd((e) => {
    "worklet";
    runOnJS(resetInactivity)();

    if (!currentStroke) return;

    // DOT strokes (like i/j dot): tap OR drag-down gesture is handled; tap can still complete
    if (currentStroke.isDot) {
      const dotX = currentStroke.points[0].x;
      const dotY = currentStroke.points[0].y;
      const dx = e.x - dotX;
      const dy = e.y - dotY;
      if (Math.sqrt(dx * dx + dy * dy) < 62) runOnJS(handleStrokeCompletion)();
      return;
    }

    // For the "dot-on-top" feel: allow a downward tap near the last checkpoint to count as completion
    const lastDot = currentStroke.dots[currentStroke.dots.length - 1];
    if (lastDot) {
      const dx = e.x - lastDot.x;
      const dy = e.y - lastDot.y;
      if (Math.sqrt(dx * dx + dy * dy) < 64 && dy > 10) {
        runOnJS(handleStrokeCompletion)();
      }
    }
  });

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      "worklet";
      runOnJS(resetInactivity)();

      if (showTutorial.value) {
        showTutorial.value = false;
        tutorialOpacity.value = 0;
      }

      if (!currentStroke) return;

      // DOT stroke: allow grab and drag down slightly to complete (fix for i/j dot)
      if (currentStroke.isDot) {
        const dotX = currentStroke.points[0].x;
        const dotY = currentStroke.points[0].y;
        const dx = e.x - dotX;
        const dy = e.y - dotY;
        if (Math.sqrt(dx * dx + dy * dy) < 80) {
          isTracing.value = true; // reuse flag
          animalX.value = dotX;
          animalY.value = dotY;
        }
        return;
      }

      const dx = e.x - animalX.value;
      const dy = e.y - animalY.value;
      if (Math.sqrt(dx * dx + dy * dy) < ANIMAL_GRAB_RADIUS) {
        isTracing.value = true;
      }
    })
    .onUpdate((e) => {
      "worklet";
      if (!isTracing.value || !currentStroke) return;

      // DOT stroke: dragging down counts as completion once moved enough
      if (currentStroke.isDot) {
        const dotX = currentStroke.points[0].x;
        const dotY = currentStroke.points[0].y;
        const dy = e.y - dotY;
        const dx = e.x - dotX;

        // allow the animal to move slightly while dragging so it doesn't feel "stuck"
        animalX.value = dotX + Math.max(-18, Math.min(18, dx));
        animalY.value = dotY + Math.max(-10, Math.min(40, dy));

        // completion threshold: a small downward move
        if (dy > 18) {
          isTracing.value = false;
          runOnJS(handleStrokeCompletion)();
        }
        return;
      }

      const projected = projectToPath(currentStroke.points, e.x, e.y, lastProjectionIndex.value);
      if (!projected.isInCorridor) {
        isTracing.value = false;
        return;
      }

      const newProgress = projected.index / (currentStroke.points.length - 1);
      if (newProgress >= traceProgress.value) {
        // Smoothly follow the path points to reduce micro-stutter (especially with checkpoints)
        const smooth = 0.55;
        animalX.value = animalX.value + (projected.x - animalX.value) * smooth;
        animalY.value = animalY.value + (projected.y - animalY.value) * smooth;
        traceProgress.value = newProgress;
        lastProjectionIndex.value = projected.index;
        trailTrigger.value += 1;

        
        // Completion: require CENTER of animal bubble to align with CENTER of the last dot (worklet-safe)
        const lastDot = currentStroke.dots[currentStroke.dots.length - 1];
        const dxLast = projected.x - lastDot.x;
        const dyLast = projected.y - lastDot.y;
        const distLast = Math.sqrt(dxLast * dxLast + dyLast * dyLast);

        // Require true end-of-stroke progress (prevents early completion)
        const nearEnd = projected.index >= currentStroke.points.length - 2 && newProgress >= 0.995;

        // Strict center-to-center alignment (not edge-touch). Tune carefully.
        if (nearEnd && distLast <= 10) {
          isTracing.value = false;
          runOnJS(handleStrokeCompletion)();
        }

      }
    })
    .onEnd(() => {
      "worklet";
      isTracing.value = false;
    });

  const combinedGesture = Gesture.Race(tapGesture, panGesture);

  // --- Rendering: helpers to draw a letter at a given center (for pinned letters) ---
  const renderLetterAt = useCallback(
    (targetChar, atX, atY, isLower, scale = 1, keyPrefix = "p") => {
      const g = getTracingGlyphForTarget(targetChar);
      const w = baseLetterWidth * scale;
      const h = (isLower ? baseLetterHeightLower : baseLetterHeightUpper) * scale;

      // Draw as "already traced" (thick + glow + gradient) to match the solid look after sliding.
      const strokes = (g?.strokes || []).map((stroke) => generateSmoothPath(stroke.points, w, h, atX, atY));

      // Gradient endpoints (consistent direction regardless of stroke count)
      const gradStart = vec(atX - w * 0.25, atY - h * 0.25);
      const gradEnd = vec(atX + w * 0.25, atY + h * 0.25);

      return strokes.map((s, idx) => {
        if (!s.pathString) return null;
        const skPath = Skia.Path.MakeFromSVGString(s.pathString);
        if (!skPath) return null;
        return (
          <Path
            key={`${keyPrefix}-${targetChar}-${idx}`}
            path={skPath}
            style="stroke"
            strokeWidth={56 * scale}
            strokeCap="round"
            strokeJoin="round"
          >
            <SkiaLinearGradient start={gradStart} end={gradEnd} colors={pattern.colors} />
            <BlurMask blur={8 * scale} style="solid" />
            <DashPathEffect intervals={pattern.intervals} />
          </Path>
        );
      });
    },
    [baseLetterWidth, baseLetterHeightLower, baseLetterHeightUpper, pattern.colors, pattern.intervals]
  );

  // --- Active letter skia paths (computed once per stroke) ---
  const strokeStart = useMemo(() => startPoint, [startPoint]);
  const strokeEnd = useMemo(() => {
    const pts = currentStroke?.points || [];
    return pts.length ? pts[pts.length - 1] : strokeStart;
  }, [currentStroke, strokeStart]);

  // --- Ensure state resets when switching mode / indices ---
  useEffect(() => {
    // Clear pinned word letters when starting a new word letter index at 0
    if (mode === "words" && wordLetterIndex === 0) {
      setPinnedWordLetters([]);
    }
  }, [mode, wordLetterIndex]);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Crossfaded background */}
      <Animated.View style={[StyleSheet.absoluteFill, bgAStyle]}>
        <TracingBackgrounds theme={bgA} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bgBStyle]}>
        <TracingBackgrounds theme={bgB} />
      </Animated.View>

      <ParticleLayer
        width={screenWidth}
        height={screenHeight}
        burstTrigger={burstKey}
        trailTriggerSV={trailTrigger}
        followX={animalX}
        followY={animalY}
        active={isAnimalActive}
      />

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={styles.tracingArea}>
          <Canvas style={StyleSheet.absoluteFill}>
            {/* WORDS: draw completed word letters as a group (with pop scale) */}
            {mode === "words" && (
              <Group transform={wordGroupTransform}>
                {pinnedWordLetters.map((pl, idx) => {
                  const slot = wordLayout.slots[pl.slotIndex] || { x: centerX, y: centerY, scale: wordLayout.scale };
                  return (
                    <Group key={`w-pin-${idx}`}>
                      {renderLetterAt(pl.char, slot.x, slot.y, false, slot.scale, `w${idx}`)}
                      {/* solid traced look for pinned letters */}
                      {/* (We keep them as the soft white stroke layer; the real "filled" look is from stroke completion effect during tracing) */}
                    </Group>
                  );
                })}
              </Group>
            )}

            {/* SOUNDS: pinned uppercase on the left while tracing lowercase */}
            {mode === "sounds" && pinnedUppercase?.target && (
              <Group transform={pairGroupTransform}>
                {renderLetterAt(pinnedUppercase.target, leftX, centerY, false, 1, "pinU")}
              </Group>
            )}

            {/* ACTIVE LETTER: placeholder + traced + checkpoints, and slides after completion */}
            {!(mode === "words" && hideActiveLetter) && (
            <Group transform={slideTransform}>
              {screenStrokes.map((stroke, idx) => {
                const isCompleted = completedStrokes.includes(idx);
                const isCurrent = idx === strokeIndex;

                if (!stroke.pathString && !stroke.isDot) return null;

                const skiaPath = stroke.pathString ? Skia.Path.MakeFromSVGString(stroke.pathString) : null;
                if (!skiaPath && !stroke.isDot) return null;

                if (isCompleted && skiaPath) {
                  return (
                    <Group key={`stroke-${idx}`}>
                      <Path path={skiaPath} style="stroke" strokeWidth={56} strokeCap="round" strokeJoin="round">
                        <SkiaLinearGradient start={vec(strokeStart.x, strokeStart.y)} end={vec(strokeEnd.x, strokeEnd.y)} colors={pattern.colors} />
                        <BlurMask blur={8} style="solid" />
                        <DashPathEffect intervals={pattern.intervals} />
                      </Path>
                    </Group>
                  );
                }

                if (isCurrent && skiaPath) {
                  return (
                    <Group key={`stroke-${idx}`}>
                      {/* Placeholder */}
                      <Path
                        path={skiaPath}
                        style="stroke"
                        strokeWidth={60}
                        strokeCap="round"
                        strokeJoin="round"
                        color="rgba(255,255,255,0.5)"
                      />
                      {/* Traced */}
                      {!stroke.isDot && (
                        <Path path={tracedPath} style="stroke" strokeWidth={56} strokeCap="round" strokeJoin="round">
                          <SkiaLinearGradient
                            start={vec(strokeStart.x, strokeStart.y)}
                            end={vec(strokeEnd.x, strokeEnd.y)}
                            colors={pattern.colors}
                          />
                          <BlurMask blur={8} style="solid" />
                          <DashPathEffect intervals={pattern.intervals} />
                        </Path>
                      )}
                      {/* Checkpoints */}
                      {!stroke.isDot &&
                        stroke.dots.map((d, i) => (
                          <CheckpointDot
                            key={`dot-${idx}-${i}`}
                            cx={d.x}
                            cy={d.y}
                            index={i}
                            currentDotIndex={currentDotIndex}
                            traceProgress={traceProgress}
                            percentage={d.percentage}
                          />
                        ))}
                    </Group>
                  );
                }

                if (skiaPath) {
                  return (
                    <Path
                      key={`stroke-${idx}`}
                      path={skiaPath}
                      style="stroke"
                      strokeWidth={58}
                      strokeCap="round"
                      strokeJoin="round"
                      color="rgba(255,255,255,0.18)"
                    />
                  );
                }
                return null;
              })}
            </Group>
            )}

            {/* When in sounds & lowercase step, apply pop scale to both pinned+active visual continuity */}
            {mode === "sounds" && letterCase === "lower" && pinnedUppercase?.target && (
              <Group transform={pairGroupTransform}>
                {/* Re-draw active outline lightly at its base position so pop feels coherent */}
                {/* (This is subtle; the main active rendering remains above. Keeping it minimal avoids duplicate look.) */}
              </Group>
            )}
          </Canvas>

          <Animated.View style={[styles.animal, animalStyle]} pointerEvents="none">
            <View style={styles.animalGlow}>
              <Text style={styles.animalEmoji}>{animalEmoji}</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.tutorialHand, tutorialHandStyle]}>
            <Text style={styles.handEmoji}>👆</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  backIcon: { fontSize: 28, fontWeight: "bold", color: "#333" },
  tracingArea: { flex: 1 },
  animal: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  animalGlow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.48)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 12,
  },
  animalEmoji: { fontSize: 38 },
  tutorialHand: {
    position: "absolute",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  handEmoji: {
    fontSize: 44,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
