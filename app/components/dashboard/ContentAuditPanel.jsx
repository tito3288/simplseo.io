"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getPageContent } from "../../lib/pageScraper";
import { useAuth } from "../../contexts/AuthContext";
import SquashBounceLoader from "../ui/squash-bounce-loader";
import { toast } from "sonner";

const ContentAuditPanel = ({ pageUrl, pageData }) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const cleanUrl = pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

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
        {!auditResult ? (
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
                  <SquashBounceLoader size="sm" className="mr-2" />
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
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Overall Content Score</h4>
                {getScoreBadge(auditResult.contentScore)}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${auditResult.contentScore}%` }}
                ></div>
              </div>
            </div>

            {/* Detailed Analysis */}
            {isExpanded && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Content Analysis</h4>
                
                {/* Content Length */}
                <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <h5 className="font-medium">Content Length</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.contentLength.value.toLocaleString()} characters
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.contentLength.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.contentLength.score}/100
                  </Badge>
                </div>

                {/* Readability */}
                <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <h5 className="font-medium">Readability</h5>
                    <p className="text-sm text-muted-foreground">
                      Flesch-Kincaid: {auditResult.analysis.readability.value.toFixed(1)}
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.readability.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.readability.score}/100
                  </Badge>
                </div>

                {/* Heading Structure */}
                <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <h5 className="font-medium">Heading Structure</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.headingStructure.value.totalHeadings} headings
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.headingStructure.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.headingStructure.score}/100
                  </Badge>
                </div>

                {/* Title Optimization */}
                <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <h5 className="font-medium">Title Optimization</h5>
                    <p className="text-sm text-muted-foreground">
                      {auditResult.analysis.titleOptimization.value.length} characters
                    </p>
                  </div>
                  <Badge variant={auditResult.analysis.titleOptimization.status === 'excellent' ? 'default' : 'secondary'}>
                    {auditResult.analysis.titleOptimization.score}/100
                  </Badge>
                </div>

                {/* Meta Description */}
                <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <h5 className="font-medium">Meta Description</h5>
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
                    <h4 className="font-medium text-gray-900 mb-3">Improvement Suggestions</h4>
                    <div className="space-y-3">
                      {auditResult.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-blue-900">{suggestion.title}</h5>
                            {getPriorityBadge(suggestion.priority)}
                          </div>
                          <p className="text-sm text-blue-700 mb-2">{suggestion.description}</p>
                          <p className="text-sm text-blue-600 font-medium">Action: {suggestion.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={generateAiSuggestions}
                    disabled={isGeneratingSuggestions || !auditResult}
                    variant="outline"
                    size="sm"
                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  >
                    {isGeneratingSuggestions ? (
                      <>
                        <SquashBounceLoader size="sm" className="mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Get AI Suggestions
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={runContentAudit}
                    variant="outline"
                    size="sm"
                  >
                    Refresh Analysis
                  </Button>
                </div>

                {/* AI Suggestions Section */}
                {aiSuggestions && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-green-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      AI Improvement Suggestions
                    </h4>
                    <div className="space-y-4">
                      {aiSuggestions.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-green-900">{suggestion.title}</h5>
                            {getPriorityBadge(suggestion.priority)}
                          </div>
                          <p className="text-sm text-green-700 mb-3">{suggestion.description}</p>
                          <div className="bg-white p-3 rounded border border-green-100">
                            <h6 className="text-xs font-medium text-green-800 mb-2">AI Recommendation:</h6>
                            <p className="text-sm text-green-700">{suggestion.aiRecommendation}</p>
                          </div>
                          {suggestion.examples && (
                            <div className="mt-3 bg-white p-3 rounded border border-green-100">
                              <h6 className="text-xs font-medium text-green-800 mb-2">Examples:</h6>
                              <ul className="text-sm text-green-700 space-y-1">
                                {suggestion.examples.map((example, exampleIdx) => (
                                  <li key={exampleIdx} className="flex items-start gap-2">
                                    <span className="text-green-500 mt-1">•</span>
                                    <span>{String(example || '')}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {suggestion.beforeAfter && suggestion.beforeAfter.length > 0 && (
                            <div className="mt-3 bg-white p-3 rounded border border-green-100">
                              <h6 className="text-xs font-medium text-green-800 mb-2">Specific Changes:</h6>
                              <div className="space-y-3">
                                {suggestion.beforeAfter.map((change, changeIdx) => (
                                  <div key={changeIdx} className="space-y-2">
                                    <div className="bg-red-50 p-2 rounded border border-red-200">
                                      <h6 className="text-xs font-medium text-red-800 mb-1">BEFORE:</h6>
                                      <p className="text-xs text-red-700 font-mono">{String(change.before || '')}</p>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded border border-green-200">
                                      <h6 className="text-xs font-medium text-green-800 mb-1">AFTER:</h6>
                                      <p className="text-xs text-green-700 font-mono">{String(change.after || '')}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ContentAuditPanel;
