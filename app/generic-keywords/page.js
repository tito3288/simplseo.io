"use client";

import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import MainLayout from "../components/MainLayout";
import { createGSCTokenManager } from "../lib/gscTokenManager";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, MapPin, Clock, Wrench, Search, Filter, TrendingUp, AlertTriangle, ChevronDown, CheckCircle, ExternalLink } from "lucide-react";
import { useOnboarding } from "../contexts/OnboardingContext";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { useMinimumLoading } from "../hooks/use-minimum-loading";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function GenericKeywordsPage() {
  const { user, isLoading } = useAuth();
  const { data } = useOnboarding();
  const [opportunities, setOpportunities] = useState([]);
  const [cannibalizationAnalysis, setCannibalizationAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);
  const shouldShowLoader = useMinimumLoading(loading, 2000);
  const [openCategories, setOpenCategories] = useState({});
  const [createdOpportunities, setCreatedOpportunities] = useState([]);
  const [successStories, setSuccessStories] = useState([]);
  const [gscKeywords, setGscKeywords] = useState([]);
  const [markAsCreatedDialog, setMarkAsCreatedDialog] = useState({ open: false, opportunity: null });
  const [markAsCreatedUrl, setMarkAsCreatedUrl] = useState("");
  const [isMarkingAsCreated, setIsMarkingAsCreated] = useState(false);

  // Helper function to get display name for page types
  const getPageTypeDisplayName = (pageType) => {
    const typeMap = {
      'homepage': 'Homepage',
      'oil-change': 'Oil Change',
      'detailing': 'Car Detailing',
      'location': 'Location',
      'landing-page': 'Landing Page',
      'faq': 'FAQ',
      'coupon': 'Coupon/Deal',
      'service': 'Service'
    };
    return typeMap[pageType] || 'Service';
  };

  useEffect(() => {
    if (user?.id && data?.businessType) {
      // Use the same approach as dashboard - get GSC data from the dashboard's context
      fetchGenericOpportunitiesFromDashboard();
      fetchCreatedOpportunities();
    }
  }, [user?.id, data?.businessType]);

  // Fetch created opportunities
  const fetchCreatedOpportunities = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/content-opportunities/mark-created?userId=${encodeURIComponent(user.id)}`);
      const result = await response.json();
      
      if (result.success) {
        setCreatedOpportunities(result.opportunities || []);
      }
    } catch (error) {
      console.error("Error fetching created opportunities:", error);
    }
  };

  // Fetch GSC keywords for success stories matching
  useEffect(() => {
    const fetchGSCDataForSuccessStories = async () => {
      if (!user?.id || !data?.gscProperty) return;

      try {
        const tokenManager = createGSCTokenManager(user.id);
        const gscData = await tokenManager.getStoredGSCData();
        
        if (!gscData?.refreshToken || !gscData?.siteUrl) {
          return;
        }

        const validToken = await tokenManager.getValidAccessToken();
        if (!validToken) {
          return;
        }

        const keywords = await fetchGSCKeywords(gscData.siteUrl, validToken);
        setGscKeywords(keywords || []);
      } catch (error) {
        console.error("Error fetching GSC data for success stories:", error);
      }
    };

    fetchGSCDataForSuccessStories();
  }, [user?.id, data?.gscProperty]);

  // Match created opportunities with GSC data to find success stories
  useEffect(() => {
    if (createdOpportunities.length === 0 || gscKeywords.length === 0) {
      setSuccessStories([]);
      return;
    }

    const stories = createdOpportunities
      .filter(opp => {
        // Check if the page URL exists in GSC data
        return gscKeywords.some(kw => {
          // Normalize URLs for comparison (remove trailing slashes, etc.)
          const normalizeUrl = (url) => {
            try {
              const u = new URL(url);
              return u.pathname === '/' ? u.origin : u.origin + u.pathname.replace(/\/$/, '');
            } catch {
              return url.replace(/\/$/, '');
            }
          };
          
          const oppUrl = normalizeUrl(opp.pageUrl);
          const kwUrl = normalizeUrl(kw.page);
          
          return oppUrl === kwUrl || kwUrl.includes(oppUrl) || oppUrl.includes(kwUrl);
        });
      })
      .map(opp => {
        // Find matching GSC keyword data
        const normalizeUrl = (url) => {
          try {
            const u = new URL(url);
            return u.pathname === '/' ? u.origin : u.origin + u.pathname.replace(/\/$/, '');
          } catch {
            return url.replace(/\/$/, '');
          }
        };
        
        const matchingKw = gscKeywords.find(kw => {
          const oppUrl = normalizeUrl(opp.pageUrl);
          const kwUrl = normalizeUrl(kw.page);
          return oppUrl === kwUrl || kwUrl.includes(oppUrl) || oppUrl.includes(kwUrl);
        });

        if (matchingKw) {
          const createdAt = new Date(opp.createdAt);
          const now = new Date();
          const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

          return {
            ...opp,
            position: matchingKw.position,
            impressions: matchingKw.impressions,
            clicks: matchingKw.clicks,
            ctr: matchingKw.ctr,
            daysSinceCreated,
            gscPage: matchingKw.page,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by impressions (descending) then clicks (descending)
        if (b.impressions !== a.impressions) {
          return b.impressions - a.impressions;
        }
        return b.clicks - a.clicks;
      });

    setSuccessStories(stories);
  }, [createdOpportunities, gscKeywords]);

  const fetchGSCKeywords = async (siteUrl, token) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 28); // 28 days like Low CTR page

    const format = (d) => d.toISOString().split("T")[0];
    const from = format(start);
    const to = format(today);

    console.log(`🔍 Fetching GSC data from ${from} to ${to} for ${siteUrl}`);

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
          rowLimit: 1000, // Increased from 100 to get more keywords
        }),
      }
    );

    const json = await res.json();
    console.log("🔍 GSC Raw Data:", json);
    
    if (!json.rows) {
      console.log("❌ No rows returned from GSC");
      return [];
    }
    
    console.log("✅ GSC returned", json.rows.length, "rows");

    // Format the data the same way as the dashboard
    const formatted = json.rows.map((row) => ({
      keyword: row.keys[0].replace(/^\[|\]$/g, ""),
      page: row.keys[1],
      clicks: row.clicks,
      impressions: row.impressions,
      position: Math.round(row.position),
      ctr: `${(row.ctr * 100).toFixed(1)}%`,
    }));

    return formatted;
  };

  const fetchGenericOpportunitiesFromDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("🔍 Fetching generic opportunities using dashboard approach...");
      
      // Call the API directly with empty GSC keywords - the API will generate new ones
      const requestBody = {
        gscKeywords: [], // Empty array - let API generate new keywords
        businessType: data.businessType,
        customBusinessType: data.customBusinessType,
        businessLocation: data.businessLocation,
        websiteUrl: data.websiteUrl,
        userId: user.id, // Add userId for caching
      };
      
      console.log("🔍 API request body:", {
        gscKeywordsCount: requestBody.gscKeywords?.length || 0,
        businessType: requestBody.businessType,
        businessLocation: requestBody.businessLocation,
        websiteUrl: requestBody.websiteUrl
      });

      const response = await fetch("/api/generic-keywords/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      
      console.log("🔍 Generic opportunities result:", result);
      console.log("🔍 Sample opportunity with page data:", result.opportunities?.[0]);
      console.log("🔍 Sample opportunity actionItems:", result.opportunities?.[0]?.actionItems);
      
      if (result.opportunities && result.opportunities.length > 0) {
        setOpportunities(result.opportunities);
        setCannibalizationAnalysis(result.cannibalizationAnalysis || null);
        setFromCache(result.fromCache || false);
        setCacheAge(result.cacheAge || null);
      } else {
        setError("No generic opportunities found");
      }
    } catch (err) {
      console.error("❌ Failed to fetch generic keywords:", err);
      setError(`Failed to load generic opportunities: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getOpportunityIcon = (category) => {
    switch (category) {
      case 'service_based':
        return <Wrench className="w-4 h-4" />;
      case 'location_based':
        return <MapPin className="w-4 h-4" />;
      case 'problem_solving':
        return <Search className="w-4 h-4" />;
      case 'comparison':
        return <TrendingUp className="w-4 h-4" />;
      case 'trending_search':
        return <Clock className="w-4 h-4" />;
      case 'long_tail':
        return <Target className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority) => {
    if (priority >= 8) return "bg-red-100 text-red-800";
    if (priority >= 6) return "bg-orange-100 text-orange-800";
    if (priority >= 4) return "bg-yellow-100 text-yellow-800";
    return "bg-blue-100 text-blue-800";
  };

  const getDifficultyColor = (difficulty) => {
    if (difficulty === 'Easy') return "bg-green-100 text-green-800";
    if (difficulty === 'Medium') return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getVolumeColor = (volume) => {
    if (volume === 'High') return "bg-green-100 text-green-800";
    if (volume === 'Medium-High') return "bg-blue-100 text-blue-800";
    if (volume === 'Medium') return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const searchVolumeRank = {
    "Very High": 5,
    "High": 4,
    "Medium-High": 3,
    "Medium": 2,
    "Medium-Low": 1,
    "Low": 0,
  };

  const difficultyRank = {
    Easy: 2,
    Medium: 1,
    Hard: 0,
  };

  const categoryLabels = {
    location_based: "Location-Based Opportunities",
    service_based: "Service-Based Opportunities",
    comparison: "Comparison Opportunities",
    problem_solving: "Problem-Solving Opportunities",
    trending_search: "Trending & Seasonal Ideas",
    long_tail: "Long-Tail Opportunities",
  };

  const sortedOpportunities = useMemo(() => {
    const ranked = [...opportunities];
    ranked.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      const volumeDiff =
        (searchVolumeRank[b.searchVolume] || -1) -
        (searchVolumeRank[a.searchVolume] || -1);
      if (volumeDiff !== 0) return volumeDiff;

      return (difficultyRank[a.difficulty] || 0) - (difficultyRank[b.difficulty] || 0);
    });
    return ranked;
  }, [opportunities]);

  const topOpportunities = useMemo(
    () => sortedOpportunities.slice(0, 3),
    [sortedOpportunities]
  );

  const filteredOpportunities = useMemo(() => {
    return sortedOpportunities.filter((opp) => {
      if (categoryFilter !== "all" && opp.category !== categoryFilter) {
        return false;
      }

      if (priorityFilter === "high" && (opp.priority || 0) < 8) return false;
      if (
        priorityFilter === "medium" &&
        ((opp.priority || 0) < 6 || (opp.priority || 0) > 7)
      )
        return false;
      if (priorityFilter === "lower" && (opp.priority || 0) >= 6) return false;

      return true;
    });
  }, [sortedOpportunities, categoryFilter, priorityFilter]);

  const groupedOpportunities = useMemo(() => {
    return filteredOpportunities.reduce((acc, opportunity) => {
      const category = opportunity.category || "other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(opportunity);
      return acc;
    }, {});
  }, [filteredOpportunities]);

  const categoryOrder = [
    "location_based",
    "service_based",
    "problem_solving",
    "comparison",
    "trending_search",
    "long_tail",
    "other",
  ];

  useEffect(() => {
    setOpenCategories((prev) => {
      const next = { ...prev };
      Object.keys(groupedOpportunities).forEach((category) => {
        if (typeof next[category] === "undefined") {
          next[category] = categoryFilter === "all";
        }
      });
      return next;
    });
  }, [groupedOpportunities, categoryFilter]);

  const filterOptions = [
    { value: "all", label: "All Opportunities", count: sortedOpportunities.length },
    {
      value: "location_based",
      label: "Location-Based",
      count: sortedOpportunities.filter((o) => o.category === "location_based").length,
    },
    {
      value: "service_based",
      label: "Service-Based",
      count: sortedOpportunities.filter((o) => o.category === "service_based").length,
    },
    {
      value: "comparison",
      label: "Comparison",
      count: sortedOpportunities.filter((o) => o.category === "comparison").length,
    },
    {
      value: "problem_solving",
      label: "Problem-Solving",
      count: sortedOpportunities.filter((o) => o.category === "problem_solving").length,
    },
    {
      value: "trending_search",
      label: "Trending Search",
      count: sortedOpportunities.filter((o) => o.category === "trending_search").length,
    },
    {
      value: "long_tail",
      label: "Long-Tail",
      count: sortedOpportunities.filter((o) => o.category === "long_tail").length,
    },
  ];

  const priorityFilters = [
    { value: "all", label: "All Priorities" },
    { value: "high", label: "High (8-10)" },
    { value: "medium", label: "Medium (6-7)" },
    { value: "lower", label: "Lower (≤5)" },
  ];

  const renderOpportunityCard = (opportunity, key, { isFeatured = false } = {}) => (
    <Card
      key={key}
      className={cn(
        "hover:shadow-md transition-shadow border-l-4 border-l-blue-200 dark:border-l-blue-800",
        isFeatured && "border-l-primary/60 bg-primary/5 dark:bg-primary/10"
      )}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {getOpportunityIcon(opportunity.category)}
              <div>
                <h3 className="font-semibold text-lg leading-tight">
                  {opportunity.keyword}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {categoryLabels[opportunity.category] || "Growth Opportunity"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Badge className={getPriorityColor(opportunity.priority)}>
                Priority {opportunity.priority}
              </Badge>
              <Badge className={getDifficultyColor(opportunity.difficulty)}>
                {opportunity.difficulty}
              </Badge>
              <Badge className={getVolumeColor(opportunity.searchVolume)}>
                {opportunity.searchVolume} Volume
              </Badge>
            </div>
          </div>

          {opportunity.contentIdea && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Content Strategy
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {opportunity.contentIdea}
                  </p>
                </div>
              </div>
            </div>
          )}

          {opportunity.actionItems?.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-2">
                    Recommended Actions
                  </p>
                  <ul className="text-sm text-foreground space-y-1">
                    {opportunity.actionItems.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {opportunity.potential} potential
            </span>
            <span>•</span>
            <span>Difficulty: {opportunity.difficulty}</span>
            <span>•</span>
            <span>
              Suggested for:{" "}
              {categoryLabels[opportunity.category] || "Additional"}
            </span>
          </div>

          {/* Mark as Created Button */}
          {!createdOpportunities.some(co => co.keyword.toLowerCase() === opportunity.keyword.toLowerCase()) && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMarkAsCreatedDialog({ open: true, opportunity });
                  setMarkAsCreatedUrl("");
                }}
                className="w-full gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Created
              </Button>
            </div>
          )}

          {/* Show if already created */}
          {createdOpportunities.some(co => co.keyword.toLowerCase() === opportunity.keyword.toLowerCase()) && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Marked as created</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading || !user) return null;

  if (shouldShowLoader) {
    return (
      <MainLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Generic Keyword Opportunities</h1>
          <Button onClick={() => window.history.back()} variant="outline">
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <SquashBounceLoader size="lg" className="mb-4" />
              <p className="text-muted-foreground">Loading generic opportunities...</p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI-Generated Content Opportunities</h1>
          <p className="text-muted-foreground mt-2">
            Discover new keywords and content ideas to expand your reach and attract new customers
          </p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      {/* Dummy Success Story Card - For Preview Only */}
      <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900/20 dark:bg-green-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="w-5 h-5" />
            🎉 Success Stories - Your Pages Are Ranking!
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Pages you created are now appearing in Google Search Console
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Dummy Success Story */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-green-800 dark:text-green-200">
                      best dentist independence
                    </h4>
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                      Ranking
                    </Badge>
                  </div>
                  <a
                    href="https://example.com/best-dentist-independence"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 dark:text-green-300 hover:underline flex items-center gap-1 mb-2"
                  >
                    https://example.com/best-dentist-independence
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-green-700 dark:text-green-300">
                    <span>
                      <strong>Position:</strong> 12
                    </span>
                    <span>
                      <strong>Impressions:</strong> 1,250
                    </span>
                    <span>
                      <strong>Clicks:</strong> 45
                    </span>
                    <span>
                      <strong>CTR:</strong> 3.6%
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Created 7 days ago
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Stories Section */}
      {successStories.length > 0 && (
        <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900/20 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              🎉 Success Stories - Your Pages Are Ranking!
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Pages you created are now appearing in Google Search Console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {successStories.map((story, index) => (
                <div
                  key={story.id || index}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-green-800 dark:text-green-200">
                          {story.keyword}
                        </h4>
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                          Ranking
                        </Badge>
                      </div>
                      <a
                        href={story.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-700 dark:text-green-300 hover:underline flex items-center gap-1 mb-2"
                      >
                        {story.pageUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-green-700 dark:text-green-300">
                        <span>
                          <strong>Position:</strong> {story.position}
                        </span>
                        <span>
                          <strong>Impressions:</strong> {story.impressions.toLocaleString()}
                        </span>
                        <span>
                          <strong>Clicks:</strong> {story.clicks.toLocaleString()}
                        </span>
                        <span>
                          <strong>CTR:</strong> {story.ctr}
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                          Created {story.daysSinceCreated} {story.daysSinceCreated === 1 ? 'day' : 'days'} ago
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyword Cannibalization Analysis */}
      {cannibalizationAnalysis && cannibalizationAnalysis.totalCannibalized > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="w-5 h-5" />
              Keyword Cannibalization Detected
            </CardTitle>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              {cannibalizationAnalysis.summary}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cannibalizationAnalysis.cannibalizedKeywords.slice(0, 6).map((item, index) => (
                  <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200">
                    <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                      &quot;{item.keyword}&quot;
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                      {item.recommendation}
                    </p>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <p>Appears on {item.pages.length} pages:</p>
                      <ul className="list-disc list-inside mt-1">
                        {item.pages.map((page, idx) => (
                          <li key={idx}>
                            {page.page} (Pos: {page.position}, CTR: {page.ctr})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
              {cannibalizationAnalysis.totalCannibalized > 6 && (
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  ... and {cannibalizationAnalysis.totalCannibalized - 6} more cannibalized keywords
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}


      {error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="bg-muted inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
                <Target className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                onClick={fetchGenericOpportunitiesFromDashboard}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {topOpportunities.length > 0 && (
            <Card className="mb-6 border-primary/20 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Start with these 3</CardTitle>
                <CardDescription>
                  Highest-priority ideas right now. Tackle these first for the fastest impact.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topOpportunities.map((opportunity, index) =>
                  renderOpportunityCard(opportunity, `${opportunity.keyword}-featured-${index}`, {
                    isFeatured: true,
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* Filter Options */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={categoryFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(option.value)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    {option.label}
                    <Badge variant="secondary" className="ml-1">
                      {option.count}
                    </Badge>
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {priorityFilters.map((option) => (
                  <Button
                    key={option.value}
                    variant={priorityFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriorityFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              
              {/* Cache Status Indicator */}
              {fromCache && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    Cached data loaded {cacheAge ? `(${cacheAge} hours old)` : ''}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opportunities List */}
          <div className="space-y-6">
            {filteredOpportunities.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      No opportunities match your current filters. Try selecting a different category or widen the priority/difficulty filters.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                {categoryOrder
                  .filter((category) => groupedOpportunities[category]?.length)
                  .map((category) => {
                    const items = groupedOpportunities[category];
                    return (
                      <Collapsible
                        key={category}
                        open={openCategories[category]}
                        onOpenChange={(open) =>
                          setOpenCategories((prev) => ({
                            ...prev,
                            [category]: open,
                          }))
                        }
                      >
                        <div className="rounded-lg border bg-muted/40 dark:bg-muted/20">
                          <CollapsibleTrigger asChild>
                            <button className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold">
                              <span>
                                {categoryLabels[category] || "Additional Opportunities"}
                              </span>
                              <div className="flex items-center gap-3 text-sm">
                                <Badge variant="secondary">{items.length}</Badge>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    openCategories[category] ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-4 pb-4 pt-2 space-y-4">
                            {items.map((opportunity, index) =>
                              renderOpportunityCard(
                                opportunity,
                                `${opportunity.keyword}-${category}-${index}`
                              )
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mark as Created Dialog */}
      <Dialog open={markAsCreatedDialog.open} onOpenChange={(open) => {
        if (!open) {
          setMarkAsCreatedDialog({ open: false, opportunity: null });
          setMarkAsCreatedUrl("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Created</DialogTitle>
            <DialogDescription>
              Enter the URL of the page you created for this keyword. We&apos;ll track when it starts ranking in Google Search Console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">Keyword</Label>
              <Input
                id="keyword"
                value={markAsCreatedDialog.opportunity?.keyword || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pageUrl">
                Page URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pageUrl"
                value={markAsCreatedUrl}
                onChange={(e) => setMarkAsCreatedUrl(e.target.value)}
                placeholder="https://example.com/your-new-page"
                className="font-mono text-sm"
              />
              {markAsCreatedDialog.opportunity && (
                <p className="text-xs text-muted-foreground">
                  💡 Suggested: <code className="bg-muted px-1 rounded">/{markAsCreatedDialog.opportunity.keyword.toLowerCase().replace(/\s+/g, '-')}</code>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMarkAsCreatedDialog({ open: false, opportunity: null });
                setMarkAsCreatedUrl("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!markAsCreatedUrl.trim()) {
                  toast.error("Please enter a URL");
                  return;
                }

                // Validate URL
                let normalizedUrl;
                try {
                  const url = new URL(markAsCreatedUrl);
                  normalizedUrl = url.href;
                  
                  // Validate URL belongs to user's website domain
                  if (data?.websiteUrl) {
                    try {
                      const userUrl = new URL(data.websiteUrl);
                      const userDomain = userUrl.hostname.replace(/^www\./, '');
                      const inputDomain = url.hostname.replace(/^www\./, '');
                      
                      if (userDomain !== inputDomain) {
                        toast.error(`URL must belong to your website domain (${userDomain})`);
                        return;
                      }
                    } catch (domainError) {
                      console.error("Error validating domain:", domainError);
                      // Continue if domain validation fails (user's website URL might be invalid)
                    }
                  }
                } catch (error) {
                  toast.error("Please enter a valid URL (e.g., https://example.com/page)");
                  return;
                }

                setIsMarkingAsCreated(true);
                try {
                  const response = await fetch("/api/content-opportunities/mark-created", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      userId: user.id,
                      keyword: markAsCreatedDialog.opportunity.keyword,
                      pageUrl: normalizedUrl,
                      opportunityId: `${user.id}_${markAsCreatedDialog.opportunity.keyword.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`,
                    }),
                  });

                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to mark as created");
                  }

                  toast.success("Page marked as created!", {
                    description: "We'll track when this page starts ranking in Google Search Console.",
                  });

                  // Refresh created opportunities
                  await fetchCreatedOpportunities();

                  // Close dialog
                  setMarkAsCreatedDialog({ open: false, opportunity: null });
                  setMarkAsCreatedUrl("");
                } catch (error) {
                  console.error("Error marking as created:", error);
                  toast.error("Failed to mark as created", {
                    description: error.message || "Please try again.",
                  });
                } finally {
                  setIsMarkingAsCreated(false);
                }
              }}
              disabled={!markAsCreatedUrl.trim() || isMarkingAsCreated}
            >
              {isMarkingAsCreated ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Created
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
