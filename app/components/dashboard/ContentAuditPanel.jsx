"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, Sparkles, Loader2, BarChart3, Search, MousePointerClick, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { getPageContent } from "../../lib/pageScraper";
import { useAuth } from "../../contexts/AuthContext";
import { saveContentAuditResult, getContentAuditResult, saveAiSuggestions, getAiSuggestions } from "../../lib/firestoreHelpers";
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

const ContentAuditPanel = ({ pageUrl, pageData, implementationData }) => {
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
  const [pageFocusKeyword, setPageFocusKeyword] = useState(null);
  const [focusKeywordSource, setFocusKeywordSource] = useState(null); // "ai-generated" or "gsc-existing"

  const cleanUrl = pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

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
        {isLoadingSavedData ? (
          <div className="text-center py-4">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading saved data...</p>
          </div>
        ) : !auditResult ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Analyze content quality, readability, and structure to improve SEO performance.
            </p>
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
          </div>
        ) : (
          <>
            {/* Overall Score */}
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

                {/* Action Button */}
                <div className="pt-4">
                  <Button 
                    onClick={generateAiSuggestions}
                    disabled={isGeneratingSuggestions || !auditResult}
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                  >
                    {isGeneratingSuggestions ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Get AI Suggestions
                      </>
                    )}
                  </Button>
                </div>

                {/* AI Suggestions Section */}
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
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ContentAuditPanel;
