import React, { useMemo, useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Canvas,
  Rect,
  Circle,
  Oval,
  Group,
  Path,
  LinearGradient,
  RadialGradient,
  vec,
  BlurMask,
  Skia,
} from "@shopify/react-native-skia";
import {
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  useDerivedValue,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";

// ============================================================================
// 1. HELPERS & ANIMATION WRAPPER
// ============================================================================

const AnimatedItem = ({ 
  children, 
  x, 
  y, 
  scale = 1, 
  rotationSpeed = 0, 
  floatSpeed = 0, 
  swayAmount = 0,
  rotateBase = 0
}) => {
  const sv = useSharedValue(Math.random());

  useEffect(() => {
    const duration = floatSpeed > 0 ? floatSpeed : (swayAmount > 0 ? 3000 : 4000);
    sv.value = withRepeat(
      withTiming(sv.value < 0.5 ? 1 : 0, { duration: duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(sv);
  }, [floatSpeed, swayAmount]);

  const transform = useDerivedValue(() => {
    const translateY = floatSpeed > 0 ? interpolate(sv.value, [0, 1], [0, -12]) : 0;
    const rotate = rotationSpeed > 0 
        ? interpolate(sv.value, [0, 1], [rotateBase - 0.05, rotateBase + 0.05])
        : rotateBase;
    const swayX = swayAmount > 0 ? interpolate(sv.value, [0, 1], [-swayAmount, swayAmount]) : 0;
    const breathing = interpolate(sv.value, [0, 1], [0.98, 1.02]);

    return [
      { translateX: x + swayX },
      { translateY: y + translateY },
      { scale: scale * breathing },
      { rotate: rotate }
    ];
  });

  return <Group transform={transform}>{children}</Group>;
};

// ============================================================================
// 2. CRAB WITH BLINKING EYES
// ============================================================================

const BlinkingCrab = () => {
  const blink = useSharedValue(0);
  
  useEffect(() => {
    const blinkSequence = () => {
      blink.value = withSequence(
        withDelay(2000 + Math.random() * 1000, withTiming(1, { duration: 100 })),
        withTiming(0, { duration: 100 })
      );
    };
    const interval = setInterval(blinkSequence, 3000);
    return () => clearInterval(interval);
  }, []);

  const eyeScale = useDerivedValue(() => interpolate(blink.value, [0, 1], [1, 0.1]));

  return (
    <Group>
       <Path path="M-25,5 Q-35,15 -25,25" color="#E53935" style="stroke" strokeWidth={5} strokeCap="round" />
       <Path path="M25,5 Q35,15 25,25" color="#E53935" style="stroke" strokeWidth={5} strokeCap="round" />
       <Path path="M-20,10 Q-30,20 -20,30" color="#E53935" style="stroke" strokeWidth={5} strokeCap="round" />
       <Path path="M20,10 Q30,20 20,30" color="#E53935" style="stroke" strokeWidth={5} strokeCap="round" />

       <Group transform={[{rotate: -0.5}, {translateX: -32}, {translateY: -10}]}>
          <Oval x={0} y={0} width={20} height={15} color="#E53935" />
          <Path path="M10,0 L20,-5" color="#E53935" style="stroke" strokeWidth={4} />
       </Group>
       <Group transform={[{rotate: 0.5}, {translateX: 12}, {translateY: -25}]}>
          <Oval x={0} y={0} width={20} height={15} color="#E53935" />
          <Path path="M0,0 L-10,-5" color="#E53935" style="stroke" strokeWidth={4} />
       </Group>

       <Oval x={-35} y={-20} width={70} height={45} color="#FF5252" />
       
       <Group transform={[{translateX: -12}, {translateY: -10}]}>
          <Circle cx={0} cy={0} r={8} color="white" />
          <Group transform={useDerivedValue(() => [{ scaleY: eyeScale.value }])}>
             <Circle cx={2} cy={0} r={3.5} color="black" />
             <Circle cx={3} cy={-1.5} r={1.5} color="white" />
          </Group>
       </Group>

       <Group transform={[{translateX: 12}, {translateY: -10}]}>
          <Circle cx={0} cy={0} r={8} color="white" />
          <Group transform={useDerivedValue(() => [{ scaleY: eyeScale.value }])}>
             <Circle cx={2} cy={0} r={3.5} color="black" />
             <Circle cx={3} cy={-1.5} r={1.5} color="white" />
          </Group>
       </Group>
       
       <Path path="M-5,5 Q0,10 5,5" color="#B71C1C" style="stroke" strokeWidth={2} strokeCap="round" />
    </Group>
  );
};

// ============================================================================
// 3. FALL ASSETS (High Detail)
// ============================================================================

const Basket = () => {
    return (
        <Group>
            <Path path="M-30,-20 C-30,-60 30,-60 30,-20" color="#D84315" style="stroke" strokeWidth={8} strokeCap="round" />
            <Path path="M-30,-20 C-30,-60 30,-60 30,-20" color="#E64A19" style="stroke" strokeWidth={4} strokeCap="round" />
            
            <Circle cx={-15} cy={-15} r={18} color="#BF360C" />
            <Circle cx={15} cy={-15} r={18} color="#D84315" />
            <Circle cx={0} cy={-25} r={18} color="#E64A19" />
            
            <Oval x={-40} y={-20} width={80} height={60} color="#E65100" />
            
            <Path path="M-40,-10 Q0,5 40,-10" color="#EF6C00" style="stroke" strokeWidth={10} strokeCap="round" />
            <Oval x={-35} y={-5} width={70} height={40} color="#F57C00" />
            
            <Path path="M-30,10 Q0,20 30,10" color="rgba(0,0,0,0.1)" style="stroke" strokeWidth={2} />
            <Path path="M-25,25 Q0,35 25,25" color="rgba(0,0,0,0.1)" style="stroke" strokeWidth={2} />
        </Group>
    )
}

const DetailedLeaf = ({ color, rot }) => {
    return (
        <Group transform={[{rotate: rot}]}>
            <Path 
              path="M0,40 Q-15,30 -10,10 Q-20,5 -10,-5 Q-5,-15 0,-20 Q5,-15 10,-5 Q20,5 10,10 Q15,30 0,40 Z" 
              color={color} 
            />
            <Path path="M0,-15 L0,35" color="rgba(0,0,0,0.2)" style="stroke" strokeWidth={1.5} />
            <Path path="M0,0 L-8,-5 M0,10 L-8,5 M0,20 L-6,15" color="rgba(0,0,0,0.2)" style="stroke" strokeWidth={1} />
            <Path path="M0,0 L8,-5 M0,10 L8,5 M0,20 L6,15" color="rgba(0,0,0,0.2)" style="stroke" strokeWidth={1} />
        </Group>
    )
}

const LeafCluster = () => {
    return (
        <Group>
            <Group transform={[{translateX: -25}, {translateY: 10}]}><DetailedLeaf color="#689F38" rot={-0.8} /></Group>
            <Group transform={[{translateX: 0}, {translateY: -10}]}><DetailedLeaf color="#F4511E" rot={0} /></Group>
            <Group transform={[{translateX: 25}, {translateY: 15}]}><DetailedLeaf color="#FFB300" rot={0.8} /></Group>
            <Group transform={[{translateX: 0}, {translateY: 30}]}><DetailedLeaf color="#D84315" rot={2.5} /></Group>
        </Group>
    )
}

const Mushroom = () => {
    return (
        <Group>
            <Oval x={-10} y={0} width={20} height={25} color="#FFF3E0" />
            <Path path="M-22,5 Q0,-25 22,5 Z" color="#BF360C" />
             <Oval x={-8} y={-5} width={8} height={4} color="rgba(255,255,255,0.3)" transform={[{rotate: -0.2}]}/>
        </Group>
    )
}

const Pumpkin = () => {
    return (
        <Group>
            <Group transform={[{translateX: 5}, {translateY: -15}]}>
                <Path path="M0,0 Q10,-10 20,0 Q10,10 0,0" color="#4CAF50" style="fill"/>
                <Path path="M10,-10 L10,0" color="#388E3C" style="stroke" strokeWidth={2}/>
            </Group>
            
            <Oval x={-35} y={-30} width={40} height={60} color="#F57C00" transform={[{rotate: -0.2}]}/>
            <Oval x={-5} y={-30} width={40} height={60} color="#F57C00" transform={[{rotate: 0.2}]}/>
            <Oval x={-22} y={-32} width={44} height={64} color="#FF9800" />
            
            <Path path="M-2,-30 L2,-42 L8,-38 L5,-30 Z" color="#5D4037" />
        </Group>
    )
}

const Acorn = () => {
    return (
        <Group>
             <Oval x={-8} y={0} width={16} height={20} color="#FFB74D" />
             <Path path="M-10,0 Q0,-10 10,0 Z" color="#8D6E63" />
             <Path path="M0,-6 L3,-10" color="#8D6E63" style="stroke" strokeWidth={3} />
        </Group>
    )
}

// ============================================================================
// 4. BEACH ASSETS (High Detail)
// ============================================================================

const PalmLeafBig = ({ color, scaleX = 1 }) => {
    const path = "M0,0 Q20,-40 60,-30 Q40,-10 80,0 Q40,10 70,30 Q30,20 50,50 Q10,30 20,70 Q0,40 -10,80 Q-10,40 -30,60 Q-20,30 -50,40 Q-30,20 -60,10 Q-30,0 -50,-20 Q-20,-10 0,0 Z";
    return (
        <Group transform={[{scaleX}]}>
            <Path path={path} color={color} />
            <Path path="M0,0 L40,-20 M0,0 L50,20 M0,0 L10,50 M0,0 L-20,40 M0,0 L-40,10" color="rgba(0,0,0,0.1)" style="stroke" strokeWidth={2} />
        </Group>
    )
}

const FlipFlopPair = () => {
    const Flop = ({ color, strap, x, rot }) => (
        <Group transform={[{translateX: x}, {rotate: rot}]}>
            <Oval x={-12} y={-22} width={24} height={44} color={color} />
            <Path path="M-12,-10 Q-5,-5 -2,-18" color={strap} style="stroke" strokeWidth={4} strokeCap="round"/>
            <Path path="M12,-10 Q5,-5 2,-18" color={strap} style="stroke" strokeWidth={4} strokeCap="round"/>
            <Circle cx={0} cy={-18} r={2} color={strap} />
        </Group>
    )
    return (
        <Group>
            <Flop color="#FF4081" strap="#2962FF" x={-15} rot={-0.3} />
            <Flop color="#FF4081" strap="#2962FF" x={15} rot={0.2} />
        </Group>
    )
}

const Shell = () => {
    return (
        <Group>
            <Path path="M0,15 L-15,-5 Q0,-18 15,-5 Z" color="#E1BEE7" />
            <Path path="M0,15 L0,-8" color="#BA68C8" style="stroke" strokeWidth={2} />
            <Path path="M0,15 L-8,-6" color="#BA68C8" style="stroke" strokeWidth={2} />
            <Path path="M0,15 L8,-6" color="#BA68C8" style="stroke" strokeWidth={2} />
            <Circle cx={0} cy={15} r={3} color="white"/>
        </Group>
    )
}

const Starfish = () => {
    return (
        <Group>
            <Path path="M0,-25 L6,-8 L24,-6 L10,6 L14,24 L0,14 L-14,24 L-10,6 L-24,-6 L-6,-8 Z" color="#FF4081" style="fill">
                <BlurMask blur={1} style="normal"/>
            </Path>
            <Circle cx={0} cy={0} r={3} color="#D81B60" opacity={0.4} />
            <Circle cx={0} cy={-15} r={2} color="#D81B60" opacity={0.4} />
            <Circle cx={12} cy={-4} r={2} color="#D81B60" opacity={0.4} />
            <Circle cx={-12} cy={-4} r={2} color="#D81B60" opacity={0.4} />
            <Circle cx={7} cy={12} r={2} color="#D81B60" opacity={0.4} />
            <Circle cx={-7} cy={12} r={2} color="#D81B60" opacity={0.4} />
        </Group>
    )
}

// ============================================================================
// 5. SPACE ASSETS (High Detail)
// ============================================================================

const BigPinkPlanet = () => {
    return (
        <Group>
            <Circle cx={0} cy={0} r={50} color="#AB47BC" />
            <Circle cx={-20} cy={-15} r={12} color="#8E24AA" />
            <Circle cx={15} cy={20} r={10} color="#8E24AA" />
            <Circle cx={25} cy={-10} r={6} color="#8E24AA" />
            <Circle cx={-10} cy={30} r={8} color="#8E24AA" />
            
            <Path path="M-30,-30 Q0,-40 30,-30" color="rgba(255,255,255,0.1)" style="stroke" strokeWidth={5} />
        </Group>
    )
}

const Saturn = () => {
    return (
        <Group transform={[{rotate: -0.5}]}>
             <Circle cx={0} cy={0} r={25} color="#FFA726" />
             <Path path="M-15,-10 L15,-10" color="#FB8C00" style="stroke" strokeWidth={4} />
             <Path path="M-15,10 L15,10" color="#FB8C00" style="stroke" strokeWidth={4} />
             
             <Oval x={-45} y={-8} width={90} height={16} color="#4DD0E1" style="fill" opacity={0.8}/>
             <Oval x={-35} y={-5} width={70} height={10} color="#26C6DA" style="fill" opacity={0.8}/>
        </Group>
    )
}

const BlueStripedPlanet = () => {
    return (
        <Group>
             <Circle cx={0} cy={0} r={30} color="#42A5F5" />
             <Path path="M-25,-10 Q0,-15 25,-10" color="#90CAF9" style="stroke" strokeWidth={6} strokeCap="round"/>
             <Path path="M-25,5 Q0,0 25,5" color="#90CAF9" style="stroke" strokeWidth={6} strokeCap="round"/>
             <Circle cx={-15} cy={18} r={4} color="#1E88E5" />
        </Group>
    )
}

const Star = ({ x, y, scale = 1 }) => (
    <Group transform={[{translateX: x}, {translateY: y}, {scale}]}>
        <Path path="M0,-8 Q2,-2 8,0 Q2,2 0,8 Q-2,2 -8,0 Q-2,-2 0,-8" color="white" opacity={0.6} />
    </Group>
)

// ============================================================================
// 6. MAIN THEME COMPONENTS
// ============================================================================

const AutumnTheme = ({ width, height }) => {
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="#CED651" />
      
      <AnimatedItem x={width * 0.18} y={height * 0.15} scale={1.8} floatSpeed={4000}>
         <Basket />
      </AnimatedItem>

      <AnimatedItem x={width * 0.82} y={height * 0.15} scale={1.5} rotationSpeed={1} rotateBase={0.2}>
         <LeafCluster />
      </AnimatedItem>

      <AnimatedItem x={width * 0.08} y={height * 0.4} scale={1.2} rotationSpeed={1}><Acorn/></AnimatedItem>
      <AnimatedItem x={width * 0.92} y={height * 0.5} scale={1.2} rotationSpeed={1}><Acorn/></AnimatedItem>
      <AnimatedItem x={width * 0.15} y={height * 0.85} scale={1.2} rotationSpeed={1}><Acorn/></AnimatedItem>
      <AnimatedItem x={width * 0.95} y={height * 0.8} scale={1.2} rotationSpeed={1}><Acorn/></AnimatedItem>

      <AnimatedItem x={width * 0.15} y={height * 0.6} scale={1.6} swayAmount={5}>
          <Group>
             <Group transform={[{translateX: -15}]}><Mushroom /></Group>
             <Group transform={[{translateX: 15}, {translateY: 10}, {scale: 0.8}]}><Mushroom /></Group>
          </Group>
      </AnimatedItem>

      <AnimatedItem x={width * 0.85} y={height * 0.65} scale={2.4} floatSpeed={5000}>
          <Pumpkin />
      </AnimatedItem>
    </Group>
  );
};

const BeachTheme = ({ width, height }) => {
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="#F2C063" />

      <Group transform={[{translateX: 0}, {translateY: 0}]}>
          <PalmLeafBig color="#43A047" scaleX={1} />
          <Group transform={[{rotate: 0.5}, {translateX: -20}]}><PalmLeafBig color="#2E7D32" /></Group>
      </Group>

      <Group transform={[{translateX: width}, {translateY: 0}]}>
          <PalmLeafBig color="#43A047" scaleX={-1} />
          <Group transform={[{rotate: -0.5}, {translateX: 20}]}><PalmLeafBig color="#2E7D32" scaleX={-1} /></Group>
      </Group>

      <AnimatedItem x={width * 0.85} y={height * 0.2} scale={1.4} rotationSpeed={1} rotateBase={0.4}>
          <FlipFlopPair />
      </AnimatedItem>
      
      <AnimatedItem x={width * 0.68} y={height * 0.12} scale={1.3} floatSpeed={3000}>
          <Shell />
      </AnimatedItem>

      <AnimatedItem x={width * 0.15} y={height * 0.75} scale={1.5} rotationSpeed={1}>
          <Starfish />
      </AnimatedItem>

      <AnimatedItem x={width * 0.85} y={height * 0.6} scale={1.2} swayAmount={8} rotateBase={-0.2}>
          <BlinkingCrab />
      </AnimatedItem>
      
      <Circle cx={width * 0.2} cy={height * 0.3} r={15} color="#FFA000" opacity={0.2} />
      <Circle cx={width * 0.9} cy={height * 0.4} r={20} color="#FFA000" opacity={0.2} />
      <Circle cx={width * 0.1} cy={height * 0.9} r={12} color="#FFA000" opacity={0.2} />
      <Circle cx={width * 0.8} cy={height * 0.8} r={18} color="#FFA000" opacity={0.2} />
    </Group>
  );
};

const SpaceTheme = ({ width, height }) => {
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="#2A1867" />
      
      <Path 
        path={`M0,${height * 0.4} Q${width*0.5},${height*0.3} ${width},${height*0.5} V${height} H0 Z`} 
        color="#392085" 
      />
      <Path 
        path={`M0,${height * 0.7} Q${width*0.5},${height*0.6} ${width},${height*0.8} V${height} H0 Z`} 
        color="#4527A0" 
      />

      <Star x={width*0.1} y={height*0.85} scale={1.5} />
      <Star x={width*0.5} y={height*0.15} scale={1.0} />
      <Star x={width*0.9} y={height*0.5} scale={1.8} />
      <Star x={width*0.05} y={height*0.4} scale={0.8} />
      <Circle cx={width*0.2} cy={height*0.3} r={4} color="white" opacity={0.3}/>
      <Circle cx={width*0.8} cy={height*0.2} r={5} color="white" opacity={0.3}/>

      <AnimatedItem x={width * 0.12} y={height * 0.12} scale={1.4} rotationSpeed={1}>
          <BigPinkPlanet />
      </AnimatedItem>

      <AnimatedItem x={width * 0.88} y={height * 0.2} scale={1.6} floatSpeed={5000}>
          <Saturn />
      </AnimatedItem>

      <AnimatedItem x={width * 0.12} y={height * 0.65} scale={1.5} swayAmount={5}>
          <BlueStripedPlanet />
      </AnimatedItem>
    </Group>
  );
};

// ============================================================================
// 7. MAIN EXPORT
// ============================================================================

export default function TracingBackgrounds({ theme = "space" }) {
  const { width, height } = useWindowDimensions();

  const content = useMemo(() => {
    switch (theme) {
      case "autumn": return <AutumnTheme width={width} height={height} />;
      case "beach": return <BeachTheme width={width} height={height} />;
      case "space": return <SpaceTheme width={width} height={height} />;
      default: return <SpaceTheme width={width} height={height} />;
    }
  }, [theme, width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        {content}
        <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
                c={vec(width/2, height/2)}
                r={width * 0.85}
                colors={['transparent', 'rgba(0,0,0,0.15)']}
            />
        </Rect>
      </Canvas>
    </View>
  );
}