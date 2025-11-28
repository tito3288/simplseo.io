"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useOnboarding } from "../../contexts/OnboardingContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, MapPin, Clock, Wrench, Lightbulb, Target } from "lucide-react";
import SquashBounceLoader from "../ui/squash-bounce-loader";

export default function GenericKeywordCard({ gscKeywords = [] }) {
  const { user } = useAuth();
  const { data } = useOnboarding();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);

  useEffect(() => {
    if (user?.id && data?.businessType && gscKeywords.length > 0) {
      fetchGenericOpportunities(gscKeywords);
    }
  }, [user?.id, data?.businessType, gscKeywords]);

  const fetchGenericOpportunities = async (gscKeywords) => {
    setLoading(true);
    setError(null);

    try {
      console.log("🔍 Fetching Generic Keywords for:", {
        gscKeywordsCount: gscKeywords?.length || 0,
        businessType: data.businessType,
        businessLocation: data.businessLocation,
        websiteUrl: data.websiteUrl
      });

      const response = await fetch("/api/generic-keywords/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gscKeywords: gscKeywords || [],
          businessType: data.businessType,
          customBusinessType: data.customBusinessType,
          businessLocation: data.businessLocation,
          websiteUrl: data.websiteUrl,
          userId: user.id, // Add userId for caching
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Generic Keywords response:", result);

      if (result.opportunities && result.opportunities.length > 0) {
        setOpportunities(result.opportunities);
        setFromCache(result.fromCache || false);
        setCacheAge(result.cacheAge || null);
      } else {
        setError("No generic opportunities found");
      }
    } catch (err) {
      console.error("❌ Failed to fetch generic keywords:", err);
      setError("Failed to load generic opportunities");
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

  if (loading) {
    return (
      <Card className="border-purple-400 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5 text-purple-700 dark:text-purple-500" />
            Generic Keyword Opportunities
            <Badge className="bg-red-100 text-red-700">High Priority</Badge>
          </CardTitle>
          <CardDescription>
            Focus on non-branded, service-based keywords for new customer acquisition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <SquashBounceLoader size="lg" className="mb-4" />
            <p className="text-sm text-muted-foreground">Finding generic opportunities...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5" />
            AI Generic Keyword Opportunities
            <Badge className="bg-red-100 text-red-700">High Priority</Badge>
          </CardTitle>
          <CardDescription>
            Focus on non-branded, service-based keywords for new customer acquisition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="bg-muted inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
              <Target className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button 
              onClick={() => fetchGenericOpportunities(gscKeywords)} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (opportunities.length === 0) {
    return (
      <Card className="border-purple-400 dark:border-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5 text-purple-700 dark:text-purple-500" />
            AI Generic Keyword Opportunities
            <Badge className="bg-red-100 text-red-700">High Priority</Badge>
          </CardTitle>
          <CardDescription>
            Focus on non-branded, service-based keywords for new customer acquisition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="bg-green-100 dark:bg-green-900/20 inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
              🎉 No opportunities found!
            </p>
            <p className="text-xs text-green-600 dark:text-green-300">
              You're already targeting great generic keywords
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-400 dark:border-purple-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5 text-purple-700 dark:text-purple-500" />
          AI Generic Keyword Opportunities
          <Badge className="bg-red-100 text-red-700">High Priority</Badge>
        </CardTitle>
        <CardDescription>
          Focus on non-branded, service-based keywords for new customer acquisition
          {fromCache && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>
                Cached data loaded {cacheAge ? `(${cacheAge} hours old)` : ''}
              </span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {opportunities.slice(0, 5).map((opportunity, index) => (
            <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getOpportunityIcon(opportunity.category)}
                  <span className="font-medium text-sm">{opportunity.keyword}</span>
                </div>
                <div className="flex gap-1">
                  <Badge className={`text-xs ${getPriorityColor(opportunity.priority)}`}>
                    Priority {opportunity.priority}
                  </Badge>
                  <Badge className={`text-xs ${getDifficultyColor(opportunity.difficulty)}`}>
                    {opportunity.difficulty}
                  </Badge>
                </div>
              </div>
              
              {opportunity.contentIdea && (
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1 font-medium">
                  💡 {opportunity.contentIdea}
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Badge className={`text-xs ${getVolumeColor(opportunity.searchVolume)}`}>
                  {opportunity.searchVolume} Volume
                </Badge>
                <span>•</span>
                <span>Type: {opportunity.category}</span>
                <span>•</span>
                <span>Difficulty: {opportunity.difficulty}</span>
              </div>
            </div>
          ))}
        </div>
        
        {opportunities.length > 5 && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm">
              View All {opportunities.length} Opportunities
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
