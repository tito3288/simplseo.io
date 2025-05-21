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
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(1);

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

  const navItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
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
        <Popover open={isChatOpen} onOpenChange={setIsChatOpen}>
          <PopoverTrigger asChild>
            <Button
              className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg flex items-center justify-center z-50 bg-primary hover:bg-primary/90"
              size="icon"
            >
              <MessageSquare className="w-6 h-6 text-white" />
              {unreadMessages > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-80 sm:w-96 p-0 rounded-xl shadow-xl backdrop-blur-md bg-white/1 border border-white/10 ring-1 ring-white/20 mr-2 mb-2"
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
