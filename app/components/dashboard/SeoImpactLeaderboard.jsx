"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const SeoImpactLeaderboard = ({ totalRecommendations }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [implementedCount, setImplementedCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchLeaderboardData = async () => {
      setLoading(true);

      const q = query(
        collection(db, "implementedSeoTips"),
        where("userId", "==", user.id),
        where("status", "==", "implemented")
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => doc.data());
      setImplementedCount(docs.length);

      const deltas = docs
        .filter((doc) => doc.preStats && doc.postStats)
        .map((doc) => {
          const { preStats, postStats, pageUrl } = doc;
          return {
            pageUrl,
            impressionsDelta: postStats.impressions - preStats.impressions,
            clicksDelta: postStats.clicks - preStats.clicks,
            ctrDelta: postStats.ctr - preStats.ctr,
            positionDelta: postStats.position - preStats.position,
          };
        });

      // Sort by clicksDelta desc, then ctrDelta desc
      deltas.sort((a, b) => {
        if (b.clicksDelta !== a.clicksDelta) {
          return b.clicksDelta - a.clicksDelta;
        }
        return b.ctrDelta - a.ctrDelta;
      });

      setLeaderboardData(deltas);
      setLoading(false);
    };

    fetchLeaderboardData();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full mt-4" />
        </CardContent>
      </Card>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Progress</CardTitle>
          <CardDescription>Results from Your Updates</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your SEO results will appear here 7 days after you apply an AI
            suggestion. We&apos;ll show changes in impressions, clicks, and
            ranking—check back soon!
          </p>
          
          {/* Show countdown for implemented tips */}
          {implementedCount > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                📊 Implementation Status
              </h4>
              <p className="text-xs text-blue-700">
                You have {implementedCount} implemented SEO tip{implementedCount !== 1 ? 's' : ''}. 
                The Cloud Function will process these after 7 days and display the results here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
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

        <div className="space-y-4">
          {leaderboardData.map((item, idx) => {
            const cleanUrl = item.pageUrl
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "");

            const renderDelta = (label, value, invert = false) => {
              const isImprovement = invert ? value < 0 : value > 0;
              const formatted =
                label === "CTR" || label === "Position"
                  ? Number(value || 0).toFixed(2)
                  : value;

              return (
                <span
                  className={cn(
                    "inline-flex items-center text-sm",
                    isImprovement ? "text-green-600" : "text-red-600"
                  )}
                >
                  {isImprovement ? (
                    <ArrowUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDown className="h-3 w-3 mr-1" />
                  )}
                  {formatted}
                </span>
              );
            };

            return (
              <div
                key={idx}
                className="border rounded-md p-3 hover:bg-muted/50"
              >
                <div className="font-medium truncate">{cleanUrl}</div>
                <div className="grid grid-cols-4 text-muted-foreground text-sm mt-2 gap-2">
                  <div>
                    <strong>Impressions:</strong>
                    <br />
                    {renderDelta("Impressions", item.impressionsDelta)}
                  </div>
                  <div>
                    <strong>Clicks:</strong>
                    <br />
                    {renderDelta("Clicks", item.clicksDelta)}
                  </div>
                  <div>
                    <strong>CTR (%):</strong>
                    <br />
                    {renderDelta("CTR", item.ctrDelta.toFixed(2))}
                  </div>
                  <div>
                    <strong>Position:</strong>
                    <br />
                    {renderDelta("Position", item.positionDelta, true)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ NEW: Continuous Update Message */}
        <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600">🔄</span>
            <h4 className="text-sm font-medium text-green-900">
              Continuous Progress Tracking
            </h4>
          </div>
          <p className="text-xs text-green-700">
            Your SEO progress continues to update after the initial 7-day results. 
            The system monitors your performance daily and will show ongoing improvements 
            or declines. Check back regularly to see the latest progress!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SeoImpactLeaderboard;
