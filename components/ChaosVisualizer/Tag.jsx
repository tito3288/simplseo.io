"use client";

import { Check } from 'lucide-react';

export const Tag = ({ 
  text, 
  x, 
  y, 
  rotation, 
  colorClass, 
  isOrganized, 
  opacity 
}) => {
  return (
    <div
      className={`absolute flex items-center gap-2 px-5 py-3 rounded-full border backdrop-blur-xl ${colorClass} ${isOrganized ? 'shadow-md shadow-black/10' : 'shadow-lg shadow-black/20'}`}
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        opacity: opacity,
        willChange: 'transform, opacity',
        whiteSpace: 'nowrap',
        zIndex: isOrganized ? 10 : 20,
        transition: 'box-shadow 0.3s ease, opacity 0.8s ease-in-out',
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

