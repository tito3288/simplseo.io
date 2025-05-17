"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import MainLayout from "../components/MainLayout";
import KeywordTable from "../components/dashboard/KeywordTable";
import { Button } from "@/components/ui/button";

export default function TopKeywordsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("gscAccessToken");
    const siteUrl = localStorage.getItem("gscSiteUrl");
    if (!token || !siteUrl) return;

    const fetchData = async () => {
      try {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - 28);

        const from = startDate.toISOString().split("T")[0];
        const to = today.toISOString().split("T")[0];

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
              rowLimit: 1000,
            }),
          }
        );

        const json = await res.json();

        if (json.rows) {
          const formatted = json.rows.map((row) => ({
            keyword: row.keys[0],
            page: row.keys[1],
            clicks: row.clicks,
            impressions: row.impressions,
            position: Math.round(row.position),
            ctr: `${(row.ctr * 100).toFixed(1)}%`,
          }));

          setKeywords(formatted);
        }
      } catch (err) {
        console.error("❌ Failed to load keyword data:", err);
      }
    };

    fetchData();
  }, []);

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

      <KeywordTable keywords={keywords} title="All Keywords" />
    </MainLayout>
  );
}
