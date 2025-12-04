"use client";

import { Search, TrendingUp, FileText, MessageSquare, Sparkles, Target } from "lucide-react";
import { useTheme } from "@/app/contexts/ThemeContext";

const stackingCards = [
  {
    icon: Sparkles,
    title: "AI Content Outlines",
    titleSubtitle: "(So You Know What to Write)",
    description: "Found a keyword opportunity but not sure what to write? We'll generate a complete content outline for you. Just add your expertise and hit publish. We do the SEO thinking, you do the writing.",
    lightColor: "hsl(260, 30%, 94%)",
    darkColor: "hsl(260, 25%, 35%)"
  },

  {
    icon: MessageSquare,
    title: "Your Personal SEO Mentor",
    titleSubtitle: "(Trained Specifically for You)",
    description: "Ask your SEO mentor anything in plain English. It's trained on YOUR website, so it already understands your business, your pages, and the keywords you care about. No more wasting hours trying to decode SEO jargon on your own. Those days are officially behind you. Every answer is personalized. It explains things simply, helps you write stronger content, and gives you ideas that actually work for your business. Think of it as your own SEO professional available 24/7.",

    lightColor: "hsl(145, 40%, 92%)",
    darkColor: "hsl(160, 30%, 32%)", // Soft sage
  },
  {
    icon: Target,
    title: "Track Your Progress",
    titleSubtitle: "(Real Results, Not Just Data)",
    description: "See your real-time rankings with accurate data straight from Google. Create a page from our suggestions? We'll email you the moment it starts ranking. Plus, see side-by-side comparisons showing how your keywords improved after you implemented our suggestions. Watch your CTR go up, clicks increase, and rankings climb. We'll even tell you exactly what's working and what's not.",
    lightColor: "hsl(200, 40%, 92%)",
    darkColor: "hsl(210, 30%, 35%)", // Soft steel blue
  },
  {
    icon: Search,
    title: "Find Keywords You're Already Ranking For",
    titleSubtitle: "(But Didn't Know)",
    description: "We'll show you keywords people are searching for that lead to your site even if you don't have a page for them yet. It's like finding money in your couch cushions, but for SEO.",
    lightColor: "hsl(320, 30%, 94%)",
    darkColor: "hsl(330, 25%, 35%)", // Soft dusty rose
  },
  {
    icon: TrendingUp,
    title: "Fix Pages That Get Views But No Clicks",
    titleSubtitle: "(The CTR Problem)",
    description: "Your page shows up in Google but nobody clicks? We'll tell you exactly why and how to fix it. Usually it's the title we'll help you write better ones that people actually want to click.",
    lightColor: "hsl(45, 50%, 92%)",
    darkColor: "hsl(40, 35%, 32%)", // Soft warm beige
  },


  // {
  //   icon: Target,
  //   title: "Track Your Rankings",
  //   titleSubtitle: "(Without the Headache)",
  //   description: "See your real-time rankings with accurate data staright from Google. We break it down in plain English so you always know what's working and what is not.",
  //   lightColor: "hsl(15, 40%, 94%)",
  //   darkColor: "hsl(20, 30%, 35%)", // Soft terracotta
  // },
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
                top: `${150 + index * 24}px`,
                zIndex: index + 1,
              }}
            >
              <div
                className="rounded-[2rem] p-8 md:p-12 lg:p-16 shadow-lg transition-all duration-300 min-h-[400px] md:min-h-[450px] flex flex-col md:flex-row items-center gap-8"
                style={{ backgroundColor: isDarkMode ? card.darkColor : card.lightColor }}
              >
              <div className="flex-1">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/10' : 'bg-foreground/10'}`}>
                  <card.icon className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-foreground'}`} />
                </div>
                <h3 className={`text-3xl md:text-4xl lg:text-5xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-foreground'}`}>
                  {card.title}
                  {card.titleSubtitle && (
                    <>
                      <br />
                      <span className="text-2xl md:text-3xl lg:text-4xl">{card.titleSubtitle}</span>
                    </>
                  )}
                </h3>
                <p className={`text-lg md:text-xl max-w-xl ${isDarkMode ? 'text-white/80' : 'text-foreground/70'}`}>
                  {card.description}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className={`w-full max-w-md aspect-video rounded-2xl shadow-inner flex items-center justify-center ${isDarkMode ? 'bg-white/10' : 'bg-background/50'}`}>
                  <card.icon className={`w-20 h-20 ${isDarkMode ? 'text-white/30' : 'text-foreground/20'}`} />
                </div>
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

