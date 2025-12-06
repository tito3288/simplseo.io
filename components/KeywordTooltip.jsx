"use client";

import { useState } from "react";
import { X, Search, MousePointerClick } from "lucide-react";

const KeywordModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div 
          className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 pointer-events-auto animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">What is a Keyword?</h3>
            </div>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="space-y-4 text-muted-foreground">
            <p className="text-base leading-relaxed">
              A <span className="text-foreground font-medium">keyword</span> is simply a word or phrase that people type into Google when they&apos;re looking for something.
            </p>
            
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">For example:</p>
              <ul className="text-sm space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>&quot;best pizza in New York&quot;</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>&quot;personal trainer Columbus, Ohio&quot;</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>&quot;gift shop in Charleston, SC&quot;</span>
                </li>
              </ul>
            </div>
            
            <p className="text-base leading-relaxed">
              When your website shows up for keywords related to your business, that&apos;s how new customers find you. The goal of SEO is to help your pages rank higher for the <span className="text-foreground font-medium">right keywords</span>, the ones your ideal customers are actually searching for.
            </p>
          </div>
          
          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full bg-primary text-white font-medium py-2.5 px-4 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
      
      {/* Animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
};

// CTR Modal
const CTRModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div 
          className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 pointer-events-auto animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MousePointerClick className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">What is CTR?</h3>
            </div>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="space-y-4 text-muted-foreground">
            <p className="text-base leading-relaxed">
              <span className="text-foreground font-medium">CTR</span> stands for <span className="text-foreground font-medium">Click-Through Rate</span>. It&apos;s the percentage of people who see your page in Google and actually click on it.
            </p>
            
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Here&apos;s how it works:</p>
              <ul className="text-sm space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>100 people see your page in search results</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>5 people click on it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Your CTR = 5%</span>
                </li>
              </ul>
            </div>
            
            <p className="text-base leading-relaxed">
              A low CTR means your page is showing up but people aren&apos;t clicking. Usually, this is because your <span className="text-foreground font-medium">title or description</span> isn&apos;t compelling enough. The good news? It&apos;s one of the easiest things to fix!
            </p>
          </div>
          
          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full bg-primary text-white font-medium py-2.5 px-4 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Shared modal state - singleton pattern for the modals
let globalSetKeywordModalOpen = null;
let globalSetCTRModalOpen = null;

export const openKeywordModal = () => {
  if (globalSetKeywordModalOpen) {
    globalSetKeywordModalOpen(true);
  }
};

export const openCTRModal = () => {
  if (globalSetCTRModalOpen) {
    globalSetCTRModalOpen(true);
  }
};

// Provider component to be placed once in layout
export const KeywordModalProvider = ({ children }) => {
  const [isKeywordOpen, setIsKeywordOpen] = useState(false);
  const [isCTROpen, setIsCTROpen] = useState(false);
  
  // Register the global setters
  globalSetKeywordModalOpen = setIsKeywordOpen;
  globalSetCTRModalOpen = setIsCTROpen;
  
  return (
    <>
      {children}
      <KeywordModal isOpen={isKeywordOpen} onClose={() => setIsKeywordOpen(false)} />
      <CTRModal isOpen={isCTROpen} onClose={() => setIsCTROpen(false)} />
    </>
  );
};

// The clickable keyword span
export const KeywordTooltip = ({ children, className = "" }) => {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        openKeywordModal();
      }}
      className={`underline decoration-primary/50 underline-offset-4 cursor-pointer hover:decoration-primary hover:text-primary transition-colors ${className}`}
    >
      {children}
    </span>
  );
};

// The clickable CTR span
export const CTRTooltip = ({ children, className = "" }) => {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        openCTRModal();
      }}
      className={`underline decoration-primary/50 underline-offset-4 cursor-pointer hover:decoration-primary hover:text-primary transition-colors ${className}`}
    >
      {children}
    </span>
  );
};

export default KeywordTooltip;

