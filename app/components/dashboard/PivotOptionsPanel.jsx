"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Sparkles, 
  History, 
  TrendingUp, 
  AlertCircle, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { db } from "../../lib/firebaseConfig";
import { doc, setDoc, getDoc, deleteField } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Helper function to create safe document IDs
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

// CTR Benchmark by position (industry averages)
const getExpectedCTR = (position) => {
  if (position <= 1) return 0.28;  // 28%
  if (position <= 2) return 0.15;  // 15%
  if (position <= 3) return 0.10;  // 10%
  if (position <= 4) return 0.07;  // 7%
  if (position <= 5) return 0.05;  // 5%
  if (position <= 10) return 0.025; // 2.5%
  return 0.01; // 1%
};

// Check if page meets CTR Benchmark fail criteria
const checkCtrBenchmarkFail = (position, impressions, clicks) => {
  if (position > 5) return null; // Only check for top 5 positions
  if (impressions < 50) return null; // Need enough impressions to judge
  
  const expectedCTR = getExpectedCTR(position);
  const expectedClicks = Math.round(impressions * expectedCTR);
  const actualCTR = impressions > 0 ? clicks / impressions : 0;
  
  // CTR Benchmark Fail: Position is good but clicks are way below expected
  if (clicks === 0 && expectedClicks >= 5) {
    return {
      isFail: true,
      position: Math.round(position),
      impressions,
      expectedClicks,
      actualClicks: clicks,
      expectedCTR: (expectedCTR * 100).toFixed(1),
      actualCTR: (actualCTR * 100).toFixed(2)
    };
  }
  
  // Also fail if actual CTR is less than 20% of expected CTR
  if (actualCTR < expectedCTR * 0.2 && expectedClicks >= 3) {
    return {
      isFail: true,
      position: Math.round(position),
      impressions,
      expectedClicks,
      actualClicks: clicks,
      expectedCTR: (expectedCTR * 100).toFixed(1),
      actualCTR: (actualCTR * 100).toFixed(2)
    };
  }
  
  return null;
};

