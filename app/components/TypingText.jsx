"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function TypingText({ 
  text, 
  speed = 30, // milliseconds per character
  onComplete,
  className = "",
  isMarkdown = false 
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated without triggering effect re-runs
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Reset state for new text
    setDisplayedText("");
    setIsComplete(false);
    indexRef.current = 0;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const typeText = () => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.substring(0, indexRef.current + 1));
        indexRef.current += 1;
        timeoutRef.current = setTimeout(typeText, speed);
      } else {
        setIsComplete(true);
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    };

    // Start typing after a brief delay
    timeoutRef.current = setTimeout(typeText, 50);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed]); // onComplete removed - accessed via ref

  if (isMarkdown) {
    return (
      <div className={className}>
        <ReactMarkdown>{displayedText}</ReactMarkdown>
      </div>
    );
  }

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
}

