"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
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

export const ChaosVisualizer = () => {
  const containerRef = useRef(null);
  const titleRef = useRef(null);
  
  // State for rendering
  const [tags, setTags] = useState([]);
  const [phase, setPhase] = useState(AnimationPhase.CHAOS);
  
  // Refs for physics loop (mutable to avoid re-renders during calc)
  const tagsRef = useRef([]);
  const requestRef = useRef(null);
  const startTimeRef = useRef(0);
  const phaseStartTimeRef = useRef(0);
  
  // Cache container dimensions to avoid getBoundingClientRect during scroll (fixes mobile glitching)
  const containerDimensionsRef = useRef({ width: 0, height: 0 });
  
  // Pause animation during scroll to prevent glitching (especially on mobile)
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  
  // Tag dimensions for bounds checking
  const TAG_WIDTH = 250;   // Max estimated tag width
  const TAG_HEIGHT = 50;   // Tag height
  const PADDING = 30;      // Padding from edges
  const TITLE_PADDING = 20; // Extra padding around title for bounce
  
  // Initialize tags
  const initTags = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const { width, height } = container.getBoundingClientRect();
    
    // Cache dimensions to avoid reading during scroll (fixes mobile glitching)
    containerDimensionsRef.current = { width, height };
    
    // Safe bounds
    const minX = PADDING;
    const maxX = width - TAG_WIDTH - PADDING;
    const minY = PADDING;
    const maxY = height - TAG_HEIGHT - PADDING;
    
    const newTags = KEYWORDS.map((text, i) => ({
      id: `tag-${i}`,
      text,
      category: 'general',
      // Start in random positions within safe bounds
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
      rotation: (Math.random() - 0.5) * 20, // -10 to 10 deg (less rotation to avoid cutoff)
      // Random velocities
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      vr: (Math.random() - 0.5) * 0.3,
    }));
    
    tagsRef.current = newTags;
    setTags(newTags);
  }, []);

  // Calculate grid positions for "Organized" state
  const getGridTargets = (containerWidth, containerHeight, tagCount) => {
    const targets = [];
    
    // Adaptive columns based on screen width
    let cols = 1;
    if (containerWidth > 1400) cols = 4;
    else if (containerWidth > 1100) cols = 4;
    else if (containerWidth > 768) cols = 3;
    else if (containerWidth > 480) cols = 2;
    
    const rows = Math.ceil(tagCount / cols);
    
    const xGap = 240; // width of tag + gap
    const yGap = 70;  // height of tag + gap
    
    const totalW = cols * xGap;
    const totalH = rows * yGap;
    
    // Center the grid
    const startX = (containerWidth - totalW) / 2 + (xGap / 2) - 100;
    const startY = (containerHeight - totalH) / 2;

    for (let i = 0; i < tagCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      targets.push({
        x: startX + col * xGap,
        y: startY + row * yGap
      });
    }
    return targets;
  };

  const animate = useCallback((time) => {
    // Skip animation frame if scrolling (prevents glitching on mobile)
    if (isScrollingRef.current) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }
    
    if (!startTimeRef.current) startTimeRef.current = time;
    if (!phaseStartTimeRef.current) phaseStartTimeRef.current = time;

    const container = containerRef.current;
    if (!container) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    // Use cached dimensions instead of getBoundingClientRect (fixes mobile scroll glitching)
    const { width, height } = containerDimensionsRef.current;
    
    // Skip if dimensions not yet cached
    if (width === 0 || height === 0) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    const currentPhaseDuration = 
      phase === AnimationPhase.CHAOS ? DURATION_CHAOS :
      phase === AnimationPhase.ALIGNING ? DURATION_ALIGNING :
      phase === AnimationPhase.ORGANIZED ? DURATION_ORGANIZED :
      DURATION_RESETTING;

    const elapsedInPhase = time - phaseStartTimeRef.current;
    
    // Check for Phase Transition
    if (elapsedInPhase > currentPhaseDuration) {
      phaseStartTimeRef.current = time;
      
      if (phase === AnimationPhase.CHAOS) {
        setPhase(AnimationPhase.ALIGNING);
      } else if (phase === AnimationPhase.ALIGNING) {
        setPhase(AnimationPhase.ORGANIZED);
      } else if (phase === AnimationPhase.ORGANIZED) {
        setPhase(AnimationPhase.RESETTING);
        
        // Prepare for explosion/scatter
        tagsRef.current.forEach(tag => {
           const centerX = width / 2;
           const centerY = height / 2;
           const angle = Math.atan2(tag.y - centerY, tag.x - centerX);
           const force = 5 + Math.random() * 5;
           
           tag.vx = Math.cos(angle) * force;
           tag.vy = Math.sin(angle) * force;
           tag.vr = (Math.random() - 0.5) * 5;
        });
      } else if (phase === AnimationPhase.RESETTING) {
        setPhase(AnimationPhase.CHAOS);
        // Calms down velocity for the drift phase
        const minX = PADDING;
        const maxX = width - TAG_WIDTH - PADDING;
        const minY = PADDING;
        const maxY = height - TAG_HEIGHT - PADDING;
        
        tagsRef.current.forEach(tag => {
           // Reset position if flew off screen
           if (tag.x < -TAG_WIDTH || tag.x > width + TAG_WIDTH || tag.y < -TAG_HEIGHT || tag.y > height + TAG_HEIGHT) {
             tag.x = minX + Math.random() * (maxX - minX);
             tag.y = minY + Math.random() * (maxY - minY);
           }
           tag.vx = (Math.random() - 0.5) * 1.5;
           tag.vy = (Math.random() - 0.5) * 1.5;
           tag.vr = (Math.random() - 0.5) * 0.3;
        });
      }
    }
    
    // Physics & Logic Update
    const currentTags = tagsRef.current;
    const gridTargets = getGridTargets(width, height, currentTags.length);

    // Safe bounds for physics
    const minX = PADDING;
    const maxX = width - TAG_WIDTH - PADDING;
    const minY = PADDING;
    const maxY = height - TAG_HEIGHT - PADDING;

    // Get title bounds for collision (using offsetWidth/Height to avoid getBoundingClientRect during scroll)
    let titleBounds = null;
    if (titleRef.current) {
      const titleWidth = titleRef.current.offsetWidth;
      const titleHeight = titleRef.current.offsetHeight;
      // Title is centered via flexbox, so calculate bounds from center
      const centerX = width / 2;
      const centerY = height / 2;
      titleBounds = {
        left: centerX - titleWidth / 2 - TITLE_PADDING,
        right: centerX + titleWidth / 2 + TITLE_PADDING,
        top: centerY - titleHeight / 2 - TITLE_PADDING,
        bottom: centerY + titleHeight / 2 + TITLE_PADDING,
      };
    }

    currentTags.forEach((tag, index) => {
      if (phase === AnimationPhase.CHAOS) {
        // Drift Physics
        tag.x += tag.vx;
        tag.y += tag.vy;
        tag.rotation += tag.vr;

        // Bounce off walls with padding
        if (tag.x <= minX || tag.x >= maxX) tag.vx *= -1;
        if (tag.y <= minY || tag.y >= maxY) tag.vy *= -1;
        
        // Bounce off title (center collision box)
        if (titleBounds) {
          const tagCenterX = tag.x + TAG_WIDTH / 2;
          const tagCenterY = tag.y + TAG_HEIGHT / 2;
          const titleCenterX = (titleBounds.left + titleBounds.right) / 2;
          const titleCenterY = (titleBounds.top + titleBounds.bottom) / 2;
          
          // Check if tag overlaps with title bounds
          if (tag.x < titleBounds.right && 
              tag.x + TAG_WIDTH > titleBounds.left &&
              tag.y < titleBounds.bottom && 
              tag.y + TAG_HEIGHT > titleBounds.top) {
            
            // Determine which side to bounce from
            const overlapLeft = (tag.x + TAG_WIDTH) - titleBounds.left;
            const overlapRight = titleBounds.right - tag.x;
            const overlapTop = (tag.y + TAG_HEIGHT) - titleBounds.top;
            const overlapBottom = titleBounds.bottom - tag.y;
            
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            
            if (minOverlap === overlapLeft || minOverlap === overlapRight) {
              tag.vx *= -1;
              // Push out
              if (tagCenterX < titleCenterX) {
                tag.x = titleBounds.left - TAG_WIDTH - 1;
              } else {
                tag.x = titleBounds.right + 1;
              }
            } else {
              tag.vy *= -1;
              // Push out
              if (tagCenterY < titleCenterY) {
                tag.y = titleBounds.top - TAG_HEIGHT - 1;
              } else {
                tag.y = titleBounds.bottom + 1;
              }
            }
          }
        }
        
        // Keep inside bounds
        tag.x = Math.max(minX, Math.min(tag.x, maxX));
        tag.y = Math.max(minY, Math.min(tag.y, maxY));

      } else if (phase === AnimationPhase.ALIGNING) {
        // Smoothly move to grid target
        const target = gridTargets[index];
        const lerpFactor = 0.06; 
        
        tag.x += (target.x - tag.x) * lerpFactor;
        tag.y += (target.y - tag.y) * lerpFactor;
        tag.rotation += (0 - tag.rotation) * lerpFactor;
        
      } else if (phase === AnimationPhase.ORGANIZED) {
        // Snap to exact target
        const target = gridTargets[index];
        const lerpFactor = 0.1;
        tag.x += (target.x - tag.x) * lerpFactor;
        tag.y += (target.y - tag.y) * lerpFactor;
        tag.rotation = 0;
        
      } else if (phase === AnimationPhase.RESETTING) {
         // Explode outwards
         tag.x += tag.vx;
         tag.y += tag.vy;
         tag.rotation += tag.vr;
      }
    });

    setTags([...currentTags]);
    requestRef.current = requestAnimationFrame(animate);
  }, [phase]);

  useEffect(() => {
    initTags();
    const handleResize = () => initTags();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initTags]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Pause animation during scroll to prevent glitching (mobile only)
  useEffect(() => {
    // Only apply scroll pause on mobile/touch devices
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
    if (!isMobile) return;
    
    const handleScroll = () => {
      isScrollingRef.current = true;
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Resume animation 150ms after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Determine title text and z-index based on phase
  const isOrganizedPhase = phase === AnimationPhase.ORGANIZED || phase === AnimationPhase.ALIGNING;
  const titleText = isOrganizedPhase ? "Into Clarity" : "Turn Keyword Chaos";

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden rounded-2xl">
      {/* Keywords container - behind title when organized */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full pointer-events-none" 
        style={{ zIndex: isOrganizedPhase ? 10 : 30, touchAction: 'pan-y' }}
      >
        {tags.map((tag, i) => (
          <Tag
            key={tag.id}
            text={tag.text}
            x={tag.x}
            y={tag.y}
            rotation={tag.rotation}
            colorClass={COLORS[i % COLORS.length]}
            isOrganized={phase === AnimationPhase.ORGANIZED}
            opacity={phase === AnimationPhase.RESETTING ? 0 : (isOrganizedPhase ? 0.3 : 1)}
          />
        ))}
      </div>

      {/* Center Title - Dynamic based on phase, in front when organized */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: isOrganizedPhase ? 30 : 10, pointerEvents: 'none' }}
      >
        <AnimatePresence mode="wait">
          <motion.h2 
            key={titleText}
            ref={titleRef}
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

