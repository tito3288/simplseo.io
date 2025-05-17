"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import SeoRecommendationPanel from "../components/dashboard/SeoRecommendationPanel";
import MainLayout from "../components/MainLayout";
import SeoPerformanceCard from "../components/dashboard/SeoPerformanceCard";
import SeoImpactLeaderboard from "../components/dashboard/SeoImpactLeaderboard";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function LowCtrPage() {
  const { user, isLoading } = useAuth();
  const [lowCtrPages, setLowCtrPages] = useState([]);
  const [aiMeta, setAiMeta] = useState([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("gscAccessToken");
    const siteUrl = localStorage.getItem("gscSiteUrl");

    if (!savedToken || !siteUrl || !user?.id) return;

    fetchLowCtrPages(siteUrl, savedToken);
  }, [user]);

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

    if (!json.rows) return;

    const grouped = Object.values(
      json.rows
        .filter(
          (r) =>
            parseFloat((r.ctr * 100).toFixed(1)) === 0 && r.impressions > 20
        )
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
          <CardTitle>SEO Recommendations</CardTitle>
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

      {/* SEO Performance Comparison Card */}
      <div className="mb-6">
        <SeoPerformanceCard totalRecommendations={aiMeta.length} />{" "}
      </div>
      
      {/* SEO impact leaderboard */}
      <div className="mb-6">
        <SeoImpactLeaderboard />
      </div>
    </MainLayout>
  );
}
