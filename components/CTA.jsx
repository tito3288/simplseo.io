"use client";

import { ArrowRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const CTA = () => {
  const router = useRouter();
  const [buttonState, setButtonState] = useState("hidden");
  const buttonRef = useRef(null);
  const timersRef = useRef([]);
  
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
  }, []);
  
  const startAnimation = useCallback(() => {
    clearAllTimers();
    setButtonState("hidden");
    
    const startTimer = setTimeout(() => {
      setButtonState("bouncing");
    }, 100);
    
    const expandTimer = setTimeout(() => {
      setButtonState("expanding");
    }, 700);
    
    const completeTimer = setTimeout(() => {
      setButtonState("complete");
    }, 1200);
    
    timersRef.current = [startTimer, expandTimer, completeTimer];
  }, [clearAllTimers]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startAnimation();
          } else {
            clearAllTimers();
            setButtonState("hidden");
          }
        });
      },
      { threshold: 0.5 }
    );
    
    if (buttonRef.current) {
      observer.observe(buttonRef.current);
    }
    
    return () => {
      observer.disconnect();
      clearAllTimers();
    };
  }, [startAnimation, clearAllTimers]);
  
  const getButtonStyles = () => {
    switch (buttonState) {
      case "hidden":
        return {
          width: "48px",
          height: "48px",
          padding: "0",
          transform: "scale(0)",
          borderRadius: "9999px",
        };
      case "bouncing":
        return {
          width: "48px",
          height: "48px",
          padding: "0",
          transform: "scale(1)",
          borderRadius: "9999px",
          animation: "cta-bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
        };
      case "expanding":
        return {
          width: "180px",
          height: "48px",
          padding: "0 2.5rem",
          transform: "scale(1)",
          borderRadius: "9999px",
          transition: "width 0.4s ease-out, padding 0.4s ease-out",
        };
      case "complete":
        return {
          width: "180px",
          height: "48px",
          padding: "0 2.5rem",
          transform: "scale(1)",
          borderRadius: "9999px",
        };
      default:
        return {};
    }
  };
  
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes cta-bounce-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.85); }
          85% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .cta-button {
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .cta-button:hover {
          transform: scale(1.02) !important;
          box-shadow: 0 4px 12px rgba(0, 191, 99, 0.25);
          filter: brightness(1.05);
        }
        .cta-button:active {
          transform: scale(0.99) !important;
        }
      `}} />
      <section className="pt-0 pb-20">
        <div className="section-secondary py-20 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Ready to rank higher?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          Stop paying Google for ads. The moment you stop, the traffic stops.
          With SEO, you build trust that brings customers in long after the work is done. <br></br>     
          It takes time, but the long-term payoff makes it all worth it. <br></br><br></br>
            Join thousands of businesses using SimplSEO to grow their organic traffic!
          </p>
          <button
            ref={buttonRef}
            className="cta-button relative overflow-hidden font-semibold text-white bg-primary flex items-center justify-center gap-2 mx-auto"
            style={getButtonStyles()}
            onClick={() => router.push('/auth')}
          >
            <span 
              className="whitespace-nowrap transition-opacity duration-300"
              style={{ opacity: buttonState === "complete" ? 1 : 0 }}
            >
              Try Our Demo
            </span>
            <ArrowRight 
              className="w-4 h-4 transition-opacity duration-300"
              style={{ opacity: buttonState === "complete" ? 1 : 0 }}
            />
          </button>
          </div>
        </div>
      </section>
    </>
  );
};

export default CTA;

