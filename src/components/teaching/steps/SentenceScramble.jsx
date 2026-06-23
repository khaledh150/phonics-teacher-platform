import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { findSentenceImage } from '../../../utils/assetHelpers';
import { playVO, stopVO, delay, playWordVO, playSentenceVO, stopWordVO } from '../../../utils/audioPlayer';
import { triggerCelebration, triggerSmallBurst } from '../../../utils/confetti';
import { playCompletionEncouragement } from '../../../utils/encouragement';

let sharedCtx = null;
const getCtx = () => {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
};

const playPlaceSound = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
  } catch (e) { /* silent */ }
};

const playSuccessChime = () => {
  try {
    const ctx = getCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.25);
    });
  } catch (e) { /* silent */ }
};

const playErrorBuzz = () => {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
};

const BLOCK_COLORS = ['#4d79ff', '#ae90fd', '#FF6B9D', '#4ECDC4', '#FFE66D', '#FF6600', '#22c55e', '#00B894', '#E60023', '#8B00FF'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const isSame = a.every((item, idx) => item.originalIdx === idx);
  if (isSame && a.length > 1) return shuffle(arr);
  return a;
}

const findShelfAtPoint = (x, y) => {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (el.dataset?.shelfZone === 'true') return true;
  }
  const fallback = document.querySelector('[data-shelf-zone="true"]');
  if (!fallback) return false;
  const rect = fallback.getBoundingClientRect();
  const pad = 60;
  return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
};

