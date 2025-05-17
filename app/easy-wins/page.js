"use client";

import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import MainLayout from "../components/MainLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import SeoTitleSuggestionPanel from "../components/dashboard/SeoTitleSuggestionPanel";

export default function EasyWinsPage() {
  const { user, isLoading } = useAuth();
  const [gscKeywords, setGscKeywords] = useState([]);
  const [generatedTitles, setGeneratedTitles] = useState([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("gscAccessToken");
    const savedSiteUrl = localStorage.getItem("gscSiteUrl");

    if (savedToken && savedSiteUrl) {
      fetchEasyWinKeywords(savedSiteUrl, savedToken);
    }
  }, []);

  const fetchEasyWinKeywords = async (siteUrl, token) => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 28);

    const formatDate = (d) => d.toISOString().split("T")[0];
    const from = formatDate(startDate);
    const to = formatDate(today);

    try {
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

      const data = await res.json();

      if (!data.rows) return;

      const formatted = data.rows.map((row) => ({
        keyword: row.keys[0],
        page: row.keys[1],
        clicks: row.clicks,
        impressions: row.impressions,
        position: Math.round(row.position),
        ctr: `${(row.ctr * 100).toFixed(1)}%`,
      }));

      const easyWins = formatted.filter((kw) => {
        const pos = kw.position;
        const ctr = parseFloat(kw.ctr.replace("%", ""));
        return pos > 10 && pos <= 20 && ctr < 5;
      });

      setGscKeywords(easyWins);

      const aiResults = await Promise.all(
        easyWins.map(async (kw) => {
          const res = await fetch("/api/seo-assistant/meta-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageUrl: kw.page,
              keyword: kw.keyword,
              context: {
                type: "easy-win",
                targetKeyword: kw.keyword,
                goal: "improve ranking to page 1",
              },
            }),
          });

          const json = await res.json();
          return {
            ...kw,
            title: json.title || "Suggested Title",
          };
        })
      );

      setGeneratedTitles(aiResults);
    } catch (err) {
      console.error("❌ Failed to fetch easy win keywords", err);
    }
  };

  if (isLoading || !user) return null;

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Easy Win Opportunities</h1>
        <p className="text-muted-foreground">
          These are keywords currently ranking on page 2 of search results. With
          a bit of effort, they can hit page 1.
        </p>
      </div>

      {/* ✅ Card: Raw Easy Win Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Raw Easy Win Data</CardTitle>
          <CardDescription>
            Keywords with positions 11–20 and CTR &lt; 5%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gscKeywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No easy wins found.</p>
          ) : (
            <ul className="space-y-2">
              {gscKeywords.map((kw, idx) => (
                <li key={idx} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-yellow-500 h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">{kw.keyword}</span>
                  </div>
                  <div className="text-sm text-muted-foreground pl-6">
                    <a
                      href={kw.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00BF63] underline truncate"
                    >
                      {kw.page}
                    </a>
                    <div>
                      {kw.impressions} impressions, {kw.clicks} clicks, {kw.ctr}{" "}
                      CTR, position {kw.position}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ✅ Card: SEO Title Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Title Suggestions</CardTitle>
          <CardDescription>
            AI-generated title recommendations for easy-win keywords
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedTitles.map((item, idx) => (
            <SeoTitleSuggestionPanel
              key={idx}
              title={`Fix: ${item.keyword}`}
              keyword={item.keyword}
              pageUrl={item.page}
              suggestedTitle={item.title}
              suggestedDescription=""
            />
          ))}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
