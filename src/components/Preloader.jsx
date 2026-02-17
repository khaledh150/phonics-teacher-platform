import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

const defaultMessages = [
  'Opening your book...',
  'Finding the pictures...',
  'Almost ready...',
];

const Preloader = ({ isVisible, onExitComplete, messages: customMessages }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = customMessages || defaultMessages;

  useEffect(() => {
    if (!isVisible) return;
    setMessageIndex(0);
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 800);
    return () => clearInterval(interval);
  }, [isVisible, messages]);

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
            <BookOpen className="w-24 h-24 md:w-32 md:h-32 text-[#3e366b]" strokeWidth={1.5} />
          </motion.div>

          {/* Changing text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              className="mt-8 text-2xl md:text-3xl font-semibold text-[#3e366b]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {messages[messageIndex]}
            </motion.p>
          </AnimatePresence>

          {/* Subtle dots */}
          <div className="flex gap-3 mt-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-4 h-4 rounded-full bg-[#3e366b]/40"
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
