"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const Hero = () => {
  const router = useRouter();
  const [buttonState, setButtonState] = useState("hidden"); // "hidden" | "bouncing" | "expanding" | "complete"
  const buttonRef = useRef(null);
  const timersRef = useRef([]);
  
  // Clear all timers
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
  }, []);
  
  // Start the animation sequence
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
  
  // Intersection Observer to detect when button is in view
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
  
  // Get button styles based on state
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
          animation: "bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
        };
      case "expanding":
        return {
          width: "160px",
          height: "48px",
          padding: "0 2rem",
          transform: "scale(1)",
          borderRadius: "9999px",
          transition: "width 0.4s ease-out, padding 0.4s ease-out",
        };
      case "complete":
        return {
          width: "160px",
          height: "48px",
          padding: "0 2rem",
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
        @keyframes bounce-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.85); }
          85% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .hero-button {
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .hero-button:hover {
          transform: scale(1.02) !important;
          box-shadow: 0 4px 12px rgba(0, 191, 99, 0.25);
          filter: brightness(1.05);
        }
        .hero-button:active {
          transform: scale(0.99) !important;
        }
      `}} />
      <section className="min-h-[100vh] flex flex-col items-center justify-center px-4 pt-32 pb-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground mb-8 animate-fade-up">
            SEO made simple
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Your personal AI-powered SEO assistant that analyzes, optimizes, and tracks your website's performance so you can focus on what matters. (like running your business, not wondering what CTR and SERP mean).
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <button
              ref={buttonRef}
              className="hero-button relative overflow-hidden font-semibold text-white bg-primary flex items-center justify-center gap-2"
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
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full px-8 py-6 text-base font-semibold"
              onClick={() => document.getElementById('stacking-cards')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See how it works
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

export default Hero;

