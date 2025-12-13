"use client";

import { motion } from 'framer-motion';

const TypingDots = () => {
  const dotTransition = {
    duration: 0.6,
    repeat: Infinity,
    ease: "easeInOut"
  };

  return (
    <div className="flex items-center space-x-1.5 h-6">
      <motion.div
        className="w-2.5 h-2.5 bg-primary rounded-full"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ ...dotTransition, delay: 0 }}
      />
      <motion.div
        className="w-2.5 h-2.5 bg-primary rounded-full"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ ...dotTransition, delay: 0.2 }}
      />
      <motion.div
        className="w-2.5 h-2.5 bg-primary rounded-full"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ ...dotTransition, delay: 0.4 }}
      />
    </div>
  );
};

export default TypingDots;
