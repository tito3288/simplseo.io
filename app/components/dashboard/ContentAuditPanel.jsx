"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, Sparkles, Loader2, BarChart3, Search, MousePointerClick, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { getPageContent } from "../../lib/pageScraper";
import { useAuth } from "../../contexts/AuthContext";
import { saveContentAuditResult, getContentAuditResult, saveAiSuggestions, getAiSuggestions, getFocusKeywords, saveFocusKeywords } from "../../lib/firestoreHelpers";
import { doc, getDoc, setDoc, deleteField, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const ContentAuditPanel = ({ pageUrl, pageData, implementationData, focusKeyword: propFocusKeyword, keywordSource: propKeywordSource }) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isLoadingSavedData, setIsLoadingSavedData] = useState(true);
  const expandedContentRef = useRef(null);
  const [expandedMaxHeight, setExpandedMaxHeight] = useState("0px");
  
  // Keyword Insights Modal state
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [keywordData, setKeywordData] = useState(null);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [pageFocusKeyword, setPageFocusKeyword] = useState(propFocusKeyword || null);
  const [focusKeywordSource, setFocusKeywordSource] = useState(propKeywordSource || null); // "ai-generated" or "gsc-existing"
  
  // E3 Pivot state
  const [showPivotOptions, setShowPivotOptions] = useState(false);
  const [isPivoting, setIsPivoting] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  
  // E1 Meta Optimization state
  const [isOptimizingMeta, setIsOptimizingMeta] = useState(false);
  
  // E2 Content Gap Analysis state
  const [contentGaps, setContentGaps] = useState(null);
  const [isLoadingContentGaps, setIsLoadingContentGaps] = useState(false);
  const [internalLinkSuggestions, setInternalLinkSuggestions] = useState([]);
  const [isLoadingInternalLinks, setIsLoadingInternalLinks] = useState(false);
  
  // Keyword selection state (same as PivotOptionsPanel)
  const [showKeywordSelection, setShowKeywordSelection] = useState(false);
  const [hybridKeywords, setHybridKeywords] = useState([]);
  const [loadingHybridKeywords, setLoadingHybridKeywords] = useState(false);
  const [currentRankingKeywords, setCurrentRankingKeywords] = useState([]);
  const [loadingRankingKeywords, setLoadingRankingKeywords] = useState(false);
  const [keywordHistory, setKeywordHistory] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [pendingKeyword, setPendingKeyword] = useState(null);
  const [pendingKeywordSource, setPendingKeywordSource] = useState(null);
  const [isSavingKeyword, setIsSavingKeyword] = useState(false);

  const cleanUrl = pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Determine Content Audit Tier based on position
  const getContentAuditTier = () => {
    const position = implementationData?.currentPosition || 100;
    
    if (position >= 15 && position <= 25) {
      return {
        tier: "E1",
        title: "Just Off Page 1",
        icon: "",
        color: "blue",
        message: `You're close! Position ${Math.round(position)} means Google sees your content as relevant, but competitors are edging you out. Focus on making your meta title irresistible and adding 2-3 internal links from high-traffic pages.`,
        recommendations: [
          { priority: "high", icon: "", title: "Optimize Meta Title", description: "Make it more click-worthy and compelling" },
          { priority: "high", icon: "", title: "Optimize Meta Description", description: "Add a stronger call-to-action" },
          { priority: "medium", icon: "", title: "Add Internal Links", description: "Link from 2-3 high-traffic pages to boost authority" },
          { priority: "medium", icon: "", title: "Minor Content Tweaks", description: "Improve keyword placement in first paragraph and headings" }
        ]
      };
    }
    
    if (position > 25 && position <= 40) {
      return {
        tier: "E2",
        title: "Content Needs Depth",
        icon: "",
        color: "amber",
        message: `At position ${Math.round(position)} (page 3-4), you're too far back for meta changes to matter—no one sees your result yet. Focus 100% on making your content more comprehensive and valuable. Add examples, FAQs, or step-by-step sections. Aim for 300-500 additional words.`,
        recommendations: [
          { priority: "high", icon: "", title: "Expand Content Depth", description: "Add 300-500+ words of valuable, relevant content" },
          { priority: "high", icon: "", title: "Improve Keyword Integration", description: "Add natural keyword placement throughout content" },
          { priority: "high", icon: "", title: "Add FAQ Section", description: "Capture long-tail queries and increase content value" },
          { priority: "medium", icon: "", title: "Add Internal Links", description: "Link from high-traffic pages to boost authority" },
          { priority: "medium", icon: "", title: "Improve Content Structure", description: "Use clear headings, bullet points, and short paragraphs" }
        ]
      };
    }
    
    // E3: Position 40+
    const daysSince = Math.floor(implementationData?.daysSince || 45);
    return {
      tier: "E3",
      title: "Significant Content-Keyword Gap",
      icon: "",
      color: "red",
      message: `At position ${Math.round(position)} with 0 clicks after ${daysSince}+ days, there may be a fundamental mismatch between your content and this keyword. You have two options: (1) Completely rewrite the content to better match search intent, OR (2) Pivot to a different keyword that better fits your existing content.`,
      recommendations: [
        { priority: "high", icon: "", title: "Comprehensive Content Rewrite", description: "Keep this keyword but significantly expand and restructure your content", action: "rewrite" },
        { priority: "high", icon: "", title: "Try a Different Keyword", description: "Current keyword may not be the right fit - pivot to a new one", action: "pivot" },
        { priority: "high", icon: "", title: "Re-evaluate Search Intent", description: "Research what users actually want when searching this keyword" },
        { priority: "medium", icon: "", title: "Optimize Meta Title & Description", description: "Align meta tags with search intent" }
      ],
      showPivotOption: true
    };
  };

  const tierInfo = getContentAuditTier();

  // Smart E3 Recommendation - determines whether to recommend Rewrite or Pivot
  const getE3Recommendation = () => {
    if (tierInfo.tier !== "E3") return null;

    const impressions = implementationData?.newImpressions || implementationData?.postStats?.impressions || 0;
    const baselineImpressions = implementationData?.preStats?.impressions || 0;
    const impressionGrowth = impressions - baselineImpressions;
    const growthPercent = baselineImpressions > 0 ? ((impressionGrowth / baselineImpressions) * 100) : 0;
    const isGrowing = impressionGrowth > 0;

    // Very low impressions = Google doesn't see relevance → Recommend Pivot
    if (impressions < 20) {
      return {
        action: "pivot",
        confidence: "high",
        icon: "",
        title: "Recommended: Pivot to New Keyword",
        message: `With only ${impressions} impressions after ${Math.floor(implementationData?.daysSince || 45)}+ days, Google doesn't see strong relevance between your content and this keyword. Consider a long-tail variation or a completely different keyword that better matches your content.`,
        primaryButton: "pivot"
      };
    }

    // Low impressions (20-49) and stagnant/declining → Recommend Pivot
    if (impressions < 50 && !isGrowing) {
      return {
        action: "pivot",
        confidence: "medium",
        icon: "",
        title: "Recommended: Consider Pivoting",
        message: `With ${impressions} impressions and no growth momentum, the keyword-content connection may not be strong enough. A pivot to a related long-tail keyword could yield better results.`,
        primaryButton: "pivot"
      };
    }

    // Low impressions (20-49) but growing → Either option works
    if (impressions < 50 && isGrowing) {
      return {
        action: "either",
        confidence: "medium",
        icon: "",
        title: "Either Option Could Work",
        message: `With ${impressions} impressions and ${impressionGrowth > 0 ? "+" : ""}${impressionGrowth} growth, you're in a borderline zone. If you believe in the content, try a Rewrite. If unsure, a Pivot to a more specific keyword is safe.`,
        primaryButton: null // Neither is primary
      };
    }

    // High impressions (50+) = Google validated the topic → Recommend Rewrite
    if (impressions >= 50) {
      const growthMessage = isGrowing 
        ? ` (+${impressionGrowth} since baseline${growthPercent > 0 ? `, ${Math.round(growthPercent)}% growth` : ""})` 
        : "";
      
      return {
        action: "rewrite",
        confidence: "high",
        icon: "",
        title: "Recommended: Rewrite Content",
        message: `With ${impressions} impressions${growthMessage}, Google already sees your page as relevant to this keyword. Don't throw away this momentum! Focus on making your content more comprehensive and authoritative than the current Top 10 results. Update your Meta Title to reflect the new "expert" angle of that rewrite.`,
        primaryButton: "rewrite"
      };
    }

    // Default fallback
    return {
      action: "either",
      confidence: "low",
      icon: "",
      title: "Choose Based on Your Confidence",
      message: "Based on the current metrics, either option could work. Choose Rewrite if you believe in the keyword fit, or Pivot if you want to try a fresh approach.",
      primaryButton: null
    };
  };

  const e3Recommendation = tierInfo.tier === "E3" ? getE3Recommendation() : null;

  useEffect(() => {
    if (isExpanded && expandedContentRef.current) {
      // Use a large fixed value to ensure all content is visible
      setExpandedMaxHeight("2000px");
    } else {
      setExpandedMaxHeight("0px");
    }
  }, [
    isExpanded,
    auditResult,
    aiSuggestions,
    isGeneratingSuggestions,
  ]);

  // Normalize URL for comparison
  const normalizeUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      return (u.pathname === '/' ? u.origin : u.origin + u.pathname.replace(/\/$/, '')).toLowerCase();
    } catch {
      return url.trim().replace(/\/$/, '').toLowerCase();
    }
  };

  // Fetch keywords when modal opens
  const fetchKeywordInsights = async () => {
    if (!user?.id || keywordData) return; // Don't refetch if already loaded
    
    setIsLoadingKeywords(true);
    try {
      // Get GSC token and siteUrl using the token manager
      const { createGSCTokenManager } = await import("../../lib/gscTokenManager");
      const { getFocusKeywords } = await import("../../lib/firestoreHelpers");
      
      const tokenManager = createGSCTokenManager(user.id);
      const gscData = await tokenManager.getStoredGSCData();
      
      if (!gscData?.accessToken || !gscData?.siteUrl) {
        throw new Error("GSC not connected");
      }

      // Get valid access token (refreshes if needed)
      const validToken = await tokenManager.getValidAccessToken();
      if (!validToken) {
        throw new Error("Could not get valid GSC token");
      }

      // Fetch focus keywords to find the one for this page
      const focusKeywords = await getFocusKeywords(user.id);
      if (focusKeywords && focusKeywords.length > 0) {
        const normalizedPageUrl = normalizeUrl(pageUrl);
        const matchingFocus = focusKeywords.find(fk => {
          const normalizedFkUrl = normalizeUrl(fk.pageUrl);
          return normalizedFkUrl === normalizedPageUrl;
        });
        if (matchingFocus) {
          setPageFocusKeyword(matchingFocus.keyword);
          setFocusKeywordSource(matchingFocus.source || "gsc-existing"); // Default to gsc-existing if no source
        }
      }

      const response = await fetch("/api/gsc/page-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          pageUrl,
          dateRange: "28",
          token: validToken,
          siteUrl: gscData.siteUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to fetch keywords");
      }

      const data = await response.json();
      if (data.success) {
        setKeywordData(data.keywords);
      }
    } catch (error) {
      console.error("Error fetching keyword insights:", error);
      toast.error("Failed to load keyword insights", {
        description: error.message
      });
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  // Helper to format delta with arrow
  const formatDelta = (value, inverse = false) => {
    if (value === 0 || value === undefined || value === null) {
      return <span className="text-gray-500 flex items-center gap-1"><Minus className="w-3 h-3" /> 0</span>;
    }
    const isPositive = inverse ? value < 0 : value > 0;
    const arrow = isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
    const color = isPositive ? "text-green-600" : "text-red-500";
    const prefix = value > 0 ? "+" : "";
    return <span className={`${color} flex items-center gap-1`}>{arrow} {prefix}{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}</span>;
  };

  // Check if keyword matches focus keyword (case-insensitive)
  const isFocusKeyword = (keyword) => {
    if (!pageFocusKeyword || !keyword) return false;
    return keyword.toLowerCase() === pageFocusKeyword.toLowerCase();
  };

  // Load saved data on component mount
  useEffect(() => {
    const loadSavedData = async () => {
      if (!user?.id) return;

      try {
        setIsLoadingSavedData(true);
        
        // Load saved audit result
        const savedAuditResult = await getContentAuditResult(user.id, pageUrl);
        if (savedAuditResult) {
          setAuditResult(savedAuditResult);
          // Keep dropdown closed by default - user can expand if needed
        }

        // Load saved AI suggestions
        const savedAiSuggestions = await getAiSuggestions(user.id, pageUrl);
        if (savedAiSuggestions) {
          setAiSuggestions(savedAiSuggestions);
        }
      } catch (error) {
        console.error("Error loading saved data:", error);
      } finally {
        setIsLoadingSavedData(false);
      }
    };

    loadSavedData();
  }, [user?.id, pageUrl]);

  const getScoreBadge = (score) => {
    if (score >= 80) {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {score}/100 - Excellent
      </Badge>;
    } else if (score >= 60) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
        <Clock className="w-3 h-3 mr-1" />
        {score}/100 - Good
      </Badge>;
    } else {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {score}/100 - Needs Work
      </Badge>;
    }
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'high') {
      return <Badge variant="destructive" className="text-xs">High Priority</Badge>;
    } else if (priority === 'medium') {
      return <Badge variant="secondary" className="text-xs">Medium Priority</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Low Priority</Badge>;
    }
  };

  const runContentAudit = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Get page content using reusable scraper
      const pageContent = await getPageContent(user.id, pageUrl);
      
      if (!pageContent.success) {
        throw new Error(`Failed to get page content: ${pageContent.error}`);
      }

      const { title, metaDescription, textContent, headings } = pageContent.data;

      // Run content audit
      const auditResponse = await fetch("/api/content-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageUrl,
          pageContent: textContent,
          title,
          metaDescription,
          headings
        }),
      });

      if (!auditResponse.ok) {
        throw new Error(`Content audit failed: ${auditResponse.status}`);
      }

      const result = await auditResponse.json();
      setAuditResult(result);
      setIsExpanded(true);
      
      // Save audit result to Firebase
      await saveContentAuditResult(user.id, pageUrl, result);
      
      toast.success("Content audit completed!", {
        description: `Score: ${result.contentScore}/100`
      });

    } catch (error) {
      console.error("Content audit error:", error);
      toast.error("Content audit failed", {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAiSuggestions = async () => {
    if (!auditResult) return;

    setIsGeneratingSuggestions(true);
    try {
      // Get fresh page content for AI analysis
      const pageContent = await getPageContent(user.id, pageUrl, true); // Force refresh
      
      if (!pageContent.success) {
        throw new Error(`Failed to get page content: ${pageContent.error}`);
      }

      const { title, metaDescription, textContent, headings } = pageContent.data;

      console.log("🔍 Sending to AI:", {
        pageUrl,
        title: title?.substring(0, 100),
        metaDescription: metaDescription?.substring(0, 100),
        contentLength: textContent?.length,
        headingsCount: headings?.length
      });

      // Call AI suggestions API with fresh content
      const suggestionsResponse = await fetch("/api/seo-assistant/content-improvements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageUrl,
          auditResult,
          pageContent: textContent, // Use fresh scraped content
          title: title, // Use fresh scraped title
          metaDescription: metaDescription, // Use fresh scraped meta description
          headings: headings // Use fresh scraped headings
        }),
      });

      if (!suggestionsResponse.ok) {
        throw new Error(`AI suggestions failed: ${suggestionsResponse.status}`);
      }

      const suggestions = await suggestionsResponse.json();
      setAiSuggestions(suggestions);
      
      // Save AI suggestions to Firebase
      await saveAiSuggestions(user.id, pageUrl, suggestions);
      
      toast.success("AI suggestions generated!", {
        description: `${suggestions.suggestions.length} improvement suggestions ready`
      });

    } catch (error) {
      console.error("AI suggestions error:", error);
      toast.error("AI suggestions failed", {
        description: error.message
      });
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  // Helper function to create safe document IDs
  const createSafeDocId = (userId, url) => {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const urlHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
    return `${userId}_${urlHash}`;
  };

  // Fetch current ranking keywords when keyword selection is opened
  const fetchRankingKeywords = async () => {
    if (!user?.id || !pageUrl) return;

    setLoadingRankingKeywords(true);
    try {
      const { createGSCTokenManager } = await import("../../lib/gscTokenManager");
      const tokenManager = createGSCTokenManager(user.id);
      const gscData = await tokenManager.getStoredGSCData();
      
      if (!gscData?.siteUrl) {
        setLoadingRankingKeywords(false);
        return;
      }
      
      const validToken = await tokenManager.getValidAccessToken();
      if (!validToken) {
        setLoadingRankingKeywords(false);
        return;
      }

      const response = await fetch("/api/gsc/page-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: validToken,
          siteUrl: gscData.siteUrl,
          pageUrl,
          dateRange: "28",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const allKeywords = [
          ...(data.keywords?.topPerformers || []),
          ...(data.keywords?.otherKeywords || []),
        ].sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
        setCurrentRankingKeywords(allKeywords);
      }
    } catch (error) {
      console.error("Error fetching ranking keywords:", error);
    } finally {
      setLoadingRankingKeywords(false);
    }
  };

  // Handle opening keyword selection (same as PivotOptionsPanel)
  const handleOpenKeywordSelection = () => {
    setShowKeywordSelection(true);
    if (currentRankingKeywords.length === 0) {
      fetchRankingKeywords();
    }
  };

  // Handle generating hybrid keywords
  const handleGenerateHybridKeywords = async () => {
    if (!user?.id || !pageUrl) return;

    setLoadingHybridKeywords(true);
    try {
      const topRankingKeyword = currentRankingKeywords.length > 0 
        ? currentRankingKeywords[0].keyword 
        : null;

      const response = await fetch("/api/seo-assistant/suggest-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          userId: user.id,
          hybridMode: true,
          currentRankingKeyword: topRankingKeyword,
          currentFocusKeyword: propFocusKeyword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.suggestions?.length > 0) {
          const enhancedSuggestions = data.suggestions.map(suggestion => ({
            ...(typeof suggestion === "string" ? { keyword: suggestion } : suggestion),
            hybridSource: topRankingKeyword,
            isHybrid: true,
          }));
          setHybridKeywords(enhancedSuggestions);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to generate hybrid keywords");
      }
    } catch (error) {
      console.error("Error generating hybrid keywords:", error);
      toast.error("Failed to generate hybrid keywords. Please try again.");
    } finally {
      setLoadingHybridKeywords(false);
    }
  };

  // Handle selecting a keyword (just marks it as pending)
  const handleSelectKeyword = (keyword, source = "gsc-existing") => {
    setPendingKeyword(keyword);
    setPendingKeywordSource(source);
  };

  // Handle canceling the pending selection
  const handleCancelPendingKeyword = () => {
    setPendingKeyword(null);
    setPendingKeywordSource(null);
  };

  // Handle saving the pending keyword - SAME LOGIC AS PIVOT CARD
  const handleSavePendingKeyword = async () => {
    if (!user?.id || !pageUrl || !pendingKeyword) return;

    setIsSavingKeyword(true);
    
    try {
      const docId = createSafeDocId(user.id, pageUrl);
      
      // Add current focus keyword to history
      const updatedHistory = [...keywordHistory];
      if (propFocusKeyword && !updatedHistory.some(h => h.keyword?.toLowerCase() === propFocusKeyword.toLowerCase())) {
        updatedHistory.push({
          keyword: propFocusKeyword,
          testedAt: new Date().toISOString(),
          source: propKeywordSource,
        });
      }

      // First, fetch the current document to preserve old stats
      const currentDoc = await getDoc(doc(db, "implementedSeoTips", docId));
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Build the keyword stats history - preserve metrics from previous keyword attempts
      const keywordStatsHistory = currentData.keywordStatsHistory || [];
      
      // If we have stats from the current keyword, save them to history before resetting
      if (currentData.preStats && currentData.implementedAt) {
        keywordStatsHistory.push({
          keyword: propFocusKeyword,
          source: propKeywordSource,
          implementedAt: currentData.implementedAt,
          pivotedAt: new Date().toISOString(),
          preStats: currentData.preStats,
          postStats: currentData.postStats || null,
          postStatsHistory: currentData.postStatsHistory || [],
          daysTracked: currentData.implementedAt 
            ? Math.floor((Date.now() - new Date(currentData.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          // Track where the pivot was triggered from - CONTENT AUDIT
          pivotSource: "content-audit",
        });
      }

      // RESET: Clear implementation status but PRESERVE old stats in history
      await setDoc(
        doc(db, "implementedSeoTips", docId),
        {
          keywordHistory: updatedHistory,
          keywordStatsHistory: keywordStatsHistory,
          pivotedAt: new Date().toISOString(),
          status: "pivoted",
          preStats: deleteField(),
          postStats: deleteField(),
          postStatsHistory: deleteField(),
          implementedAt: deleteField(),
          nextUpdateDue: deleteField(),
          pivotedToKeyword: pendingKeyword,
          pivotedFromKeyword: propFocusKeyword,
        },
        { merge: true }
      );

      // IMPORTANT: First fetch existing focus keywords to preserve them
      const existingResponse = await fetch(`/api/focus-keywords?userId=${user.id}`);
      let existingKeywords = [];
      
      if (existingResponse.ok) {
        const existingData = await existingResponse.json();
        existingKeywords = existingData.keywords || [];
      }

      const normalizedPageUrl = normalizeUrl(pageUrl);

      // Remove any existing keyword for this specific page URL
      const filteredKeywords = existingKeywords.filter(kw => {
        const kwPageUrl = normalizeUrl(kw.pageUrl);
        return kwPageUrl !== normalizedPageUrl;
      });

      // Add the new keyword for this page
      const finalSource = pendingKeywordSource === "hybrid" ? "ai-generated" : pendingKeywordSource;
      const updatedKeywords = [
        ...filteredKeywords,
        {
          keyword: pendingKeyword,
          pageUrl,
          source: finalSource,
        }
      ];

      // Save all keywords (existing + updated)
      await fetch("/api/focus-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          keywords: updatedKeywords,
        }),
      });

      // Re-crawl the page to get fresh content for new AI suggestions
      toast.info("Re-crawling page for fresh content...");
      try {
        const recrawlRes = await fetch("/api/recrawl-page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            pageUrl,
          }),
        });
        
        if (recrawlRes.ok) {
          console.log("Page re-crawled successfully");
        }
      } catch (recrawlError) {
        console.warn("Could not re-crawl page:", recrawlError);
      }

      setKeywordHistory(updatedHistory);
      setSelectedKeyword(pendingKeyword);
      setPendingKeyword(null);
      setPendingKeywordSource(null);
      toast.success(`Keyword pivoted to "${pendingKeyword}"! Page content refreshed - new suggestions will be generated. Refreshing...`);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error saving new focus keyword:", error);
      toast.error("Failed to update focus keyword. Please try again.");
    } finally {
      setIsSavingKeyword(false);
    }
  };

  // Legacy handler - now opens keyword selection instead
  const handlePivotFromContentAudit = () => {
    handleOpenKeywordSelection();
  };

  // E3 Rewrite Content handler - generates AI suggestions for what to change
  const handleRewriteContent = async () => {
    if (!user?.id) {
      toast.error("Missing required data");
      return;
    }
    
    setIsRewriting(true);
    try {
      // First, run content audit if not already done
      if (!auditResult) {
        const pageContent = await getPageContent(user.id, pageUrl);
        if (!pageContent.success) {
          throw new Error(`Failed to get page content: ${pageContent.error}`);
        }
        const { title, metaDescription, textContent, headings } = pageContent.data;
        
        const auditResponse = await fetch("/api/content-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageUrl, pageContent: textContent, title, metaDescription, headings }),
        });
        
        if (!auditResponse.ok) {
          throw new Error(`Content audit failed: ${auditResponse.status}`);
        }
        
        const result = await auditResponse.json();
        setAuditResult(result);
        await saveContentAuditResult(user.id, pageUrl, result);
      }

      // Then generate AI suggestions
      const pageContent = await getPageContent(user.id, pageUrl, true); // Force refresh
      if (!pageContent.success) {
        throw new Error(`Failed to get page content: ${pageContent.error}`);
      }

      const { title, metaDescription, textContent, headings } = pageContent.data;

      const suggestionsResponse = await fetch("/api/seo-assistant/content-improvements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          auditResult: auditResult || {},
          pageContent: textContent,
          title,
          metaDescription,
          headings
        }),
      });

      if (!suggestionsResponse.ok) {
        throw new Error(`AI suggestions failed: ${suggestionsResponse.status}`);
      }

      const suggestions = await suggestionsResponse.json();
      setAiSuggestions(suggestions);
      await saveAiSuggestions(user.id, pageUrl, suggestions);
      
      // Expand the dropdown to show suggestions
      setIsExpanded(true);
      
      toast.success("AI Rewrite Suggestions Ready!", {
        description: `${suggestions.suggestions.length} improvement suggestions generated. Review them below!`
      });

    } catch (error) {
      console.error("Rewrite suggestions error:", error);
      toast.error("Failed to generate rewrite suggestions", {
        description: error.message
      });
    } finally {
      setIsRewriting(false);
    }
  };

  // Confirm and reset tracking after user has reviewed suggestions
  const handleConfirmRewrite = async () => {
    if (!user?.id) {
      toast.error("Missing required data");
      return;
    }
    
    setIsRewriting(true);
    try {
      const pageDocRef = doc(db, "users", user.id, "seoProgress", encodeURIComponent(pageUrl));
      const pageDoc = await getDoc(pageDocRef);
      const currentData = pageDoc.exists() ? pageDoc.data() : {};
      
      // Store the current attempt in rewrite history
      const rewriteHistory = currentData.rewriteHistory || [];
      rewriteHistory.push({
        keyword: propFocusKeyword,
        rewriteStartedAt: new Date().toISOString(),
        preStats: currentData.preStats,
        postStats: currentData.postStats || null,
        daysTracked: currentData.implementedAt 
          ? Math.floor((new Date() - new Date(currentData.implementedAt)) / (1000 * 60 * 60 * 24))
          : 0,
        position: implementationData?.currentPosition || null,
        impressions: implementationData?.newImpressions || 0
      });

      // Reset the tracking cycle but keep the keyword
      await setDoc(
        pageDocRef,
        {
          rewriteHistory,
          status: "rewriting",
          rewriteStartedAt: new Date().toISOString(),
          preStats: currentData.postStats || currentData.preStats,
          postStats: deleteField(),
          postStatsHistory: deleteField(),
          implementedAt: new Date().toISOString(),
          nextUpdateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          extendedTotalDays: deleteField(),
        },
        { merge: true }
      );

      toast.success("Content Rewrite Mode Activated!", {
        description: "The 45-day tracking cycle has been reset. Make your content changes and we'll track the new performance."
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error("Rewrite confirmation error:", error);
      toast.error("Failed to start content rewrite", {
        description: error.message
      });
    } finally {
      setIsRewriting(false);
    }
  };

  // E1 Meta Optimization handler - Same logic as Pivot's "Optimize Meta Only"
  // Resets tracking, keeps keyword, re-crawls for fresh AI meta suggestions
  const handleE1MetaOptimization = async () => {
    if (!user?.id || !pageUrl) return;

    setIsOptimizingMeta(true);
    
    try {
      // Helper to create safe document IDs
      const createSafeDocId = (userId, pageUrl) => {
        let hash = 0;
        for (let i = 0; i < pageUrl.length; i++) {
          const char = pageUrl.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const urlHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
        return `${userId}_${urlHash}`;
      };

      const docId = createSafeDocId(user.id, pageUrl);
      
      // First, fetch the current document to preserve old stats
      const currentDoc = await getDoc(doc(db, "implementedSeoTips", docId));
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Fetch the current cached meta title/description BEFORE we clear them
      // This allows AI to learn from what didn't work
      let previousTitle = null;
      let previousDescription = null;
      try {
        const cacheKey = propFocusKeyword 
          ? `${pageUrl}::${propFocusKeyword.toLowerCase()}`
          : pageUrl;
        const encodedCacheKey = encodeURIComponent(cacheKey);
        
        const [titleDoc, descDoc] = await Promise.all([
          getDoc(doc(db, "seoMetaTitles", encodedCacheKey)),
          getDoc(doc(db, "seoMetaDescriptions", encodedCacheKey))
        ]);
        
        if (titleDoc.exists()) {
          previousTitle = titleDoc.data()?.title || null;
        }
        if (descDoc.exists()) {
          previousDescription = descDoc.data()?.description || null;
        }
        console.log("Fetched previous meta for history:", { previousTitle, previousDescription });
      } catch (cacheReadError) {
        console.warn("Could not fetch previous meta cache:", cacheReadError);
      }
      
      // Build the meta optimization history - preserve metrics from previous meta attempts
      const metaOptimizationHistory = currentData.metaOptimizationHistory || [];
      
      // If we have stats from the current meta, save them to history before resetting
      if (currentData.preStats && currentData.implementedAt) {
        metaOptimizationHistory.push({
          type: "e1-content-audit",
          optimizedAt: new Date().toISOString(),
          reason: `E1 Meta Optimization: Position ${Math.round(implementationData?.currentPosition || 0)} (close to page 1)`,
          keyword: propFocusKeyword,
          implementedAt: currentData.implementedAt,
          preStats: currentData.preStats,
          finalStats: currentData.postStats || null,
          postStatsHistory: currentData.postStatsHistory || [],
          // Calculate days tracked
          daysTracked: currentData.implementedAt 
            ? Math.floor((Date.now() - new Date(currentData.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          // Track where the optimization was triggered from
          optimizationSource: "content-audit",
          // Include the actual title/description that was tried (for AI learning)
          title: previousTitle,
          description: previousDescription,
        });
      }

      // RESET: Clear implementation status but PRESERVE old stats in metaOptimizationHistory
      // This allows the user to start fresh with new meta while keeping historical data
      await setDoc(
        doc(db, "implementedSeoTips", docId),
        {
          metaOptimizationHistory: metaOptimizationHistory, // Preserved history of previous meta stats
          metaOptimizedAt: new Date().toISOString(),
          // Reset the implementation - change status and DELETE current stats fields
          status: "meta-optimizing", // Special status for meta-only optimization
          preStats: deleteField(), // DELETE current pre-implementation stats (will be set when re-implemented)
          postStats: deleteField(), // DELETE current post-implementation stats
          postStatsHistory: deleteField(), // DELETE current stats history (preserved in metaOptimizationHistory)
          implementedAt: deleteField(), // DELETE implementation date
          nextUpdateDue: deleteField(), // DELETE next update schedule
          extendedTotalDays: deleteField(), // DELETE extended days
          // Keep the same keyword - don't add to keywordHistory since we're keeping it
          currentKeyword: propFocusKeyword,
          metaOptimizationReason: `E1 Content Audit: Position ${Math.round(implementationData?.currentPosition || 0)}`,
        },
        { merge: true }
      );

      // Re-crawl the page to get fresh content for new AI suggestions
      toast.info("Re-crawling page for fresh meta suggestions...");
      try {
        const recrawlRes = await fetch("/api/recrawl-page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            pageUrl,
          }),
        });
        
        if (recrawlRes.ok) {
          const recrawlData = await recrawlRes.json();
          console.log("Page re-crawled:", recrawlData);
        } else {
          console.warn("Page re-crawl failed, but continuing with meta optimization");
        }
      } catch (recrawlError) {
        console.warn("Could not re-crawl page:", recrawlError);
      }

      // Clear cached meta title/description suggestions so new ones are generated
      try {
        const cacheKey = propFocusKeyword 
          ? `${pageUrl}::${propFocusKeyword.toLowerCase()}`
          : pageUrl;
        const encodedCacheKey = encodeURIComponent(cacheKey);
        
        await deleteDoc(doc(db, "seoMetaTitles", encodedCacheKey));
        await deleteDoc(doc(db, "seoMetaDescriptions", encodedCacheKey));
        console.log("Cleared cached meta suggestions for:", cacheKey);
      } catch (cacheError) {
        // Cache might not exist, which is fine
        console.log("Could not clear meta cache (may not exist):", cacheError.message);
      }

      // Log training event for AI learning - this meta attempt failed (0 clicks)
      // This data helps the AI system learn what types of metas don't work
      try {
        await fetch("/api/training/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            eventType: "meta_optimization_outcome",
            payload: {
              pageUrl,
              outcome: "failed_no_clicks",
              focusKeyword: propFocusKeyword,
              previousTitle: previousTitle,
              previousDescription: previousDescription,
              performanceMetrics: {
                impressions: currentData.postStats?.impressions || currentData.preStats?.impressions || 0,
                clicks: currentData.postStats?.clicks || 0,
                position: currentData.postStats?.position || currentData.preStats?.position || 0,
                ctr: currentData.postStats?.ctr || 0,
                daysTracked: currentData.implementedAt 
                  ? Math.floor((Date.now() - new Date(currentData.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
                  : 0,
              },
              tier: "E1",
              triggerReason: `Position ${Math.round(implementationData?.currentPosition || 0)} (close to page 1) - user requested new meta suggestions`,
            },
          }),
        });
        console.log("Logged meta_optimization_outcome training event");
      } catch (trainingError) {
        // Non-critical - don't block the flow
        console.warn("Could not log training event:", trainingError);
      }

      toast.success("Meta optimization started! Your page will appear in AI-Powered SEO Suggestions with new title/description recommendations.", {
        duration: 5000
      });
      
      // Auto-refresh the page after a short delay so user sees the new suggestions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error starting E1 meta optimization:", error);
      toast.error("Failed to start meta optimization. Please try again.");
    } finally {
      setIsOptimizingMeta(false);
    }
  };

  // E2 Content Gap Analysis handler - Analyzes content gaps + internal linking opportunities
  const handleE2ContentGapAnalysis = async () => {
    if (!user?.id || !pageUrl) return;

    setIsLoadingContentGaps(true);
    setIsLoadingInternalLinks(true);
    
    try {
      // Step 1: Get fresh page content
      const pageContent = await getPageContent(user.id, pageUrl, true);
      if (!pageContent.success) {
        throw new Error(`Failed to get page content: ${pageContent.error}`);
      }

      const { title, metaDescription, textContent, headings } = pageContent.data;

      // Step 2: Get GSC keywords for this page (related keywords) and site URL
      let relatedKeywords = [];
      let userSiteUrl = null;
      try {
        const { createGSCTokenManager } = await import("../../lib/gscTokenManager");
        const tokenManager = createGSCTokenManager(user.id);
        const gscData = await tokenManager.getStoredGSCData();
        
        if (gscData?.siteUrl) {
          userSiteUrl = gscData.siteUrl; // Store site URL for sitemap fetch
          const validToken = await tokenManager.getValidAccessToken();
          if (validToken) {
            const keywordsResponse = await fetch("/api/gsc/page-keywords", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: validToken,
                siteUrl: gscData.siteUrl,
                pageUrl,
                dateRange: "28",
              }),
            });
            
            if (keywordsResponse.ok) {
              const keywordsData = await keywordsResponse.json();
              relatedKeywords = [
                ...(keywordsData.keywords?.topPerformers || []),
                ...(keywordsData.keywords?.otherKeywords || []),
              ].slice(0, 20);
            }
          }
        }
      } catch (gscError) {
        console.warn("Could not fetch GSC keywords for content gaps:", gscError);
      }

      // Step 3: Call content gaps API
      const contentGapsResponse = await fetch("/api/seo-assistant/content-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          focusKeyword: propFocusKeyword,
          pageContent: textContent,
          title,
          metaDescription,
          headings,
          relatedKeywords,
        }),
      });

      if (!contentGapsResponse.ok) {
        throw new Error(`Content gaps analysis failed: ${contentGapsResponse.status}`);
      }

      const contentGapsData = await contentGapsResponse.json();
      setContentGaps(contentGapsData.contentGaps);
      
      setIsLoadingContentGaps(false);

      // Step 4: Generate internal link suggestions
      try {
        // Fetch sitemap URLs using the user's site URL
        if (!userSiteUrl) {
          console.warn("No site URL available for sitemap fetch");
          setIsLoadingInternalLinks(false);
          return;
        }
        
        const sitemapResponse = await fetch("/api/sitemap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteUrl: userSiteUrl }),
        });
        if (sitemapResponse.ok) {
          const sitemapData = await sitemapResponse.json();
          const sitemapUrls = sitemapData.urls || [];
          
          // Filter out the current page and find potential link sources
          const potentialSources = sitemapUrls
            .filter(url => url !== pageUrl && !url.includes(pageUrl))
            .slice(0, 10);
          
          if (potentialSources.length > 0) {
            // Generate anchor text suggestions for top 3 potential sources
            const linkSuggestions = [];
            
            for (const sourceUrl of potentialSources.slice(0, 3)) {
              try {
                const anchorResponse = await fetch("/api/seo-assistant/anchor-text", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fromUrl: sourceUrl,
                    toUrl: pageUrl,
                    targetSlug: pageUrl.split("/").filter(Boolean).pop() || "",
                  }),
                });
                
                if (anchorResponse.ok) {
                  const anchorData = await anchorResponse.json();
                  linkSuggestions.push({
                    fromUrl: sourceUrl,
                    toUrl: pageUrl,
                    anchorText: anchorData.anchorText || propFocusKeyword || "Learn more",
                  });
                }
              } catch (anchorError) {
                console.warn("Could not generate anchor text for:", sourceUrl);
              }
            }
            
            setInternalLinkSuggestions(linkSuggestions);
          }
        }
      } catch (linkError) {
        console.warn("Could not generate internal link suggestions:", linkError);
      }

      // Expand the card to show results
      setIsExpanded(true);
      
      toast.success("Content Gap Analysis Complete!", {
        description: `Found ${contentGapsData.contentGaps?.sections?.length || 0} content opportunities`
      });

    } catch (error) {
      console.error("E2 Content Gap Analysis error:", error);
      toast.error("Content gap analysis failed", {
        description: error.message
      });
    } finally {
      setIsLoadingContentGaps(false);
      setIsLoadingInternalLinks(false);
    }
  };

  // Get tier-specific colors
  const getTierColors = () => {
    switch (tierInfo.color) {
      case "blue":
        return {
          bg: "bg-blue-50 dark:bg-blue-950/30",
          border: "border-blue-300 dark:border-blue-700",
          text: "text-blue-800 dark:text-blue-200",
          textMuted: "text-blue-700 dark:text-blue-300",
          badge: "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
        };
      case "amber":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-300 dark:border-amber-700",
          text: "text-amber-800 dark:text-amber-200",
          textMuted: "text-amber-700 dark:text-amber-300",
          badge: "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
        };
      case "red":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-300 dark:border-red-700",
          text: "text-red-800 dark:text-red-200",
          textMuted: "text-red-700 dark:text-red-300",
          badge: "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-800",
          border: "border-gray-300 dark:border-gray-700",
          text: "text-gray-800 dark:text-gray-200",
          textMuted: "text-gray-700 dark:text-gray-300",
          badge: "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        };
    }
  };

  const tierColors = getTierColors();

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-lg">{cleanUrl}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Content quality analysis and improvement suggestions
              </p>
              {/* Keyword Insights Link */}
              {implementationData && (
                <Dialog open={isInsightsOpen} onOpenChange={(open) => {
                  setIsInsightsOpen(open);
                  if (open) fetchKeywordInsights();
                }}>
                  <DialogTrigger asChild>
                    <button className="text-sm text-[#00BF63] hover:text-[#00a855] underline underline-offset-2 mt-1 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      Keyword Insights
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[85vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-[#00BF63]" />
                        Keyword Insights
                      </DialogTitle>
                      <DialogDescription>
                        {cleanUrl}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[65vh] pr-4">


                      {/* Explanatory message at top */}
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>💡 Why are there so many keywords?</strong><br />
                          Google may show your page for many related searches (keywords) based on your page content and location. The keywords below explain why your impressions and rankings moved.   <strong>You don’t need to optimize for all of them.</strong> Continuing to improve your <strong>Focus Keyword</strong> helps Google naturally narrow results over time.<br></br>
                          <br></br><strong>We just wanted to give you a quick look behind the curtain so you can see what’s happening in the background (:</strong>
                        </p>
                      </div>
                      {/* Current Stats Section */}
                      {implementationData?.postStats && (
                        <div className="mb-6">
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            Current Performance (Last 28 Days)
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-muted-foreground mb-1">Impressions</p>
                              <p className="text-lg font-bold">{implementationData.postStats.impressions?.toLocaleString() || 0}</p>
                              {implementationData.preStats && (
                                <div className="text-xs mt-1">
                                  {formatDelta(implementationData.postStats.impressions - implementationData.preStats.impressions)}
                                </div>
                              )}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-muted-foreground mb-1">Clicks</p>
                              <p className="text-lg font-bold">{implementationData.postStats.clicks || 0}</p>
                              {implementationData.preStats && (
                                <div className="text-xs mt-1">
                                  {formatDelta(implementationData.postStats.clicks - implementationData.preStats.clicks)}
                                </div>
                              )}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-muted-foreground mb-1">CTR</p>
                              <p className="text-lg font-bold">{((implementationData.postStats.ctr || 0) * 100).toFixed(1)}%</p>
                              {implementationData.preStats && (
                                <div className="text-xs mt-1">
                                  {formatDelta(((implementationData.postStats.ctr - implementationData.preStats.ctr) * 100))}
                                </div>
                              )}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-muted-foreground mb-1">Avg. Position</p>
                              <p className="text-lg font-bold">{implementationData.postStats.position?.toFixed(1) || "—"}</p>
                              {implementationData.preStats && (
                                <div className="text-xs mt-1">
                                  {formatDelta(implementationData.postStats.position - implementationData.preStats.position, true)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}


                      {/* Keywords Section */}
                      <div className="space-y-4">
                        {isLoadingKeywords ? (
                          <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading keyword data...</p>
                          </div>
                        ) : keywordData ? (
                          <>
                            {/* Focus Keyword Highlight */}
                            {pageFocusKeyword && (
                              <div className={`mb-4 p-3 rounded-lg ${
                                focusKeywordSource === "ai-generated"
                                  ? "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800"
                                  : "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800"
                              }`}>
                                <div className="flex items-center gap-2 mb-1">
                                  {focusKeywordSource === "ai-generated" ? (
                                    <>
                                      <Sparkles className="w-4 h-4 text-purple-600" />
                                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">AI-Generated Focus Keyword</span>
                                    </>
                                  ) : (
                                    <>
                                      <Search className="w-4 h-4 text-blue-600" />
                                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Focus Keyword</span>
                                    </>
                                  )}
                                </div>
                                <p className={`font-bold ${
                                  focusKeywordSource === "ai-generated"
                                    ? "text-purple-900 dark:text-purple-100"
                                    : "text-blue-900 dark:text-blue-100"
                                }`}>{pageFocusKeyword}</p>
                              </div>
                            )}

                            {/* Top Performing Keywords */}
                            {keywordData.topPerformers?.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                  <Search className="w-4 h-4 text-[#00BF63]" />
                                  Search Queries Google Tested
                                  <Badge variant="secondary" className="text-xs">{keywordData.topPerformers.length}</Badge>
                                </h4>
                                <div className="space-y-2">
                                  {keywordData.topPerformers.slice(0, 10).map((kw, idx) => {
                                    const isMatch = isFocusKeyword(kw.keyword);
                                    const isAiGenerated = focusKeywordSource === "ai-generated";
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                          isMatch 
                                            ? isAiGenerated
                                              ? "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/40 dark:to-pink-950/40 border-2 border-purple-400 dark:border-purple-600 ring-2 ring-purple-200 dark:ring-purple-800"
                                              : "bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-950/40 dark:to-cyan-950/40 border-2 border-blue-400 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-800"
                                            : "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                                        }`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <p className={`font-medium text-sm truncate ${
                                              isMatch 
                                                ? isAiGenerated 
                                                  ? "text-purple-900 dark:text-purple-100" 
                                                  : "text-blue-900 dark:text-blue-100"
                                                : ""
                                            }`}>
                                              {kw.keyword}
                                            </p>
                                            {isMatch && (
                                              <Badge className={`text-white text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${
                                                isAiGenerated ? "bg-purple-600" : "bg-blue-600"
                                              }`}>
                                                {isAiGenerated && <Sparkles className="w-2.5 h-2.5 mr-0.5" />}
                                                FOCUS
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-foreground">Position: {kw.position}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                          <div className="text-center">
                                            <p className="font-semibold">{kw.impressions}</p>
                                            <p className="text-muted-foreground">impr.</p>
                                          </div>
                                          <div className="text-center">
                                            <p className="font-semibold">{kw.clicks}</p>
                                            <p className="text-muted-foreground">clicks</p>
                                          </div>
                                          <div className="text-center">
                                            <p className="font-semibold">{kw.ctr}</p>
                                            <p className="text-muted-foreground">CTR</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {keywordData.topPerformers.length > 10 && (
                                    <p className="text-xs text-muted-foreground text-center py-1">
                                      + {keywordData.topPerformers.length - 10} more top keywords
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Other Keywords (Testing) */}
                            {keywordData.otherKeywords?.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                  <MousePointerClick className="w-4 h-4 text-gray-500" />
                                  Other Queries
                                  <Badge variant="outline" className="text-xs">{keywordData.otherKeywords.length}</Badge>
                                </h4>

                                <div className="space-y-1.5">
                                  {keywordData.otherKeywords.slice(0, 15).map((kw, idx) => {
                                    const isMatch = isFocusKeyword(kw.keyword);
                                    const isAiGenerated = focusKeywordSource === "ai-generated";
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`flex items-center justify-between p-2 rounded text-xs ${
                                          isMatch
                                            ? isAiGenerated
                                              ? "bg-purple-100 dark:bg-purple-950/40 border-2 border-purple-400 dark:border-purple-600"
                                              : "bg-blue-100 dark:bg-blue-950/40 border-2 border-blue-400 dark:border-blue-600"
                                            : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                        }`}
                                      >
                                        <div className="truncate flex-1 flex items-center gap-1.5">
                                          <span className={isMatch 
                                            ? isAiGenerated 
                                              ? "text-purple-900 dark:text-purple-100 font-medium" 
                                              : "text-blue-900 dark:text-blue-100 font-medium"
                                            : "text-muted-foreground"
                                          }>
                                            {kw.keyword}
                                          </span>
                                          {isMatch && (
                                            <Badge className={`text-white text-[9px] px-1 py-0 h-3.5 ${
                                              isAiGenerated ? "bg-purple-600" : "bg-blue-600"
                                            }`}>
                                              {isAiGenerated && <Sparkles className="w-2 h-2 mr-0.5" />}
                                              FOCUS
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 ml-2">
                                          <span className="text-muted-foreground">{kw.impressions} impr.</span>
                                          <span className="text-muted-foreground">pos. {kw.position}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {keywordData.otherKeywords.length > 15 && (
                                    <p className="text-xs text-muted-foreground text-center py-1">
                                      + {keywordData.otherKeywords.length - 15} more testing keywords
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Summary */}
                            {keywordData.totals && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Total Keywords Ranking:</span>
                                  <span className="font-semibold">{keywordData.totals.totalKeywords}</span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">No keyword data available yet.</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {auditResult && getScoreBadge(auditResult.contentScore)}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Smart Tier-Based Recommendation Section */}
        {implementationData && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${tierColors.bg} ${tierColors.border}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-sm font-semibold ${tierColors.text}`}>
                    {tierInfo.tier === "E1" && "Close to Page 1 - Minor Optimizations Needed"}
                    {tierInfo.tier === "E2" && "Content Expansion Recommended"}
                    {tierInfo.tier === "E3" && e3Recommendation?.primaryButton === "rewrite" && "Content Rewrite Recommended"}
                    {tierInfo.tier === "E3" && e3Recommendation?.primaryButton === "pivot" && "Keyword Pivot Recommended"}
                    {tierInfo.tier === "E3" && e3Recommendation?.primaryButton === null && "Significant Changes Needed"}
                  </span>
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${tierColors.badge}`}>
                    Tier {tierInfo.tier}
                  </span>
                </div>
                <p className={`text-sm ${tierColors.textMuted} mb-4`}>
                  {/* For E3 tier, use the impression-based smart message instead of static message */}
                  {tierInfo.tier === "E3" && e3Recommendation 
                    ? e3Recommendation.message 
                    : tierInfo.message}
                </p>

                {/* Priority Actions hidden - user will see detailed steps after clicking Run Audit & Get AI Suggestions */}

                {/* E3 Action Buttons with Smart Recommendation */}
                {tierInfo.showPivotOption && propFocusKeyword && (
                  <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
                    {/* Smart Recommendation Card */}
                    {e3Recommendation && !showKeywordSelection && (
                      <div className={`mb-4 p-3 rounded-lg border-2 ${
                        e3Recommendation.primaryButton === "rewrite"
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600"
                          : e3Recommendation.primaryButton === "pivot"
                          ? "bg-purple-50 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-sm font-semibold ${
                                e3Recommendation.primaryButton === "rewrite"
                                  ? "text-amber-800 dark:text-amber-200"
                                  : e3Recommendation.primaryButton === "pivot"
                                  ? "text-purple-800 dark:text-purple-200"
                                  : "text-gray-800 dark:text-gray-200"
                              }`}>
                                {e3Recommendation.title}
                              </span>
                              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                                e3Recommendation.confidence === "high"
                                  ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                                  : e3Recommendation.confidence === "medium"
                                  ? "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                              }`}>
                                {e3Recommendation.confidence} confidence
                              </span>
                            </div>
                            <p className={`text-xs ${
                              e3Recommendation.primaryButton === "rewrite"
                                ? "text-amber-700 dark:text-amber-300"
                                : e3Recommendation.primaryButton === "pivot"
                                ? "text-purple-700 dark:text-purple-300"
                                : "text-gray-700 dark:text-gray-300"
                            }`}>
                              {e3Recommendation.message}
                            </p>
                          </div>
                        </div>
                    )}

                    {!showKeywordSelection ? (
                      <>
                        <div className="mb-3">
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Current Focus Keyword: <span className="font-bold">&quot;{propFocusKeyword}&quot;</span>
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {/* Rewrite Content Button - Purple gradient AI button */}
                          {/* Shows for ALL E3 cases (E3a/b, E3c, E3d) - always available */}
                          <Button
                            onClick={handleRewriteContent}
                            disabled={isRewriting || isPivoting || aiSuggestions}
                            size="sm"
                            className={`flex-1 ${
                              e3Recommendation?.primaryButton === "rewrite"
                                ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                                : "bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-500 hover:to-pink-500 text-white border-0 opacity-90"
                            }`}
                          >
                            {isRewriting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Analyzing & Generating...
                              </>
                            ) : aiSuggestions ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Suggestions Ready ↓
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Run Audit & Get AI Suggestions
                              </>
                            )}
                          </Button>
                          {/* Pivot to New Keyword Button - Hide ONLY when Rewrite is the clear choice (E3d: impressions ≥ 50) */}
                          {e3Recommendation?.primaryButton !== "rewrite" && (
                            <Button
                              onClick={handlePivotFromContentAudit}
                              disabled={isPivoting || isRewriting}
                              variant={e3Recommendation?.primaryButton === "pivot" ? "default" : "outline"}
                              size="sm"
                              className={`flex-1 ${
                                e3Recommendation?.primaryButton === "pivot"
                                  ? "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"
                                  : "border-red-400 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-950"
                              }`}
                            >
                              {isPivoting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Pivoting...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Pivot to New Keyword
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        {/* Show explanation when both buttons are visible (E3a/b and E3c) */}
                        {e3Recommendation?.primaryButton !== "rewrite" && (
                          <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-2">
                            <strong>Run Audit & Get AI Suggestions</strong> resets the 45-day cycle and keeps your keyword. <strong>Pivot</strong> lets you try a completely different keyword.
                            {e3Recommendation?.primaryButton === "pivot" && " (Pivot recommended based on your metrics)"}
                          </p>
                        )}
                      </>
                    ) : (
                      /* Keyword Selection UI - Same as PivotOptionsPanel */
                      <div className="space-y-4">
                        {/* Current Ranking Keywords */}
                        <div className="border-t border-red-200 dark:border-red-800 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-red-900 dark:text-red-100">
                                Select New Focus Keyword
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowKeywordSelection(false);
                                setPendingKeyword(null);
                                setPendingKeywordSource(null);
                              }}
                              className="text-xs text-muted-foreground"
                            >
                              Cancel
                            </Button>
                          </div>
                          
                          {loadingRankingKeywords ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading ranking keywords...
                            </div>
                          ) : currentRankingKeywords.length > 0 ? (
                            <>
                              <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                                Select one of these keywords your page is currently ranking for:
                              </p>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {currentRankingKeywords.slice(0, 10).map((kw, idx) => {
                                  const isPending = pendingKeyword === kw.keyword;
                                  const isSaved = selectedKeyword === kw.keyword;
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
                                        isSaved
                                          ? "bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600"
                                          : isPending 
                                            ? "bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400"
                                            : "bg-white dark:bg-gray-800/50 border-red-200 dark:border-red-800 hover:border-blue-400 dark:hover:border-blue-600"
                                      }`}
                                      onClick={() => !isSaved && handleSelectKeyword(kw.keyword, "gsc-existing")}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{kw.keyword}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {kw.impressions} impressions - {kw.clicks} clicks - Pos. {Math.round(kw.position || 0)}
                                        </p>
                                      </div>
                                      {isSaved ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                      ) : isPending ? (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Selected</span>
                                      ) : (
                                        <Button variant="ghost" size="sm" className="text-xs">
                                          Select
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">
                              No ranking keywords found for this page yet.
                            </p>
                          )}

                          {/* Generate Hybrid Keywords Button */}
                          <div className="mt-4 pt-3 border-t border-red-200 dark:border-red-800">
                            <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                              Or generate AI-powered hybrid keywords:
                            </p>
                            <Button
                              onClick={handleGenerateHybridKeywords}
                              disabled={loadingHybridKeywords}
                              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                              size="sm"
                            >
                              {loadingHybridKeywords ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  Generate Hybrid Keywords
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Generated Hybrid Keywords */}
                        {hybridKeywords.length > 0 && (
                          <div className="border-t border-purple-200 dark:border-purple-800 pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                AI Hybrid Keywords
                              </span>
                            </div>
                            <div className="space-y-2">
                              {hybridKeywords.map((kw, idx) => {
                                const keyword = typeof kw === "string" ? kw : kw.keyword;
                                const reason = typeof kw === "object" ? kw.reason : null;
                                const isPending = pendingKeyword === keyword;
                                const isSaved = selectedKeyword === keyword;
                                
                                return (
                                  <div
                                    key={idx}
                                    className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
                                      isSaved
                                        ? "bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600"
                                        : isPending 
                                          ? "bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400"
                                          : "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600"
                                    }`}
                                    onClick={() => !isSaved && handleSelectKeyword(keyword, "hybrid")}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{keyword}</p>
                                      {reason && (
                                        <p className="text-xs text-purple-600 dark:text-purple-400 italic truncate">{reason}</p>
                                      )}
                                    </div>
                                    {isSaved ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    ) : isPending ? (
                                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Selected</span>
                                    ) : (
                                      <Button variant="ghost" size="sm" className="text-xs text-purple-700 dark:text-purple-300">
                                        Select
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Save Button - Shows when a keyword is pending */}
                        {pendingKeyword && (
                          <div className="border-t border-green-200 dark:border-green-800 pt-4 mt-4">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3">
                              <p className="text-sm text-green-800 dark:text-green-200">
                                <span className="font-medium">Selected keyword:</span> {pendingKeyword}
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Click &quot;Save New Focus Keyword&quot; to confirm this change.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleSavePendingKeyword}
                                disabled={isSavingKeyword}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                              >
                                {isSavingKeyword ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Save New Focus Keyword
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleCancelPendingKeyword}
                                disabled={isSavingKeyword}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoadingSavedData ? (
          <div className="text-center py-4">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading saved data...</p>
          </div>
        ) : !auditResult && !tierInfo.showPivotOption ? (
          // E1 gets special "Run Audit + AI Meta Tags" button, E2 gets standard "Run Content Audit"
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {tierInfo.tier === "E1" 
                ? "You're close to page 1! Let's optimize your meta tags to improve click-through rate."
                : tierInfo.tier === "E2"
                ? "At page 3-4, you need deeper content to compete. Get AI-powered content gap analysis and internal linking suggestions."
                : "Analyze content quality, readability, and structure to improve SEO performance."
              }
            </p>
            {tierInfo.tier === "E1" ? (
              // E1: Purple gradient button for Meta Optimization (same flow as Pivot's "Optimize Meta Only")
              <Button 
                onClick={handleE1MetaOptimization}
                disabled={isOptimizingMeta}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
              >
                {isOptimizingMeta ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Run Audit + AI Meta Tags
                  </>
                )}
              </Button>
            ) : tierInfo.tier === "E2" ? (
              // E2: Blue button for Content Gap Analysis + Internal Linking
              <Button 
                onClick={handleE2ContentGapAnalysis}
                disabled={isLoadingContentGaps || contentGaps}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoadingContentGaps ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing Content Gaps...
                  </>
                ) : contentGaps ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Analysis Complete - See Below
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Run Audit & Get AI Gap Suggestions
                  </>
                )}
              </Button>
            ) : (
              // Default: Standard blue button for Content Audit (fallback)
              <Button 
                onClick={runContentAudit}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Run Content Audit
                  </>
                )}
              </Button>
            )}
          </div>
        ) : contentGaps ? (
          /* E2 Content Gap Analysis Results */
          <div className="space-y-6">
            {/* Summary */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Content Gap Analysis Summary
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {contentGaps.summary}
              </p>
            </div>

            {/* Missing Sections */}
            {contentGaps.sections?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Missing Content Sections
                </h4>
                <div className="space-y-3">
                  {contentGaps.sections.map((section, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border-2 ${
                        section.priority === "high" 
                          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" 
                          : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className={`font-medium ${
                          section.priority === "high" 
                            ? "text-red-900 dark:text-red-200" 
                            : "text-amber-900 dark:text-amber-200"
                        }`}>
                          {section.title}
                        </h5>
                        <Badge variant={section.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                          {section.priority} priority
                        </Badge>
                      </div>
                      <p className={`text-sm mb-2 ${
                        section.priority === "high" 
                          ? "text-red-700 dark:text-red-300" 
                          : "text-amber-700 dark:text-amber-300"
                      }`}>
                        {section.description}
                      </p>
                      {section.suggestedContent && (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 mt-2">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Suggested content outline:</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{section.suggestedContent}</p>
                          {section.wordCountSuggestion && (
                            <p className="text-xs text-gray-500 mt-1">Recommended length: ~{section.wordCountSuggestion} words</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ Suggestions */}
            {contentGaps.faqSuggestions?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500" />
                  FAQ Questions to Add
                </h4>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="space-y-3">
                    {contentGaps.faqSuggestions.map((faq, idx) => (
                      <div key={idx} className="border-b border-blue-200 dark:border-blue-700 pb-3 last:border-0 last:pb-0">
                        <p className="font-medium text-blue-900 dark:text-blue-200 text-sm">
                          Q: {faq.question}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Answer outline: {faq.answerOutline}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Keyword Opportunities */}
            {contentGaps.keywordOpportunities?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Keyword Opportunities from GSC
                </h4>
                <div className="space-y-2">
                  {contentGaps.keywordOpportunities.map((kw, idx) => (
                    <div key={idx} className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="font-medium text-green-900 dark:text-green-200 text-sm">{kw.keyword}</p>
                      <p className="text-xs text-green-700 dark:text-green-300">{kw.reason}</p>
                      {kw.suggestedUse && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 italic">How to use: {kw.suggestedUse}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Wins */}
            {contentGaps.quickWins?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Quick Wins
                </h4>
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <ul className="space-y-2">
                    {contentGaps.quickWins.map((win, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-200">
                        <CheckCircle2 className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        {win}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Internal Linking Suggestions */}
            {internalLinkSuggestions.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Internal Linking Opportunities
                </h4>
                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-3">
                    Add links from these pages to boost this page's authority:
                  </p>
                  <div className="space-y-3">
                    {internalLinkSuggestions.map((link, idx) => (
                      <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded border border-indigo-200 dark:border-indigo-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Link FROM:</p>
                        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 truncate mb-2">
                          {link.fromUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Suggested anchor text:</p>
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-indigo-700 dark:text-indigo-300">
                          &lt;a href="{pageUrl}"&gt;{link.anchorText}&lt;/a&gt;
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isLoadingInternalLinks && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading internal link suggestions...
              </div>
            )}

            {/* Action Button - Reset tracking after implementing changes */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700 mb-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Next Steps:</strong> Implement the content improvements above, then click the button below to reset your 45-day tracking cycle and measure the impact of your changes.
                </p>
              </div>
              <Button
                onClick={handleConfirmRewrite}
                disabled={isRewriting}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isRewriting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting Fresh Tracking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    I've Made Changes - Start Fresh 45-Day Tracking
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : auditResult ? (
          <>
            {/* Overall Score - shows when audit has been run */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Overall Content Score</h4>
                {getScoreBadge(auditResult.contentScore)}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${auditResult.contentScore}%` }}
                ></div>
              </div>
            </div>

            {/* Detailed Analysis */}
            <div
              className="overflow-hidden"
              style={{
                display: isExpanded ? "block" : "none",
              }}
            >
              <div ref={expandedContentRef} className="space-y-4 pt-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Content Analysis</h4>
                
                {/* Content Length */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Content Length</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.contentLength.value.toLocaleString()} characters
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.contentLength.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.contentLength.score}/100
                  </Badge>
                </div>

                {/* Readability */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Readability</h5>
                    <p className="text-sm text-muted-foreground">
                      Flesch-Kincaid: {auditResult.analysis.readability.value.toFixed(1)}
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.readability.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.readability.score}/100
                  </Badge>
                </div>

                {/* Heading Structure */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Heading Structure</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.headingStructure.value.totalHeadings} headings
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.headingStructure.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.headingStructure.score}/100
                  </Badge>
                </div>

                {/* Title Optimization */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Title Optimization</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.titleOptimization.value.length} characters
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.titleOptimization.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.titleOptimization.score}/100
                  </Badge>
                </div>

                {/* Meta Description */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Meta Description</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.metaDescription.value.length} characters
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.metaDescription.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.metaDescription.score}/100
                  </Badge>
                </div>

                {/* Improvement Suggestions */}
                {auditResult.suggestions.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Improvement Suggestions</h4>
                    <div className="space-y-3">
                      {auditResult.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <h5 className="font-medium text-blue-900 dark:text-blue-200 mb-2">{suggestion.title}</h5>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{suggestion.description}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Action: {suggestion.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggestions Section - Generated via E3 Rewrite Content button */}
                {aiSuggestions && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-green-900 dark:text-green-200 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      AI Improvement Suggestions
                    </h4>
                    <div className="space-y-4">
                      {aiSuggestions.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-green-900 dark:text-green-200">{suggestion.title}</h5>
                            {getPriorityBadge(suggestion.priority)}
                          </div>
                          <p className="text-sm text-green-700 dark:text-green-300 mb-3">{suggestion.description}</p>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded border border-green-100 dark:border-green-800">
                            <h6 className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">AI Recommendation:</h6>
                            <p className="text-sm text-green-700 dark:text-green-300">{suggestion.aiRecommendation}</p>
                          </div>
                          {suggestion.examples && (
                            <div className="mt-3 bg-white dark:bg-gray-800 p-3 rounded border border-green-100 dark:border-green-800">
                              <h6 className="text-sm font-bold text-green-800 dark:text-green-300 mb-3">Examples:</h6>
                              <div className="space-y-3">
                                {suggestion.examples.map((example, exampleIdx) => {
                                  // Parse the example to extract before/after if it contains them
                                  const exampleText = String(example || '');
                                  const beforeMatch = exampleText.match(/"before":"([^"]+)"/);
                                  const afterMatch = exampleText.match(/"after":"([^"]+)"/);
                                  
                                  if (beforeMatch && afterMatch) {
                                    // Format as before/after comparison
                                    return (
                                      <div key={exampleIdx} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
                                          Example {exampleIdx + 1} of {suggestion.examples.length}
                                        </div>
                                        <div className="space-y-3">
                                          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded border border-amber-300 dark:border-amber-700">
                                            <h6 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">CURRENT:</h6>
                                            <p className="text-sm text-amber-600 dark:text-amber-300 font-mono leading-relaxed whitespace-pre-line">{beforeMatch[1].replace(/\\n/g, '\n')}</p>
                                          </div>
                                          <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-200 dark:border-green-800">
                                            <h6 className="text-sm font-bold text-green-800 dark:text-green-300 mb-2">SUGGESTED:</h6>
                                            <p className="text-sm text-green-700 dark:text-green-300 font-mono leading-relaxed whitespace-pre-line">{afterMatch[1].replace(/\\n/g, '\n')}</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Regular example format
                                    return (
                                      <div key={exampleIdx} className="flex items-start gap-2">
                                        <span className="text-green-500 dark:text-green-400 mt-1">•</span>
                                        <span className="text-sm text-green-700 dark:text-green-300">{exampleText}</span>
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Confirm & Start Fresh Tracking Button */}
                    <div className="mt-6 pt-4 border-t border-green-200 dark:border-green-800">
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-700 mb-4">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>📋 Next Steps:</strong> Review the suggestions above, then click the button below when you&apos;re ready to implement these changes. This will reset your 45-day tracking cycle so we can measure the impact of your content improvements.
                        </p>
                      </div>
                      <Button
                        onClick={handleConfirmRewrite}
                        disabled={isRewriting}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isRewriting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Starting Fresh Tracking...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            I&apos;ve Reviewed - Start Fresh 45-Day Tracking
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default ContentAuditPanel;
