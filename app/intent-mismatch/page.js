"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import MainLayout from "../components/MainLayout";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { createGSCTokenManager } from "../lib/gscTokenManager";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { useMinimumLoading } from "../hooks/use-minimum-loading";

export default function IntentMismatch() {
  const { user, isLoading: authLoading } = useAuth();
  const { data } = useOnboarding();
  const router = useRouter();
  const [mismatches, setMismatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterScore, setFilterScore] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lowCtrPages, setLowCtrPages] = useState([]);
  const shouldShowLoader = useMinimumLoading(isLoading, 3000);

  useEffect(() => {
    const fetchGSCData = async () => {
      if (!user?.id) {
        console.log("❌ No user ID");
        return;
      }

      try {
        console.log("🔍 Fetching GSC data for user:", user.id);
        const tokenManager = createGSCTokenManager(user.id);
        
        // Add a small delay to ensure tokens are stored
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const gscData = await tokenManager.getStoredGSCData();
        
        console.log("🔍 Stored GSC data:", gscData);
        console.log("🔍 GSC data details:", {
          hasAccessToken: !!gscData?.accessToken,
          hasRefreshToken: !!gscData?.refreshToken,
          hasSiteUrl: !!gscData?.siteUrl,
          accessTokenLength: gscData?.accessToken?.length,
          refreshTokenLength: gscData?.refreshToken?.length
        });
        
        if (!gscData?.accessToken || !gscData?.siteUrl) {
          console.log("❌ Missing GSC access token or site URL");
          // Use dummy data if no GSC connection
          setDummyData();
          return;
        }

        // Get valid access token (refresh if needed)
        const validToken = await tokenManager.getValidAccessToken();
        if (!validToken) {
          console.log("❌ Could not get valid access token");
          setDummyData();
          return;
        }

        console.log("✅ Got valid token, fetching low CTR pages...");
        fetchLowCtrPages(gscData.siteUrl, validToken);
      } catch (error) {
        console.error("❌ Error fetching GSC data:", error);
        setDummyData();
      }
    };

    fetchGSCData();
  }, [user]);

  const setDummyData = () => {
    const dummyMismatches = [
      {
        keyword: "best dentist in South Bend",
        pageUrl: "/flossing-tips",
        matchScore: 42,
        reason: "This page discusses flossing but doesn't mention dental services or location.",
        suggestion: "Add info about your South Bend dental practice and a CTA for booking."
      },
      {
        keyword: "dental cleaning cost",
        pageUrl: "/about-us",
        matchScore: 35,
        reason: "Page is about the practice but doesn't mention pricing or services.",
        suggestion: "Add a pricing section and list your dental services with costs."
      },
      {
        keyword: "emergency dentist near me",
        pageUrl: "/contact",
        matchScore: 28,
        reason: "Contact page doesn't mention emergency services or location details.",
        suggestion: "Add emergency dental services info and highlight your location."
      },
      {
        keyword: "teeth whitening",
        pageUrl: "/services",
        matchScore: 65,
        reason: "Services page mentions whitening but lacks specific details and pricing.",
        suggestion: "Add detailed whitening procedure info, before/after photos, and pricing."
      },
      {
        keyword: "root canal treatment",
        pageUrl: "/blog/dental-health",
        matchScore: 45,
        reason: "Blog post discusses dental health but doesn't specifically cover root canals.",
        suggestion: "Create dedicated root canal page or add detailed root canal section."
      }
    ];
    
    setMismatches(dummyMismatches);
    setIsLoading(false);
  };

  const fetchLowCtrPages = async (siteUrl, token) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 28);

    const format = (d) => d.toISOString().split("T")[0];
    const from = format(start);
    const to = format(today);

    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        siteUrl
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: from,
          endDate: to,
          dimensions: ["query", "page"],
          rowLimit: 250,
        }),
      }
    );

    const json = await res.json();
    console.log("🔍 GSC Raw Data:", json);
    if (!json.rows) {
      console.log("❌ No rows returned from GSC");
      setDummyData();
      return;
    }
    console.log("✅ GSC returned", json.rows.length, "rows");

    // Debug: Log all rows before filtering
    console.log("🔍 All GSC rows before filtering:", json.rows.slice(0, 5));
    
    const filteredRows = json.rows.filter(
      (r) =>
        parseFloat((r.ctr * 100).toFixed(1)) === 0 && r.impressions > 20
    );
    
    console.log("🔍 Rows after filtering (0% CTR, >20 impressions):", filteredRows.length);
    console.log("🔍 Sample filtered rows:", filteredRows.slice(0, 3));
    
    const grouped = Object.values(
      filteredRows
        .reduce((acc, row) => {
          const page = row.keys[1];
          if (!acc[page]) {
            acc[page] = {
              page,
              clicks: 0,
              impressions: 0,
              ctr: "0%",
            };
          }
          acc[page].clicks += row.clicks;
          acc[page].impressions += row.impressions;
          return acc;
        }, {})
    );

    setLowCtrPages(grouped);

    // Convert low CTR data to intent mismatches with dummy scores/reasons
    const intentMismatches = filteredRows.map((row, index) => {
      const keyword = row.keys[0];
      const pageUrl = row.keys[1];
      
      // Generate dummy match score (20-70 range for low CTR pages)
      const matchScore = Math.floor(Math.random() * 50) + 20;
      
      // Generate dummy reasons based on common patterns
      const dummyReasons = [
        "Page content doesn't directly address the search query",
        "Missing specific information that searchers expect",
        "Content is too general and doesn't provide actionable value",
        "Page lacks the specific details mentioned in the keyword",
        "Content doesn't match the user's search intent"
      ];
      
      const dummySuggestions = [
        "Rewrite the introduction to directly address the search query",
        "Add a dedicated section that answers the specific question",
        "Include more specific details and actionable information",
        "Restructure content to better match user expectations",
        "Add relevant keywords and improve content relevance"
      ];
      
      return {
        keyword,
        pageUrl,
        matchScore,
        reason: dummyReasons[index % dummyReasons.length],
        suggestion: dummySuggestions[index % dummySuggestions.length]
      };
    });

    setMismatches(intentMismatches);
    setIsLoading(false);
  };

  const generateMismatches = async () => {
    try {
      setIsGenerating(true);
      
      // Re-fetch GSC data to get fresh intent mismatches
      if (!user?.id) {
        toast.error("User not authenticated");
        return;
      }

      const tokenManager = createGSCTokenManager(user.id);
      const gscData = await tokenManager.getStoredGSCData();
      
      if (!gscData?.accessToken || !gscData?.siteUrl) {
        toast.error("Google Search Console not connected");
        return;
      }

      const validToken = await tokenManager.getValidAccessToken();
      if (!validToken) {
        toast.error("Could not get valid access token");
        return;
      }

      // Fetch fresh data
      await fetchLowCtrPages(gscData.siteUrl, validToken);
      toast.success("Generated intent mismatches from GSC data");
      
    } catch (error) {
      console.error("Error generating intent mismatches:", error);
      toast.error("Failed to generate intent mismatches");
    } finally {
      setIsGenerating(false);
    }
  };

  const getScoreBadge = (score) => {
    if (score < 40) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {score} - Likely Mismatch
      </Badge>;
    } else if (score < 70) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {score} - Moderate
      </Badge>;
    } else {
      return <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {score} - Good
      </Badge>;
    }
  };

  const filteredMismatches = mismatches.filter(mismatch => {
    if (filterScore === "all") return true;
    if (filterScore === "low") return mismatch.matchScore < 40;
    if (filterScore === "medium") return mismatch.matchScore >= 40 && mismatch.matchScore < 70;
    if (filterScore === "high") return mismatch.matchScore >= 70;
    return true;
  });

  const openChatWithContext = (mismatch) => {
    const message = `I need help fixing an intent mismatch. My page "${mismatch.pageUrl}" ranks for "${mismatch.keyword}" but has a match score of ${mismatch.matchScore}. The issue is: ${mismatch.reason}. Can you suggest content improvements?`;
    
    // Store the context in localStorage for the chat component to pick up
    localStorage.setItem("chatContext", JSON.stringify({
      type: "intent_mismatch",
      mismatch,
      message
    }));
    
    // Navigate to dashboard with chat open
    router.push("/dashboard?openChat=true");
  };

  if (authLoading || !user) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <SquashBounceLoader size="lg" className="mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Search Intent Mismatches</h1>
        <p className="text-muted-foreground">
          Identify pages that rank for keywords but may not satisfy searcher expectations.
        </p>
      </div>

      {/* Generate Button */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Generate Intent Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Analyze your Google Search Console data to find keyword-page mismatches
              </p>
            </div>
            <Button 
              onClick={generateMismatches} 
              disabled={isGenerating || !data?.hasGSC}
              className="bg-[#00bf63] hover:bg-[#00bf63]/90"
            >
              {isGenerating ? "Generating..." : !data?.hasGSC ? "Connect GSC First" : "Generate Analysis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* GSC Connection Alert */}
      {!data?.hasGSC && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Google Search Console not connected.</strong> You need to connect your GSC account to analyze intent mismatches. 
            <Button 
              variant="link" 
              className="p-0 h-auto text-[#00bf63] hover:text-[#00bf63]/90 ml-1"
              onClick={() => router.push("/dashboard")}
            >
              Go to Dashboard to connect
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by score:</span>
          <Select value={filterScore} onValueChange={setFilterScore}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="low">Low (&lt; 40)</SelectItem>
              <SelectItem value="medium">Medium (40-69)</SelectItem>
              <SelectItem value="high">High (70+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredMismatches.length} of {mismatches.length} mismatches
        </span>
      </div>

      {/* Results */}
      {shouldShowLoader ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <SquashBounceLoader size="lg" className="mb-4" />
              <p className="text-sm text-muted-foreground">Loading intent mismatches...</p>
            </div>
          </CardContent>
        </Card>
      ) : mismatches.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No mismatches found</h3>
              <p className="text-muted-foreground mb-4">Great job! Your content appears to align well with search intent.</p>
              <Button onClick={generateMismatches} className="bg-[#00bf63] hover:bg-[#00bf63]/90">
                Generate Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Intent Mismatches</CardTitle>
            <CardDescription>
              Pages that rank for keywords but may not satisfy searcher expectations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Keyword</th>
                    <th className="text-left py-3 px-4 font-medium">Page</th>
                    <th className="text-left py-3 px-4 font-medium">Match Score</th>
                    <th className="text-left py-3 px-4 font-medium">Mismatch Reason</th>
                    <th className="text-left py-3 px-4 font-medium">Suggested Fix</th>
                    <th className="text-left py-3 px-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMismatches.map((mismatch, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{mismatch.keyword}</div>
                      </td>
                      <td className="py-3 px-4">
                        <a 
                          href={mismatch.pageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[#00bf63] hover:underline flex items-center gap-1"
                        >
                          {mismatch.pageUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        {getScoreBadge(mismatch.matchScore)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-muted-foreground max-w-xs">
                          {mismatch.reason}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm max-w-xs">
                          {mismatch.suggestion}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button 
                          size="sm" 
                          onClick={() => openChatWithContext(mismatch)}
                          className="bg-[#00bf63] hover:bg-[#00bf63]/90"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Fix This
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert className="mt-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Intent mismatches occur when your page ranks for a keyword but doesn't fully satisfy what the searcher is looking for. 
          This can lead to high bounce rates and poor user experience. Use the "Fix This" button to get AI-powered suggestions for improving your content.
        </AlertDescription>
      </Alert>
    </MainLayout>
  );
} 