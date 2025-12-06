"use client";

import { Search, TrendingUp, FileText, MessageSquare, Sparkles, Target } from "lucide-react";
import { useTheme } from "@/app/contexts/ThemeContext";
import { KeywordTooltip, CTRTooltip } from "./KeywordTooltip";

// Helper to render description with keyword tooltips
const renderDescription = (text) => {
  // Split by "keyword" or "keywords" (case insensitive) and wrap matches
  const parts = text.split(/(keywords?)/gi);
  return parts.map((part, index) => {
    if (part.toLowerCase() === "keyword" || part.toLowerCase() === "keywords") {
      return <KeywordTooltip key={index}>{part}</KeywordTooltip>;
    }
    return part;
  });
};

// Helper to render title with keyword tooltips
const renderTitle = (text) => {
  const parts = text.split(/(Keywords?)/gi);
  return parts.map((part, index) => {
    if (part.toLowerCase() === "keyword" || part.toLowerCase() === "keywords") {
      return <KeywordTooltip key={index}>{part}</KeywordTooltip>;
    }
    return part;
  });
};

const stackingCards = [
  {
    icon: Sparkles,
    title: "AI Content Outlines",
    titleSubtitle: "(So You Know What to Write)",
    description: "Found a keyword opportunity but not sure what to write? We'll generate a complete content outline for you. Just add your expertise and hit publish. We do the SEO thinking, you do the writing.",
    lightColor: "hsl(260, 30%, 94%)",
    darkColor: "hsl(260, 25%, 35%)",
    image: "/6.png",
  },

  {
    icon: MessageSquare,
    title: "Your Personal SEO Mentor",
    titleSubtitle: "(Trained Specifically for You)",
    description: "Ask your SEO mentor anything in plain English. It's trained on YOUR website content, so it knows your business and the keywords you care about. No more decoding SEO jargon. Think of it as your own SEO professional available 24/7.",
    lightColor: "hsl(145, 40%, 92%)",
    darkColor: "hsl(160, 30%, 32%)", // Soft sage
    image: "/2.png",
  },
  {
    icon: Target,
    title: "Track Your Progress",
    titleSubtitle: "(Real Results, Not Just Data)",
    description: "See your rankings in real time with accurate data from Google. We notify you the moment a new page starts ranking and show side-by-side progress so you can see what's improving. Watch clicks rise, rankings climb, and know exactly what's working and what's not.",
    lightColor: "hsl(200, 40%, 92%)",
    darkColor: "hsl(210, 30%, 35%)", // Soft steel blue
    image: "/5.png",
  },
  {
    icon: Search,
    title: "Find Keywords You're Already Ranking For",
    titleSubtitle: "(But Didn't Know)",
    description: "We'll show you keywords people are searching for that lead to your site even if you don't have a page for them yet. It's like finding money in your couch cushions, but for SEO.",
    lightColor: "hsl(320, 30%, 94%)",
    darkColor: "hsl(330, 25%, 35%)", // Soft dusty rose
    image: "/1.png",
    skipTitleKeyword: true, // Don't underline "Keywords" in title - it's self-explanatory here
  },
  {
    icon: TrendingUp,
    title: "Fix Pages That Get Views But No Clicks",
    titleSubtitle: "(The CTR Problem)",
    hasCTRTooltip: true, // Use CTR tooltip in subtitle
    description: "Your page shows up in Google but nobody clicks? We'll tell you exactly why and how to fix it. Usually it's the title we'll help you write better ones that people actually want to click.",
    lightColor: "hsl(45, 50%, 92%)",
    darkColor: "hsl(40, 35%, 32%)", // Soft warm beige
    image: "/4.png",
  },
];

const StackingCards = () => {
  const { isDarkMode } = useTheme();
  return (
    <section id="stacking-cards" className="relative">
      {/* Section header */}
      <div className="text-center pt-20 pb-16 px-4">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
          Everything you need
        </h2>
        {/* <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Powerful SEO tools designed to help businesses of all sizes grow their organic traffic.
        </p> */}
      </div>

      {/* Stacking cards container */}
      <div className="relative px-4 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto">
          {stackingCards.map((card, index) => (
            <div
              key={card.title}
              className="sticky mb-8 last:mb-0"
              style={{
                '--mobile-top': `${100 + index * 16}px`,
                '--desktop-top': `${150 + index * 24}px`,
                top: 'var(--mobile-top)',
                zIndex: index + 1,
              }}
            >
              <style jsx>{`
                @media (min-width: 768px) {
                  div {
                    top: var(--desktop-top) !important;
                  }
                }
              `}</style>
              <div
                className="rounded-[2rem] p-8 md:p-12 lg:p-16 shadow-lg transition-all duration-300 min-h-[400px] md:min-h-[450px] flex flex-col md:flex-row items-center gap-8"
                style={{ backgroundColor: isDarkMode ? card.darkColor : card.lightColor }}
              >
              <div className="flex-1">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/10' : 'bg-foreground/10'}`}>
                  <card.icon className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-foreground'}`} />
                </div>
                <h3 className={`text-3xl md:text-4xl lg:text-5xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-foreground'}`}>
                  {card.skipTitleKeyword ? card.title : renderTitle(card.title)}
                  {card.titleSubtitle && (
                    <>
                      <br />
                      <span className="text-lg md:text-3xl lg:text-4xl">
                        {card.hasCTRTooltip ? (
                          <>{"(The "}<CTRTooltip>CTR</CTRTooltip>{" Problem)"}</>
                        ) : (
                          card.titleSubtitle
                        )}
                      </span>
                    </>
                  )}
                </h3>
                <p className={`text-lg md:text-xl max-w-xl ${isDarkMode ? 'text-white/80' : 'text-foreground/70'}`}>
                  {renderDescription(card.description)}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {card.image ? (
                  <img 
                    src={card.image} 
                    alt={card.title}
                    className="w-full max-w-sm rounded-2xl shadow-lg object-cover"
                  />
                ) : (
                  <div className={`w-full max-w-md aspect-video rounded-2xl shadow-inner flex items-center justify-center ${isDarkMode ? 'bg-white/10' : 'bg-background/50'}`}>
                    <card.icon className={`w-20 h-20 ${isDarkMode ? 'text-white/30' : 'text-foreground/20'}`} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Spacer to allow last card to be seen fully */}
      <div className="h-32" />
    </section>
  );
};

export default StackingCards;

