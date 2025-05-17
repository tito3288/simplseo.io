"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const SeoPerformanceCard = ({ totalRecommendations }) => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState("7");
  const [performanceData, setPerformanceData] = useState(null);
  const [implementedCount, setImplementedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchPerformanceData = async () => {
      setLoading(true);
      const q = query(
        collection(db, "implementedSeoTips"),
        where("userId", "==", user.id),
        where("status", "==", "implemented")
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => doc.data());

      setImplementedCount(docs.length);

      if (docs.length === 0) {
        setPerformanceData(null);
        setLoading(false);
        return;
      }

      const aggregated = {
        impressions: { before: 0, after: 0 },
        clicks: { before: 0, after: 0 },
        ctr: { before: 0, after: 0 },
        position: { before: 0, after: 0 },
      };

      let validCount = 0;

      docs.forEach((doc) => {
        if (doc.preStats && doc.postStats) {
          aggregated.impressions.before += doc.preStats.impressions;
          aggregated.impressions.after += doc.postStats.impressions;
          aggregated.clicks.before += doc.preStats.clicks;
          aggregated.clicks.after += doc.postStats.clicks;
          aggregated.ctr.before += doc.preStats.ctr;
          aggregated.ctr.after += doc.postStats.ctr;
          aggregated.position.before += doc.preStats.position;
          aggregated.position.after += doc.postStats.position;
          validCount++;
        }
      });

      if (validCount === 0) {
        setPerformanceData(null);
        setLoading(false);
        return;
      }

      aggregated.ctr.before /= validCount;
      aggregated.ctr.after /= validCount;
      aggregated.position.before /= validCount;
      aggregated.position.after /= validCount;

      const result = {
        impressions: {
          before: aggregated.impressions.before,
          after: aggregated.impressions.after,
          percentChange: calcPercentChange(
            aggregated.impressions.before,
            aggregated.impressions.after
          ),
          isImprovement:
            aggregated.impressions.after >= aggregated.impressions.before,
        },
        clicks: {
          before: aggregated.clicks.before,
          after: aggregated.clicks.after,
          percentChange: calcPercentChange(
            aggregated.clicks.before,
            aggregated.clicks.after
          ),
          isImprovement: aggregated.clicks.after >= aggregated.clicks.before,
        },
        ctr: {
          before: aggregated.ctr.before,
          after: aggregated.ctr.after,
          percentChange: calcPercentChange(
            aggregated.ctr.before,
            aggregated.ctr.after
          ),
          isImprovement: aggregated.ctr.after >= aggregated.ctr.before,
        },
        position: {
          before: aggregated.position.before,
          after: aggregated.position.after,
          percentChange: calcPercentChange(
            aggregated.position.before,
            aggregated.position.after,
            true
          ),
          isImprovement:
            aggregated.position.after <= aggregated.position.before,
        },
      };

      result.overallPositive =
        result.impressions.isImprovement ||
        result.clicks.isImprovement ||
        result.ctr.isImprovement ||
        result.position.isImprovement;

      setPerformanceData(result);
      setLoading(false);
    };

    fetchPerformanceData();
  }, [user, selectedPeriod]);

  const calcPercentChange = (before, after, invert = false) => {
    if (before === 0) return 0;
    const change = ((after - before) / before) * 100;
    return invert ? -change : change;
  };

  const formatPercent = (value) =>
    value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full mt-4" />
        </CardContent>
      </Card>
    );
  }

  if (!performanceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No implemented SEO tips with tracked results yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>SEO Performance Comparison</span>
          <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <TabsList className="grid grid-cols-3 max-w-xs">
              <TabsTrigger value="7">Last 7 days</TabsTrigger>
              <TabsTrigger value="28">Last 28 days</TabsTrigger>
              <TabsTrigger value="90">Last 3 months</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex justify-between items-center text-sm mb-1">
            <span>
              Implemented {implementedCount} of {totalRecommendations} SEO
              recommendations
            </span>
            <span>
              {totalRecommendations === 0
                ? "0%"
                : Math.min(
                    (implementedCount / totalRecommendations) * 100,
                    100
                  ).toFixed(0) + "%"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{
                width: `${Math.min(
                  (implementedCount / totalRecommendations) * 100,
                  100
                ).toFixed(0)}%`,
              }}
            ></div>
          </div>
        </div>

        <div
          className={`text-lg font-semibold mb-4 p-3 rounded-md ${
            performanceData.overallPositive
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {performanceData.overallPositive
            ? "Great improvement! Your SEO performance is trending upward."
            : "Needs more time. Some metrics need attention to improve overall performance."}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Metric</th>
                <th className="text-right py-3 px-4">Before</th>
                <th className="text-right py-3 px-4">After</th>
                <th className="text-right py-3 px-4">Change</th>
              </tr>
            </thead>
            <tbody>
              {["impressions", "clicks", "ctr", "position"].map((metric) => (
                <tr key={metric} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">
                    {metric === "ctr"
                      ? "CTR (%)"
                      : metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </td>
                  <td className="text-right py-3 px-4">
                    {metric === "ctr" || metric === "position"
                      ? performanceData[metric].before.toFixed(1)
                      : performanceData[metric].before.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4">
                    {metric === "ctr" || metric === "position"
                      ? performanceData[metric].after.toFixed(1)
                      : performanceData[metric].after.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4">
                    <span
                      className={cn(
                        "inline-flex items-center",
                        performanceData[metric].isImprovement
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {performanceData[metric].isImprovement ? (
                        <ArrowUp className="h-4 w-4 mr-1" />
                      ) : (
                        <ArrowDown className="h-4 w-4 mr-1" />
                      )}
                      {formatPercent(performanceData[metric].percentChange)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default SeoPerformanceCard;
