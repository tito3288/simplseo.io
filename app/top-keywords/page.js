"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import MainLayout from "../components/MainLayout";
import KeywordTable from "../components/dashboard/KeywordTable";
import { Button } from "@/components/ui/button";
import { createGSCTokenManager } from "../lib/gscTokenManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function TopKeywordsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKeywords = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const tokenManager = createGSCTokenManager(user.id);
        
        // Get stored GSC data
        const gscData = await tokenManager.getStoredGSCData();
        
        if (!gscData?.accessToken || !gscData?.siteUrl) {
          setError("No Google Search Console data found. Please connect your GSC account first.");
          setLoading(false);
          return;
        }

        // Get valid access token
        const validToken = await tokenManager.getValidAccessToken();
        if (!validToken) {
          setError("Could not get valid access token. Please reconnect your GSC account.");
          setLoading(false);
          return;
        }

        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - 28);

        const from = startDate.toISOString().split("T")[0];
        const to = today.toISOString().split("T")[0];

        const res = await fetch(
          `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
            gscData.siteUrl
          )}/searchAnalytics/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${validToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              startDate: from,
              endDate: to,
              dimensions: ["query", "page"],
              rowLimit: 1000,
            }),
          }
        );

        const json = await res.json();

        if (json.rows) {
          const formatted = json.rows.map((row) => ({
            keyword: row.keys[0].replace(/^\[|\]$/g, ""),
            page: row.keys[1],
            clicks: row.clicks,
            impressions: row.impressions,
            position: Math.round(row.position),
            ctr: `${(row.ctr * 100).toFixed(1)}%`,
          }));

          setKeywords(formatted);
        } else {
          setError("No keyword data found. This could mean your site hasn't received any search traffic in the past 28 days.");
        }
      } catch (err) {
        console.error("❌ Failed to load keyword data:", err);
        setError("Failed to load keyword data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchKeywords();
  }, [user]);

  if (loading) {
    return (
      <MainLayout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Top Performing Keywords</h1>
          <Button onClick={() => router.back()} variant="outline">
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading keywords...</p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Top Performing Keywords</h1>
        <Button onClick={() => router.back()} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      <p className="text-muted-foreground mb-4">
        Full list of all your keywords tracked from Google Search Console in the
        past 28 days.
      </p>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Keywords</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <KeywordTable keywords={keywords} title="All Keywords" showPagination={false} />
      )}
    </MainLayout>
  );
}