const SentenceScramble = ({ group, onComplete, onReady, active }) => {
  // Signal readiness to parent (DOM-based step, ready immediately)
  useEffect(() => { onReady?.(); }, []);

  const { sentenceData, sentences } = useMemo(() => {
    // Only include sentences that have a matching picture
    const data = group.words
      .filter(w => w.sentence && findSentenceImage(group.id, w.word, w.sentence) !== null)
      .map(w => ({ sentence: w.sentence, keyword: w.word }));
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
    return { sentenceData: data, sentences: data.map(s => s.sentence) };
  }, [group]);

  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [shelfWords, setShelfWords] = useState([]);
  const [sourceWords, setSourceWords] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [resultCountdown, setResultCountdown] = useState(5);
  const [checkWrong, setCheckWrong] = useState(false);
  // Reading animation state
  const [readingPhase, setReadingPhase] = useState(null); // 'dictation' | 'reading' | null
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showBorders, setShowBorders] = useState(true);
  const advancingRef = useRef(false);
  const cancelledRef = useRef(false);
  const idleReminderRef = useRef(null);
  const draggedRef = useRef(false);

  const currentSentence = sentences[sentenceIdx] || '';
  const currentKeyword = sentenceData[sentenceIdx]?.keyword || '';
  const sentenceImage = findSentenceImage(group.id, currentKeyword, currentSentence);
  const correctWords = currentSentence.split(/\s+/).filter(Boolean);

  // Clear idle reminder
  const clearIdleReminder = () => {
    clearTimeout(idleReminderRef.current);
  };

  // Start idle reminder
  const startIdleReminder = () => {
    clearTimeout(idleReminderRef.current);
    idleReminderRef.current = setTimeout(async () => {
      if (cancelledRef.current || isLocked) return;
      await playVO('Tap the words to put them in order');
    }, 6000);
  };

  // VO on mount — no sentence dictation (don't reveal answer before user tries)
  useEffect(() => {
    if (!active) return;
    cancelledRef.current = false;
    const run = async () => {
      await playVO("Let's build a sentence!");
      if (cancelledRef.current) return;
      await delay(200);
      if (cancelledRef.current) return;
      await playVO('Tap the words to put them in order');
      if (cancelledRef.current) return;
      startIdleReminder();
    };
    run();
    return () => { cancelledRef.current = true; stopVO(); clearIdleReminder(); };
  }, [active]);

  // Per-sentence VO reminder — no dictation (don't reveal answer)
  useEffect(() => {
    if (sentenceIdx === 0) return;
    cancelledRef.current = false;
    const run = async () => {
      await delay(400);
      if (cancelledRef.current) return;
      await playVO('Tap the words to put them in order');
      if (cancelledRef.current) return;
      startIdleReminder();
    };
    run();
    return () => { cancelledRef.current = true; stopVO(); clearIdleReminder(); };
  }, [sentenceIdx]);

  // Initialize shuffled words
  useEffect(() => {
    setShelfWords([]);
    setIsCorrect(false);
    setIsLocked(false);
    setCheckWrong(false);
    setReadingPhase(null);
    setHighlightIdx(-1);
    setShowBorders(true);
    advancingRef.current = false;

    const words = correctWords.map((word, idx) => ({
      id: `${sentenceIdx}-r${Math.random()}-${idx}`,
      text: word,
      originalIdx: idx,
    }));
    setSourceWords(shuffle(words));
  }, [sentenceIdx]);

  // Auto-check when shelf is full
  useEffect(() => {
    if (shelfWords.length === 0 || shelfWords.length < correctWords.length) return;

    const built = shelfWords.map(w => w.text).join(' ');
    const target = correctWords.join(' ');

    if (built === target) {
      setIsCorrect(true);
      setIsLocked(true);
      clearIdleReminder();
      triggerSmallBurst();
      playSuccessChime();

      // Reading animation sequence
      const runReadingAnimation = async () => {
        cancelledRef.current = false;
        await delay(800);
        if (cancelledRef.current) return;

        // Phase 1: Word-by-word dictation — VO reads each word while it pops
        setReadingPhase('dictation');
        for (let i = 0; i < correctWords.length; i++) {
          if (cancelledRef.current) return;
          setHighlightIdx(i);
          try {
            await playWordVO(correctWords[i]);
          } catch { /* silent */ }
          // Extra delay between words so last word doesn't get cut off
          await delay(350);
        }

        if (cancelledRef.current) return;
        setHighlightIdx(-1);
        await delay(800);
        if (cancelledRef.current) return;

        // Phase 2: Full sentence dictation — reads the whole sentence at once
        try {
          await playSentenceVO(currentSentence);
        } catch { /* silent */ }
        if (cancelledRef.current) return;
        await delay(600);
        if (cancelledRef.current) return;

        // Phase 3: "Let's read together" VO
        await playVO("Let's read together");
        if (cancelledRef.current) return;
        await delay(500);
        if (cancelledRef.current) return;

        // Remove borders/frames
        setShowBorders(false);
        setReadingPhase('reading');
        await delay(400);

        // Phase 4: Words pop one by one (no TTS — kids read along, slower pace)
        for (let i = 0; i < correctWords.length; i++) {
          if (cancelledRef.current) return;
          setHighlightIdx(i);
          // Slower timing to give kids time to read
          await delay(600 + correctWords[i].length * 100);
        }

        if (cancelledRef.current) return;
        setHighlightIdx(-1);
        await delay(400);

        // Completion VO
        await playCompletionEncouragement();
        await delay(800);
        if (cancelledRef.current) return;
        autoAdvance();
      };
      runReadingAnimation();
    } else {
      playErrorBuzz();
      playVO('Oops, try again!');
      setCheckWrong(true);
      setTimeout(() => {
        setCheckWrong(false);
        // Create fresh word objects to avoid duplication
        const freshWords = correctWords.map((word, idx) => ({
          id: `${sentenceIdx}-r${Math.random()}-${idx}`,
          text: word,
          originalIdx: idx,
        }));
        setShelfWords([]);
        setSourceWords(shuffle(freshWords));
        startIdleReminder();
      }, 700);
    }
  }, [shelfWords]);

  const autoAdvance = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setTimeout(() => {
      stopWordVO();
      if (sentenceIdx < sentences.length - 1) {
        setSentenceIdx(prev => prev + 1);
      } else {
        setAllDone(true);
        triggerCelebration();
      }
    }, 500);
  };

  // 5-second auto-advance when all done (use ref to avoid re-triggering on onComplete identity change)
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => {
    if (!allDone) return;
    setResultCountdown(5);
    let cancelled = false;
    let count = 5;
    const countdownInterval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownInterval);
        setResultCountdown(0);
        if (!cancelled) setTimeout(() => onCompleteRef.current(), 0);
      } else {
        setResultCountdown(count);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(countdownInterval); };
  }, [allDone]);

  const handleWordTap = (word) => {
    playWordVO(word.text);
    if (!isLocked) {
      clearIdleReminder();
      startIdleReminder();
      playPlaceSound();
      setSourceWords(prev => prev.filter(w => w.id !== word.id));
      setShelfWords(prev => [...prev, word]);
      setCheckWrong(false);
    }
  };

  const handleRemoveFromShelf = (word) => {
    if (isLocked) return;
    playWordVO(word.text);
    setShelfWords(prev => prev.filter(w => w.id !== word.id));
    setSourceWords(prev => [...prev, word]);
    setCheckWrong(false);
  };

  const handleDrop = (word, info) => {
    const { point } = info;
    if (isLocked) return;
    const onShelf = findShelfAtPoint(point.x, point.y);
    if (onShelf) {
      draggedRef.current = true;
      clearIdleReminder();
      startIdleReminder();
      playPlaceSound();
      playWordVO(word.text);
      setSourceWords(prev => prev.filter(w => w.id !== word.id));
      setShelfWords(prev => [...prev, word]);
      setCheckWrong(false);
    }
  };

  const handleReset = () => {
    if (isLocked) return;
    stopWordVO();
    const words = correctWords.map((word, idx) => ({
      id: `${sentenceIdx}-r${Math.random()}-${idx}`,
      text: word,
      originalIdx: idx,
    }));
    setSourceWords(shuffle(words));
    setShelfWords([]);
    setCheckWrong(false);
  };

  if (allDone) {
    return (
      <div className="h-full w-full flex items-center justify-center relative overflow-hidden"
        style={{ background: 'transparent' }}>
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-[#2d1b69] p-6 md:p-10 text-center max-w-sm md:max-w-md mx-4 border-[4px] border-[#8B5CF6] relative z-10"
          style={{
            borderRadius: '2.5rem',
            boxShadow: '0 12px 0 #1a1147, 0 20px 40px rgba(0,0,0,0.5)',
          }}>
          <motion.span className="text-6xl md:text-8xl block mb-3"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >&#128218;</motion.span>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.2)' }}>Sentence Master!</h2>
          <p className="text-[#e0e7ff] font-extrabold text-lg mb-8">You built {sentences.length} sentences!</p>
          <motion.div
            className="flex items-center justify-center gap-2 text-white/70 text-sm font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span>Next step in</span>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-base">
              {resultCountdown}
            </span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col"
      style={{ background: 'transparent' }}>

      {/* Title + Progress - top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 md:top-4 z-30 flex flex-col items-center gap-1">
        <motion.span
          className="text-base md:text-xl lg:text-2xl font-bold text-white/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Build the Sentence!
        </motion.span>
        <div className="flex items-center gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-0.5 md:px-4 md:py-1 flex items-center gap-2">
            <span className="text-white/50 font-semibold text-xs md:text-sm lg:text-base">
              {sentenceIdx + 1} / {sentences.length}
            </span>
            {!isLocked && (
              <motion.button
                onClick={handleReset}
                className="p-1.5 rounded-full bg-[#3e366b]/10 hover:bg-[#3e366b]/20 transition-colors"
                whileTap={{ scale: 0.9, rotate: -180 }}
              >
                <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/50" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Main content — landscape-first centering with no overflow */}
      <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center px-4 landscape:px-12 min-h-0 gap-3 landscape:gap-14 overflow-hidden pt-28 md:pt-32 landscape:pt-16">

        {/* LEFT in landscape / TOP in portrait: Picture */}
        <div className="flex flex-col items-center justify-center landscape:flex-[0.4] landscape:pl-[5%] gap-2 mt-4 landscape:mt-0">

          {sentenceImage && (
            <motion.div className="relative">
              <motion.img
                key={`img-${sentenceIdx}`}
                src={sentenceImage}
                alt={currentKeyword}
                className="rounded-2xl shadow-xl object-contain bg-white border-[3px] border-[#ae90fd]/30"
                style={{
                  width: 'clamp(140px, min(40vw, 55vh), 450px)',
                  height: 'clamp(140px, min(40vw, 55vh), 450px)',
                  padding: 'clamp(4px, 1vh, 8px)'
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
              />
            </motion.div>
          )}
        </div>

        {/* RIGHT in landscape / BOTTOM in portrait: shelf + source words */}
        <div className="flex flex-col items-center justify-start landscape:flex-[0.6] gap-4 landscape:gap-6 min-h-0 w-full landscape:w-auto">
          {/* Shelf (answer zone) */}
          <div className="w-full max-w-3xl">
            <motion.div
              data-shelf-zone="true"
              className="rounded-xl p-4 md:p-5 flex flex-wrap items-center justify-center gap-1 md:gap-1.5 transition-all duration-500"
              style={{
                minHeight: 'clamp(50px, 10vh, 75px)',
                borderWidth: showBorders ? 3 : 0,
                borderColor: isCorrect ? '#22c55e' : checkWrong ? '#E60023' : '#3e366b30',
                borderStyle: isCorrect ? 'solid' : 'dashed',
                backgroundColor: isCorrect ? '#22c55e15' : checkWrong ? '#E6002310' : 'rgba(255,255,255,0.1)',
                boxShadow: isCorrect ? '0 0 30px rgba(34,197,94,0.3), inset 0 0 20px rgba(34,197,94,0.1)' : 'none',
              }}
              animate={checkWrong ? { x: [0, -6, 6, -6, 6, 0] } : shelfWords.length === 0 && !isCorrect ? { scale: [1, 1.01, 1] } : {}}
              transition={checkWrong ? { duration: 0.4 } : shelfWords.length === 0 && !isCorrect ? { scale: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } } : {}}
            >
              {shelfWords.length === 0 && (
                <span className="text-white/25 text-sm md:text-base lg:text-lg font-medium">
                  Tap words below to build the sentence...
                </span>
              )}
              <AnimatePresence>
                {shelfWords.map((word, idx) => {
                  const isHighlighted = highlightIdx === idx;
                  const isInReadingPhase = readingPhase === 'reading';
                  const isDictationPhase = readingPhase === 'dictation';

                  return (
                    <motion.button
                      key={word.id}
                      onClick={() => isLocked ? playWordVO(word.text) : handleRemoveFromShelf(word)}
                      className="font-bold select-none px-1"
                      style={{
                        fontSize: 'clamp(1.4rem, 5.5vh, 3rem)',
                        color: isCorrect ? '#22c55e' : '#ffffff',
                        textShadow: isHighlighted ? '0 0 20px rgba(255,210,0,0.8)' : '0 2px 8px rgba(0,0,0,0.3)',
                        background: 'none',
                        border: 'none',
                        boxShadow: 'none',
                      }}
                      initial={{ opacity: 0, scale: 0.5, y: 15 }}
                      animate={{
                        opacity: 1,
                        scale: isHighlighted ? 1.15 : 1,
                        y: isHighlighted ? -4 : 0,
                        color: isHighlighted && isDictationPhase ? '#FFD000'
                          : isHighlighted && isInReadingPhase ? '#FF6600'
                            : isCorrect ? '#22c55e'
                              : '#ffffff',
                      }}
                      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
                      whileTap={!isLocked ? { scale: 0.95 } : {}}
                      layout
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      {word.text}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Source words - locked 3 per line centered with tighter gaps */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 w-full max-w-3xl px-2">
            <AnimatePresence>
              {sourceWords.map((word, idx) => (
                <motion.div
                  key={word.id}
                  drag={!isLocked}
                  dragSnapToOrigin
                  dragElastic={0.8}
                  dragMomentum={false}
                  onDragStart={() => { draggedRef.current = false; }}
                  onDragEnd={(e, info) => {
                    const pt = info.point;
                    if (Math.abs(info.offset.x) > 10 || Math.abs(info.offset.y) > 10) {
                      draggedRef.current = true;
                      handleDrop(word, info);
                    }
                  }}
                  onClick={() => { if (!draggedRef.current) handleWordTap(word); draggedRef.current = false; }}
                  className="rounded-lg md:rounded-xl font-bold text-white shadow-md select-none cursor-grab active:cursor-grabbing text-center"
                  style={{
                    backgroundColor: BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length],
                    fontSize: 'clamp(1.3rem, 5vh, 2.5rem)',
                    boxShadow: `0 3px 8px ${BLOCK_COLORS[word.originalIdx % BLOCK_COLORS.length]}30, 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)`,
                    width: 'calc(33.33% - 10px)',
                    minWidth: 'clamp(60px, 10vw, 120px)',
                    aspectRatio: '16/8.5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.2rem',
                    touchAction: 'none',
                  }}
                  initial={{ opacity: 0, scale: 0.5, rotate: Math.random() * 10 - 5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
                  transition={{ delay: idx * 0.06, duration: 0.5 }}
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.92 }}
                  layout
                >
                  {word.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>{/* end right column */}
      </div>{/* end main flex-row */}

      {/* Bottom spacer */}
      <div className="pb-8 md:pb-10" />
    </div>
  );
};

export default SentenceScramble;
