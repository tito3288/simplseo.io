"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Globe,
  MessageSquare,
  Settings,
  User,
  Menu,
  X,
  AlertTriangle,
} from "lucide-react";
import ChatAssistant from "../components/ChatAssistant";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";

const MainLayout = ({
  children,
  showChat = true,
  aiTips = [],
  gscKeywords = [],
  easyWins = [],
  topPages = [],
  lowCtrPages = [],
  impressionTrends = [],
}) => {
  const { logout, user } = useAuth();
  const { data } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !user) {
      router.push("/auth");
    }
  }, [user]);

  // ✅ Prevent hook mismatch error during logout
  // if (typeof window !== "undefined" && !user) {
  //   router.push("/auth");
  //   return null;
  // }

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Show chat assistant only on first visit
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenChat = localStorage.getItem("hasSeenChatAssistant");
      
      if (!hasSeenChat) {
        // First time visitor - show chat
        setIsChatOpen(true);
        setUnreadMessages(1);
        localStorage.setItem("hasSeenChatAssistant", "true");
      }
    }
  }, []);

  const navItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      path: "/intent-mismatch",
      label: "Intent Mismatch",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    {
      path: "/website",
      label: "My Website",
      icon: <Globe className="w-5 h-5" />,
    },
    {
      path: "/chatbot",
      label: "Chatbot",
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const isActive = (path) => pathname === path;

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };



  const handleChatOpen = (open) => {
    setIsChatOpen(open);
  };

  // Handle manual click to open chat
  const handleManualChatOpen = () => {
    setIsChatOpen(!isChatOpen);
    setShowTooltip(false); // Hide tooltip when chat is opened
  };

  // Listen for chat open events from other components (like intent mismatch page)
  useEffect(() => {
    const handleChatOpenEvent = (event) => {
      if (event.detail?.context === 'intent_mismatch') {
        setIsChatOpen(true);
        // The chat context is already stored in localStorage
        console.log('Chat opened from intent mismatch page with context:', event.detail);
      }
    };

    window.addEventListener('openChatAssistant', handleChatOpenEvent);
    
    return () => {
      window.removeEventListener('openChatAssistant', handleChatOpenEvent);
    };
  }, []);

  // Auto-animate every 30 seconds
  useEffect(() => {
    if (isChatOpen) return; // Don't animate if chat is open

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIsAnimating(false);
        // Keep tooltip visible after animation
        setShowTooltip(true);
      }, 5000); // Animation duration
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isChatOpen]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <img
                src="./1.png"
                alt="SimplSEO.io Logo"
                className="rounded-md my-logo w-[160px] md:w-[250px]"
              />
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  size="sm"
                  className={`flex items-center gap-1 ${
                    isActive(item.path) ? "font-medium" : ""
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                <span className="block text-foreground font-medium">
                  {data.businessName || user?.email}
                </span>
                <span className="text-xs">
                  {data.websiteUrl || "No website set"}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <User className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <nav className="md:hidden border-t border-border">
            <div className="container mx-auto px-4 py-2 flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    className={`w-full justify-start ${
                      isActive(item.path) ? "font-medium" : ""
                    }`}
                  >
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </Button>
                </Link>
              ))}
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <User className="w-5 h-5" />
                <span className="ml-2">Logout</span>
              </Button>
            </div>
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 transition-all duration-300">
          {children}
        </div>
      </main>

      {/* Chat Assistant */}
      {showChat && (
        <>
          {/* Inline styles for the animation */}
          {isAnimating && (
            <style jsx>{`
              @keyframes bounce-squash {
                0% {
                  transform: translateY(0) scaleX(1) scaleY(1);
                }
                10% {
                  transform: translateY(-20px) scaleX(1.05) scaleY(0.95);
                }
                25% {
                  transform: translateY(-50px) scaleX(0.95) scaleY(1.05);
                }
                50% {
                  transform: translateY(0) scaleX(1.2) scaleY(0.8); /* squash on impact */
                }
                75% {
                  transform: translateY(-30px) scaleX(0.98) scaleY(1.02);
                }
                100% {
                  transform: translateY(0) scaleX(1) scaleY(1);
                }
              }
            `}</style>
          )}
          
          <Popover open={isChatOpen} onOpenChange={handleChatOpen}>
            <PopoverTrigger asChild>
              <div className="fixed bottom-6 right-6" onClick={handleManualChatOpen}>
                <Button
                  className="rounded-full w-14 h-14 shadow-lg flex items-center justify-center z-50 bg-[#00BF63] hover:bg-[#00BF63]/90"
                  size="icon"
                  style={{
                    animation: isAnimating ? 'bounce-squash 1s ease-in-out' : 'none'
                  }}
                >
                  <MessageSquare className="w-6 h-6 text-white" />
                  {unreadMessages > 0 && !isChatOpen && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadMessages}
                    </span>
                  )}
                </Button>
                
                {/* Tooltip that appears during animation */}
                {(isAnimating || showTooltip) && (
                  <div 
                    className="fixed bottom-25 right-6 bg-[#00bf63]/8 backdrop-blur-md text-black text-sm px-3 py-2 rounded-lg shadow-lg z-50"
                    style={{
                      animation: isAnimating ? 'bounce-squash 1s ease-in-out' : 'none'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Need SEO help or a bad joke? 🤔</span>
                    </div>
                    <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white-900"></div>
                  </div>
                )}
              </div>
            </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-80 sm:w-96 p-0 rounded-xl shadow-xl backdrop-blur-md bg-white/1 border border-white/10 ring-1 ring-white/20 mr-2 mb-2 z-[60]"
            sideOffset={16}
          >
            <div className="max-h-[500px] overflow-hidden rounded-xl">
              <ChatAssistant
                onClose={() => setIsChatOpen(false)}
                aiTips={aiTips}
                gscKeywords={gscKeywords}
                easyWins={easyWins}
                topPages={topPages}
                lowCtrPages={lowCtrPages}
                impressionTrends={impressionTrends}
              />
            </div>
          </PopoverContent>
        </Popover>
        </>
      )}
    </div>
  );
};

{
  /* <style>
  .my-logo {
    width: 60px;
    height: auto;
  }
  @media (max-width: 768px) {
    .my-logo {
      width: 50px;
    }
  }
</style> */
}
export default MainLayout;
