import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

const messages = [
  'Opening your book...',
  'Finding the pictures...',
  'Almost ready...',
];

const Preloader = ({ isVisible, onExitComplete }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 800);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#d8e9fa] via-[#c4b5fd] to-[#b4d7ff]"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {/* Animated icon */}
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <BookOpen className="w-20 h-20 md:w-28 md:h-28 text-[#3e366b]" strokeWidth={1.5} />
          </motion.div>

          {/* Changing text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              className="mt-8 text-xl md:text-2xl font-semibold text-[#3e366b]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {messages[messageIndex]}
            </motion.p>
          </AnimatePresence>

          {/* Subtle dots */}
          <div className="flex gap-2 mt-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 rounded-full bg-[#3e366b]/40"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;
