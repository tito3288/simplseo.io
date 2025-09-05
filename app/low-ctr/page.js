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
  const [aiMeta, setAiMeta] = useState([]);
  const [sitemapUrls, setSitemapUrls] = useState([]);
  const [implementedPages, setImplementedPages] = useState([]);
  const [pageImplementationDates, setPageImplementationDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState(28); // Default to 28 days
  const shouldShowLoader = useMinimumLoading(loading, 3000);

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
          return;
        }

        // Get valid access token (refresh if needed)
        const validToken = await tokenManager.getValidAccessToken();
        if (!validToken) {
          console.log("❌ Could not get valid access token");
          return;
        }

        console.log("✅ Got valid token, fetching low CTR pages...");
        fetchLowCtrPages(gscData.siteUrl, validToken);
      } catch (error) {
        console.error("❌ Error fetching GSC data:", error);
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

  // ✅ Memoized filtered sitemap pages
  const relevantPages = useMemo(
    () => sitemapUrls.filter(isRelevantPage),
    [sitemapUrls]
  );

  const lowCtrUrls = useMemo(
    () => new Set(lowCtrPages.map((p) => p.page)),
    [lowCtrPages]
  );

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
    console.log("🔍 GSC Raw Data:", json);
    if (!json.rows) {
      console.log("❌ No rows returned from GSC");
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

    const aiResults = await Promise.all(
      grouped.map(async (item) => {
        const [titleRes, descRes] = await Promise.all([
          fetch("/api/seo-assistant/meta-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageUrl: item.page,
              context: {
                lowCtrPages: grouped,
                goal: "improve CTR",
              },
            }),
          }),
          fetch("/api/seo-assistant/meta-description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageUrl: item.page,
              context: {
                lowCtrPages: grouped,
                goal: "improve CTR",
              },
            }),
          }),
        ]);

        const titleJson = await titleRes.json();
        const descJson = await descRes.json();

        return {
          pageUrl: item.page,
          title: titleJson.title || "Suggested Title",
          description: descJson.description || "Suggested Description",
        };
      })
    );

    setAiMeta(aiResults);
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

  return (
    <MainLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Low CTR Fixes</h1>
        <Button onClick={() => router.back()} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      <p className="text-muted-foreground mb-4">
        These pages appear in search but get very few clicks. Try improving
        their titles and meta descriptions.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Raw Low CTR Data</CardTitle>
              <CardDescription>
                Pages with impressions but 0% click-through rate
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
              {lowCtrPages.map((page, idx) => (
                <li key={idx} className="flex flex-col">
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
                  </div>
                  <div className="text-sm text-muted-foreground pl-6">
                    {page.impressions} impressions, {page.clicks} clicks (
                    {page.ctr} CTR)
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI-Powered SEO Suggestions</CardTitle>
          <CardDescription>
            AI-generated title and meta description suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiMeta.map((meta, idx) => {
            const cleanUrl = meta.pageUrl
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "");
            return (
              <SeoRecommendationPanel
                key={idx}
                title={`Fix: ${cleanUrl}`}
                pageUrl={meta.pageUrl}
                suggestedTitle={meta.title}
                suggestedDescription={meta.description}
              />
            );
          })}
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
        <SeoImpactLeaderboard totalRecommendations={aiMeta.length} />
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
