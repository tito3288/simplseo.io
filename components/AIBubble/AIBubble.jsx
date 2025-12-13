"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bot } from 'lucide-react';
import TypingDots from './TypingDots';
import { SparkleGroup } from './Sparkles';
import { SEO_RECOMMENDATIONS, AI_LOADING_TEXTS } from './constants';

// Animation stages
const AnimationStage = {
  HIDDEN: 0,
  TYPING: 1,
  PRE_TEXT: 2,
  REFINING: 3,
  FINAL: 4,
  EXIT: 5
};

const AIBubble = () => {
  const [stage, setStage] = useState(AnimationStage.HIDDEN);
  const [recIndex, setRecIndex] = useState(0);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  useEffect(() => {
    const timeouts = [];

    const runSequence = () => {
      timeouts.forEach(t => clearTimeout(t));
      timeouts.length = 0;

      setStage(AnimationStage.TYPING);

      // Typing dots - 2.5 seconds
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.PRE_TEXT);
      }, 2500));

      // Loading text - show for 3 seconds
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.REFINING);
      }, 5500));

      // Blur transition - 0.5 seconds
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.FINAL);
      }, 6000));

      // Show recommendation - 7 seconds to read
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.EXIT);
      }, 13000));

      // Exit transition - 1 second, then loop
      timeouts.push(setTimeout(() => {
        setRecIndex((prev) => (prev + 1) % SEO_RECOMMENDATIONS.length);
        setLoadingTextIndex((prev) => (prev + 1) % AI_LOADING_TEXTS.length);
        runSequence();
      }, 14000));
    };

    runSequence();

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, []);

  const renderContent = () => {
    if (stage === AnimationStage.TYPING) {
      return (
        <motion.div
          key="typing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center py-2"
        >
          <TypingDots />
        </motion.div>
      );
    }

    if (stage === AnimationStage.PRE_TEXT || stage === AnimationStage.REFINING) {
      return (
        <motion.div
          key="pre-text"
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ 
            opacity: stage === AnimationStage.REFINING ? 0 : 1, 
            y: 0, 
            filter: stage === AnimationStage.REFINING ? 'blur(8px)' : 'blur(0px)' 
          }}
          exit={{ opacity: 0, y: -10 }}
          className="text-muted-foreground font-medium text-sm sm:text-base flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          {AI_LOADING_TEXTS[loadingTextIndex]}
        </motion.div>
      );
    }

    if (stage === AnimationStage.FINAL) {
      return (
        <motion.div
          key="final-text"
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">SEO Mentor</span>
          </div>
          <p className="text-foreground font-medium text-sm sm:text-lg leading-relaxed">
            {SEO_RECOMMENDATIONS[recIndex]}
          </p>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="relative w-full max-w-lg mx-auto px-6">
      {/* Fixed height container to prevent layout shift */}
      <div className="min-h-[180px] flex items-center justify-center">
        <motion.div
          key="bubble-container"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ 
            opacity: stage === AnimationStage.EXIT ? 0 : 1, 
            y: stage === AnimationStage.EXIT ? -10 : 0, 
            scale: stage === AnimationStage.EXIT ? 0.95 : 1 
          }}
          transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          className="relative w-full"
        >
          {/* Gradient glow behind the card */}
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-teal-500/10 to-primary/20 rounded-3xl blur-2xl opacity-60" />
          
          {/* Main card */}
          <div className="relative bg-background/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 min-h-[120px] shadow-xl">
            {/* Sparkles decoration */}
            <div className="absolute inset-0 overflow-visible pointer-events-none">
              <SparkleGroup isActive={stage === AnimationStage.FINAL} />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {renderContent()}
              </AnimatePresence>
            </div>
            
            {/* Subtle inner gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-2xl pointer-events-none" />
          </div>
        </motion.div>
      </div>
      
      {/* Status text */}
      <motion.div 
        animate={{ opacity: stage === AnimationStage.EXIT ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mt-6"
      >
        {/* <span className="inline-flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Analysing 
        </span> */}
      </motion.div>
    </div>
  );
};

export default AIBubble;
