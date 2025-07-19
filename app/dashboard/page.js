"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebaseConfig";
import { createGSCTokenManager } from "../lib/gscTokenManager";
import MainLayout from "../components/MainLayout";
import { useRouter } from "next/navigation";
import SeoRecommendationPanel from "../components/dashboard/SeoRecommendationPanel";
import Link from "next/link";

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
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DateRangeFilter from "../components/dashboard/DateRangeFilter";
import KeywordTable from "../components/dashboard/KeywordTable";

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
  const [dateRange, setDateRange] = useState("7");
  const [topPages, setTopPages] = useState([]);
  const [lowCtrPages, setLowCtrPages] = useState([]);
  const [aiTips, setAiTips] = useState([]);
  const [generatedTitles, setGeneratedTitles] = useState([]);
  const [generatedMeta, setGeneratedMeta] = useState([]);

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
        }),
      });

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
        }),
      });

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
    if (isLoading || !user?.id) return;

    const checkGSCConnection = async () => {
      try {
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
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (gscAccessToken) {
      fetchAndMatchGSC(gscAccessToken);
    }
  }, [gscAccessToken, dateRange]);

  if (isLoading || !user) {
    return null; // or show a loader/spinner if you want
  }

  const fetchAndMatchGSC = async (token) => {
    if (!user?.id) return;
    const onboardingDoc = await getDoc(doc(db, "onboarding", user.id));
    const userWebsiteUrl = onboardingDoc.data()?.websiteUrl;

    const cleanDomain = userWebsiteUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    const potentialMatches = [
      `https://${cleanDomain}/`,
      `https://www.${cleanDomain}/`,
      `sc-domain:${cleanDomain}`,
    ];

    const res = await fetch(
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    const verifiedSites = data.siteEntry.map((site) => site.siteUrl);
    const match = potentialMatches.find((url) => verifiedSites.includes(url));

    if (match) {
      // Store site URL in Firestore
      const tokenManager = createGSCTokenManager(user.id);
      await tokenManager.storeTokens(null, token, match);
      
      fetchSearchAnalyticsData(match, token, dateRange);
    }
  };

  const requestGSCAuthToken = async () => {
    // Debug: Log what we're trying to do
    console.log("🔐 Starting GSC OAuth flow...");
    
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

                   await updateDoc(doc(db, "onboarding", user.id), { hasGSC: true });

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
            parseFloat(kw.ctr.replace("%", "")) === 0 && kw.impressions > 20
        );

        const grouped = Object.values(
          lowCtr.reduce((acc, item) => {
            if (!acc[item.page]) {
              acc[item.page] = { ...item, clicks: 0, impressions: 0 };
            }
            acc[item.page].clicks += item.clicks;
            acc[item.page].impressions += item.impressions;
            return acc;
          }, {})
        );

        setLowCtrPages(grouped);

        // 🔹 AI tips
        const ai = grouped.map((kw) => {
          return `Your page <a href="${kw.page}" class="underline">${kw.page}</a> is ranking but not getting clicks. Consider improving your title or meta description.`;
        });

        setAiTips(ai);
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
    }
  };

  const easyWins = gscKeywords.filter((kw) => {
    const pos = kw.position;
    const ctr = parseFloat(kw.ctr.replace("%", ""));
    return pos > 10 && pos <= 20 && ctr < 5;
  });

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
    >
      <div className="mb-6">
        <h1 className="text-5xl font-bold mb-2">
          Welcome {data?.name ? data.name.split(" ")[0] : ""}!<br/> <span className="text-3xl">SEO Dashboard</span>
        </h1>
        <p className="text-muted-foreground">
          Get insights and recommendations for improving your website&apos;s search
          performance
        </p>
      </div>
      <Card className="col-span-full mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Website Visitors</span>
            <DateRangeFilter
              value={dateRange}
              onValueChange={(value) => setDateRange(value)}
            />
          </CardTitle>
          <CardDescription>Track impressions over time</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Performing Keywords Card */}
        <Card className="col-span-full md:col-span-1 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Performing Keywords</CardTitle>
                <CardDescription>
                  Your most clicked search terms
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/top-keywords">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGscConnected ? (
              <KeywordTable keywords={gscKeywords} title="Top Keywords" />
            ) : (
              <div className="text-center py-6">
                <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                  <Unlink className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Connect Google Search Console
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  See your top keywords and rankings by connecting your Google
                  Search Console account
                </p>
                <Button onClick={requestGSCAuthToken}>Connect GSC</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Easy Win Opportunities Card */}
        <Card className="col-span-full md:col-span-1 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Easy Win Opportunities</CardTitle>
                <CardDescription>
                  Keywords close to ranking on Page 1
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/easy-wins">See More</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGscConnected ? (
              <KeywordTable
                keywords={easyWins}
                title="Low Hanging Fruit"
                description="These keywords are on page 2 of search results. Focus on these for quick wins!"
              />
            ) : (
              <div className="text-center py-6">
                <div className="bg-muted inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Connect to see opportunities
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Find keywords you&apos;re close to ranking for on page 1
                </p>
                <Button onClick={requestGSCAuthToken}>
                  Connect GSC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Top Pages Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Pages This Month Card */}
        <Card className="col-span-full md:col-span-1 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Pages This Month</CardTitle>
                <CardDescription>
                  Pages that appeared in search results this month (may include
                  0-click pages)
                </CardDescription>
              </div>
              {/* <Button variant="outline" size="sm">
                See More
              </Button> */}
            </div>
          </CardHeader>
          <CardContent>
            {topPages.length === 0 ? (
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

        {/* Low CTR Fixes Card */}
        <Card className="col-span-full md:col-span-1 h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Low CTR Fixes</CardTitle>
                <CardDescription>
                  These pages show up in searches but aren&apos;t getting many
                  clicks. Consider rewriting their titles and meta descriptions
                  to improve click-through rate.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/low-ctr">See More</Link>
              </Button>
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
      </div>

      {/* SEO Recommendations Section */}
      {/* <Card className="mb-6">
        <CardHeader>
          <CardTitle>SEO Recommendations</CardTitle>
          <CardDescription>
            AI-powered suggestions to improve your rankings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiTips.map((tip, idx) => {
            const match = tip.match(/href="(.*?)"/);
            const pageUrl = match?.[1] || "";
            const pageName = pageUrl
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "");

            const matchingMeta = generatedMeta.find(
              (item) => item.pageUrl === pageUrl
            );

            return (
              <SeoRecommendationPanel
                key={idx}
                title={`Fix: ${pageName}`}
                pageUrl={pageUrl} // ✅ Add this line
                suggestedTitle={matchingMeta?.title || "Loading..."}
                suggestedDescription={matchingMeta?.description || "Loading..."}
              />
            );
          })}
        </CardContent>
      </Card> */}

      {/* <Alert className="mb-6 border-primary/20 bg-primary/5">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Quick SEO Tip</AlertTitle>
        <AlertDescription>
          {data.businessType === "Dentist"
            ? "Add your business hours, services, and patient reviews to improve your local SEO as a dental practice."
            : `Add your business hours and location details to your website to improve your local SEO visibility in ${
                data.businessLocation || "your area"
              }.`}
        </AlertDescription>
      </Alert> */}
      {/* Getting Started Card */}
      {/* <Card>
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
      </Card> */}
    </MainLayout>
  );
}
