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
import InternalLinkSuggestion from "../components/dashboard/InternalLinkSuggestion";
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

// ✅ Add filtering function at top
const isRelevantPage = (url) =>
  url.includes("bryandevelops.com/") &&
  !url.includes("/tag/") &&
  !url.includes("/category/") &&
  !url.includes("/event") &&
  !url.includes("/faq") &&
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
  const [lowCtrPages, setLowCtrPages] = useState([]);
  const [aiMeta, setAiMeta] = useState([]);
  const [sitemapUrls, setSitemapUrls] = useState([]);
  const [implementedPages, setImplementedPages] = useState([]);

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
      }
    };

    fetchGSCData();
  }, [user]);

  useEffect(() => {
    const loadWpPages = async () => {
      const domain = "bryandevelops.com";
      const pages = await fetchWpPages(domain);
      setSitemapUrls(pages);
    };

    loadWpPages();
  }, []);

  // ✅ Fetch implemented pages that have 0 clicks after 30 days
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

      const eligiblePages = snapshot.docs
        .map(doc => doc.data())
        .filter(data => {
          if (!data.postStats || !data.implementedAt) return false;
          
          const daysSince = (now - new Date(data.implementedAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince >= 30 && data.postStats.clicks === 0;
        })
        .map(data => data.pageUrl);

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
  };

  const PerformanceDelta = ({ pageUrl }) => {
    const [delta, setDelta] = useState(null);

    useEffect(() => {
      const fetchDelta = async () => {
        const docId = `${user.id}_${encodeURIComponent(pageUrl)}`;
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

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Low CTR Fixes</h1>
        <p className="text-muted-foreground">
          These pages appear in search but get very few clicks. Try improving
          their titles and meta descriptions.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Raw Low CTR Data</CardTitle>
          <CardDescription>
            Pages with impressions but 0% click-through rate
          </CardDescription>
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

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Suggested Internal Links</CardTitle>
              <CardDescription>
                These pages haven&apos;t gotten any clicks after 30 days. Try linking to
                them from other pages on your site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lowCtrPages.map((page) => (
                <InternalLinkSuggestion
                  key={page.page}
                  userId={user.id}
                  page={page.page}
                  targetPage={page.page}
                  lowCtrUrls={lowCtrUrls}
                  sitemapUrls={relevantPages}
                  implementedPages={implementedPages}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}

    </MainLayout>
  );
}
