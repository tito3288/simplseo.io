import React, { useState, useRef, useEffect } from "react";
import { X, Send, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOnboarding } from "../contexts/OnboardingContext";
import { useAuth } from "../contexts/AuthContext";
import ReactMarkdown from "react-markdown";

const ChatAssistant = ({
  onClose,
  aiTips = [],
  gscKeywords = [],
  easyWins = [],
  topPages = [],
  lowCtrPages = [],
  impressionTrends = [],
}) => {
  const { data } = useOnboarding();
  const { user } = useAuth();
  const firstName = data?.name ? data.name.split(" ")[0] : "";
  // Get current page context for personalized welcome message
  const getPageContext = () => {
    if (typeof window === 'undefined') return null;
    
    const pathname = window.location.pathname;
    const pageContexts = {
      '/dashboard': {
        title: 'Dashboard',
        message: "I see you're on your Dashboard! This shows your SEO progress and recommendations. Need help understanding what you're seeing?",
        help: "I can explain any metric, help you understand the data, or guide you on what to do next."
      },
      '/intent-mismatch': {
        title: 'Intent Mismatch Analysis',
        message: "I see you're on the Intent Mismatch page! This finds when your content doesn't match what people are searching for. Need help understanding what you're seeing?",
        help: "I can explain the scores, help you fix content issues, or show you how to make your pages match what people want."
      },
      '/low-ctr': {
        title: 'Low CTR Fixes',
        message: "I see you're on the Low CTR page! These pages get seen but not clicked. Need help understanding what you're seeing?",
        help: "I can help you write better titles, improve descriptions, or fix why people aren't clicking."
      },
      '/top-keywords': {
        title: 'Top Keywords',
        message: "I see you're on the Top Keywords page! This shows your best-performing search terms. Need help understanding what you're seeing?",
        help: "I can explain which keywords to focus on, how to improve rankings, or find new opportunities."
      },
      '/easy-wins': {
        title: 'Easy Wins',
        message: "I see you're on the Easy Wins page! These are quick SEO fixes you can do right now. Need help understanding what you're seeing?",
        help: "I can help you pick the best wins, guide you through them, or explain what results to expect."
      },
      '/chatbot': {
        title: 'SEO Mentor Chat',
        message: "I see you're in the SEO Mentor chat! This is your personal SEO help space. What would you like to work on?",
        help: "I can answer any SEO question, analyze your data, or guide you through optimizations."
      },
      '/settings': {
        title: 'Settings',
        message: "I see you're in your Settings! This is where you can customize your SEO experience. Need help understanding any settings?",
        help: "I can explain what each setting does, help you configure your preferences, or guide you through account management."
      }
    };
    
    return pageContexts[pathname] || {
      title: 'SEO Assistant',
      message: "I'm here to help with all your SEO needs! Need help understanding what you're seeing?",
      help: "I can answer questions, provide recommendations, or guide you through any SEO challenge."
    };
  };

  const pageContext = getPageContext();
  const defaultWelcome = {
    id: "welcome",
    role: "assistant",
    content:
      `**Hey${firstName ? ` ${firstName}` : ""}! I'm your personal SEO Mentor**  \n\n${pageContext.message}\n\n${pageContext.help}\n\nJust type your question below to get started!`,
    timestamp: new Date(),
  };
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // Conversation management functions
  const loadConversations = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/conversations?userId=${user.id}`);
      const result = await response.json();
      
      if (result.success) {
        setConversations(result.conversations);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const saveConversation = async (messagesToSave) => {
    if (!user?.id || !messagesToSave.length) return;

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          messages: messagesToSave,
          source: 'corner-bubble'
        })
      });

      const result = await response.json();
      if (result.success) {
        setCurrentConversationId(result.conversationId);
        await loadConversations();
        return result.conversationId;
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
    }
  };

  const updateConversation = async (conversationId, messagesToUpdate) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addMessage',
          messages: messagesToUpdate
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadConversations();
      }
    } catch (error) {
      console.error("Error updating conversation:", error);
    }
  };

  const endConversationInCorner = async (conversationId) => {
    if (!conversationId) return;
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cornerEnd',
          cornerEnded: true
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadConversations();
      }
    } catch (error) {
      console.error("Error ending conversation in corner:", error);
    }
  };

  const loadMostRecentConversation = async () => {
    if (!user?.id) return false;
    
    try {
      const response = await fetch(`/api/conversations?userId=${user.id}`);
      const result = await response.json();
      
      if (result.success && result.conversations.length > 0) {
        // Find the most recent conversation that was started in the corner bubble
        // and hasn't been ended in the corner bubble
        const cornerConversation = result.conversations.find(conv => 
          (conv.source === 'corner-bubble' || 
           (conv.messages && conv.messages.length > 0 && conv.messages[0].source === 'corner-bubble')) &&
          !conv.cornerEnded // Not ended in corner bubble
        );
        
        if (cornerConversation) {
          // Load the full conversation
          const conversationResponse = await fetch(`/api/conversations/${cornerConversation.id}`);
          const conversationResult = await conversationResponse.json();
          
          if (conversationResult.success) {
            setMessages(conversationResult.conversation.messages);
            setCurrentConversationId(cornerConversation.id);
            return true; // Successfully loaded a corner conversation
          }
        }
      }
    } catch (error) {
      console.error("Error loading most recent conversation:", error);
    }
    return false; // No corner conversation loaded
  };
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [chatWidth, setChatWidth] = useState(384); // Default width (w-96)
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const resizeRef = useRef(null);

  // Load conversations and most recent conversation when component mounts
  useEffect(() => {
    if (user?.id && !isInitialized) {
      const initializeChat = async () => {
        setIsLoadingConversation(true);
        await loadConversations();
        const conversationLoaded = await loadMostRecentConversation();
        
        // If no conversation was loaded, show welcome message
        if (!conversationLoaded) {
          setMessages([defaultWelcome]);
        }
        
        setIsInitialized(true);
        setIsLoadingConversation(false);
      };
      initializeChat();
    }
  }, [user?.id, isInitialized]);

  // Check for stored chat context when component mounts
  useEffect(() => {
    const chatContext = localStorage.getItem("chatContext");
    if (chatContext) {
      try {
        const context = JSON.parse(chatContext);
        if (context.type === "intent_mismatch") {
          // Add the context message to the chat
          const contextMessage = {
            id: Date.now().toString(),
            role: "user",
            content: context.message,
            timestamp: new Date(),
            source: "corner-bubble",
          };
          
          setMessages(prev => [...prev, contextMessage]);
          
          // Clear the stored context after using it
          localStorage.removeItem("chatContext");
          
          // Automatically send the message to get AI response
          setTimeout(() => {
            sendMessageToAI(contextMessage.content, context.mismatch);
          }, 1000);
        }
      } catch (error) {
        console.error("Error parsing chat context:", error);
      }
    }
  }, []);

  // Function to send message to AI (separate from handleSendMessage)
  const sendMessageToAI = async (messageContent, pageContext = null) => {
    setIsThinking(true);
    
    try {
      const res = await fetch("/api/seo-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          context: {
            aiTips,
            gscKeywords,
            easyWins,
            topPages,
            lowCtrPages,
            impressionTrends,
            onboarding: data,
            // Enhanced context for better responses
            currentPage: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
            userFirstName: firstName,
            timestamp: new Date().toISOString(),
            // Include comprehensive page context if available
            pageContext: pageContext ? {
              targetKeyword: pageContext.targetKeyword,
              pageUrl: pageContext.currentPageUrl,
              matchScore: pageContext.currentMatchScore,
              pageStructure: pageContext.pageStructure,
              fullPageContent: pageContext.fullPageContent,
              allHeadings: pageContext.allHeadings,
              seoGuidance: pageContext.seoGuidance
            } : null
          },
        }),
      });

      const { reply } = await res.json();

      const assistantMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
        source: "corner-bubble",
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save to Firebase
      const updatedMessages = [...messages, contextMessage, assistantMessage];
      if (currentConversationId) {
        // Update existing conversation
        await updateConversation(currentConversationId, updatedMessages);
      } else {
        // Create new conversation
        const conversationId = await saveConversation(updatedMessages);
        if (conversationId) {
          setCurrentConversationId(conversationId);
        }
      }
    } catch (error) {
      console.error("OpenAI error:", error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "Sorry, something went wrong while trying to give you SEO advice. Try again shortly.",
          timestamp: new Date(),
          source: "corner-bubble",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Note: Conversations are now saved to Firebase instead of localStorage

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Resize functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      // Calculate width based on distance from right edge of screen
      // When dragging left (towards screen edge), chat gets smaller
      // When dragging right (away from screen edge), chat gets bigger
      const rightEdge = window.innerWidth - 24; // 24px margin from right edge
      const newWidth = Math.min(Math.max(320, rightEdge - e.clientX), window.innerWidth - 48);
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setChatWidth(Math.min(800, window.innerWidth - 48));
    } else {
      setChatWidth(384);
    }
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const imageMessage = {
        id: Date.now().toString(),
        role: "user",
        type: "image",
        content: reader.result, // base64
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, imageMessage]);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
      source: "corner-bubble",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);

    try {
      const res = await fetch("/api/seo-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          context: {
            aiTips,
            gscKeywords,
            easyWins,
            topPages,
            lowCtrPages,
            impressionTrends,
            onboarding: data,
            // Enhanced context for better responses
            currentPage: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
            userFirstName: firstName,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const { reply } = await res.json();

      const assistantMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
        source: "corner-bubble",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save to Firebase
      const updatedMessages = [...messages, userMessage, assistantMessage];
      if (currentConversationId) {
        // Update existing conversation
        await updateConversation(currentConversationId, updatedMessages);
      } else {
        // Create new conversation
        const conversationId = await saveConversation(updatedMessages);
        if (conversationId) {
          setCurrentConversationId(conversationId);
        }
      }
    } catch (error) {
      console.error("OpenAI error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "Sorry, something went wrong while trying to give you SEO advice. Try again shortly.",
          timestamp: new Date(),
          source: "corner-bubble",
        },
      ]);
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

  const endConversation = async () => {
    // Mark the current conversation as ended in corner bubble
    if (currentConversationId) {
      await endConversationInCorner(currentConversationId);
    }
    
    localStorage.removeItem("seoChatMessages");
    setCurrentConversationId(null);
    const pageContext = getPageContext();
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          `**Hey${firstName ? ` ${firstName}` : ""}! I'm your personal SEO Mentor**  \n\n${pageContext.message}\n\n${pageContext.help}\n\nJust type your question below to get started! 🚀`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div 
      className="flex flex-col h-[500px] overflow-hidden rounded-xl bg-white/1 backdrop-blur-md border border-white/10 shadow-md relative"
      style={{ width: `${chatWidth}px` }}
    >
      <div className="p-3 border-b border-border flex justify-between items-center bg-[#00bf63]/8">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-sm">SEO Mentor</h2>
        </div>
        <div className="flex items-center gap-1">
          {/* Expand/Minimize Button - Desktop Only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpanded}
            className="h-6 w-6 hidden md:flex"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-3">
          {isLoadingConversation ? (
            <div className="flex justify-start">
              <div className="bg-muted max-w-[85%] rounded-2xl p-2.5">
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63] animate-pulse"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63] animate-pulse delay-75"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63] animate-pulse delay-150"></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Loading conversation...</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-2.5 ${
                      message.role === "user"
                        ? "bg-[#00bf63] text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {message.type === "image" ? (
                        <img
                          src={message.content}
                          alt="User uploaded"
                          className="rounded-md max-w-full h-auto"
                        />
                      ) : (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      )}
                    </div>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-muted max-w-[85%] rounded-2xl p-2.5">
                    <div className="flex space-x-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63] animate-pulse"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63] animate-pulse delay-75"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63] animate-pulse delay-150"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about SEO..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm px-4 py-2"
            disabled={isThinking}
          />

          {/* <div>
            <input
              id="upload-image"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleUploadImage}
              disabled={isThinking}
              className="hidden"
            />

            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full h-9 w-9 flex-shrink-0 cursor-pointer"
              disabled={isThinking}
            >
              +
            </Button>
          </div> */}

          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isThinking}
            size="icon"
            className="rounded-full h-9 w-9 flex-shrink-0 bg-[#00bf63]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* 🔻 End Conversation Button */}
        <div className="text-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={endConversation}
          >
            End Conversation
          </Button>
        </div>
      </div>

      {/* Resize Handle - Desktop Only - Top Left Corner */}
      <div 
        ref={resizeRef}
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize hidden md:block hover:bg-[#00bf63]/20 transition-colors rounded-br-lg"
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-2 h-2 bg-[#00bf63]/40 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
