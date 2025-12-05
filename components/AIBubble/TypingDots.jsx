"use client";

import { motion } from 'framer-motion';

const TypingDots = () => {
  const dotTransition = {
    duration: 0.6,
    repeat: Infinity,
    ease: "easeInOut"
  };

  return (
    <div className="flex items-center space-x-1 h-6">
      <motion.div
        className="w-2 h-2 bg-zinc-400 rounded-full"
        animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ ...dotTransition, delay: 0 }}
      />
      <motion.div
        className="w-2 h-2 bg-zinc-400 rounded-full"
        animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ ...dotTransition, delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-zinc-400 rounded-full"
        animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ ...dotTransition, delay: 0.4 }}
      />
    </div>
  );
};

export default TypingDots;

