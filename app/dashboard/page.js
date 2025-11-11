"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebaseConfig";
import { createGSCTokenManager } from "../lib/gscTokenManager";
import MainLayout from "../components/MainLayout";
import { useRouter } from "next/navigation";
import SeoRecommendationPanel from "../components/dashboard/SeoRecommendationPanel";
import Link from "next/link";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { useMinimumLoading } from "../hooks/use-minimum-loading";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "../contexts/OnboardingContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Unlink,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import DateRangeFilter from "../components/dashboard/DateRangeFilter";
import KeywordTable from "../components/dashboard/KeywordTable";
import ContentExpansionCard from "../components/dashboard/ContentExpansionCard";
import LongTailKeywordCard from "../components/dashboard/LongTailKeywordCard";
import GenericKeywordCard from "../components/dashboard/GenericKeywordCard";
import { toast } from "sonner";
import {
  saveFocusKeywords,
  getFocusKeywords,
} from "../lib/firestoreHelpers";
import FocusKeywordSelector from "../components/dashboard/FocusKeywordSelector";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

if (typeof window !== "undefined") {
  window.google = window.google || {};
}

export default function Dashboard() {
  const { data } = useOnboarding();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isGscConnected, setIsGscConnected] = useState(false);
  const [gscAccessToken, setGscAccessToken] = useState(null);
  const [gscKeywords, setGscKeywords] = useState([]);
  const [gscImpressionTrends, setGscImpressionTrends] = useState([]);
  const [dateRange, setDateRange] = useState("28"); // Changed from "7" to "28"
  const [topPages, setTopPages] = useState([]);
  const [lowCtrPages, setLowCtrPages] = useState([]);
  const [aiTips, setAiTips] = useState([]);
  const [generatedTitles, setGeneratedTitles] = useState([]);
  const [generatedMeta, setGeneratedMeta] = useState([]);
  const [hasShownGscError, setHasShownGscError] = useState(false);
  const [gscAlert, setGscAlert] = useState(null);
  const [isLoadingGscData, setIsLoadingGscData] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false); // ✅ NEW: Track refresh state
  
  // Use AI-powered filtering for non-branded keywords
  const [nonBrandedKeywords, setNonBrandedKeywords] = useState([]);
  const [isFilteringKeywords, setIsFilteringKeywords] = useState(false);
  const [focusKeywords, setFocusKeywords] = useState([]);
  const [focusKeywordByPage, setFocusKeywordByPage] = useState(new Map());
  const [initialFocusKeywordsLoaded, setInitialFocusKeywordsLoaded] = useState(
    false
  );
  const [isSavingFocusKeywords, setIsSavingFocusKeywords] = useState(false);
  const [hasAutoSelectedFocusKeywords, setHasAutoSelectedFocusKeywords] =
    useState(false);
  const [showDashboardPreview, setShowDashboardPreview] = useState(false);

  const normalizePageKey = (page) => page || "__unknown__";
  const assignmentsToEntries = (assignments) =>
    Array.from(assignments.entries())
      .map(([pageKey, keyword]) => {
        if (typeof keyword !== "string") return null;
        const trimmed = keyword.trim();
        if (!trimmed) return null;
        return {
          keyword: trimmed,
          pageUrl: pageKey === "__unknown__" ? null : pageKey,
        };
      })
      .filter(Boolean);

  const focusKeywordSet = useMemo(
    () =>
      new Set(
        (focusKeywords || []).map((keyword) => keyword.trim().toLowerCase())
      ),
    [focusKeywords]
  );

  const focusKeywordAssignmentsByKeyword = useMemo(() => {
    const map = new Map();
    focusKeywordByPage.forEach((keyword, pageKey) => {
      if (!keyword) return;
      const normalizedKeyword = keyword.trim().toLowerCase();
      if (!normalizedKeyword) return;
      map.set(normalizedKeyword, pageKey === "__unknown__" ? null : pageKey);
    });
    return map;
  }, [focusKeywordByPage]);
  const hasFocusKeywords = focusKeywords.length > 0;
  const shouldGateDashboard =
    isGscConnected && !hasFocusKeywords && !showDashboardPreview;
  useEffect(() => {
    if (hasFocusKeywords) {
      setShowDashboardPreview(true);
    }
  }, [hasFocusKeywords]);
  const crawlTriggeredRef = useRef(false);
  
  // Use minimum loading time for professional UX
  const shouldShowLoader = useMinimumLoading(isLoadingGscData, 3000);

  const generateMetaDescription = async (pageUrl) => {
    try {
      const res = await fetch("/api/seo-assistant/meta-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageUrl,
          onboarding: data,
          context: { lowCtrPages, aiTips }, // same context as titles
          userId: user?.id,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const json = await res.json();
      return (
        json.description ||
        "Your page is ranking but not getting clicks. Consider improving your title or meta description."
      );
    } catch (err) {
      console.error("❌ Failed to fetch AI meta description", err);
      return "Meta description could not be generated.";
    }
  };

  const generateMetaTitle = async (pageUrl) => {
    try {
      const res = await fetch("/api/seo-assistant/meta-title", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageUrl,
          onboarding: data,
          context: { lowCtrPages, aiTips }, // feel free to expand this later
          userId: user?.id,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const json = await res.json();
      return json.title || "Suggested Meta Title";
    } catch (err) {
      console.error("❌ Failed to fetch AI meta title", err);
      return "Suggested Meta Title";
    }
  };

  useEffect(() => {
    const fetchTitlesAndDescriptions = async () => {
      const results = await Promise.all(
        aiTips.map(async (tip) => {
          const match = tip.match(/href="(.*?)"/);
          const pageUrl = match?.[1] || "";

          const [title, description] = await Promise.all([
            generateMetaTitle(pageUrl),
            generateMetaDescription(pageUrl),
          ]);

          return { pageUrl, title, description };
        })
      );

      setGeneratedMeta(results);
    };

    if (aiTips.length > 0) {
      fetchTitlesAndDescriptions();
    }
  }, [aiTips]);

  useEffect(() => {
    const loadFocusKeywords = async () => {
      if (!user?.id) {
        setFocusKeywords([]);
        setInitialFocusKeywordsLoaded(false);
        setFocusKeywordByPage(new Map());
        setHasAutoSelectedFocusKeywords(false);
        return;
      }
      try {
        const stored = await getFocusKeywords(user.id);
        if (Array.isArray(stored) && stored.length > 0) {
          const keywordList = [];
          const assignments = new Map();
          stored.forEach(({ keyword, pageUrl }) => {
            if (!keyword) return;
            keywordList.push(keyword);
            const pageKey = normalizePageKey(pageUrl);
            assignments.set(pageKey, keyword);
          });
          setFocusKeywords(keywordList);
          setFocusKeywordByPage(assignments);
          setHasAutoSelectedFocusKeywords(true);
        } else {
          setFocusKeywords([]);
          setFocusKeywordByPage(new Map());
        }
      } catch (error) {
        console.error("Failed to load focus keywords:", error);
      } finally {
        setInitialFocusKeywordsLoaded(true);
      }
    };
    loadFocusKeywords();
  }, [user?.id]);

  useEffect(() => {
    if (!gscKeywords.length) {
      if (focusKeywords.length === 0 && focusKeywordByPage.size) {
        setFocusKeywordByPage(new Map());
      }
      return;
    }

    setFocusKeywordByPage((prev) =>
      buildAssignmentsFromKeywords(focusKeywords, prev, gscKeywords)
    );
  }, [gscKeywords, focusKeywords]);

  useEffect(() => {
    if (isLoading || !user?.id) return;

    // Reset error flag when user changes
    setHasShownGscError(false);

    const checkGSCConnection = async () => {
      try {
        // Debug: Log onboarding data
        console.log("🔍 Dashboard onboarding data:", {
          hasGSC: data?.hasGSC,
          gscProperty: data?.gscProperty,
          googleEmail: data?.googleEmail,
          fullData: data
        });

        // Check if a GSC property was selected during onboarding
        if (!data?.gscProperty) {
          console.log("❌ No GSC property selected during onboarding");
          setIsGscConnected(false);
          return;
        }

        const tokenManager = createGSCTokenManager(user.id);
        const accessToken = await tokenManager.getValidAccessToken();
        
        if (!accessToken) {
          setIsGscConnected(false);
          return;
        }

        // Verify token is still valid
        const response = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.status === 200) {
          setGscAccessToken(accessToken);
          setIsGscConnected(true);
          fetchAndMatchGSC(accessToken);
        } else {
          console.warn("⚠️ GSC token is invalid, try reconnecting manually.");
          setIsGscConnected(false);
        }
      } catch (error) {
        console.error("⚠️ Error checking GSC connection:", error);
        setIsGscConnected(false);
      }
    };

    checkGSCConnection();
  }, [isLoading, user?.id, data?.gscProperty, data?.hasGSC]);

  useEffect(() => {
    if (!user?.id || !data?.websiteUrl) return;
    if (!data?.hasGSC) return;

    const status = data?.siteCrawlStatus;
    if (status === "in-progress" || status === "completed" || status === "completed-with-errors") {
      return;
    }

    if (crawlTriggeredRef.current) {
      return;
    }

    crawlTriggeredRef.current = true;

    const startCrawl = async () => {
      try {
        console.log("🌐 Starting site crawl for:", data.websiteUrl);
        const res = await fetch("/api/crawl-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            websiteUrl: data.websiteUrl,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          console.error("❌ Site crawl failed:", result?.error || result);
          crawlTriggeredRef.current = false;
        } else {
          console.log("✅ Site crawl started:", result);
        }
      } catch (error) {
        crawlTriggeredRef.current = false;
        console.error("❌ Failed to start site crawl:", error);
      }
    };

    startCrawl();
  }, [user?.id, data?.websiteUrl, data?.hasGSC, data?.siteCrawlStatus]);

  // Commented out to prevent duplicate calls
  // useEffect(() => {
  //   if (gscAccessToken) {
  //     fetchAndMatchGSC(gscAccessToken);
  //   }
  // }, [gscAccessToken, dateRange]);

  // ✅ NEW: Refresh all data when date range changes
  useEffect(() => {
    if (gscAccessToken && isGscConnected) {
      console.log(`🔄 Date range changed to ${dateRange} days, refreshing all data...`);
      setIsRefreshingData(true);
      fetchAndMatchGSC(gscAccessToken);
    }
  }, [dateRange, gscAccessToken, isGscConnected]);

  // AI-powered brand filtering effect
  useEffect(() => {
    const filterKeywordsWithAI = async () => {
      if (!gscKeywords.length || !data?.businessName) return;
      
      setIsFilteringKeywords(true);
      try {
        console.log('🤖 Using AI to filter branded keywords for dashboard...');
        
        const response = await fetch('/api/filter-branded-keywords', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keywords: gscKeywords,
            businessName: data.businessName,
            businessType: data.businessType
          })
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        console.log("✅ AI filtering result:", result);
        console.log(
          "🔍 Branded keywords from AI:",
          result.branded?.map((kw) => kw.keyword) || []
        );
        console.log(
          "🔍 Generic keywords from AI:",
          result.generic?.map((kw) => kw.keyword) || []
        );

        // Set only the generic (non-branded) keywords - limit to 4 for dashboard
        setNonBrandedKeywords(result.generic.slice(0, 4));
      } catch (error) {
        console.error("❌ AI filtering failed, using enhanced fallback:", error);
        // Enhanced fallback filtering if AI fails
        const businessName = data?.businessName?.toLowerCase() || "";
        const businessWords = businessName
          .split(" ")
          .filter((word) => word.length > 2);

        const fallback = gscKeywords
          .filter((kw) => {
            const keyword = kw.keyword.toLowerCase();

            // Enhanced branded detection - same logic as API
            const isBranded =
              // Exact business name matches
              keyword.includes(businessName) ||
              keyword.includes(businessName.replace(/\s+/g, "")) ||
              keyword.includes(businessName.replace(/\s+/g, " n ")) ||
              keyword.includes(businessName.replace(/\s+/g, " & ")) ||
              keyword.includes(businessName.replace(/\s+/g, " and ")) ||
              // Check for individual business words (but be more strict)
              (businessWords.length > 1 &&
                businessWords.every((word) => keyword.includes(word))) ||
              // Check for common brand variations
              keyword === businessName ||
              keyword === businessName.replace(/\s+/g, "") ||
              keyword === businessName.replace(/\s+/g, " n ") ||
              keyword === businessName.replace(/\s+/g, " & ");

            // Return true if NOT branded (i.e., it's generic)
            return !isBranded;
          })
          .slice(0, 4);

        console.log(
          `🔄 Dashboard fallback filtering: ${fallback.length} generic keywords from ${gscKeywords.length} total`
        );
        setNonBrandedKeywords(fallback);
      } finally {
        setIsFilteringKeywords(false);
      }
    };

    filterKeywordsWithAI();
  }, [gscKeywords, data?.businessName, data?.businessType, user?.id, initialFocusKeywordsLoaded]);

  const fetchAndMatchGSC = async (token) => {
    if (!user?.id) return;
    
    // Use the GSC property selected during onboarding
    const selectedProperty = data?.gscProperty;
    
    if (selectedProperty) {
      console.log("🎯 Using selected GSC property:", selectedProperty);
      
      // Store site URL in Firestore
      const tokenManager = createGSCTokenManager(user.id);
      await tokenManager.storeTokens(null, token, selectedProperty);
      
      fetchSearchAnalyticsData(selectedProperty, token, dateRange);
    } else {
      console.log("❌ No GSC property selected during onboarding");
      
      if (!hasShownGscError) {
        toast.error("No GSC Property Selected", {
          description: "Please complete the onboarding process and select a Google Search Console property.",
          duration: 30000,
          style: {
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca'
          }
        });
        setHasShownGscError(true);
        setGscAlert({
          type: "no-property-selected",
          title: "No GSC Property Selected",
          description: "Please complete the onboarding process and select a Google Search Console property.",
          action: "Complete Onboarding"
        });
      }
    }
  };

  const requestGSCAuthToken = async () => {
    // Debug: Log what we're trying to do
    console.log("🔐 Starting GSC OAuth flow...");
    
    // Reset error flag for new attempt
    setHasShownGscError(false);
    
    // Clear existing GSC data first
    try {
      const tokenManager = createGSCTokenManager(user.id);
      await tokenManager.clearGSCData();
      console.log("✅ Cleared existing GSC data");
    } catch (error) {
      console.error("❌ Failed to clear GSC data:", error);
    }
    
    // Use authorization code flow to get refresh tokens
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=956212275866-7dtgdq7b38b156riehghuvh8b8469ktg.apps.googleusercontent.com&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/gsc-callback')}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(GSC_SCOPE)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `include_granted_scopes=true`;
    
    // Open popup for authorization
    const popup = window.open(authUrl, 'gsc-auth', 'width=500,height=600');
    
    // Listen for the authorization code
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GSC_AUTH_SUCCESS' && event.data.code) {
        console.log("🔐 Authorization code received:", event.data.code);
        
        try {
          console.log("🔐 About to exchange code for tokens...");
          
          // Exchange code for tokens
          const response = await fetch('/api/gsc/exchange-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: event.data.code })
          });
          
          const tokenData = await response.json();
          console.log("🔐 Token exchange response:", tokenData);
          
                           if (tokenData.access_token) {
                   console.log("🔐 Token exchange successful:", {
                     hasAccessToken: !!tokenData.access_token,
                     hasRefreshToken: !!tokenData.refresh_token,
                     refreshTokenLength: tokenData.refresh_token?.length
                   });
                   
                   const tokenManager = createGSCTokenManager(user.id);
                   
                   console.log("🔐 About to store tokens:", {
                     hasRefreshToken: !!tokenData.refresh_token,
                     refreshTokenLength: tokenData.refresh_token?.length,
                     hasAccessToken: !!tokenData.access_token,
                     accessTokenLength: tokenData.access_token?.length
                   });
                   
                   // Store tokens in Firestore
                   await tokenManager.storeTokens(
                     tokenData.refresh_token || null,
                     tokenData.access_token,
                     null // siteUrl will be set after matching
                   );

                   console.log("✅ Tokens stored in Firestore");

                   setGscAccessToken(tokenData.access_token);
                   setIsGscConnected(true);

                  await setDoc(
                    doc(db, "onboarding", user.id),
                    { hasGSC: true },
                    { merge: true }
                  );

                   fetchAndMatchGSC(tokenData.access_token);
                 } else {
                   console.error("❌ No access token in response:", tokenData);
                 }
        } catch (error) {
          console.error("❌ Failed to exchange code for tokens:", error);
        }
        
        popup.close();
        window.removeEventListener('message', handleMessage);
      }
    };
    
    window.addEventListener('message', handleMessage);
  };

  const fetchSearchAnalyticsData = async (siteUrl, token, range) => {
    setIsLoadingGscData(true);
    const today = new Date();
    const startDate = new Date();
    if (range === "all") {
      startDate.setFullYear(today.getFullYear() - 1);
    } else {
      startDate.setDate(today.getDate() - parseInt(range));
    }

    const formatDate = (d) => d.toISOString().split("T")[0];
    const from = formatDate(startDate);
    const to = formatDate(today);

    try {
      // 🔹 Fetch keyword + page performance
      const keywordRes = await fetch(
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
            rowLimit: 100,
          }),
        }
      );

      const keywordJson = await keywordRes.json();

      if (keywordJson.rows) {
        const formatted = keywordJson.rows.map((row) => ({
          keyword: row.keys[0].replace(/^\[|\]$/g, ""),
          page: row.keys[1],
          clicks: row.clicks,
          impressions: row.impressions,
          position: Math.round(row.position),
          ctr: `${(row.ctr * 100).toFixed(1)}%`,
        }));

        setGscKeywords(formatted);

        // 🔹 Top pages by clicks
        const pageClickMap = {};
        formatted.forEach((row) => {
          pageClickMap[row.page] = (pageClickMap[row.page] || 0) + row.clicks;
        });

        const sortedPages = Object.entries(pageClickMap)
          .map(([page, clicks]) => ({ page, clicks }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 5);

        setTopPages(sortedPages);

        // 🔹 Low CTR pages
        const lowCtr = formatted.filter(
          (kw) =>
            parseFloat(kw.ctr.replace("%", "")) <= 2 && kw.impressions > 20
        );

        const grouped = Object.values(
          lowCtr.reduce((acc, item) => {
            if (!acc[item.page]) {
              acc[item.page] = { ...item, clicks: 0, impressions: 0, keywords: new Set() };
            }
            acc[item.page].clicks += item.clicks;
            acc[item.page].impressions += item.impressions;
            if (item.keyword) {
              acc[item.page].keywords.add(item.keyword);
            }
            return acc;
          }, {})
        ).map((entry) => ({
          ...entry,
          keywords: Array.from(entry.keywords || []),
        }));

        setLowCtrPages(grouped);

        // 🔹 AI tips
        const ai = grouped.map((kw) => {
          return `Your page <a href="${kw.page}" class="underline">${kw.page}</a> is ranking but not getting clicks. Consider improving your title or meta description.`;
        });

        setAiTips(ai);

        if (
          initialFocusKeywordsLoaded &&
          !hasAutoSelectedFocusKeywords &&
          focusKeywords.length === 0 &&
          user?.id
        ) {
          try {
            const defaultAssignments = new Map();
            const sortedCandidates = formatted
              .filter((kw) => kw.clicks >= 1 && kw.impressions >= 20)
              .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));

            sortedCandidates.forEach((kw) => {
              const keyword = kw.keyword;
              if (!keyword) return;
              const pageKey = normalizePageKey(kw.page);
              if (defaultAssignments.has(pageKey)) return;
              defaultAssignments.set(pageKey, keyword);
            });

            const defaultEntries = assignmentsToEntries(defaultAssignments);

            if (defaultEntries.length > 0) {
              await saveFocusKeywords(user.id, defaultEntries);
              setFocusKeywordByPage(defaultAssignments);
              setFocusKeywords(defaultEntries.map((entry) => entry.keyword));
              setHasAutoSelectedFocusKeywords(true);
            }
          } catch (error) {
            console.error("Failed to save initial focus keywords:", error);
          }
        }
      } else {
        setGscKeywords([]);
        setTopPages([]);
      }

      // 🔹 Fetch daily impressions for the chart
      const trendsRes = await fetch(
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
            dimensions: ["date"],
            rowLimit: 1000,
          }),
        }
      );

      const trendsJson = await trendsRes.json();

      if (trendsJson.rows) {
        const trends = trendsJson.rows.map((row) => {
          const dateObj = new Date(row.keys[0]);
          const formattedDate = `${
            dateObj.getMonth() + 1
          }/${dateObj.getDate()}/${dateObj.getFullYear().toString().slice(-2)}`;
          return {
            date: formattedDate,
            impressions: row.impressions,
          };
        });

        setGscImpressionTrends(trends);
      } else {
        setGscImpressionTrends([]);
      }
    } catch (err) {
      console.error("❌ Failed to fetch GSC data:", err);
    } finally {
      setIsLoadingGscData(false);
      setIsRefreshingData(false); // Reset refreshing state after data fetch
    }
  };

  const gscKeywordsWithFocus = useMemo(
    () =>
      gscKeywords.map((kw) => ({
        ...kw,
        isFocus: focusKeywordSet.has(kw.keyword.toLowerCase()),
      })),
    [gscKeywords, focusKeywordSet]
  );

  const groupedByPage = useMemo(() => {
    const map = new Map();
    gscKeywords.forEach((row) => {
      const page = row.page || "__unknown__";
      const keyword = row.keyword;
      if (!keyword) return;
      const lower = keyword.toLowerCase();
      const entry = map.get(page);
      if (entry) {
        if (!entry.includes(lower)) {
          entry.push(lower);
        }
      } else {
        map.set(page, [lower]);
      }
    });
    return map;
  }, [gscKeywords]);

  const buildAssignmentsFromKeywords = (
    keywordsList = [],
    currentAssignments = new Map(),
    rows = []
  ) => {
    if (!keywordsList.length || !rows.length) {
      return new Map();
    }

    const next = new Map();
    const reservedPages = new Set();
    const previousByKeyword = new Map();

    currentAssignments?.forEach((keyword, pageKey) => {
      if (!keyword) return;
      previousByKeyword.set(keyword.toLowerCase(), pageKey);
    });

    const rowsByKeyword = new Map();
    rows.forEach((row) => {
      const key = row.keyword?.toLowerCase();
      if (!key) return;
      if (!rowsByKeyword.has(key)) {
        rowsByKeyword.set(key, []);
      }
      rowsByKeyword.get(key).push(row);
    });

    rowsByKeyword.forEach((list) => {
      list.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
    });

    keywordsList.forEach((keyword) => {
      const lower = keyword?.toLowerCase();
      if (!lower) return;

      const keywordRows = rowsByKeyword.get(lower) || [];
      if (!keywordRows.length) return;

      let chosenPageKey = previousByKeyword.get(lower);

      if (chosenPageKey) {
        const stillValid = keywordRows.some(
          (row) => normalizePageKey(row.page) === chosenPageKey
        );
        if (!stillValid || reservedPages.has(chosenPageKey)) {
          chosenPageKey = null;
        }
      }

      if (!chosenPageKey) {
        const candidate = keywordRows.find(
          (row) => !reservedPages.has(normalizePageKey(row.page))
        );
        chosenPageKey = normalizePageKey((candidate || keywordRows[0]).page);
      }

      if (chosenPageKey && !reservedPages.has(chosenPageKey)) {
        next.set(chosenPageKey, keyword);
        reservedPages.add(chosenPageKey);
      }
    });

    return next;
  };

  const easyWins = useMemo(() => {
    const filtered = gscKeywordsWithFocus.filter((kw) => {
      const pos = kw.position;
      const ctr = parseFloat(kw.ctr.replace("%", ""));
      return pos > 10 && pos <= 20 && ctr < 3 && kw.impressions > 10;
    });

    return filtered.sort((a, b) => {
      const aFocus = a.isFocus ? 1 : 0;
      const bFocus = b.isFocus ? 1 : 0;
      if (aFocus !== bFocus) {
        return bFocus - aFocus;
      }
      return a.position - b.position;
    });
  }, [gscKeywordsWithFocus]);

  const orderedFocusKeywords = useMemo(
    () => (focusKeywords || []).map((keyword) => keyword.trim()).filter(Boolean),
    [focusKeywords]
  );

  const focusKeywordTopRows = useMemo(() => {
    const map = new Map();
    gscKeywords.forEach((row) => {
      const key = row.keyword?.toLowerCase();
      if (!key || !focusKeywordSet.has(key)) return;
      const existing = map.get(key);
      if (!existing || row.impressions > existing.impressions) {
        map.set(key, row);
      }
    });
    return map;
  }, [gscKeywords, focusKeywordSet]);

  const focusKeywordsNotShownInEasyWins = useMemo(() => {
    const shown = new Set(
      easyWins
        .filter((kw) => kw.isFocus)
        .map((kw) => kw.keyword?.toLowerCase())
        .filter(Boolean)
    );

    return orderedFocusKeywords
      .filter((keyword) => !shown.has(keyword.toLowerCase()))
      .map((keyword) => {
        const lower = keyword.toLowerCase();
        const data = focusKeywordTopRows.get(lower) || null;
        const mappedPage = focusKeywordAssignmentsByKeyword.get(lower) || null;
        const page = mappedPage ?? data?.page ?? null;
        return {
          keyword,
          data,
          page,
        };
      });
  }, [
    orderedFocusKeywords,
    easyWins,
    focusKeywordTopRows,
    focusKeywordAssignmentsByKeyword,
  ]);

  const prioritizedLowCtrPages = useMemo(() => {
    return lowCtrPages
      .map((page) => {
        const focusMatches = page.keywords?.filter((keyword) =>
          focusKeywordSet.has(keyword.toLowerCase())
        );
        const primaryKeyword = focusMatches?.[0] || page.keywords?.[0] || null;
        return {
          ...page,
          focusKeywords: focusMatches || [],
          primaryKeyword,
        };
      })
      .sort((a, b) => {
        const aFocus = a.focusKeywords.length;
        const bFocus = b.focusKeywords.length;
        if (aFocus !== bFocus) {
          return bFocus - aFocus;
        }
        return b.impressions - a.impressions;
      });
  }, [lowCtrPages, focusKeywordSet]);
 
  const focusKeywordsNotShownLowCtr = useMemo(() => {
    const shown = new Set();
    prioritizedLowCtrPages.forEach((page) => {
      page.focusKeywords?.forEach((keyword) => {
        shown.add(keyword.toLowerCase());
      });
    });

    return orderedFocusKeywords
      .filter((keyword) => !shown.has(keyword.toLowerCase()))
      .map((keyword) => {
        const lower = keyword.toLowerCase();
        const data = focusKeywordTopRows.get(lower) || null;
        const mappedPage = focusKeywordAssignmentsByKeyword.get(lower) || null;
        const page = mappedPage ?? data?.page ?? null;
        return {
          keyword,
          data,
          page,
        };
      });
  }, [
    orderedFocusKeywords,
    prioritizedLowCtrPages,
    focusKeywordTopRows,
    focusKeywordAssignmentsByKeyword,
  ]);

  if (isLoading || !user) {
    return null; // or show a loader/spinner if you want
  }

  const handleFocusKeywordToggle = async ({
    keyword,
    page,
    isSelectedForPage,
  }) => {
    if (!user?.id || !keyword) return;

    const pageKey = normalizePageKey(page);
    const lowerKeyword = keyword.toLowerCase();

    const nextAssignments = new Map(focusKeywordByPage);

    if (isSelectedForPage) {
      nextAssignments.delete(pageKey);
    } else {
      nextAssignments.delete(pageKey);
      for (const [existingPageKey, existingKeyword] of Array.from(
        nextAssignments.entries()
      )) {
        if (existingKeyword?.toLowerCase() === lowerKeyword) {
          nextAssignments.delete(existingPageKey);
        }
      }

      if (pageKey === "__unknown__") {
        const keywordRow = gscKeywords.find(
          (row) => row.keyword?.toLowerCase() === lowerKeyword
        );
        const resolvedPageKey = normalizePageKey(keywordRow?.page);
        nextAssignments.set(resolvedPageKey, keyword);
      } else {
        nextAssignments.set(pageKey, keyword);
      }
    }

    const uniqueKeywords = Array.from(
      new Set(
        Array.from(nextAssignments.values())
          .map((item) => item?.trim())
          .filter(Boolean)
      )
    );

    const entries = assignmentsToEntries(nextAssignments);

    setFocusKeywordByPage(nextAssignments);
    setFocusKeywords(uniqueKeywords);

    setIsSavingFocusKeywords(true);
    try {
      await saveFocusKeywords(user.id, entries);
      setHasAutoSelectedFocusKeywords(true);
      toast.success("Focus keywords updated.");
    } catch (error) {
      console.error("Failed to save focus keywords:", error);
      toast.error("We couldn’t save your focus keywords. Try again.");
    } finally {
      setIsSavingFocusKeywords(false);
    }
  };

  const defaultFocusKeywords = async () => {
    const sourceList = nonBrandedKeywords.length
      ? nonBrandedKeywords
      : gscKeywords;
    if (!sourceList.length) {
      toast.error("We need more Search Console data before we can suggest keywords.");
      return;
    }

    const keywordToRow = new Map(
      gscKeywords.map((row) => [row.keyword?.toLowerCase(), row])
    );
    const nextAssignments = new Map();
    const usedKeywords = new Set();

    sourceList
      .slice()
      .sort((a, b) => {
        const aImpressions =
          typeof a === "string"
            ? keywordToRow.get(a?.toLowerCase())?.impressions || 0
            : a.impressions || 0;
        const bImpressions =
          typeof b === "string"
            ? keywordToRow.get(b?.toLowerCase())?.impressions || 0
            : b.impressions || 0;
        return bImpressions - aImpressions;
      })
      .forEach((item) => {
        const keyword = typeof item === "string" ? item : item.keyword;
        if (!keyword) return;
        const lower = keyword.toLowerCase();
        if (usedKeywords.has(lower)) return;

        const row =
          typeof item === "string" ? keywordToRow.get(lower) : item;
        const pageKey = normalizePageKey(row?.page);

        if (!row || nextAssignments.has(pageKey)) return;

        usedKeywords.add(lower);
        nextAssignments.set(pageKey, keyword);
      });

    const entries = assignmentsToEntries(nextAssignments);

    if (!entries.length) {
      toast.error("We couldn’t find unique keywords per page to suggest yet.");
      return;
    }

    const autoKeywords = entries.map((entry) => entry.keyword);

    setFocusKeywordByPage(nextAssignments);
    setFocusKeywords(autoKeywords);

    setIsSavingFocusKeywords(true);
    try {
      await saveFocusKeywords(user.id, entries);
      setHasAutoSelectedFocusKeywords(true);
      toast.success("Picked starter focus keywords for you.");
    } catch (error) {
      console.error("Failed to save initial focus keywords:", error);
      toast.error("We couldn’t save your focus keywords. Try again.");
    } finally {
      setIsSavingFocusKeywords(false);
    }
  };


  const stripHtmlTags = (html) => {
    if (typeof window === "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  return (
    <MainLayout
      aiTips={aiTips}
      gscKeywords={gscKeywords}
      easyWins={easyWins}
      topPages={topPages}
      lowCtrPages={lowCtrPages}
      impressionTrends={gscImpressionTrends}
      isLoading={isLoadingGscData}
    >
      <div className="mb-6">
        <h1 className="text-5xl font-bold mb-2">
          Welcome {data?.name ? data.name.split(" ")[0] : ""}!<br/> <span className="text-3xl">SEO Dashboard</span>
        </h1>
        <p className="text-muted-foreground">
          Get insights and recommendations for improving your website&apos;s search
          performance
        </p>

        {data?.siteCrawlStatus === "in-progress" && (
          <Alert className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertTitle>Scanning your website…</AlertTitle>
            <AlertDescription>
              We&apos;re crawling up to 25 pages so the AI coach can understand your content.
              This only takes a minute.
            </AlertDescription>
          </Alert>
        )}

        {(data?.siteCrawlStatus === "completed" ||
          data?.siteCrawlStatus === "completed-with-errors") && (
          <Alert className="mt-4 border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Website scan complete</AlertTitle>
            <AlertDescription>
              Your chatbot now uses your site&apos;s content for more personalized answers.
              <span className="block text-xs text-muted-foreground mt-1">
                Last crawl: {data?.lastSiteCrawlAt ? new Date(data.lastSiteCrawlAt).toLocaleString() : "Just now"}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {data?.siteCrawlStatus === "error" && (
          <Alert className="mt-4 border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertTitle>We couldn&apos;t scan your website</AlertTitle>
            <AlertDescription>
              Please double-check your website URL in settings, then refresh to try again.
            </AlertDescription>
          </Alert>
        )}
        {focusKeywords.length === 0 && (
          <Alert className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertTitle>Let&apos;s pick focus keywords</AlertTitle>
            <AlertDescription>
              Choose the keywords you want to improve first. We&apos;ll personalize the
              dashboard and chatbot around them.
            </AlertDescription>
          </Alert>
        )}
      </div>


      <Card className="col-span-full mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Website Visitors</span>
            <DateRangeFilter
              value={dateRange}
              onValueChange={(value) => setDateRange(value)}
              isLoading={isRefreshingData}
            />
          </CardTitle>
          <CardDescription>
            Track impressions over time - Last {dateRange === "all" ? "year" : `${dateRange} days`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shouldShowLoader ? (
            <div className="text-center py-8">
              <SquashBounceLoader size="lg" className="mb-4" />
              <p className="text-sm text-muted-foreground">Loading chart data...</p>
            </div>
          ) : !isGscConnected ? (
            <div className="text-center py-8">
              <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                <Unlink className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Connect GSC to see chart data</p>
            </div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gscImpressionTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="black"
                    strokeWidth={1}
                    dot={{ r: 5, fill: "#00BF63" }}
                    activeDot={{ r: 6, fill: "#00BF63" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      {isGscConnected && (
        <Card className="col-span-full mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Choose Your Focus Keywords</span>
              <Button
                variant="outline"
                size="sm"
                onClick={defaultFocusKeywords}
                disabled={isFilteringKeywords || isSavingFocusKeywords}
              >
                Smart Suggest
              </Button>
            </CardTitle>
            <CardDescription>
              Choose the keywords that matter most for each page so the rest of the dashboard can highlight them first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FocusKeywordSelector
              keywords={gscKeywords}
              selectedByPage={focusKeywordByPage}
              onToggle={handleFocusKeywordToggle}
              isSaving={isSavingFocusKeywords}
              suggestions={nonBrandedKeywords}
              groupedByPage={groupedByPage}
            />
          </CardContent>
        </Card>
      )}
      {shouldGateDashboard && (
        <Card className="mb-6 border-dashed border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex flex-col gap-2 text-primary">
              Start by picking your focus keywords
            </CardTitle>
            <CardDescription className="text-primary/80">
              We&apos;ll tailor Low CTR fixes, Easy Wins, and AI tips around the keywords you select. Once you choose them, the rest of your dashboard will unlock.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-primary/80">
              Want to peek at the raw data first?
            </p>
            <Button
              variant="outline"
              onClick={() => setShowDashboardPreview(true)}
            >
              Preview metrics
            </Button>
          </CardContent>
        </Card>
      )}

      <div
        className={cn(
          "space-y-6 transition-all duration-300",
          shouldGateDashboard && "pointer-events-none opacity-40"
        )}
      >

            {/* GSC Setup Alert */}
            {gscAlert && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 mb-2">
                  {gscAlert.title}
                </h3>
                <p className="text-red-700 mb-4">
                  {gscAlert.description}
                </p>
                <Button 
                  onClick={() => {
                    if (gscAlert.type === "no-property-selected") {
                      router.push("/onboarding");
                    } else {
                      window.open("https://search.google.com/search-console", "_blank");
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {gscAlert.action}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert className="mb-6 border-primary/20 bg-primary/5">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Quick SEO Tip</AlertTitle>
        <AlertDescription>
          {data.businessType === "Dentist"
            ? "Add your business hours, services, and patient reviews to improve your local SEO as a dental practice."
            : `Add your business hours and location details to your website to improve your local SEO visibility in ${
                data.businessLocation || "your area"
              }.`}
        </AlertDescription>
      </Alert> 
      {/* Getting Started Card */}
       <Card>
        <CardHeader>
          <CardTitle>Your Next Steps</CardTitle>
          <CardDescription>
            Follow these steps to improve your SEO
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center">
                <div className="bg-primary/10 text-primary h-8 w-8 rounded-full flex items-center justify-center mr-3">
                  <span className="font-medium">1</span>
                </div>
                <div>
                  <p className="font-medium">Connect Google Search Console</p>
                  <p className="text-sm text-muted-foreground">
                    Track your search rankings and performance
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Setup
              </Button>
            </div>

            <div className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center">
                <div className="bg-primary/10 text-primary h-8 w-8 rounded-full flex items-center justify-center mr-3">
                  <span className="font-medium">2</span>
                </div>
                <div>
                  <p className="font-medium">Complete Your Local SEO Profile</p>
                  <p className="text-sm text-muted-foreground">
                    Add business details for local search
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center">
                <div className="bg-primary/10 text-primary h-8 w-8 rounded-full flex items-center justify-center mr-3">
                  <span className="font-medium">3</span>
                </div>
                <div>
                  <p className="font-medium">Optimize Website Content</p>
                  <p className="text-sm text-muted-foreground">
                    Improve page titles, descriptions, and content
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Top Row - Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 mt-6">

        {/* Low CTR Fixes Card */}
        <Card
          className={cn(
            "col-span-full md:col-span-1 h-full border-red-200 shadow-red-100 transition-all",
            hasFocusKeywords && "border-primary/40 shadow-[0_0_0_1px_rgba(0,191,99,0.15)]"
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Low CTR Fixes
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                    High Priority
                  </span>
                </CardTitle>
                <CardDescription>
                  These pages show up in searches but aren&apos;t getting many
                  clicks. Consider rewriting their titles and meta descriptions
                  to improve click-through rate. Data from last {dateRange === "all" ? "year" : `${dateRange} days`}.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/low-ctr">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGscConnected ? (
              shouldShowLoader ? (
                <div className="text-center py-8">
                  <SquashBounceLoader size="lg" className="mb-4" />
                  <p className="text-sm text-muted-foreground">Loading CTR data...</p>
                </div>
              ) : prioritizedLowCtrPages.length === 0 ? (
                <div className="text-center py-6">
                  <div className="bg-green-100 dark:bg-green-900/20 inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    🎉 No issues found!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-300">
                    Your pages are getting great click-through rates
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {prioritizedLowCtrPages.map((page, idx) => {
                    const focusKeyword = page.focusKeywords?.[0] || null;
                    const focusKeywordLower = focusKeyword
                      ? focusKeyword.toLowerCase()
                      : null;
                    const additionalKeywords = (page.keywords || []).filter(
                      (keyword) =>
                        keyword &&
                        keyword.toLowerCase() !== focusKeywordLower &&
                        keyword !== focusKeyword
                    );

                    return (
                      <li key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="text-red-600 h-4 w-4 flex-shrink-0" />
                          <a
                            href={page.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00BF63] underline truncate"
                          >
                            {page.page}
                          </a>
                          {focusKeyword && (
                            <Badge variant="secondary" className="ml-auto">
                              Focus keyword
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground pl-6">
                          {page.impressions} impressions, {page.clicks} clicks (
                          {page.ctr} CTR)
                        </div>
                        <div className="pl-6 text-xs text-muted-foreground">
                          {focusKeyword ? (
                            <div className="flex flex-col gap-1">
                              <span>
                                Primary keyword:&nbsp;
                                <span className="font-medium text-foreground">
                                  {focusKeyword}
                                </span>
                              </span>
                              {additionalKeywords.length > 0 && (
                                <span>
                                  Other low-CTR queries:&nbsp;
                                  {additionalKeywords.join(", ")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span>
                              Primary keyword:&nbsp;
                              {page.primaryKeyword || "—"}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <div className="text-center py-6">
                <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                  <Unlink className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Connect Google Search Console
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Find pages with low click-through rates and fix them to improve your SEO performance
                </p>
                <Button onClick={requestGSCAuthToken}>Connect GSC</Button>
              </div>
            )}
            {focusKeywordsNotShownLowCtr.length > 0 && (
              <div className="mt-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-sm">
                <p className="font-semibold mb-2">Focus keywords not showing up here yet</p>
                <p className="text-xs text-muted-foreground mb-3">
                  These keywords are on your focus list, but they haven&apos;t hit the Low CTR threshold. Keep optimizing their pages so they start appearing here.
                </p>
                <ul className="space-y-2">
                  {focusKeywordsNotShownLowCtr.map(({ keyword, data, page }) => (
                    <li key={keyword} className="flex flex-col gap-1 rounded-sm bg-background/60 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{keyword}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Focus
                        </Badge>
                      </div>
                      {data ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{data.impressions} impressions</span>
                          <span>Pos. {data.position}</span>
                          {(page || data.page) && (
                            <a
                              href={page || data.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00BF63] underline"
                            >
                              View page
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>No Search Console data yet for this keyword.</span>
                          {page && (
                            <a
                              href={page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00BF63] underline"
                            >
                              View page
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI-Generated Content Opportunities */}
        <Card
          className={cn(
            "col-span-full md:col-span-1 h-full border-red-200 shadow-red-100 transition-all",
            hasFocusKeywords && "border-primary/40 shadow-[0_0_0_1px_rgba(0,191,99,0.15)]"
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Extra Opportunities
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                    High Priority
                  </span>
                </CardTitle>
                <CardDescription>
                  Discover new keywords and content ideas to expand your reach and attract new customers.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/generic-keywords">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGscConnected ? (
              shouldShowLoader ? (
                <div className="text-center py-8">
                  <SquashBounceLoader size="lg" className="mb-4" />
                  <p className="text-sm text-muted-foreground">Loading opportunities...</p>
                </div>
              ) : (
                <GenericKeywordCard gscKeywords={gscKeywords} />
              )
            ) : (
              <div className="text-center py-6">
                <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                  <Unlink className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Connect Google Search Console
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Find generic keyword opportunities to attract new customers
                </p>
                <Button onClick={requestGSCAuthToken}>Connect GSC</Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Generic Keyword Opportunities Row */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"> */}
        {/* Non-Branded Keywords Already Ranking */}
        {/* <Card className="border-green-200 shadow-green-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Generic Keywords Already Ranking
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    Low Priority
                  </span>
                </CardTitle>
                <CardDescription>
                  Non-branded keywords you&apos;re already ranking for in the last {dateRange === "all" ? "year" : `${dateRange} days`} (showing top 4)
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/generic-keywords-ranking">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGscConnected ? (
              shouldShowLoader || isFilteringKeywords ? (
                <div className="text-center py-8">
                  <SquashBounceLoader size="lg" className="mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {isFilteringKeywords ? 'AI is filtering keywords...' : 'Loading keywords...'}
                  </p>
                </div>
              ) : nonBrandedKeywords.length === 0 ? (
                <div className="text-center py-6">
                  <div className="bg-muted inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    No generic keywords found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Most of your keywords appear to be branded
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nonBrandedKeywords.map((keyword, index) => (
                    <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 text-sm">
                          &quot;{keyword.keyword}&quot;
                        </h4>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Position {keyword.position}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-green-600">{keyword.clicks}</span> clicks
                        </div>
                        <div>
                          <span className="font-medium text-green-600">{keyword.impressions}</span> impressions
                        </div>
                        <div>
                          <span className="font-medium text-green-600">{keyword.ctr}</span> CTR
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-6">
                <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                  <Unlink className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Connect Google Search Console
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  See your generic keywords that are already ranking
                </p>
                <Button onClick={requestGSCAuthToken}>Connect GSC</Button>
              </div>
            )}
          </CardContent>
        </Card> */}

        {/* Easy Win Opportunities Card */}
        {/* <Card className="border-yellow-200 shadow-yellow-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Easy Win Opportunities
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                    Medium Priority
                  </span>
                </CardTitle>
                <CardDescription>
                  Keywords close to ranking on Page 1 in the last {dateRange === "all" ? "year" : `${dateRange} days`}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/easy-wins">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGscConnected ? (
              shouldShowLoader ? (
                <div className="text-center py-8">
                  <SquashBounceLoader size="lg" className="mb-4" />
                  <p className="text-sm text-muted-foreground">Loading opportunities...</p>
                </div>
              ) : easyWins.length === 0 ? (
                <div className="text-center py-6">
                  <div className="bg-green-100 dark:bg-green-900/20 inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    🎉 No easy wins needed!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-300">
                    Your keywords are already performing well
                  </p>
                </div>
              ) : (
                <KeywordTable
                  keywords={easyWins}
                  title="Low Hanging Fruit"
                  description="These keywords are on page 2 of search results. Focus on these for quick wins!"
                  showPagination={false}
                />
              )
            ) : (
              <div className="text-center py-6">
                <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                  <Unlink className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Connect Google Search Console
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Find keywords close to ranking on page 1 for quick SEO wins
                </p>
                <Button onClick={requestGSCAuthToken}>Connect GSC</Button>
              </div>
            )}
            {focusKeywordsNotShownInEasyWins.length > 0 && (
              <div className="mt-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-sm">
                <p className="font-semibold mb-2">Focus keywords not in Easy Wins yet</p>
                <p className="text-xs text-muted-foreground mb-3">
                  These keywords are on your radar but aren&apos;t close to page one yet. Keep working on their pages so they move into Easy Wins.
                </p>
                <ul className="space-y-2">
                  {focusKeywordsNotShownInEasyWins.map(({ keyword, data, page }) => (
                    <li key={keyword} className="flex flex-col gap-1 rounded-sm bg-background/60 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{keyword}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Focus
                        </Badge>
                      </div>
                      {data ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{data.impressions} impressions</span>
                          <span>Pos. {data.position}</span>
                          {(page || data.page) && (
                            <a
                              href={page || data.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00BF63] underline"
                            >
                              View page
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>No Search Console data yet for this keyword.</span>
                          {page && (
                            <a
                              href={page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00BF63] underline"
                            >
                              View page
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card> */}
      {/* </div> */}

      {/* Content Expansion Row - Show for all users */}
      {/* {isGscConnected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ContentExpansionCard gscKeywords={gscKeywords} />
          <LongTailKeywordCard gscKeywords={gscKeywords} />
        </div>
      )} */}

      {/* Bottom Row - Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Performing Keywords Card */}
        <Card className="col-span-full md:col-span-1 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Top Performing Keywords
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full font-medium">
                    Insights
                  </span>
                </CardTitle>
                <CardDescription>
                  Your most clicked search terms in the last {dateRange === "all" ? "year" : `${dateRange} days`}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/top-keywords">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {shouldShowLoader ? (
              <div className="text-center py-8">
                <SquashBounceLoader size="lg" className="mb-4" />
                <p className="text-sm text-muted-foreground">Loading keywords...</p>
              </div>
            ) : (
              <KeywordTable keywords={gscKeywordsWithFocus} title="Top Keywords" />
            )}
          </CardContent>
        </Card>

        {/* Top Pages Card */}
        <Card className="col-span-full md:col-span-1 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Top Pages
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full font-medium">
                    Insights
                  </span>
                </CardTitle>
                <CardDescription>
                  Pages that appeared in search results in the last {dateRange === "all" ? "year" : `${dateRange} days`} (may include
                  0-click pages)
                </CardDescription>
              </div>
              {/* <Button variant="outline" size="sm">
                See More
              </Button> */}
            </div>
          </CardHeader>
          <CardContent>
            {shouldShowLoader ? (
              <div className="text-center py-8">
                <SquashBounceLoader size="lg" className="mb-4" />
                <p className="text-sm text-muted-foreground">Loading pages...</p>
              </div>
            ) : topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ul className="space-y-2">
                {topPages.map((page) => (
                  <li key={page.page} className="flex flex-col">
                    <a
                      href={page.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00BF63] underline truncate max-w-full"
                    >
                      {page.page}
                    </a>
                    <div className="text-sm text-muted-foreground">
                      {page.clicks} clicks
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      </div>

    </MainLayout>
  );
}
