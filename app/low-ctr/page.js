"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebaseConfig";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { createGSCTokenManager } from "../lib/gscTokenManager";
import SeoRecommendationPanel from "../components/dashboard/SeoRecommendationPanel";
import MainLayout from "../components/MainLayout";
import SeoPerformanceCard from "../components/dashboard/SeoPerformanceCard";
import SeoImpactLeaderboard from "../components/dashboard/SeoImpactLeaderboard";
import { Button } from "@/components/ui/button";
import { fetchWpPages } from "../lib/fetchWpPages";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { useMinimumLoading } from "../hooks/use-minimum-loading";
import { Calendar, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ContentAuditPanel from "../components/dashboard/ContentAuditPanel";
import { Badge } from "@/components/ui/badge";
import { getFocusKeywords } from "../lib/firestoreHelpers";

// Helper function to create safe document IDs
const createSafeDocId = (userId, pageUrl) => {
  // Create a more unique hash to avoid collisions
  let hash = 0;
  for (let i = 0; i < pageUrl.length; i++) {
    const char = pageUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string and take first 8 chars
  const urlHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
  const finalId = `${userId}_${urlHash}`;
  
  // Debug logging
  console.log("🔍 createSafeDocId Debug:");
  console.log("  userId:", userId);
  console.log("  pageUrl:", pageUrl);
  console.log("  raw hash:", hash);
  console.log("  urlHash:", urlHash);
  console.log("  finalId:", finalId);
  console.log("  expectedId:", "c7uSLI9gpbUSoeRv05zeDklER763_3b0a68f3");
  console.log("  match:", finalId === "c7uSLI9gpbUSoeRv05zeDklER763_3b0a68f3");
  
  return finalId;
};

// ✅ Add filtering function at top
const isRelevantPage = (url) =>
  url.includes("bryandevelops.com/") &&
  !url.includes("/tag/") &&
  !url.includes("/category/") &&
  !url.includes("/event") &&
  !url.includes("/faq") &&
  !url.includes("/author/") &&
  !url.includes("/author/") &&
  !url.includes("/topics/") &&
  !url.includes("/rvm") &&
  !url.includes("wordpress-maintenance-support") &&
  !url.includes("post-format") &&
  !url.includes("sample") &&
  !url.includes("chat") &&
  !url.includes("blockquote") &&
  !url.includes("?") &&
  !url.includes("carousel") &&
  !url.includes("video") &&
  !url.includes("status") &&
  !url.includes("/wp-json") &&
  !url.includes("/feed") &&
  !url.match(/\/\d{4}\/\d{2}\/\d{2}/); // ✅ fixed

export default function LowCtrPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [lowCtrPages, setLowCtrPages] = useState([]);
  const [aiMetaByPage, setAiMetaByPage] = useState({});
  const [sitemapUrls, setSitemapUrls] = useState([]);
  const [implementedPages, setImplementedPages] = useState([]);
  const [pageImplementationDates, setPageImplementationDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState(28); // Default to 28 days
  const shouldShowLoader = useMinimumLoading(loading, 3000);
  const [focusKeywords, setFocusKeywords] = useState([]);
  const [focusKeywordAssignments, setFocusKeywordAssignments] = useState(
    new Map()
  );
  const [focusKeywordsLoaded, setFocusKeywordsLoaded] = useState(false);
  const [gscKeywordRows, setGscKeywordRows] = useState([]);
  const [viewMode, setViewMode] = useState("raw");
  const [userHasToggledView, setUserHasToggledView] = useState(false);

  useEffect(() => {
    const fetchGSCData = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const tokenManager = createGSCTokenManager(user.id);
        
        // Add a small delay to ensure tokens are stored
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const gscData = await tokenManager.getStoredGSCData();
        
        if (!gscData?.accessToken || !gscData?.siteUrl) {
          return;
        }

        // Get valid access token (refresh if needed)
        const validToken = await tokenManager.getValidAccessToken();
        if (!validToken) {
          return;
        }

        fetchLowCtrPages(gscData.siteUrl, validToken);
      } catch (error) {
        console.error("Error fetching GSC data:", error);
        setLoading(false);
      }
    };

    fetchGSCData();
  }, [user, timePeriod]); // Add timePeriod dependency

  useEffect(() => {
    const loadWpPages = async () => {
      const domain = "bryandevelops.com";
      const pages = await fetchWpPages(domain);
      setSitemapUrls(pages);
    };

    loadWpPages();
  }, []);

  // ✅ Fetch implemented pages and their implementation dates
  useEffect(() => {
    const fetchImplementedPages = async () => {
      if (!user?.id) return;

      const q = query(
        collection(db, "implementedSeoTips"),
        where("userId", "==", user.id),
        where("status", "==", "implemented")
      );

      const snapshot = await getDocs(q);
      const now = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

      const pageData = {};
      const eligiblePages = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.postStats && data.implementedAt) {
          const daysSince = (now - new Date(data.implementedAt).getTime()) / (1000 * 60 * 60 * 24);
          
          // Store implementation date for each page
          pageData[data.pageUrl] = {
            implementedAt: data.implementedAt,
            daysSince: daysSince,
            hasZeroClicks: data.postStats.clicks === 0
          };

          // Only add to eligible pages if 30+ days and 0 clicks
          if (daysSince >= 30 && data.postStats.clicks === 0) {
            eligiblePages.push(data.pageUrl);
          }
        }
      });

      setPageImplementationDates(pageData);
      setImplementedPages(eligiblePages);
    };

    fetchImplementedPages();
  }, [user]);

  useEffect(() => {
    const fetchFocus = async () => {
      if (!user?.id) return;
      try {
        const keywords = await getFocusKeywords(user.id);
        if (Array.isArray(keywords) && keywords.length > 0) {
          const keywordList = [];
          const assignments = new Map();
          keywords.forEach(({ keyword, pageUrl }) => {
            if (!keyword) return;
            keywordList.push(keyword);
            assignments.set(keyword.toLowerCase(), pageUrl || null);
          });
          setFocusKeywords(keywordList);
          setFocusKeywordAssignments(assignments);
        } else {
          setFocusKeywords([]);
          setFocusKeywordAssignments(new Map());
        }
      } catch (error) {
        console.error("Failed to load focus keywords:", error);
      }
      setFocusKeywordsLoaded(true);
    };

    fetchFocus();
  }, [user?.id]);

  // ✅ Memoized filtered sitemap pages
  const relevantPages = useMemo(
    () => sitemapUrls.filter(isRelevantPage),
    [sitemapUrls]
  );

  useEffect(() => {
    if (!focusKeywordsLoaded || userHasToggledView) return;
    if (focusKeywords.length > 0) {
      setViewMode("focus");
    } else {
      setViewMode("raw");
    }
  }, [focusKeywordsLoaded, focusKeywords.length, userHasToggledView]);

  const lowCtrUrls = useMemo(
    () => new Set(lowCtrPages.map((p) => p.page)),
    [lowCtrPages]
  );

  const orderedFocusKeywords = useMemo(
    () => (focusKeywords || []).map((keyword) => keyword.trim()).filter(Boolean),
    [focusKeywords]
  );

  const focusKeywordSet = useMemo(
    () => new Set(orderedFocusKeywords.map((keyword) => keyword.toLowerCase())),
    [orderedFocusKeywords]
  );

  const focusKeywordTopRows = useMemo(() => {
    const map = new Map();
    gscKeywordRows.forEach((row) => {
      const keyword = row.keys?.[0];
      const page = row.keys?.[1];
      if (!keyword || !focusKeywordSet.has(keyword.toLowerCase())) return;
      const impressions = row.impressions || 0;
      const position = row.position != null ? Number(row.position.toFixed(1)) : null;
      const entry = map.get(keyword.toLowerCase());
      if (!entry || impressions > entry.impressions) {
        map.set(keyword.toLowerCase(), {
          keyword,
          impressions,
          position,
          page,
        });
      }
    });
    return map;
  }, [gscKeywordRows, focusKeywordSet]);

  const focusKeywordsNotShown = useMemo(() => {
    const shown = new Set();
    lowCtrPages.forEach((page) => {
      page.keywords?.forEach((keyword) => {
        shown.add(keyword.toLowerCase());
      });
    });

    return orderedFocusKeywords
      .filter((keyword) => !shown.has(keyword.toLowerCase()))
      .map((keyword) => {
        const lower = keyword.toLowerCase();
        const data = focusKeywordTopRows.get(lower) || null;
        const mappedPage = focusKeywordAssignments.get(lower) || null;
        return {
          keyword,
          data,
          page: mappedPage ?? data?.page ?? null,
        };
      });
  }, [
    orderedFocusKeywords,
    lowCtrPages,
    focusKeywordTopRows,
    focusKeywordAssignments,
  ]);

  const focusLowCtrPages = useMemo(() => {
    if (!focusKeywordSet.size) return [];

    return lowCtrPages
      .map((page) => {
        const matchingKeywords = (page.keywords || []).filter((keyword) =>
          focusKeywordSet.has(keyword.toLowerCase())
        );
        if (!matchingKeywords.length) {
          return null;
        }

        const focusKeyword = matchingKeywords[0];
        const additionalKeywords = (page.keywords || []).filter((keyword) => {
          if (!keyword) return false;
          return !matchingKeywords.includes(keyword);
        });

        return {
          ...page,
          focusKeyword,
          matchingKeywords,
          additionalKeywords,
        };
      })
      .filter(Boolean);
  }, [lowCtrPages, focusKeywordSet]);

  const buildSuggestionKey = (pageUrl, focusKeyword) =>
    `${pageUrl}::${focusKeyword ? focusKeyword.toLowerCase() : "__none__"}`;

  const focusSuggestionTargets = useMemo(() => {
    const targets = focusLowCtrPages.map((page) => ({
      pageUrl: page.page,
      focusKeyword: page.focusKeyword,
      metrics: {
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
      },
      key: buildSuggestionKey(page.page, page.focusKeyword),
    }));

    const seen = new Set(targets.map((item) => item.pageUrl));

    focusKeywordsNotShown.forEach(({ keyword, data, page }) => {
      const pageUrl = page || data?.page;
      if (!pageUrl || seen.has(pageUrl)) return;
      seen.add(pageUrl);
      targets.push({
        pageUrl,
        focusKeyword: keyword,
        metrics: {
          impressions: data?.impressions ?? 0,
          clicks: data?.clicks ?? 0,
          ctr:
            data && typeof data.impressions === "number" && data.impressions > 0
              ? `${(((data.clicks ?? 0) / data.impressions) * 100).toFixed(1)}%`
              : "0%",
        },
        key: buildSuggestionKey(pageUrl, keyword),
      });
    });

    return targets;
  }, [focusLowCtrPages, focusKeywordsNotShown]);

  const rawSuggestionTargets = useMemo(
    () =>
      lowCtrPages.map((page) => ({
        pageUrl: page.page,
        focusKeyword: null,
        metrics: {
          impressions: page.impressions,
          clicks: page.clicks,
          ctr: page.ctr,
        },
        key: buildSuggestionKey(page.page, null),
      })),
    [lowCtrPages]
  );

  const suggestionTargets = useMemo(() => {
    if (viewMode === "focus") {
      if (focusSuggestionTargets.length > 0) {
        return focusSuggestionTargets;
      }
      return rawSuggestionTargets;
    }
    return rawSuggestionTargets;
  }, [viewMode, focusSuggestionTargets, rawSuggestionTargets]);

  const requestAiMeta = async ({
    pageUrl,
    focusKeyword: focusKeywordArg,
    key,
  }) => {
    try {
      const payload = {
        pageUrl,
        context: {
          source: "low-ctr-suggestions",
          ...(focusKeywordArg ? { focusKeyword: focusKeywordArg } : {}),
        },
        ...(focusKeywordArg ? { focusKeywords: [focusKeywordArg] } : {}),
      };

      const [titleRes, descRes] = await Promise.all([
        fetch("/api/seo-assistant/meta-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        fetch("/api/seo-assistant/meta-description", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      ]);

      if (!titleRes.ok) {
        console.error(`Title API error for ${pageUrl}:`, titleRes.status);
      }
      if (!descRes.ok) {
        console.error(`Description API error for ${pageUrl}:`, descRes.status);
      }

      const titleJson = titleRes.ok ? await titleRes.json() : { title: null };
      const descJson = descRes.ok ? await descRes.json() : { description: null };

      return {
        pageUrl,
        title: titleJson.title || "Suggested Title",
        description: descJson.description || "Suggested Description",
        focusKeyword: focusKeywordArg || null,
        key,
      };
    } catch (error) {
      console.error("Failed to fetch AI meta suggestions:", error);
      return {
        pageUrl,
        title: "Suggested Title",
        description: "Suggested Description",
        focusKeyword: focusKeywordArg || null,
        key,
      };
    }
  };

  useEffect(() => {
    const missing = suggestionTargets.filter(
      ({ key }) => !aiMetaByPage[key]
    );
    if (!missing.length) return;

    let cancelled = false;
    const loadSuggestions = async () => {
      const suggestions = await Promise.all(
        missing.map((target) => requestAiMeta(target))
      );
      if (cancelled) return;
      setAiMetaByPage((prev) => {
        const next = { ...prev };
        suggestions.forEach((entry) => {
          next[entry.key] = entry;
        });
        return next;
      });
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [suggestionTargets, aiMetaByPage]);


  // Helper function to check if a page is eligible for Content Quality Audit
  const isPageEligibleForContentAudit = (pageUrl) => {
    const pageData = pageImplementationDates[pageUrl];
    if (!pageData) return false;
    
    // Page must be implemented for 30+ days and have 0 clicks
    return pageData.daysSince >= 30 && pageData.hasZeroClicks;
  };

  const fetchLowCtrPages = async (siteUrl, token) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - timePeriod);

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
    if (!json.rows) {
      return;
    }
    setGscKeywordRows(json.rows);
    
    const filteredRows = json.rows.filter(
      (r) =>
        parseFloat((r.ctr * 100).toFixed(1)) <= 2 && r.impressions > 20
    );
    
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
              keywords: new Set(),
            };
          }
          acc[page].clicks += row.clicks;
          acc[page].impressions += row.impressions;
          const query = row.keys?.[0];
          if (query) {
            acc[page].keywords.add(query);
          }
          return acc;
        }, {})
    ).map((item) => ({
      ...item,
      ctr:
        item.impressions > 0
          ? `${((item.clicks / item.impressions) * 100).toFixed(1)}%`
          : "0%",
      keywords: Array.from(item.keywords || []),
    }));

    setLowCtrPages(grouped);

    const aiResults = await Promise.all(
      grouped.map((item) =>
        requestAiMeta({
          pageUrl: item.page,
          focusKeyword: (item.keywords || []).find((keyword) =>
            focusKeywordSet.has(keyword.toLowerCase())
          ) || null,
        })
      )
    );

    setAiMetaByPage((prev) => {
      const next = { ...prev };
      aiResults.forEach((entry) => {
        next[entry.pageUrl] = entry;
      });
      return next;
    });
    setLoading(false);
  };

  const PerformanceDelta = ({ pageUrl }) => {
    const [delta, setDelta] = useState(null);

    useEffect(() => {
      const fetchDelta = async () => {
        const docId = createSafeDocId(user.id, pageUrl);
        const snapshot = await getDoc(doc(db, "implementedSeoTips", docId));
        const data = snapshot.data();
        if (!data?.postStats || !data?.preStats) return;

        const deltaData = {
          impressions: data.postStats.impressions - data.preStats.impressions,
          clicks: data.postStats.clicks - data.preStats.clicks,
          ctr: (data.postStats.ctr - data.preStats.ctr).toFixed(4),
          position: (data.postStats.position - data.preStats.position).toFixed(
            2
          ),
        };

        setDelta(deltaData);
      };

      fetchDelta();
    }, [pageUrl]);

    if (!delta) return null;

    const cleanUrl = pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

    return (
      <li>
        <div className="text-sm">
          <strong>{cleanUrl}</strong>
          <ul className="list-disc ml-6 text-muted-foreground">
            <li>Impressions: {delta.impressions}</li>
            <li>Clicks: {delta.clicks}</li>
            <li>CTR: {delta.ctr}</li>
            <li>Position: {delta.position}</li>
          </ul>
        </div>
      </li>
    );
  };

  if (isLoading || !user) return null;

  if (shouldShowLoader) {
    return (
      <MainLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Low CTR Fixes</h1>
          <Button onClick={() => router.back()} variant="outline">
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <SquashBounceLoader size="lg" className="mb-4" />
              <p className="text-muted-foreground">Loading low CTR data...</p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const suggestionsToRender = suggestionTargets.map((target) => {
    const suggestion = aiMetaByPage[target.key];
    return {
      pageUrl: target.pageUrl,
      focusKeyword: target.focusKeyword,
      title: suggestion?.title || "Hang tight—we're crafting a fresh meta title.",
      description:
        suggestion?.description ||
        "Your AI-powered meta description will appear here shortly.",
    };
  });

  return (
    <MainLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Low CTR Fixes</h1>
        <Button onClick={() => router.back()} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      <p className="text-muted-foreground mb-4">
        These pages show up in Google search results but aren&apos;t getting many clicks. 
        This usually means your page titles and descriptions aren&apos;t compelling enough 
        to make people want to click. Try making them more attractive and keyword-focused!
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === "focus" ? "default" : "outline"}
            onClick={() => {
              setUserHasToggledView(true);
              setViewMode("focus");
            }}
            disabled={!focusKeywordSet.size}
          >
            Focus keywords view
          </Button>
          <Button
            variant={viewMode === "raw" ? "default" : "outline"}
            onClick={() => {
              setUserHasToggledView(true);
              setViewMode("raw");
            }}
          >
            Raw data view
          </Button>
        </div>
        {!focusKeywordSet.size && focusKeywordsLoaded && (
          <span className="text-xs text-muted-foreground">
            Add focus keywords on the dashboard to unlock the focus view.
          </span>
        )}
      </div>

      {viewMode === "focus" ? (
        <>
          <Card className="mb-6 border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle>Focus keywords with low CTR</CardTitle>
              <CardDescription>
                These focus keywords are showing up in search results but aren&apos;t getting clicks yet. Prioritize their titles and descriptions first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!focusKeywordSet.size ? (
                <p className="text-sm text-muted-foreground">
                  Add focus keywords on the dashboard to see prioritized alerts here.
                </p>
              ) : focusLowCtrPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Great news—none of your focus keywords are hitting the Low CTR threshold right now.
                </p>
              ) : (
                <ul className="space-y-3">
                  {focusLowCtrPages.map((page, idx) => (
                    <li key={idx} className="rounded-md border border-primary/30 bg-background/80 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="text-red-600 h-4 w-4 flex-shrink-0" />
                        <a
                          href={page.page}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00BF63] underline truncate"
                        >
                          {page.page}
                        </a>
                        <Badge variant="secondary">Focus keyword</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {page.impressions} impressions, {page.clicks} clicks ({page.ctr} CTR)
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex flex-col gap-1">
                        <span>
                          Primary keyword:&nbsp;
                          <span className="font-medium text-foreground">
                            {page.focusKeyword}
                          </span>
                        </span>
                        {page.additionalKeywords?.length > 0 && (
                          <span>
                            Other low-CTR queries:&nbsp;
                            {page.additionalKeywords.join(", ")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {focusKeywordsNotShown.length > 0 && (
            <Card className="mb-6 border-dashed border-muted-foreground/30 bg-muted/30">
              <CardHeader>
                <CardTitle>Keep an eye on your focus keywords</CardTitle>
                <CardDescription>
                  These keywords are on your focus list but haven&apos;t triggered Low CTR warnings yet. Optimize their pages to drive more impressions and clicks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {focusKeywordsNotShown.map(({ keyword, data, page }) => (
                    <li
                      key={keyword}
                      className="rounded-md bg-background p-3 shadow-sm border border-muted/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{keyword}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Focus keyword
                        </Badge>
                      </div>
                      {data ? (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{data.impressions} impressions</span>
                          {typeof data.position === "number" && (
                            <span>Avg. position {data.position}</span>
                          )}
                          {(page || data.page) && (
                            <a
                              href={page || data.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00BF63] underline"
                            >
                              View ranking page
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          We don&apos;t have enough Search Console data for this keyword yet.
                          {page && (
                            <>
                              {" "}
                              <a
                                href={page}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00BF63] underline"
                              >
                                View page
                              </a>
                            </>
                          )}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        Try updating the page&apos;s title, meta description, and on-page content to target this keyword more directly.
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Raw Low CTR Data</CardTitle>
                <CardDescription>
                  Pages with low click-through rates (2% or less) - these need better titles and descriptions
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Last {timePeriod} days
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTimePeriod(7)}>
                    Last 7 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimePeriod(28)}>
                    Last 28 days
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            {lowCtrPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues found</p>
            ) : (
              <ul className="space-y-2">
                {lowCtrPages.map((page, idx) => {
                  const focusMatch = page.keywords?.find((keyword) =>
                    focusKeywordSet.has(keyword.toLowerCase())
                  );
                  const primaryKeyword = focusMatch || page.keywords?.[0] || null;
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
                        {focusMatch && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            Focus keyword
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground pl-6">
                        {page.impressions} impressions, {page.clicks} clicks ({page.ctr} CTR)
                      </div>
                      {primaryKeyword && (
                        <div className="pl-6 text-xs text-muted-foreground">
                          Keyword: {primaryKeyword}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI-Powered SEO Suggestions</CardTitle>
          <CardDescription>
            AI-generated title and meta description suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestionsToRender.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AI suggestions available yet.
            </p>
          ) : (
            suggestionsToRender.map((meta, idx) => {
              const cleanUrl = meta.pageUrl
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "");
              const titlePrefix = meta.focusKeyword ? "Focus" : "Fix";
              return (
                <SeoRecommendationPanel
                  key={idx}
                  title={`${titlePrefix}: ${cleanUrl}`}
                  pageUrl={meta.pageUrl}
                  suggestedTitle={meta.title}
                  suggestedDescription={meta.description}
                />
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Content Audit Section */}
      {/* <Card className="mb-6">
        <CardHeader>
          <CardTitle>Content Quality Audit</CardTitle>
          <CardDescription>
            Analyze content quality, readability, and structure to improve SEO performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lowCtrPages.map((page, idx) => (
            <ContentAuditPanel
              key={idx}
              pageUrl={page.page}
              pageData={page}
            />
          ))}
        </CardContent>
      </Card> */}


      <div className="mb-6">
        <SeoImpactLeaderboard totalRecommendations={suggestionsToRender.length} />
      </div>


      {implementedPages.length > 0 && (
        <>
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Still No Clicks After 30 Days?</AlertTitle>
            <AlertDescription>
              That&apos;s okay — it&apos;s totally normal. SEO takes time and a bit of trial
              and error. To improve your chances, try these additional tips
              alongside your AI-generated title and description.
            </AlertDescription>
          </Alert>

          {/* Intent Mismatch Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Search Intent Analysis</CardTitle>
              <CardDescription>
                Check if your content matches what users are actually searching for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Sometimes low CTR happens because your content doesn&apos;t match the search intent. 
                Our intent mismatch analysis can help identify and fix these issues.
              </p>
              <Button 
                onClick={() => router.push("/intent-mismatch")}
                className="bg-[#00BF63] hover:bg-[#00BF63]/90"
              >
                Fix Intent Mismatches
              </Button>
            </CardContent>
          </Card>


          {/* Content Quality Audit Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Content Quality Audit</CardTitle>
              <CardDescription>
                These pages haven&apos;t gotten any clicks after 30 days. Analyze and improve 
                their content quality to boost SEO performance and rankings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const eligiblePages = lowCtrPages.filter((page) => isPageEligibleForContentAudit(page.page));
                
                if (eligiblePages.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">
                        No pages are eligible for Content Quality Audit yet.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pages become eligible 30 days after implementing AI suggestions and having 0 clicks.
                      </p>
                    </div>
                  );
                }
                
                return eligiblePages.map((page) => {
                  const pageData = pageImplementationDates[page.page];
                  return (
                    <div key={page.page} className="mb-4">
                      <div className="text-sm text-muted-foreground mb-2">
                        Implemented {Math.floor(pageData?.daysSince || 0)} days ago • 
                        {pageData?.hasZeroClicks ? ' No clicks yet' : ' Has clicks'}
                      </div>
                      <ContentAuditPanel
                        pageUrl={page.page}
                        pageData={page}
                      />
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>
        </>
      )}

    </MainLayout>
  );
}
