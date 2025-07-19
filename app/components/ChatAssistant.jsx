import React, { useState, useRef, useEffect } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOnboarding } from "../contexts/OnboardingContext";
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
  const firstName = data?.name ? data.name.split(" ")[0] : "";
  const defaultWelcome = {
    id: "welcome",
    role: "assistant",
    content:
      `**Hey${firstName ? ` ${firstName}` : ""}! I’m your personal SEO Mentor**  \nI can answer questions, give you tips, or help rewrite titles and descriptions — whatever you need.\n\nJust type your question below to get started`,
    timestamp: new Date(),
  };
  const [messages, setMessages] = useState(() => {
    const stored = localStorage.getItem("seoChatMessages-v4");
    if (stored) {
      const { messages, timestamp } = JSON.parse(stored);
      const now = new Date().getTime();
      const oneHour = 60 * 60 * 1000;
      if (now - timestamp < oneHour) return messages;
    }
    return [defaultWelcome]; // fallback
  });
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load saved conversation (if within 1 hour)
  useEffect(() => {
    const stored = localStorage.getItem("seoChatMessages-v4");
    if (stored) {
      const { messages, timestamp } = JSON.parse(stored);
      const now = new Date().getTime();
      const oneHour = 60 * 60 * 1000;

      if (now - timestamp < oneHour) {
        setMessages(messages);
      } else {
        localStorage.removeItem("seoChatMessages");
      }
    }
  }, []);

  // Save conversation on every update
  useEffect(() => {
    const payload = {
      messages,
      timestamp: new Date().getTime(),
    };
    localStorage.setItem("seoChatMessages", JSON.stringify(payload));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
          },
        }),
      });

      const { reply } = await res.json();

      const assistantMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
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

  const endConversation = () => {
    localStorage.removeItem("seoChatMessages");
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          `**Welcome${firstName ? ` ${firstName}` : ""}! I’m your personal SEO Mentor**  \nI can answer questions, give you tips, or help rewrite titles and descriptions — whatever you need.\n\nJust type your question below to get started 🚀`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[500px] overflow-hidden rounded-xl bg-white/1 backdrop-blur-md border border-white/10 shadow-md">
      <div className="p-3 border-b border-border flex justify-between items-center bg-[#00bf63]/8">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-sm">SEO Mentor</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose} // X now just minimizes
          className="h-6 w-6"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-3">
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

          <div>
            {/* <input
              id="upload-image"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleUploadImage}
              disabled={isThinking}
              className="hidden"
            /> */}

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
          </div>

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
    </div>
  );
};

export default ChatAssistant;
