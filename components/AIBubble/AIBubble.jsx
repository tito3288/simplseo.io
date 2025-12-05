"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import TypingDots from './TypingDots';
import { SparkleGroup } from './Sparkles';
import { SEO_RECOMMENDATIONS, AI_LOADING_TEXT } from './constants';

// Animation stages as constants instead of enum
const AnimationStage = {
  HIDDEN: 0,
  TYPING: 1,
  PRE_TEXT: 2,    // "Keyword opportunity found..."
  REFINING: 3,   // Transition/Blur
  FINAL: 4,      // Actual recommendation
  EXIT: 5        // Fade out
};

const AIBubble = () => {
  const [stage, setStage] = useState(AnimationStage.HIDDEN);
  const [recIndex, setRecIndex] = useState(0);

  useEffect(() => {
    const timeouts = [];

    const runSequence = () => {
      // Clear any existing timeouts
      timeouts.forEach(t => clearTimeout(t));
      timeouts.length = 0;

      // 1. Start Hidden -> Typing
      setStage(AnimationStage.TYPING);

      // 2. Typing -> Pre-text ("Keyword opportunity found...")
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.PRE_TEXT);
      }, 1500));

      // 3. Pre-text -> Refining (Brief transition state)
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.REFINING);
      }, 3500));

      // 4. Refining -> Final (Show actual recommendation + Sparkles)
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.FINAL);
      }, 4000));

      // 5. Final -> Exit (Fade out to prepare next loop)
      timeouts.push(setTimeout(() => {
        setStage(AnimationStage.EXIT);
      }, 8000));

      // 6. Exit -> Reset Loop (Increment index)
      timeouts.push(setTimeout(() => {
        setRecIndex((prev) => (prev + 1) % SEO_RECOMMENDATIONS.length);
        // Recursively call to loop
        runSequence();
      }, 8800));
    };

    // Start the first loop
    runSequence();

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, []);

  // Determine what content to show based on stage
  const renderContent = () => {
    if (stage === AnimationStage.TYPING) {
      return (
        <motion.div
          key="typing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center"
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
          className="text-zinc-500 font-medium text-sm sm:text-base flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-emerald-500" />
          {AI_LOADING_TEXT}
        </motion.div>
      );
    }

    if (stage === AnimationStage.FINAL) {
      return (
        <motion.div
          key="final-text"
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          className="flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 mb-1">
             <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-[10px] text-white font-bold">
               AI
             </div>
             <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">SEO Mentor</span>
          </div>
          <p className="text-zinc-800 font-medium text-sm sm:text-lg leading-snug">
            {SEO_RECOMMENDATIONS[recIndex]}
          </p>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="relative w-full max-w-md mx-auto px-6">
      <AnimatePresence mode="wait">
        {stage !== AnimationStage.EXIT && (
          <motion.div
            key="bubble-container"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
            className="relative bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-6 sm:p-8 flex items-center min-h-[120px]"
            style={{
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05), 0 0 1px 0 rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.8)"
            }}
          >
             {/* Sparkles Decoration Container - Renders outside the clip */}
            <div className="absolute inset-0 overflow-visible pointer-events-none">
              <SparkleGroup isActive={stage === AnimationStage.FINAL} />
            </div>
            {/* Content Area */}
            <div className="w-full relative z-10">
              <AnimatePresence mode="wait">
                {renderContent()}
              </AnimatePresence>
            </div>
            
            {/* Subtle Gradient Hint */}
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-50/50 via-transparent to-emerald-50/30 rounded-3xl pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Helper text for the demo */}
      <motion.div 
        animate={{ opacity: stage === AnimationStage.EXIT ? 0 : 1 }}
        className="text-center mt-12 text-zinc-300 text-sm font-medium tracking-wide"
      >
        Analysing site performance...
      </motion.div>
    </div>
  );
};

export default AIBubble;

