"use client";

import { Check } from 'lucide-react';

export const Tag = ({ 
  text, 
  x, 
  y, 
  colorClass, 
  isOrganized, 
  opacity,
  floatClass = '',
  stateClass = '',
  floatDuration = 8,
  floatDelay = 0,
  index = 0,
}) => {
  return (
    <div
      className={`absolute pointer-events-none flex items-center gap-2 px-5 py-3 rounded-full border backdrop-blur-xl ${colorClass} ${floatClass} ${stateClass} ${isOrganized ? 'shadow-md shadow-black/10' : 'shadow-lg shadow-black/20'}`}
      style={{
        left: x,
        top: y,
        opacity: opacity,
        willChange: 'transform, opacity, left, top',
        whiteSpace: 'nowrap',
        zIndex: isOrganized ? 10 : 20,
        // CSS custom property for varied animation durations
        '--float-duration': `${floatDuration}s`,
        animationDelay: `${floatDelay}s`,
        // Smooth transition for position changes AND opacity (with staggered delay for fade-in)
        // Include delay directly in transition to avoid shorthand/longhand conflict
        transition: stateClass 
          ? 'left 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.8s ease, box-shadow 0.3s ease' 
          : `opacity 0.6s ease-in ${!stateClass && opacity === 1 ? index * 0.05 : 0}s, box-shadow 0.3s ease`,
      }}
    >
      <span className="text-base font-medium tracking-wide">{text}</span>
      <div 
        className={`overflow-hidden transition-all duration-500 ease-out flex items-center ${isOrganized ? 'w-5 opacity-100' : 'w-0 opacity-0'}`}
      >
        <Check size={18} className="text-current" strokeWidth={3} />
      </div>
    </div>
  );
};

export default Tag;
