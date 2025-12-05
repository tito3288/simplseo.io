"use client";

import { motion } from 'framer-motion';

const Sparkle = ({ delay = 0, top, left, size = 16 }) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute text-amber-400 pointer-events-none z-10"
      style={{ top, left }}
      initial={{ scale: 0, opacity: 0, rotate: 0 }}
      animate={{ 
        scale: [0, 1.2, 0], 
        opacity: [0, 1, 0], 
        rotate: [0, 90, 180] 
      }}
      transition={{ 
        duration: 1.5, 
        delay: delay, 
        times: [0, 0.5, 1],
        ease: "easeInOut" 
      }}
    >
      <path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill="currentColor"
      />
    </motion.svg>
  );
};

export const SparkleGroup = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <>
      <Sparkle top="-10%" left="-5%" delay={0.1} size={20} />
      <Sparkle top="90%" left="95%" delay={0.3} size={24} />
      <Sparkle top="-15%" left="80%" delay={0.5} size={16} />
      <Sparkle top="40%" left="-12%" delay={0.2} size={12} />
    </>
  );
};

export default Sparkle;

