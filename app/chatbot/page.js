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
  PanelLeftOpen
} from "lucide-react";
import { toast } from "sonner";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";

export default function Chatbot() {
  const { user, isLoading: authLoading } = useAuth();
  const { data } = useOnboarding();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
    setInput("");
    setIsThinking(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = generateAIResponse(input);
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsThinking(false);
    }, 1500);
  };

  const generateAIResponse = (userInput) => {
    const responses = [
      "Based on current SEO best practices, I'd recommend starting with a technical audit to identify any Core Web Vitals issues. Then focus on content optimization that directly addresses user intent.",
      "For this type of optimization, the key is balancing technical improvements with content quality. Have you considered implementing structured data markup?",
      "The solution typically involves a three-pronged approach: technical optimization, content enhancement, and user experience improvements.",
      "The most effective strategy depends on your specific situation and goals. Could you tell me more about your current setup?",
      "Based on recent algorithm updates, I'd recommend focusing on E-A-T signals and user experience metrics."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
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

  return (
    <MainLayout>
      <div className="flex h-screen w-full bg-gray-50 z-2">
                {/* Left Sidebar - Collapsible with smooth animation */}
        <div className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          isMobile 
            ? (isSidebarCollapsed ? 'w-0' : 'w-80') 
            : (isSidebarCollapsed ? 'w-16' : 'w-80')
        } ${isMobile ? 'absolute left-0 top-0 h-full z-20' : 'relative'} ${isMobile && isSidebarCollapsed ? 'overflow-hidden' : ''}`}>
          {/* Header */}
          <div className={`border-b border-gray-200 transition-all duration-300 ${
            isSidebarCollapsed ? 'p-4' : 'p-6'
          }`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-6`}>
              {!isSidebarCollapsed && (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  </div>
                  <span className="text-lg font-medium text-gray-700">SimplSEO Mentor</span>
                </div>
              )}
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-gray-600" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
            
            <Button 
              className={`bg-green-600 hover:bg-green-700 text-white transition-all duration-300 ${
                isSidebarCollapsed ? 'w-8 h-8 p-0' : 'w-full'
              }`}
              onClick={() => setMessages([])}
            >
              <Plus className="w-4 h-4" />
              {!isSidebarCollapsed && <span className="ml-2">New Chat</span>}
            </Button>
          </div>

          {/* Advanced Tools Section */}
          <div className={`py-2 transition-all duration-300 ${
            isSidebarCollapsed ? 'px-2' : 'px-4'
          }`}>
            <button className={`w-full text-left rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between ${
              isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2'
            }`}>
              <div className="flex items-center space-x-3">
                <Wand2 className="w-5 h-5 text-gray-600 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-gray-700">Advanced Tools</span>}
              </div>
              {!isSidebarCollapsed && <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
          </div>

          {/* AI Assistants Section */}
          <div className={`py-2 transition-all duration-300 ${
            isSidebarCollapsed ? 'px-2' : 'px-4'
          }`}>
            <button className={`w-full text-left rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between ${
              isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2'
            }`}>
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-600 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-gray-700">AI Assistants</span>}
              </div>
              {!isSidebarCollapsed && <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
          </div>

          {/* Chat History Panel */}
          <div className={`flex-1 mb-4 bg-gray-50 rounded-lg border border-gray-200 transition-all duration-300 ${
            isSidebarCollapsed ? 'mx-2 p-2' : 'mx-4 p-4'
          }`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-gray-600 flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <>
                    <span className="text-sm font-medium text-gray-700">Chat History</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">0</span>
                  </>
                )}
              </div>
              {!isSidebarCollapsed && (
                <button className="p-1 hover:bg-gray-200 rounded">
                  <ChevronUp className="w-4 h-4 text-gray-500" />
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
                        className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer py-1 truncate"
                        onClick={() => toast.success(`Loading: ${chat}`)}
                      >
                        {chat}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">😔</div>
                    <p className="text-sm text-gray-400">No chat history here</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* User Profile */}
          <div className={`border-t border-gray-200 transition-all duration-300 ${
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
                  <div className="text-sm font-medium text-gray-900">{data?.name || user?.email || 'User'}</div>
                  <div className="text-xs text-gray-500">SEO Assistant</div>
                </div>
              )}
              {!isSidebarCollapsed && <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </div>
        </div>

        {/* Main Chat Area - Takes remaining width, no margins */}
        <div className="flex-1 flex flex-col bg-gray-50 relative z-0">
          {/* Mobile Backdrop Overlay - Only visible when sidebar is open on mobile */}
          {isMobile && !isSidebarCollapsed && (
            <div 
              className="fixed inset-0 backdrop-blur-sm bg-white/10 z-10"
              onClick={() => setIsSidebarCollapsed(true)}
            />
          )}
          
          {/* Mobile Sidebar Toggle - Only visible when sidebar is closed on mobile */}
          {isMobile && isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="absolute top-4 left-4 z-10 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5 text-gray-600" />
            </button>
          )}

          {/* Chat Header - Centered content */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="text-center w-full max-w-2xl">

                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 sm:mb-8">
                  <SquashBounceLoader size="lg" className="text-green-500" />
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 px-4">{currentTitle}</h1>
                </div>
              
              {/* Input Field */}
              <div className="relative mb-6 sm:mb-8 w-full">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`How can I help you today ${data?.name?.split(' ')[0] || 'there'}?`}
                  className="w-full min-h-[100px] sm:min-h-[120px] pr-24 sm:pr-32 resize-none text-base sm:text-lg placeholder:text-sm sm:placeholder:text-base border-gray-200 focus:border-blue-500 focus:ring-0 focus-visible:ring-0 focus-visible:border-gray-200 rounded-lg transition-all duration-200"
                  disabled={isThinking}
                />
                
                {/* Input Controls - Left side */}
                <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 flex items-center gap-1 sm:gap-2">
                  <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                    <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" />
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
                  <Code className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Ideas</span>
                </Button>
                <Button variant="outline" className="flex items-center space-x-2 text-sm sm:text-base px-3 sm:px-4 py-2">
                  <Coffee className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Track</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Messages Area - Only shows when there are messages */}
          {messages.length > 0 && (
            <div className="flex-1 overflow-y-auto px-6 py-4 border-t border-gray-200 bg-white">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <Card className={`max-w-[80%] ${message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
                      <CardContent className="p-4">
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                
                {isThinking && (
                  <div className="flex justify-start">
                    <Card className="bg-gray-100">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                          </div>
                          <span className="text-sm text-gray-600">Thinking...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
