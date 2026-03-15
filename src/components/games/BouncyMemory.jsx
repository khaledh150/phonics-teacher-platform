import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { playVO, stopVO, delay } from '../../utils/audioPlayer';
import { stopAllAudio } from '../../utils/letterSounds';
import { speakAsync } from '../../utils/speech';
import { triggerSmallBurst, triggerCelebration } from '../../utils/confetti';
import { playEncouragement } from '../../utils/encouragement';
import { getWordImage } from '../../utils/assetHelpers';
import confetti from 'canvas-confetti';

const PAIR_COUNT = 4;

const BouncyMemoryGame = ({ group, onBack, onPlayAgain }) => {
  const [cards, setCards] = useState(() => {
    const wordsWithImages = group.words.filter(
      (w) => getWordImage(group.id, w.image || w.word) !== null
    );
    const shuffled = [...wordsWithImages].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, PAIR_COUNT);

    const cardPairs = selected.flatMap((w, i) => [
      {
        id: i * 2,
        pairId: i,
        type: 'word',
        word: w.word,
        imageUrl: null,
        isFlipped: false,
        isMatched: false,
      },
      {
        id: i * 2 + 1,
        pairId: i,
        type: 'image',
        word: w.word,
        imageUrl: getWordImage(group.id, w.image || w.word),
        isFlipped: false,
        isMatched: false,
      },
    ]);

    // Fisher-Yates shuffle
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }
    return cardPairs;
  });

  const [flippedIds, setFlippedIds] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const isCheckingRef = useRef(false);
  const idleRef = useRef(null);
  const mountedRef = useRef(true);

  // --- Idle reminder ---
  const startIdleReminder = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await playVO('Flip the cards to find a match!');
    }, 12000);
  }, []);

  // --- Mount: intro VO + idle ---
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const run = async () => {
      await playVO('Find the matching pairs!');
      if (cancelled) return;
      startIdleReminder();
    };
    run();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
      clearTimeout(idleRef.current);
    };
  }, [startIdleReminder]);

  // --- Confetti rain on results ---
  useEffect(() => {
    if (!gameComplete) return;
    let running = true;
    const rain = () => {
      if (!running) return;
      confetti({
        particleCount: 3,
        angle: 270,
        spread: 120,
        origin: { x: Math.random(), y: -0.1 },
        gravity: 0.6,
        scalar: 0.8,
        ticks: 200,
        colors: ['#FFD000', '#FF6B9D', '#4ECDC4', '#8B5CF6', '#22C55E'],
      });
      requestAnimationFrame(rain);
    };
    rain();
    return () => {
      running = false;
    };
  }, [gameComplete]);

  // --- Card click handler ---
  const handleCardClick = useCallback(
    async (cardId) => {
      if (isCheckingRef.current) return;

      const card = cards.find((c) => c.id === cardId);
      if (!card || card.isMatched || card.isFlipped) return;

      clearTimeout(idleRef.current);

      // Flip the card
      const updatedCards = cards.map((c) =>
        c.id === cardId ? { ...c, isFlipped: true } : c
      );
      const newFlippedIds = [...flippedIds, cardId];
      setCards(updatedCards);
      setFlippedIds(newFlippedIds);

      if (newFlippedIds.length === 2) {
        isCheckingRef.current = true;
        const first = updatedCards.find((c) => c.id === newFlippedIds[0]);
        const second = updatedCards.find((c) => c.id === newFlippedIds[1]);

        if (first.pairId === second.pairId) {
          // MATCH!
          await delay(400);
          if (!mountedRef.current) return;

          const matchedCards = updatedCards.map((c) =>
            c.id === first.id || c.id === second.id
              ? { ...c, isMatched: true }
              : c
          );
          setCards(matchedCards);
          setFlippedIds([]);
          const newMatchCount = matchedPairs + 1;
          setMatchedPairs(newMatchCount);
          triggerSmallBurst();
          await playEncouragement();
          if (!mountedRef.current) return;

          // Speak the word
          await speakAsync(first.word, { rate: 0.85 });
          if (!mountedRef.current) return;

          isCheckingRef.current = false;

          if (newMatchCount >= PAIR_COUNT) {
            // Game complete
            triggerCelebration();
            await playVO('Great job!');
            if (!mountedRef.current) return;
            setGameComplete(true);
          } else {
            startIdleReminder();
          }
        } else {
          // No match - flip back after delay
          await delay(1000);
          if (!mountedRef.current) return;

          const resetCards = updatedCards.map((c) =>
            c.id === first.id || c.id === second.id
              ? { ...c, isFlipped: false }
              : c
          );
          setCards(resetCards);
          setFlippedIds([]);
          isCheckingRef.current = false;
          startIdleReminder();
        }
      }
    },
    [cards, flippedIds, matchedPairs, startIdleReminder]
  );

  // --- Back handler ---
  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    clearTimeout(idleRef.current);
    onBack();
  };

  // --- Results screen ---
  if (gameComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1147] to-[#8B5CF6]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-white p-8 md:p-12 text-center max-w-md mx-4"
          style={{
            borderRadius: '2.2rem',
            boxShadow: '0px 10px 0px rgba(0,0,0,0.12)',
          }}
        >
          <motion.span
            className="text-7xl md:text-8xl block mb-4"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🧠⭐
          </motion.span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#8B5CF6] mb-2">
            Memory Master!
          </h2>
          <p className="text-[#3e366b]/60 text-sm md:text-base mb-6">
            You matched all the pairs!
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={onPlayAgain}
              className="px-8 py-3 md:px-10 md:py-4 bg-[#8B5CF6] text-white font-bold text-base md:text-lg"
              style={{
                borderRadius: '1.6rem',
                borderBottom: '5px solid #7C3AED',
                boxShadow: '0px 6px 0px rgba(0,0,0,0.12)',
              }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Play Again
            </motion.button>
            <motion.button
              onClick={handleBack}
              className="px-8 py-2.5 md:px-10 md:py-3 bg-white/20 text-[#3e366b]/70 font-bold text-sm md:text-base"
              style={{
                borderRadius: '1.6rem',
                borderBottom: '4px solid rgba(0,0,0,0.05)',
              }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 4 }}
            >
              Back to Playground
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Main game ---
  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-b from-[#1a1147] to-[#6B3FA0] overflow-hidden">
      {/* Back button */}
      <motion.button
        onClick={handleBack}
        className="fixed top-3 left-3 z-[70] p-2 md:p-2.5 lg:p-3 rounded-[1.2rem] bg-[#FFD000] transition-all"
        style={{
          borderBottom: '4px solid #E0B800',
          boxShadow: '0px 6px 0px rgba(0,0,0,0.1)',
        }}
        whileTap={{ scale: 0.95, y: 3 }}
      >
        <ArrowLeft className="w-[18px] h-[18px] lg:w-6 lg:h-6 text-[#3e366b]" />
      </motion.button>

      {/* Progress dots */}
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-1.5">
        {Array.from({ length: PAIR_COUNT }).map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              idx < matchedPairs
                ? 'bg-[#22c55e] w-2.5 h-2.5'
                : idx === matchedPairs
                ? 'bg-[#8B5CF6] w-3 h-3 ring-2 ring-[#8B5CF6]/40'
                : 'bg-white/20 w-2.5 h-2.5'
            }`}
          />
        ))}
      </div>

      {/* Card grid */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-2xl w-full">
          {cards.map((card) => (
            <div
              key={card.id}
              className="aspect-square"
              style={{ perspective: '600px' }}
            >
              <motion.div
                animate={{
                  rotateY: card.isFlipped || card.isMatched ? 180 : 0,
                  y: card.isFlipped && !card.isMatched ? -20 : 0,
                }}
                transition={{
                  rotateY: { type: 'spring', stiffness: 300, damping: 20 },
                  y: { type: 'spring', stiffness: 400, damping: 15 },
                }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative w-full h-full cursor-pointer"
                onClick={() => handleCardClick(card.id)}
              >
                {/* Front (face down - star pattern) */}
                <div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center"
                  style={{
                    backfaceVisibility: 'hidden',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.15)',
                  }}
                >
                  <span className="text-4xl">⭐</span>
                </div>

                {/* Back (face up - content) */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-white flex items-center justify-center p-2 ${
                    card.isMatched
                      ? 'ring-4 ring-[#22c55e] shadow-[0_0_16px_rgba(34,197,94,0.4)]'
                      : ''
                  }`}
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    boxShadow: card.isMatched
                      ? '0 4px 0 rgba(34,197,94,0.3)'
                      : '0 4px 0 rgba(0,0,0,0.15)',
                  }}
                >
                  {card.type === 'word' ? (
                    <span className="text-xl md:text-2xl font-black text-[#3e366b] uppercase">
                      {card.word}
                    </span>
                  ) : (
                    <img
                      src={card.imageUrl}
                      alt={card.word}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  )}
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BouncyMemory = (props) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <BouncyMemoryGame
      {...props}
      key={gameKey}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default BouncyMemory;
