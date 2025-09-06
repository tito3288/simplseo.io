"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import MainLayout from "../components/MainLayout";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  MessageSquare, 
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Pencil,
  GraduationCap,
  Code,
  Coffee,
  ArrowUp,
  Folder,
  Settings,
  Search,
  Wand2,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Lightbulb,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { fetchChatbotData } from "../lib/chatbotDataFetcher";
import { useMinimumLoading } from "../hooks/use-minimum-loading";

export default function Chatbot() {
  const { user, isLoading: authLoading } = useAuth();
  const { data } = useOnboarding();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ✅ NEW: Chatbot-specific data states
  const [chatbotData, setChatbotData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const shouldShowLoader = useMinimumLoading(isLoadingData, 2000);

  const recentChats = [
    "React Hook Dependency Warning",
    "Community Impact Page Strategy", 
    "Community Center Services Overview",
    "Website Content Enhancement Strategy",
    "Dental Website FAQ Development",
    "Generating Relevant Anchor Text",
    "Introducing SEO Assistant"
  ];

  const rotatingTitles = [
    "What SEO mess are we cleaning up today?",
    "SEO is hard. Talking to me isn't.",
    "Rankings low? Confidence lower? I got you.",
    "Google's confusing. I'm not.",
    "Your AI sidekick for all things SEO.",
    "Let's fix what Google isn't loving yet."
  ];

  const [currentTitle, setCurrentTitle] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // ✅ NEW: Fetch chatbot data
  useEffect(() => {
    const loadChatbotData = async () => {
      if (!user?.id) {
        setIsLoadingData(false);
        return;
      }

      try {
        console.log("🔍 Fetching chatbot data...");
        const result = await fetchChatbotData(user.id);
        
        if (result.success) {
          setChatbotData(result.data);
          console.log("✅ Chatbot data loaded:", result.data);
        } else {
          console.log("❌ Failed to load chatbot data:", result.error);
          toast.error("Failed to load your data", {
            description: result.error
          });
        }
      } catch (error) {
        console.error("❌ Error loading chatbot data:", error);
        toast.error("Error loading data", {
          description: "Please try refreshing the page"
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadChatbotData();
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    // Randomly select a title when component mounts
    const randomIndex = Math.floor(Math.random() * rotatingTitles.length);
    setCurrentTitle(rotatingTitles[randomIndex]);
  }, []);

  // ✅ NEW: Load saved conversation (no automatic welcome message)
  useEffect(() => {
    const loadSavedConversation = () => {
      const stored = localStorage.getItem("chatbotMessages-v1");
      if (stored) {
        const { messages: savedMessages, timestamp } = JSON.parse(stored);
        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;

        if (now - timestamp < oneHour && savedMessages.length > 0) {
          setMessages(savedMessages);
          return;
        }
      }

      // No automatic welcome message - start with empty messages
      setMessages([]);
    };

    // Only load conversation after data is loaded
    if (!isLoadingData) {
      loadSavedConversation();
    }
  }, [isLoadingData]);

  // Mobile detection and sidebar state management
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // On mobile, start with sidebar collapsed
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile detection and sidebar state management
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // On mobile, start with sidebar collapsed
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsThinking(true);

    try {
      // ✅ NEW: Call dedicated chatbot API with user data
      const res = await fetch("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          userData: {
            userFirstName: data?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there',
            businessName: data?.businessName,
            businessLocation: data?.businessLocation,
            websiteUrl: data?.websiteUrl,
            gscKeywords: chatbotData?.gscKeywords || [],
            topPages: chatbotData?.topPages || [],
            lowCtrPages: chatbotData?.lowCtrPages || [],
            aiTips: chatbotData?.aiTips || [],
            easyWins: chatbotData?.easyWins || [],
            impressionTrends: chatbotData?.impressionTrends || []
          }
        }),
      });

      if (!res.ok) {
        throw new Error(`Chatbot API failed: ${res.status}`);
      }

      const aiResponse = await res.json();
      
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse.response || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Save conversation to localStorage
      const conversation = {
        messages: [...messages, userMessage, aiMessage],
        timestamp: new Date().getTime()
      };
      localStorage.setItem("chatbotMessages-v1", JSON.stringify(conversation));
      
    } catch (error) {
      console.error("❌ Chatbot API error:", error);
      
      // Fallback response
      const fallbackMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment! 🤖",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
      toast.error("Failed to get AI response", {
        description: "Please try again in a moment"
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading) {
    return null;
  }

  // ✅ NEW: Show loading state while fetching data
  if (shouldShowLoader) {
    return (
      <MainLayout>
        <div className="flex h-full w-full bg-background z-2">
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="text-center w-full max-w-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 sm:mb-8">
                <SquashBounceLoader size="lg" className="text-green-500" />
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground px-4">Loading your SEO data...</h1>
              </div>
              <p className="text-muted-foreground mb-4">
                Fetching your Google Search Console data and SEO insights to give you personalized help!
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex h-[calc(97dvh-4rem)] w-full bg-background z-2">
                {/* Left Sidebar - Sticky and collapsible */}
        <div className={`bg-card border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          isMobile 
            ? (isSidebarCollapsed ? 'w-0' : 'w-80') 
            : (isSidebarCollapsed ? 'w-16' : 'w-80')
        } ${isMobile ? 'absolute left-0 top-0 h-screen z-20' : 'relative'} ${isMobile && isSidebarCollapsed ? 'overflow-hidden' : ''}`}>
          {/* Header */}
          <div className={`border-b border-border transition-all duration-300 ${
            isSidebarCollapsed ? 'p-4' : 'p-6'
          }`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-6`}>
              {!isSidebarCollapsed && (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  </div>
                  <span className="text-lg font-medium text-foreground">SimplSEO Mentor</span>
                </div>
              )}
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
            
            <Button 
              className={`bg-green-600 hover:bg-green-700 text-white transition-all duration-300 ${
                isSidebarCollapsed ? 'w-8 h-8 p-0' : 'w-full'
              }`}
              onClick={() => {
                setMessages([]);
                localStorage.removeItem("chatbotMessages-v1");
                toast.success("New conversation started!");
              }}
            >
              <Plus className="w-4 h-4" />
              {!isSidebarCollapsed && <span className="ml-2">New Chat</span>}
            </Button>
          </div>

          {/* Advanced Tools Section */}
          <div className={`py-2 transition-all duration-300 ${
            isSidebarCollapsed ? 'px-2' : 'px-4'
          }`}>
            <button className={`w-full text-left rounded-lg hover:bg-muted transition-colors flex items-center justify-between ${
              isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2'
            }`}>
              <div className="flex items-center space-x-3">
                <Wand2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-foreground">Advanced Tools</span>}
              </div>
              {!isSidebarCollapsed && <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>

          {/* AI Assistants Section */}
          <div className={`py-2 transition-all duration-300 ${
            isSidebarCollapsed ? 'px-2' : 'px-4'
          }`}>
            <button className={`w-full text-left rounded-lg hover:bg-muted transition-colors flex items-center justify-between ${
              isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2'
            }`}>
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-foreground">AI Assistants</span>}
              </div>
              {!isSidebarCollapsed && <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Chat History Panel */}
          <div className={`flex-1 mb-4 bg-muted rounded-lg border border-border transition-all duration-300 ${
            isSidebarCollapsed ? 'mx-2 p-2' : 'mx-4 p-4'
          }`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <>
                    <span className="text-sm font-medium text-foreground">Chat History</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">0</span>
                  </>
                )}
              </div>
              {!isSidebarCollapsed && (
                <button className="p-1 hover:bg-muted rounded">
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            
            {!isSidebarCollapsed && (
              <>
                {recentChats.length > 0 ? (
                  <div className="space-y-2">
                    {recentChats.map((chat, index) => (
                      <div 
                        key={index}
                        className="text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1 truncate"
                        onClick={() => toast.success(`Loading: ${chat}`)}
                      >
                        {chat}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">😔</div>
                    <p className="text-sm text-muted-foreground">No chat history here</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* User Profile */}
          <div className={`border-t border-border transition-all duration-300 ${
            isSidebarCollapsed ? 'p-2' : 'p-4'
          }`}>
            <div className={`flex items-center cursor-pointer ${
              isSidebarCollapsed ? 'justify-center' : 'space-x-3'
            }`}>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {data?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{data?.name || user?.email || 'User'}</div>
                  <div className="text-xs text-muted-foreground">SEO Assistant</div>
                </div>
              )}
              {!isSidebarCollapsed && <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {/* Main Chat Area - Takes remaining width, no margins */}
        <div className="flex-1 flex flex-col bg-background relative z-0 overflow-hidden">
          {/* Mobile Backdrop Overlay - Only visible when sidebar is open on mobile */}
          {isMobile && !isSidebarCollapsed && (
            <div 
              className="fixed inset-0 backdrop-blur-sm bg-background/10 z-10"
              onClick={() => setIsSidebarCollapsed(true)}
            />
          )}
          
          {/* Mobile Sidebar Toggle - Only visible when sidebar is closed on mobile */}
          {isMobile && isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="absolute top-4 left-4 z-10 p-2 bg-card rounded-lg shadow-lg border border-border hover:bg-muted transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5 text-muted-foreground" />
            </button>
          )}

          {/* Main Chat Area - Messages above, input below */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {messages.length === 0 ? (
              /* Welcome State - Centered when no messages */
              <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
                <div className="text-center w-full max-w-2xl">
                  <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 sm:mb-8">
                    <SquashBounceLoader size="lg" className="text-green-500" />
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground px-4">{currentTitle}</h1>
                  </div>
                  
                  {/* Input Field - Larger and better centered */}
                  <div className="relative mb-6 sm:mb-8 w-full">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`How can I help you today ${data?.name?.split(' ')[0] || 'there'}?`}
                      className="w-full min-h-[100px] sm:min-h-[120px] pr-24 sm:pr-32 resize-none text-base sm:text-lg placeholder:text-sm sm:placeholder:text-base border-border focus:border-blue-500 focus:ring-0 focus-visible:ring-0 focus-visible:border-border rounded-lg transition-all duration-200"
                      disabled={isThinking}
                    />
                    
                    {/* Input Controls - Left side */}
                    <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 flex items-center gap-1 sm:gap-2">
                      <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                    
                    {/* Model Selection & Send - Right side */}
                    <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-1 sm:gap-2">
                      <Select>
                        <SelectTrigger className="w-32 sm:w-40 h-7 sm:h-8 text-sm">
                          <SelectValue placeholder="SEO Assistant" />
                        </SelectTrigger>
                      </Select>
                      
                      <Button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isThinking}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 bg-green-500 hover:bg-green-600"
                      >
                        <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-4 px-4">
                    <Button variant="outline" className="flex items-center space-x-2 text-sm sm:text-base px-3 sm:px-4 py-2">
                      <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Write</span>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2 text-sm sm:text-base px-3 sm:px-4 py-2">
                      <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Learn</span>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2 text-sm sm:text-base px-3 sm:px-4 py-2">
                      <Lightbulb className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Ideas</span>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2 text-sm sm:text-base px-3 sm:px-4 py-2">
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Track</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Messages Display - When conversation exists */
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="max-w-4xl mx-auto">
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[80%] sm:max-w-[80%] ${message.role === "user" ? "order-2" : "order-1"}`}>
                          <div className={`p-4 rounded-lg ${
                            message.role === "user" 
                              ? "bg-green-600 text-white ml-2 sm:ml-4" 
                              : "bg-muted mr-2 sm:mr-4"
                          }`}>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isThinking && (
                      <div className="flex justify-start">
                        <div className="bg-muted p-4 rounded-lg mr-2 sm:mr-4 max-w-[80%]">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                            </div>
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>
            )}

            {/* Input Area - Sticky at bottom when conversation exists */}
            {messages.length > 0 && (
              <div className="sticky bottom-0 z-40 border-t border-border bg-background p-4 flex-shrink-0">
                <div className="max-w-4xl mx-auto px-2 sm:px-0">
                  <div className="border border-border rounded-lg bg-card">
                    {/* Textarea */}
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`How can I help you today ${data?.name?.split(' ')[0] || 'there'}?`}
                      className="w-full min-h-[60px] sm:min-h-[60px] max-h-[200px] resize-none text-base border-0 focus:ring-0 focus-visible:ring-0 rounded-none transition-all duration-200"
                      disabled={isThinking}
                    />
                    
                    {/* Bottom Controls Row */}
                    <div className="flex items-center justify-between p-2 bg-card">
                      {/* Left side buttons */}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Search className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Right side controls */}
                      <div className="flex items-center gap-2">
                        <Select>
                          <SelectTrigger className="w-32 h-7 text-sm border-0 shadow-none">
                            <SelectValue placeholder="SEO Assistant" />
                          </SelectTrigger>
                        </Select>
                        
                        <Button 
                          onClick={handleSendMessage}
                          disabled={!input.trim() || isThinking}
                          className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
