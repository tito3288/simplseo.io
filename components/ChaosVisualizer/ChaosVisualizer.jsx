"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag } from './Tag';
import { 
  AnimationPhase,
  KEYWORDS, 
  COLORS, 
  DURATION_CHAOS, 
  DURATION_ALIGNING, 
  DURATION_ORGANIZED, 
  DURATION_RESETTING 
} from './constants';

// Pre-defined starting positions (percentages) - distributed across the container
const STARTING_POSITIONS = [
  { x: 5, y: 8 },    { x: 65, y: 5 },   { x: 30, y: 15 },
  { x: 80, y: 20 },  { x: 10, y: 35 },  { x: 50, y: 30 },
  { x: 75, y: 45 },  { x: 20, y: 55 },  { x: 55, y: 60 },
  { x: 85, y: 65 },  { x: 8, y: 75 },   { x: 40, y: 80 },
  { x: 70, y: 85 },  { x: 25, y: 90 },  { x: 60, y: 92 },
];

// Float animation classes (defined in globals.css)
const FLOAT_ANIMATIONS = [
  'animate-float-1',
  'animate-float-2', 
  'animate-float-3',
  'animate-float-4',
  'animate-float-5',
  'animate-float-6',
];

export const ChaosVisualizer = () => {
  const containerRef = useRef(null);
  const [phase, setPhase] = useState(AnimationPhase.CHAOS);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Generate tag data with pre-assigned positions and animations
  const tags = useMemo(() => {
    return KEYWORDS.map((text, i) => ({
      id: `tag-${i}`,
      text,
      // Starting position (percentage-based for responsiveness)
      startX: STARTING_POSITIONS[i % STARTING_POSITIONS.length].x,
      startY: STARTING_POSITIONS[i % STARTING_POSITIONS.length].y,
      // Assign a float animation class
      floatClass: FLOAT_ANIMATIONS[i % FLOAT_ANIMATIONS.length],
      // Varied animation durations for organic feel (6-12 seconds)
      floatDuration: 6 + (i * 0.5) % 6,
      // Staggered delay so they don't all start synchronized
      floatDelay: (i * 0.3) % 3,
      // Color
      colorClass: COLORS[i % COLORS.length],
    }));
  }, []);

  // Calculate grid positions for organized state
  const gridPositions = useMemo(() => {
    if (containerSize.width === 0) return [];
    
    const { width, height } = containerSize;
    const tagCount = KEYWORDS.length;
    
    // Adaptive columns based on screen width (1 column on mobile)
    let cols = 1;
    if (width > 1200) cols = 4;
    else if (width > 900) cols = 3;
    else if (width > 600) cols = 2;
    // 600px and below = 1 column
    
    const rows = Math.ceil(tagCount / cols);
    const xGap = cols === 1 ? 200 : Math.min(220, (width - 80) / cols);
    const yGap = cols === 1 ? 58 : 65; // More spacing for single column on mobile
    
    const totalW = cols * xGap;
    const totalH = rows * yGap;
    
    const startX = (width - totalW) / 2 + (cols === 1 ? 0 : xGap / 4);
    const startY = (height - totalH) / 2;
    
    return KEYWORDS.map((_, i) => ({
      x: startX + (i % cols) * xGap,
      y: startY + Math.floor(i / cols) * yGap,
    }));
  }, [containerSize]);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Phase cycle timer
  useEffect(() => {
    const durations = {
      [AnimationPhase.CHAOS]: DURATION_CHAOS,
      [AnimationPhase.ALIGNING]: DURATION_ALIGNING,
      [AnimationPhase.ORGANIZED]: DURATION_ORGANIZED,
      [AnimationPhase.RESETTING]: DURATION_RESETTING,
    };
    
    const nextPhase = {
      [AnimationPhase.CHAOS]: AnimationPhase.ALIGNING,
      [AnimationPhase.ALIGNING]: AnimationPhase.ORGANIZED,
      [AnimationPhase.ORGANIZED]: AnimationPhase.RESETTING,
      [AnimationPhase.RESETTING]: AnimationPhase.CHAOS,
    };
    
    const timer = setTimeout(() => {
      setPhase(nextPhase[phase]);
    }, durations[phase]);
    
    return () => clearTimeout(timer);
  }, [phase]);

  // Determine states
  const isChaos = phase === AnimationPhase.CHAOS;
  const isAligning = phase === AnimationPhase.ALIGNING;
  const isOrganized = phase === AnimationPhase.ORGANIZED;
  const isResetting = phase === AnimationPhase.RESETTING;
  const isOrganizedPhase = isOrganized || isAligning;
  
  const titleText = isOrganizedPhase ? "Into Clarity" : "Turn Keyword Chaos";

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden rounded-2xl">
      {/* Keywords container */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: isOrganizedPhase ? 10 : 30 }}
      >
        {tags.map((tag, i) => {
          // Calculate position based on phase
          let x, y;
          
          if (isChaos) {
            // Use percentage-based starting positions during chaos
            x = (tag.startX / 100) * (containerSize.width - 200);
            y = (tag.startY / 100) * (containerSize.height - 50);
          } else if (gridPositions[i]) {
            // Use grid positions during aligning/organized
            x = gridPositions[i].x;
            y = gridPositions[i].y;
          } else {
            x = tag.startX;
            y = tag.startY;
          }
          
          // Determine CSS classes
          const floatActive = isChaos && !isResetting;
          const animationClass = floatActive ? tag.floatClass : '';
          const stateClass = isOrganizedPhase ? 'tag-organized' : isResetting ? 'tag-resetting' : '';
          
          return (
            <Tag
              key={tag.id}
              text={tag.text}
              x={x}
              y={y}
              colorClass={tag.colorClass}
              isOrganized={isOrganized}
              opacity={isResetting ? 0 : (isOrganizedPhase ? 0.3 : 1)}
              floatClass={animationClass}
              stateClass={stateClass}
              floatDuration={tag.floatDuration}
              floatDelay={tag.floatDelay}
              index={i}
            />
          );
        })}
      </div>

      {/* Center Title - Dynamic based on phase */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: isOrganizedPhase ? 30 : 10, pointerEvents: 'none' }}
      >
        <AnimatePresence mode="wait">
          <motion.h2 
            key={titleText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-center px-4"
          >
            {isOrganizedPhase ? "Into Clarity" : "Turn Keyword Chaos"}
          </motion.h2>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChaosVisualizer;