const PivotOptionsPanel = ({
  pageUrl,
  pageData,
  implementationData,
  focusKeyword = "",
  keywordSource = "gsc-existing",
}) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showKeywordSelection, setShowKeywordSelection] = useState(false);
  const [hybridKeywords, setHybridKeywords] = useState([]);
  const [loadingHybridKeywords, setLoadingHybridKeywords] = useState(false);
  const [currentRankingKeywords, setCurrentRankingKeywords] = useState([]);
  const [loadingRankingKeywords, setLoadingRankingKeywords] = useState(false);
  const [keywordHistory, setKeywordHistory] = useState([]);
  const [waitAnotherCycle, setWaitAnotherCycle] = useState(false);
  const [extendedDeadline, setExtendedDeadline] = useState(null);
  const [selectedKeyword, setSelectedKeyword] = useState(null); // Successfully saved keyword
  const [pendingKeyword, setPendingKeyword] = useState(null); // Keyword selected but not yet saved
  const [pendingKeywordSource, setPendingKeywordSource] = useState(null); // Source of pending keyword
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizingMeta, setIsOptimizingMeta] = useState(false); // For "Optimize Meta Only" action

  // Check CTR Benchmark fail
  const ctrBenchmarkFail = implementationData ? checkCtrBenchmarkFail(
    implementationData.currentPosition || 100,
    implementationData.postStats?.impressions || implementationData.newImpressions || 0,
    implementationData.postStats?.clicks || 0
  ) : null;

  // Calculate reasons why Content Audit isn't available
  const pivotReasons = [];
  if (implementationData) {
    const { newImpressions, currentPosition, hasZeroClicks } = implementationData;
    
    if (!hasZeroClicks) {
      pivotReasons.push("You have clicks! That's a good sign.");
    }
    if ((newImpressions || 0) < 50) {
      pivotReasons.push(`Only ${newImpressions || 0} new impressions (need 50+)`);
    }
    if ((currentPosition || 0) < 15 && (currentPosition || 0) > 0) {
      pivotReasons.push(`Position ${Math.round(currentPosition || 0)} is on page 1 (need page 2+)`);
    }
  }
  if (pivotReasons.length === 0) {
    pivotReasons.push("Page is performing differently than expected");
  }

  // Calculate recommendation: Wait vs Pivot vs Optimize Meta
  // This provides clear guidance based on deeper metric analysis
  const getRecommendation = () => {
    if (!implementationData) {
      return { action: "wait", confidence: "low", reason: "Not enough data to make a recommendation." };
    }

    const { newImpressions, currentPosition, hasZeroClicks, postStats } = implementationData;
    const clicks = postStats?.clicks || 0;
    const impressions = postStats?.impressions || newImpressions || 0;
    const position = currentPosition || 100;
    const keywordsTried = keywordHistory.length;

    // CTR BENCHMARK FAIL - Top position but no clicks (critical!)
    // Check this FIRST as it's a special case
    if (ctrBenchmarkFail) {
      return {
        action: "optimize-meta",
        confidence: "high",
        reason: `🚨 Critical CTR Fail: You're in position ${ctrBenchmarkFail.position} (top of page 1) with ${ctrBenchmarkFail.impressions} impressions but only ${ctrBenchmarkFail.actualClicks} clicks. You should have ~${ctrBenchmarkFail.expectedClicks} clicks at this position! Your keyword IS working - Google loves your content. The problem is your Meta Title isn't compelling enough to beat competitors. Don't change your keyword - just rewrite your Meta Title and Description!`,
        icon: "🚨"
      };
    }

    // IMPRESSION VELOCITY - "Rising Star" Signal
    // Check if impressions are growing significantly month-over-month
    if (implementationData.preStats && impressions > 0) {
      const baselineImpressions = implementationData.preStats.impressions || 1;
      const growthPercent = ((impressions - baselineImpressions) / baselineImpressions) * 100;
      
      // If impressions grew by 100%+ (doubled or more), it's a rising star
      if (growthPercent >= 100 && clicks === 0) {
        return {
          action: "wait",
          confidence: "high",
          reason: `🌟 Rising Star! Your visibility has grown by ${Math.round(growthPercent)}% since implementation (${baselineImpressions} → ${impressions} impressions). Google is starting to trust this page—give it 45 more days to stabilize before making changes.`,
          icon: "🚀"
        };
      }
      
      // Even 50%+ growth is a good sign worth noting
      if (growthPercent >= 50 && clicks === 0 && position > 15) {
        return {
          action: "wait",
          confidence: "medium",
          reason: `📈 Momentum Building! Impressions grew ${Math.round(growthPercent)}% since implementation (${baselineImpressions} → ${impressions}). Google is noticing this page—wait for the trend to continue.`,
          icon: "📈"
        };
      }
    }

    // Strong indicators to WAIT
    if (clicks > 0) {
      return {
        action: "wait",
        confidence: "high",
        reason: `You're getting clicks (${clicks})! Your CTR optimizations are working. Give it more time to build momentum.`,
        icon: "✅"
      };
    }

    // Only suggest waiting for top position if NOT a CTR benchmark fail
    if (position < 10 && !ctrBenchmarkFail) {
      return {
        action: "wait",
        confidence: "high", 
        reason: `You're ranking in position ${Math.round(position)} (top of page 1)! You're very close to breakthrough. Keep your current strategy.`,
        icon: "🎯"
      };
    }

    if (impressions < 30) {
      return {
        action: "wait",
        confidence: "medium",
        reason: `Only ${impressions} impressions so far. Google hasn't shown your page enough yet to judge performance. Wait for more exposure.`,
        icon: "👀"
      };
    }

    if (position >= 10 && position < 20) {
      return {
        action: "wait",
        confidence: "medium",
        reason: `Position ${Math.round(position)} is on the edge of page 1. A small content tweak might push you over. Consider waiting.`,
        icon: "📈"
      };
    }

    // Strong indicators to PIVOT
    if (position >= 40 && impressions >= 50 && clicks === 0) {
      return {
        action: "pivot",
        confidence: "high",
        reason: `Position ${Math.round(position)} with ${impressions} impressions but 0 clicks suggests Google isn't connecting this keyword to your content. Try a different keyword.`,
        icon: "🔄"
      };
    }

    if (keywordsTried >= 2) {
      return {
        action: "pivot",
        confidence: "high",
        reason: `You've already tried ${keywordsTried} keywords. Consider using AI-generated hybrid keywords to find a fresh angle.`,
        icon: "✨"
      };
    }

    if (position >= 30 && impressions >= 100 && clicks === 0) {
      return {
        action: "pivot",
        confidence: "medium",
        reason: `High impressions (${impressions}) but no clicks at position ${Math.round(position)} indicates a keyword-content mismatch. A new keyword might help.`,
        icon: "🔀"
      };
    }

    // Moderate case - could go either way
    if (position >= 20 && position < 40) {
      return {
        action: "either",
        confidence: "low",
        reason: `Position ${Math.round(position)} with ${impressions} impressions is in the "watch zone". You could wait for more data or try a new keyword - both are reasonable choices.`,
        icon: "⚖️"
      };
    }

    // Default fallback
    return {
      action: "either",
      confidence: "low",
      reason: "Your metrics are mixed. Consider your content quality and whether the current keyword truly matches your page's topic.",
      icon: "🤔"
    };
  };

  const recommendation = getRecommendation();

  // Load saved data (keyword history, extended deadline)
  useEffect(() => {
    const loadSavedData = async () => {
      if (!user?.id || !pageUrl) return;

      try {
        const docId = createSafeDocId(user.id, pageUrl);
        const snapshot = await getDoc(doc(db, "implementedSeoTips", docId));
        const data = snapshot.data();

        if (data?.keywordHistory) {
          setKeywordHistory(data.keywordHistory);
        }
        if (data?.extendedDeadline) {
          setExtendedDeadline(new Date(data.extendedDeadline));
          setWaitAnotherCycle(true);
        }
      } catch (error) {
        console.error("Error loading pivot data:", error);
      }
    };

    loadSavedData();
  }, [user?.id, pageUrl]);

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

  // Handle opening keyword selection
  const handleOpenKeywordSelection = () => {
    setShowKeywordSelection(true);
    // Fetch keywords when opening the selection
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
          currentFocusKeyword: focusKeyword,
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

  // Handle selecting a keyword (just marks it as pending, doesn't save yet)
  const handleSelectKeyword = (keyword, source = "gsc-existing") => {
    setPendingKeyword(keyword);
    setPendingKeywordSource(source);
  };

  // Handle saving the pending keyword
  const handleSavePendingKeyword = async () => {
    if (!user?.id || !pageUrl || !pendingKeyword) return;

    setIsSaving(true);
    
    try {
      const docId = createSafeDocId(user.id, pageUrl);
      
      // Add current focus keyword to history
      const updatedHistory = [...keywordHistory];
      if (focusKeyword && !updatedHistory.some(h => h.keyword.toLowerCase() === focusKeyword.toLowerCase())) {
        updatedHistory.push({
          keyword: focusKeyword,
          testedAt: new Date().toISOString(),
          source: keywordSource,
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
          keyword: focusKeyword,
          source: keywordSource,
          implementedAt: currentData.implementedAt,
          pivotedAt: new Date().toISOString(),
          preStats: currentData.preStats,
          postStats: currentData.postStats || null,
          postStatsHistory: currentData.postStatsHistory || [],
          // Calculate days tracked
          daysTracked: currentData.implementedAt 
            ? Math.floor((Date.now() - new Date(currentData.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        });
      }

      // RESET: Clear implementation status but PRESERVE old stats in history
      // This allows the user to start fresh with the new keyword while keeping historical data
      await setDoc(
        doc(db, "implementedSeoTips", docId),
        {
          keywordHistory: updatedHistory,
          keywordStatsHistory: keywordStatsHistory, // Preserved history of previous keyword stats
          pivotedAt: new Date().toISOString(),
          // Reset the implementation - change status and DELETE current stats fields
          status: "pivoted", // Changed from "implemented" to "pivoted"
          preStats: deleteField(), // DELETE current pre-implementation stats (will be set when re-implemented)
          postStats: deleteField(), // DELETE current post-implementation stats
          postStatsHistory: deleteField(), // DELETE current stats history (preserved in keywordStatsHistory)
          implementedAt: deleteField(), // DELETE implementation date
          nextUpdateDue: deleteField(), // DELETE next update schedule
          // Keep reference to what keyword we're pivoting to
          pivotedToKeyword: pendingKeyword,
          pivotedFromKeyword: focusKeyword,
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

      // Normalize the page URL for comparison
      const normalizeUrl = (url) => {
        if (!url) return "";
        try {
          const u = new URL(url);
          return (u.pathname === '/' ? u.origin : u.origin + u.pathname.replace(/\/$/, '')).toLowerCase();
        } catch {
          return url.trim().replace(/\/$/, '').toLowerCase();
        }
      };

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
      // This ensures the AI uses the current H1, content, etc. when generating new title/meta
      toast.info("🔄 Re-crawling page for fresh content...");
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
          console.log("✅ Page re-crawled:", recrawlData);
        } else {
          console.warn("⚠️ Page re-crawl failed, but continuing with pivot");
        }
      } catch (recrawlError) {
        console.warn("⚠️ Could not re-crawl page:", recrawlError);
        // Don't fail the whole pivot if re-crawl fails
      }

      setKeywordHistory(updatedHistory);
      setSelectedKeyword(pendingKeyword);
      setPendingKeyword(null);
      setPendingKeywordSource(null);
      toast.success(`🔄 Keyword pivoted to "${pendingKeyword}"! Page content refreshed - new suggestions will be generated. Refreshing...`);
      
      // Auto-refresh the page after a short delay so user sees the new suggestions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error saving new focus keyword:", error);
      toast.error("Failed to update focus keyword. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle canceling the pending selection
  const handleCancelPendingKeyword = () => {
    setPendingKeyword(null);
    setPendingKeywordSource(null);
  };

  // Handle "Optimize Meta Only" - For CTR Benchmark Fail cases
  // Same keyword, just new title/description
  const handleOptimizeMetaOnly = async () => {
    if (!user?.id || !pageUrl) return;

    setIsOptimizingMeta(true);
    
    try {
      const docId = createSafeDocId(user.id, pageUrl);
      
      // First, fetch the current document to preserve old stats
      const currentDoc = await getDoc(doc(db, "implementedSeoTips", docId));
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Build the meta optimization history - preserve metrics from previous meta attempts
      const metaOptimizationHistory = currentData.metaOptimizationHistory || [];
      
      // If we have stats from the current meta, save them to history before resetting
      if (currentData.preStats && currentData.implementedAt) {
        metaOptimizationHistory.push({
          type: "ctr-benchmark",
          optimizedAt: new Date().toISOString(),
          reason: ctrBenchmarkFail 
            ? `CTR Benchmark Fail: Position ${ctrBenchmarkFail.position} with ${ctrBenchmarkFail.impressions} impressions, ${ctrBenchmarkFail.actualClicks} clicks (expected ~${ctrBenchmarkFail.expectedClicks})`
            : "Meta optimization triggered",
          keyword: focusKeyword,
          implementedAt: currentData.implementedAt,
          preStats: currentData.preStats,
          finalStats: currentData.postStats || null,
          postStatsHistory: currentData.postStatsHistory || [],
          // Calculate days tracked
          daysTracked: currentData.implementedAt 
            ? Math.floor((Date.now() - new Date(currentData.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
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
          // Keep the same keyword - don't add to keywordHistory since we're keeping it
          currentKeyword: focusKeyword,
          metaOptimizationReason: ctrBenchmarkFail 
            ? `CTR Benchmark Fail: Position ${ctrBenchmarkFail.position}`
            : "Meta optimization",
        },
        { merge: true }
      );

      // Re-crawl the page to get fresh content for new AI suggestions
      toast.info("🔄 Re-crawling page for fresh meta suggestions...");
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
          console.log("✅ Page re-crawled:", recrawlData);
        } else {
          console.warn("⚠️ Page re-crawl failed, but continuing with meta optimization");
        }
      } catch (recrawlError) {
        console.warn("⚠️ Could not re-crawl page:", recrawlError);
      }

      toast.success(`⚡ Meta optimization started! Your page will appear in AI-Powered SEO Suggestions with new title/description recommendations. Refreshing...`);
      
      // Auto-refresh the page after a short delay so user sees the new suggestions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error starting meta optimization:", error);
      toast.error("Failed to start meta optimization. Please try again.");
    } finally {
      setIsOptimizingMeta(false);
    }
  };

  // Handle waiting another 45 days
  const handleWaitAnotherCycle = async () => {
    if (!user?.id || !pageUrl) return;

    try {
      const docId = createSafeDocId(user.id, pageUrl);
      
      // First, fetch current document to get existing extendedTotalDays
      const currentDoc = await getDoc(doc(db, "implementedSeoTips", docId));
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Calculate new extended total days (add 45 to existing, or start at 90 if first extension)
      const currentTotalDays = currentData.extendedTotalDays || 45;
      const newExtendedTotalDays = currentTotalDays + 45;
      
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + 45);

      await setDoc(
        doc(db, "implementedSeoTips", docId),
        {
          extendedDeadline: newDeadline.toISOString(),
          extendedTotalDays: newExtendedTotalDays, // Track total days target (90, 135, 180, etc.)
          waitingForMoreData: true,
          lastExtendedAt: new Date().toISOString(), // Track when user last clicked "Wait"
        },
        { merge: true }
      );

      setExtendedDeadline(newDeadline);
      setWaitAnotherCycle(true);
      toast.success(`Extended tracking to ${newExtendedTotalDays} total days. We'll gather more data!`);
    } catch (error) {
      console.error("Error extending deadline:", error);
      toast.error("Failed to extend deadline. Please try again.");
    }
  };

  const cleanUrl = pageUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 overflow-hidden">
        {/* Header */}
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="text-left">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                🎯 Time to Pivot: {cleanUrl}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {focusKeyword ? `Current keyword: "${focusKeyword}"` : "No focus keyword set"}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {/* Explanation */}
            <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                Your page has been tracking for 45+ days but doesn&apos;t meet Content Audit criteria yet:
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
                {pivotReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            {/* AI Recommendation */}
            <div className={`rounded-lg p-4 border-2 ${
              recommendation.action === "wait" 
                ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700" 
                : recommendation.action === "pivot"
                ? "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700"
                : recommendation.action === "optimize-meta"
                ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700"
                : "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700"
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{recommendation.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-sm font-semibold ${
                      recommendation.action === "wait"
                        ? "text-green-800 dark:text-green-200"
                        : recommendation.action === "pivot"
                        ? "text-purple-800 dark:text-purple-200"
                        : recommendation.action === "optimize-meta"
                        ? "text-red-800 dark:text-red-200"
                        : "text-blue-800 dark:text-blue-200"
                    }`}>
                      {recommendation.action === "wait" && "🎯 Recommended: Wait Another 45 Days"}
                      {recommendation.action === "pivot" && "🔄 Recommended: Select a New Keyword"}
                      {recommendation.action === "optimize-meta" && "⚡ Recommended: Optimize Meta Title & Description Only"}
                      {recommendation.action === "either" && "⚖️ Either Option Works"}
                    </span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                      recommendation.confidence === "high"
                        ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                        : recommendation.confidence === "medium"
                        ? "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}>
                      {recommendation.confidence} confidence
                    </span>
                  </div>
                  <p className={`text-sm ${
                    recommendation.action === "wait"
                      ? "text-green-700 dark:text-green-300"
                      : recommendation.action === "pivot"
                      ? "text-purple-700 dark:text-purple-300"
                      : recommendation.action === "optimize-meta"
                      ? "text-red-700 dark:text-red-300"
                      : "text-blue-700 dark:text-blue-300"
                  }`}>
                    {recommendation.reason}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons - Initial State */}
            {!showKeywordSelection && (
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                {/* CTR Benchmark Fail - Show "Optimize Meta Only" button prominently */}
                {ctrBenchmarkFail && (
                  <Button
                    onClick={handleOptimizeMetaOnly}
                    disabled={isOptimizingMeta}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
                  >
                    {isOptimizingMeta ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {isOptimizingMeta ? "Optimizing..." : "Optimize Meta Only"}
                  </Button>
                )}
                
                {!waitAnotherCycle ? (
                  <Button
                    variant="outline"
                    onClick={handleWaitAnotherCycle}
                    className="flex items-center gap-2 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    <Clock className="h-4 w-4" />
                    Wait Another 45 Days
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-3 py-2 rounded-md">
                    <Clock className="h-4 w-4" />
                    Extended until {extendedDeadline?.toLocaleDateString()}
                  </div>
                )}
                <Button
                  onClick={handleOpenKeywordSelection}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Select New Focus Keyword
                </Button>
              </div>
            )}

            {/* Keyword History */}
            {keywordHistory.length > 0 && (
              <div className="border-t border-amber-200 dark:border-amber-800 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Previously Tried Keywords</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywordHistory.map((item, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 rounded bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 line-through opacity-60"
                      title={`Tested on ${new Date(item.testedAt).toLocaleDateString()}`}
                    >
                      {item.keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keyword Selection Section - Shown after clicking "Select a New Focus Keyword" */}
            {showKeywordSelection && (
              <>
                {/* Current Ranking Keywords */}
                <div className="border-t border-amber-200 dark:border-amber-800 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Current Ranking Keywords
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
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
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
                                    : "bg-white dark:bg-gray-800/50 border-amber-200 dark:border-amber-800 hover:border-blue-400 dark:hover:border-blue-600"
                              }`}
                              onClick={() => !isSaved && handleSelectKeyword(kw.keyword, "gsc-existing")}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{kw.keyword}</p>
                                <p className="text-xs text-muted-foreground">
                                  {kw.impressions} impressions • {kw.clicks} clicks • Pos. {Math.round(kw.position || 0)}
                                </p>
                              </div>
                              {isSaved ? (
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
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

                  {/* Generate Hybrid Keywords Button - Shows with the keyword list */}
                  <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                      Or generate AI-powered hybrid keywords that combine your page content with ranking data:
                    </p>
                    <Button
                      onClick={handleGenerateHybridKeywords}
                      disabled={loadingHybridKeywords}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
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
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                      Select one of these AI-generated keywords to target:
                    </p>
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
                              {kw.hybridSource && (
                                <p className="text-xs text-muted-foreground">
                                  Combined with: &quot;{kw.hybridSource}&quot;
                                </p>
                              )}
                            </div>
                            {isSaved ? (
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Save New Focus Keyword
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelPendingKeyword}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default PivotOptionsPanel;
