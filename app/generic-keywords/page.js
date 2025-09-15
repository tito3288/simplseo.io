"use client";

import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
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
import { Target, MapPin, Clock, Wrench, Search, Filter, TrendingUp, AlertTriangle } from "lucide-react";
import { useOnboarding } from "../contexts/OnboardingContext";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { useMinimumLoading } from "../hooks/use-minimum-loading";

export default function GenericKeywordsPage() {
  const { user, isLoading } = useAuth();
  const { data } = useOnboarding();
  const [opportunities, setOpportunities] = useState([]);
  const [cannibalizationAnalysis, setCannibalizationAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);
  const shouldShowLoader = useMinimumLoading(loading, 2000);

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
    }
  }, [user?.id, data?.businessType]);

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

  const filteredOpportunities = filter === 'all' 
    ? opportunities 
    : opportunities.filter(opp => opp.category === filter);

  // No need to group by page for AI-generated content

  const filterOptions = [
    { value: 'all', label: 'All Opportunities', count: opportunities.length },
    { value: 'location_based', label: 'Location-Based', count: opportunities.filter(o => o.category === 'location_based').length },
    { value: 'service_based', label: 'Service-Based', count: opportunities.filter(o => o.category === 'service_based').length },
    { value: 'comparison', label: 'Comparison', count: opportunities.filter(o => o.category === 'comparison').length },
    { value: 'problem_solving', label: 'Problem-Solving', count: opportunities.filter(o => o.category === 'problem_solving').length },
    { value: 'trending_search', label: 'Trending Search', count: opportunities.filter(o => o.category === 'trending_search').length },
    { value: 'long_tail', label: 'Long-Tail', count: opportunities.filter(o => o.category === 'long_tail').length }
  ];

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
                      "{item.keyword}"
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
                onClick={fetchGenericOpportunities} 
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
          {/* Filter Options */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(option.value)}
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
                      No opportunities found for this filter
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOpportunities.map((opportunity, index) => (
                <Card key={`${opportunity.keyword}-${index}`} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-200 dark:border-l-blue-800">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getOpportunityIcon(opportunity.category)}
                        <div>
                          <h3 className="font-semibold text-lg">{opportunity.keyword}</h3>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(opportunity.priority)}>
                          Priority {opportunity.priority}
                        </Badge>
                        <Badge className={getDifficultyColor(opportunity.difficulty)}>
                          {opportunity.difficulty}
                        </Badge>
                      </div>
                    </div>

                    {opportunity.contentIdea && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
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



                    {/* Action Items */}
                    {opportunity.actionItems && opportunity.actionItems.length > 0 ? (
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg mb-4">
                        <div className="flex items-start gap-2">
                          <Wrench className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                              Recommended Actions
                            </p>
                            <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                              {console.log("🔍 Rendering actions for", opportunity.keyword, ":", opportunity.actionItems)}
                              {opportunity.actionItems.map((action, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-orange-600 mt-0.5">•</span>
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <Badge className={getVolumeColor(opportunity.searchVolume)}>
                        {opportunity.searchVolume} Volume
                      </Badge>
                      <span>Type: {opportunity.category}</span>
                      <span>•</span>
                      <span>Difficulty: {opportunity.difficulty}</span>
                      <span>•</span>
                      <span>Potential: {opportunity.potential}</span>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
