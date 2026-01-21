"use client";

import { useEffect, useRef, useState } from "react";
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
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, RefreshCw, Clock, History, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Helper function to convert position to Google page number
const getGooglePage = (position) => {
  if (!position || position <= 0) return 1;
  return Math.ceil(position / 10);
};

// Render position with page number prominently displayed
const renderPositionWithPage = (position, size = "default") => {
  const pageNum = getGooglePage(position);
  const positionFixed = position?.toFixed(2) || "0.00";
  
  if (size === "large") {
    return (
      <>
        <span className="font-bold text-lg">Page {pageNum}</span>
        <br />
        <span className="text-xs text-muted-foreground">Pos. {positionFixed}</span>
      </>
    );
  }
  
  return (
    <>
      <span className="font-medium">Page {pageNum}</span>
      <br />
      <span className="text-[10px] text-muted-foreground">Pos. {positionFixed}</span>
    </>
  );
};

const SeoImpactLeaderboard = ({ totalRecommendations }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [pendingData, setPendingData] = useState([]); // Items waiting for 7-day results
  const [implementedCount, setImplementedCount] = useState(0);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const expandedContentRefs = useRef(new Map());
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState(null);

  // CSV Download function
  const downloadHistoryCSV = () => {
    if (!selectedItemHistory) return;

    const cleanUrl = selectedItemHistory.pageUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    
    // CSV headers
    const headers = ["Page URL", "Date", "Day", "Impressions", "Imp. Change", "Clicks", "Clicks Change", "CTR", "Position", "Pos. Change"];
    
    // Build rows
    const rows = [];
    
    // Add baseline row
    const baseline = selectedItemHistory.preStats;
    rows.push([
      cleanUrl,
      new Date(selectedItemHistory.implementedAt).toLocaleDateString('en-US'),
      "Baseline",
      baseline.impressions,
      "0",
      baseline.clicks,
      "0",
      `${(baseline.ctr * 100).toFixed(2)}%`,
      baseline.position.toFixed(2),
      "0"
    ]);
    
    // Add history rows (sorted oldest to newest for CSV)
    const sortedHistory = [...(selectedItemHistory.postStatsHistory || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedHistory.forEach((snapshot) => {
      const impressionsDelta = snapshot.impressions - baseline.impressions;
      const clicksDelta = snapshot.clicks - baseline.clicks;
      const positionDelta = snapshot.position - baseline.position;
      
      rows.push([
        cleanUrl,
        new Date(snapshot.date).toLocaleDateString('en-US'),
        snapshot.dayNumber === Math.floor((Date.now() - new Date(selectedItemHistory.implementedAt).getTime()) / (1000 * 60 * 60 * 24)) 
          ? "Latest" 
          : `Day ${snapshot.dayNumber}`,
        snapshot.impressions,
        impressionsDelta >= 0 ? `+${impressionsDelta}` : impressionsDelta,
        snapshot.clicks,
        clicksDelta >= 0 ? `+${clicksDelta}` : clicksDelta,
        `${(snapshot.ctr * 100).toFixed(2)}%`,
        snapshot.position.toFixed(2),
        positionDelta <= 0 ? `↑${Math.abs(positionDelta).toFixed(1)}` : `↓${positionDelta.toFixed(1)}`
      ]);
    });
    
    // Convert to CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `seo-progress-${cleanUrl.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      // Items with both preStats and postStats (have results)
      const deltas = docs
        .filter((doc) => doc.preStats && doc.postStats)
        .map((doc) => {
          const { preStats, postStats, pageUrl, implementedAt, lastUpdated, updatedAt, postStatsHistory, nextUpdateDue, keywordStatsHistory, metaOptimizationHistory } = doc;
          return {
            pageUrl,
            implementedAt,
            lastUpdated,
            updatedAt,
            nextUpdateDue,
            preStats,
            postStats,
            postStatsHistory: postStatsHistory || [], // Include history array
            keywordStatsHistory: keywordStatsHistory || [], // Include previous keyword attempts
            metaOptimizationHistory: metaOptimizationHistory || [], // Include previous meta optimization history
            impressionsDelta: postStats.impressions - preStats.impressions,
            clicksDelta: postStats.clicks - preStats.clicks,
            ctrDelta: postStats.ctr - preStats.ctr,
            positionDelta: postStats.position - preStats.position,
          };
        });

      // Items with preStats but NO postStats yet (waiting for 7-day results)
      const pending = docs
        .filter((doc) => doc.preStats && !doc.postStats)
        .map((doc) => {
          const { preStats, pageUrl, implementedAt, nextUpdateDue } = doc;
          const now = Date.now();
          const implementedDate = new Date(implementedAt).getTime();
          const daysSince = Math.floor((now - implementedDate) / (1000 * 60 * 60 * 24));
          const daysUntilResults = Math.max(0, 7 - daysSince);
          const progressPercent = Math.min(100, (daysSince / 7) * 100);
          
          return {
            pageUrl,
            implementedAt,
            nextUpdateDue,
            preStats,
            daysSince,
            daysUntilResults,
            progressPercent,
          };
        })
        .sort((a, b) => a.daysUntilResults - b.daysUntilResults); // Show closest to completion first

      // Sort by clicksDelta desc, then ctrDelta desc
      deltas.sort((a, b) => {
        if (b.clicksDelta !== a.clicksDelta) {
          return b.clicksDelta - a.clicksDelta;
        }
        return b.ctrDelta - a.ctrDelta;
      });

      setLeaderboardData(deltas);
      setPendingData(pending);
      setLoading(false);
    };

    fetchLeaderboardData();
  }, [user]);

  const toggleRow = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const getExpandedContentRef = (index) => {
    if (!expandedContentRefs.current.has(index)) {
      expandedContentRefs.current.set(index, { current: null });
    }
    return expandedContentRefs.current.get(index);
  };

  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      console.log("🔄 Refreshing postStats data...");
      
      const response = await fetch('/api/refresh-poststats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          forceUpdate: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Refresh result:", result);

      // Refresh the data
      const fetchLeaderboardData = async () => {
        const q = query(
          collection(db, "implementedSeoTips"),
          where("userId", "==", user.id),
          where("status", "==", "implemented")
        );

        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map((doc) => doc.data());
        setImplementedCount(docs.length);

        // Items with both preStats and postStats (have results)
        const deltas = docs
          .filter((doc) => doc.preStats && doc.postStats)
          .map((doc) => {
            const { preStats, postStats, pageUrl, implementedAt, lastUpdated, updatedAt, postStatsHistory, nextUpdateDue, keywordStatsHistory, metaOptimizationHistory } = doc;
            return {
              pageUrl,
              implementedAt,
              lastUpdated,
              updatedAt,
              nextUpdateDue,
              preStats,
              postStats,
              postStatsHistory: postStatsHistory || [], // Include history array
              keywordStatsHistory: keywordStatsHistory || [], // Include previous keyword attempts
              metaOptimizationHistory: metaOptimizationHistory || [], // Include previous meta optimization history
              impressionsDelta: postStats.impressions - preStats.impressions,
              clicksDelta: postStats.clicks - preStats.clicks,
              ctrDelta: postStats.ctr - preStats.ctr,
              positionDelta: postStats.position - preStats.position,
            };
          });

        // Items with preStats but NO postStats yet (waiting for 7-day results)
        const pending = docs
          .filter((doc) => doc.preStats && !doc.postStats)
          .map((doc) => {
            const { preStats, pageUrl, implementedAt, nextUpdateDue } = doc;
            const now = Date.now();
            const implementedDate = new Date(implementedAt).getTime();
            const daysSince = Math.floor((now - implementedDate) / (1000 * 60 * 60 * 24));
            const daysUntilResults = Math.max(0, 7 - daysSince);
            const progressPercent = Math.min(100, (daysSince / 7) * 100);
            
            return {
              pageUrl,
              implementedAt,
              nextUpdateDue,
              preStats,
              daysSince,
              daysUntilResults,
              progressPercent,
            };
          })
          .sort((a, b) => a.daysUntilResults - b.daysUntilResults);

        deltas.sort((a, b) => {
          if (b.clicksDelta !== a.clicksDelta) {
            return b.clicksDelta - a.clicksDelta;
          }
          return b.ctrDelta - a.ctrDelta;
        });

        setLeaderboardData(deltas);
        setPendingData(pending);
      };

      await fetchLeaderboardData();
      
      alert("✅ Data refreshed successfully!");
      
    } catch (error) {
      console.error("❌ Refresh failed:", error);
      alert(`❌ Failed to refresh: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

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

  // Hide the card until user has clicked "I've updated this on my site" for the first time
  if (implementedCount === 0) {
    return null;
  }

  if (leaderboardData.length === 0 && pendingData.length === 0) {
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
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 p-3">
              <h4 className="mb-2 text-sm font-medium text-primary">
                📊 Implementation Status
              </h4>
              <p className="text-xs text-muted-foreground">
                You have {implementedCount} implemented SEO tip{implementedCount !== 1 ? 's' : ''}. 
                The Cloud Function will process these after 7 days and display the results here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show card even if only pending items exist (no completed results yet)
  if (leaderboardData.length === 0 && pendingData.length > 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>SEO Progress</CardTitle>
            {/* Refresh Data button - hidden for now
            <Button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            */}
          </div>
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
            <div className="h-2 w-full overflow-hidden rounded bg-muted/60">
              <div
                className="h-full rounded bg-blue-500 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    (implementedCount / totalRecommendations) * 100,
                    100
                  ).toFixed(0)}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Pending Items - Waiting for 7-day results */}
            {pendingData.map((item, idx) => {
              const cleanUrl = item.pageUrl
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "");

              return (
                <div
                  key={`pending-${idx}`}
                  className="border border-dashed border-amber-500/50 rounded-md overflow-hidden bg-amber-50/10 dark:bg-amber-900/10"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          In Progress
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.daysUntilResults > 0 
                          ? `${item.daysUntilResults} day${item.daysUntilResults !== 1 ? 's' : ''} until results`
                          : 'Results coming soon!'
                        }
                      </span>
                    </div>
                    
                    <div className="font-medium truncate mb-3">{cleanUrl}</div>
                    
                    {/* Progress bar to 7 days */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Day {item.daysSince} of 7</span>
                        <span>{Math.round(item.progressPercent)}%</span>
                      </div>
                      <Progress value={item.progressPercent} className="h-2" />
                    </div>

                    {/* Baseline Stats */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2">
                         Baseline (Before Implementation)
                      </h5>
                      <p className="text-xs text-muted-foreground mb-2">
                        Implemented on: {new Date(item.implementedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Impressions:</span>
                          <br />
                          <span className="font-medium">{item.preStats.impressions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clicks:</span>
                          <br />
                          <span className="font-medium">{item.preStats.clicks}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR:</span>
                          <br />
                          <span className="font-medium">{(item.preStats.ctr * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>
                          <br />
                          {renderPositionWithPage(item.preStats.position)}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                       We'll compare your new metrics after 7 days to show the impact of your changes.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Continuous Update Message */}
          <div className="mt-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              {/* <span className="text-blue-600 dark:text-blue-400">🔄</span> */}
              <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Continuous Progress Tracking
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Your SEO tracking doesn't stop after the first week! We monitor your performance daily and provide fresh insights <strong className="text-blue-600 dark:text-blue-400">every 7 days</strong>, so you can stay on top of your progress. Check back regularly to see the latest progress!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>SEO Progress</CardTitle>
          {/* Refresh Data button - hidden for now
          <Button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          */}
        </div>
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
          <div className="h-2 w-full overflow-hidden rounded bg-muted/60">
            <div
              className="h-full rounded bg-blue-500 transition-all duration-500"
              style={{
                width: `${Math.min(
                  (implementedCount / totalRecommendations) * 100,
                  100
                ).toFixed(0)}%`,
              }}
            ></div>
          </div>
        </div>

        {/* SEO Tip */}
        <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-semibold">💡 SEO Tip:</span> Your Impressions, Clicks and Position will move up and down week to week, This is normal, SEO takes time. <br></br>We share updates every 7 days so you can see progress as it happens, SEO changes usually take about 30 days to fully settle.
          </p>
        </div>

        <div className="space-y-3">
          {leaderboardData.map((item, idx) => {
            const cleanUrl = item.pageUrl
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "");
            const isExpanded = expandedRows.has(idx);
            const expandedRef = getExpandedContentRef(idx);
            // Use a large fixed value to ensure all content is visible
            const expandedMaxHeight = isExpanded ? "2000px" : "0px";

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
                className="border rounded-md overflow-hidden hover:bg-muted/50 transition-all duration-200"
              >
                {/* Main Row - Always Visible */}
                <div 
                  className="p-3 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleRow(idx)}
                >
                  <div className="flex-1">
                    <div className="font-medium truncate mb-2">{cleanUrl}</div>
                    <div className="grid grid-cols-4 text-muted-foreground text-sm gap-2">
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
                  
                  {/* Expand/Collapse Icon */}
                  <div className="ml-4 text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </div>
                </div>

                {/* Expanded Details - Show Before/After Comparison */}
                <div
                  className={cn(
                    "overflow-hidden bg-muted/30 transition-[max-height,opacity,padding] duration-300 ease-in-out",
                    isExpanded ? "border-t" : "border-t border-transparent"
                  )}
                  style={{
                    maxHeight: expandedMaxHeight,
                    opacity: isExpanded ? 1 : 0,
                    padding: isExpanded ? "1rem" : "0px",
                    pointerEvents: isExpanded ? "auto" : "none",
                  }}
                >
                  <div ref={(el) => { expandedRef.current = el; }} className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                       Detailed Metrics Comparison
                    </h4>
                    
                    {/* After (7+ Days) - Now shown first */}
                    <div className="bg-card rounded-lg p-3 border">
                      <h5 className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                         After (7+ Days)
                      </h5>
                      <div className="text-xs text-green-500 dark:text-green-400 mb-2">
                        Last updated: {new Date(item.lastUpdated || item.updatedAt || Date.now()).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })} • {Math.floor((new Date(item.lastUpdated || item.updatedAt || Date.now()).getTime() - new Date(item.implementedAt).getTime()) / (1000 * 60 * 60 * 24))} days since implementation
                      </div>
                      {item.nextUpdateDue && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 mb-3">
                           Next update: {new Date(item.nextUpdateDue).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Impressions:</span>
                          <br />
                          <span className="font-medium">{item.postStats.impressions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clicks:</span>
                          <br />
                          <span className="font-medium">{item.postStats.clicks}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR:</span>
                          <br />
                          <span className="font-medium">{(item.postStats.ctr * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>
                          <br />
                          {renderPositionWithPage(item.postStats.position)}
                        </div>
                      </div>
                    </div>

                    {/* Before (Implementation) - Now shown second */}
                    <div className="bg-card rounded-lg p-3 border">
                      <h5 className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                         Before (Implementation)
                      </h5>
                      <div className="text-xs text-blue-500 dark:text-blue-400 mb-3">
                        Implemented on: {new Date(item.implementedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Impressions:</span>
                          <br />
                          <span className="font-medium">{item.preStats.impressions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clicks:</span>
                          <br />
                          <span className="font-medium">{item.preStats.clicks}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR:</span>
                          <br />
                          <span className="font-medium">{(item.preStats.ctr * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>
                          <br />
                          {renderPositionWithPage(item.preStats.position)}
                        </div>
                      </div>
                    </div>

                    {/* Summary of Changes */}
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                      <h5 className="mb-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                         Summary of Changes
                      </h5>
                      <div className="text-xs text-muted-foreground">
                        <p>
                          <strong>Impressions:</strong> {item.impressionsDelta > 0 ? '+' : ''}{item.impressionsDelta} 
                          ({item.impressionsDelta > 0 ? 'improved' : 'decreased'})
                        </p>
                        <p>
                          <strong>Position:</strong> {item.positionDelta < 0 ? '+' : ''}{Math.abs(item.positionDelta).toFixed(2)} 
                          ({item.positionDelta < 0 ? 'improved ranking' : 'ranking decreased'})
                        </p>
                      </div>
                    </div>

                    {/* View History Button */}
                    {item.postStatsHistory && item.postStatsHistory.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 flex items-center justify-center gap-2 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemHistory(item);
                          setHistoryModalOpen(true);
                        }}
                      >
                        <History className="h-4 w-4" />
                        View Full History ({item.postStatsHistory.length} snapshot{item.postStatsHistory.length !== 1 ? 's' : ''})
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pending Items - Waiting for 7-day results */}
          {pendingData.map((item, idx) => {
            const cleanUrl = item.pageUrl
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "");

            return (
              <div
                key={`pending-${idx}`}
                className="border border-dashed border-amber-500/50 rounded-md overflow-hidden bg-amber-50/10 dark:bg-amber-900/10"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                        In Progress
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.daysUntilResults > 0 
                        ? `${item.daysUntilResults} day${item.daysUntilResults !== 1 ? 's' : ''} until results`
                        : 'Results coming soon!'
                      }
                    </span>
                  </div>
                  
                  <div className="font-medium truncate mb-3">{cleanUrl}</div>
                  
                  {/* Progress bar to 7 days */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Day {item.daysSince} of 7</span>
                      <span>{Math.round(item.progressPercent)}%</span>
                    </div>
                    <Progress value={item.progressPercent} className="h-2" />
                  </div>

                  {/* Baseline Stats */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">
                       Baseline (Before Implementation)
                    </h5>
                    <p className="text-xs text-muted-foreground mb-2">
                      Implemented on: {new Date(item.implementedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Impressions:</span>
                        <br />
                        <span className="font-medium">{item.preStats.impressions}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clicks:</span>
                        <br />
                        <span className="font-medium">{item.preStats.clicks}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CTR:</span>
                        <br />
                        <span className="font-medium">{(item.preStats.ctr * 100).toFixed(2)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Position:</span>
                        <br />
                        {renderPositionWithPage(item.preStats.position)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                     We'll compare your new metrics after 7 days to show the impact of your changes.
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ NEW: Continuous Update Message */}
        <div className="mt-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            {/* <span className="text-blue-600 dark:text-blue-400">🔄</span> */}
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Continuous Progress Tracking
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
          Your SEO tracking doesn't stop after the first week! We monitor your performance daily and provide fresh insights <strong className="text-blue-600 dark:text-blue-400">every 7 days</strong>, so you can stay on top of your progress. Check back regularly to see the latest progress!
          </p>
        </div>

        {/* History Modal */}
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  SEO Progress History
                </DialogTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadHistoryCSV}
                  className="flex items-center gap-2 mr-8"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </div>
              <DialogDescription>
                {selectedItemHistory && (
                  <span className="font-medium text-foreground">
                    {selectedItemHistory.pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedItemHistory && (
              <div 
                className="overflow-y-auto flex-1 pr-2 space-y-4"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent',
                }}
              >
                {/* Timeline of snapshots - LATEST first */}
                <div className="relative">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                     Progress Timeline
                  </h4>
                  
                  {/* Timeline line */}
                  <div className="absolute left-4 top-10 bottom-4 w-0.5 bg-gradient-to-b from-primary to-primary/20" />
                  
                  <div className="space-y-3">
                    {selectedItemHistory.postStatsHistory
                      .slice()
                      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Most recent first
                      .map((snapshot, idx) => {
                        // Calculate delta from baseline
                        const impressionsDelta = snapshot.impressions - selectedItemHistory.preStats.impressions;
                        const clicksDelta = snapshot.clicks - selectedItemHistory.preStats.clicks;
                        const positionDelta = snapshot.position - selectedItemHistory.preStats.position;
                        
                        return (
                          <div key={idx} className="relative pl-10">
                            {/* Timeline dot */}
                            <div className={cn(
                              "absolute left-2.5 w-3 h-3 rounded-full border-2 border-background",
                              idx === 0 ? "bg-green-500" : "bg-primary/60"
                            )} />
                            
                            <div className={cn(
                              "rounded-lg border",
                              idx === 0 ? "p-4 border-green-500/30 bg-green-50/10 dark:bg-green-900/10" : "p-3 border-muted"
                            )}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={cn(
                                  "font-medium uppercase tracking-wide",
                                  idx === 0 ? "text-sm text-green-600 dark:text-green-400" : "text-xs text-muted-foreground"
                                )}>
                                  {idx === 0 ? "Latest" : `Day ${snapshot.dayNumber}`}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(snapshot.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                              
                              <div className={cn(
                                "grid grid-cols-4 gap-3",
                                idx === 0 ? "text-base" : "text-sm"
                              )}>
                                <div>
                                  <span className="text-muted-foreground text-xs">Impressions</span>
                                  <p className={cn("font-semibold", idx === 0 && "text-lg")}>{snapshot.impressions}</p>
                                  <span className={cn(
                                    "text-xs",
                                    impressionsDelta >= 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {impressionsDelta >= 0 ? '+' : ''}{impressionsDelta}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Clicks</span>
                                  <p className={cn("font-semibold", idx === 0 && "text-lg")}>{snapshot.clicks}</p>
                                  <span className={cn(
                                    "text-xs",
                                    clicksDelta >= 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {clicksDelta >= 0 ? '+' : ''}{clicksDelta}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">CTR</span>
                                  <p className={cn("font-semibold", idx === 0 && "text-lg")}>{(snapshot.ctr * 100).toFixed(2)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Position</span>
                                  <p className={cn("font-bold", idx === 0 && "text-lg")}>
                                    Page {getGooglePage(snapshot.position)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Pos. {snapshot.position.toFixed(2)}</p>
                                  <span className={cn(
                                    "text-xs",
                                    positionDelta <= 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {positionDelta <= 0 ? '↑' : '↓'}{Math.abs(positionDelta).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Baseline (preStats) - at the bottom, smaller */}
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400">
                       Baseline (Before Implementation)
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      Implemented on: {new Date(selectedItemHistory.implementedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Impressions</span>
                      <p className="font-semibold text-sm">{selectedItemHistory.preStats.impressions}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Clicks</span>
                      <p className="font-semibold text-sm">{selectedItemHistory.preStats.clicks}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CTR</span>
                      <p className="font-semibold text-sm">{(selectedItemHistory.preStats.ctr * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Position</span>
                      <p className="font-bold text-sm">Page {getGooglePage(selectedItemHistory.preStats.position)}</p>
                      <p className="text-[10px] text-muted-foreground">Pos. {selectedItemHistory.preStats.position.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Previous Keyword Attempts - show history of pivoted keywords */}
                {selectedItemHistory.keywordStatsHistory && selectedItemHistory.keywordStatsHistory.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-amber-200 dark:border-amber-800">
                    <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                      🔄 Previous Keyword Attempts
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      These keywords were tried before pivoting to the current strategy.
                    </p>
                    <div className="space-y-4">
                      {selectedItemHistory.keywordStatsHistory.map((attempt, idx) => {
                        const finalStats = attempt.postStats || attempt.preStats;
                        const hasProgress = attempt.postStats && attempt.preStats;
                        const impressionsDelta = hasProgress ? attempt.postStats.impressions - attempt.preStats.impressions : 0;
                        const clicksDelta = hasProgress ? attempt.postStats.clicks - attempt.preStats.clicks : 0;
                        
                        return (
                          <div 
                            key={idx} 
                            className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 line-through">
                                  &quot;{attempt.keyword}&quot;
                                </span>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded",
                                  attempt.source === "ai-generated" 
                                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                )}>
                                  {attempt.source === "ai-generated" ? "✨ AI" : "🔍 GSC"}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {attempt.daysTracked} days tracked
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              {new Date(attempt.implementedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })} → {new Date(attempt.pivotedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground">Impressions</span>
                                <p className="font-semibold text-sm">{finalStats?.impressions || 0}</p>
                                {hasProgress && (
                                  <span className={cn(
                                    "text-xs",
                                    impressionsDelta >= 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {impressionsDelta >= 0 ? '+' : ''}{impressionsDelta}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Clicks</span>
                                <p className="font-semibold text-sm">{finalStats?.clicks || 0}</p>
                                {hasProgress && (
                                  <span className={cn(
                                    "text-xs",
                                    clicksDelta >= 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {clicksDelta >= 0 ? '+' : ''}{clicksDelta}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">CTR</span>
                                <p className="font-semibold text-sm">{((finalStats?.ctr || 0) * 100).toFixed(2)}%</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Position</span>
                                <p className="font-semibold text-sm">{(finalStats?.position || 0).toFixed(2)}</p>
                              </div>
                            </div>
                            {/* Show why it was pivoted */}
                            {attempt.postStats && attempt.postStats.clicks === 0 && (
                              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ Pivoted due to 0 clicks after {attempt.daysTracked} days
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Previous Meta Optimization History - show history from "Optimize Meta Only" */}
                {selectedItemHistory.metaOptimizationHistory && selectedItemHistory.metaOptimizationHistory.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-red-200 dark:border-red-800">
                    <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                      ⚡ Previous Meta Title/Description Attempts
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      These are the results from previous meta title &amp; description changes (same keyword, different copy).
                    </p>
                    <div className="space-y-4">
                      {selectedItemHistory.metaOptimizationHistory
                        .slice()
                        .sort((a, b) => new Date(b.optimizedAt) - new Date(a.optimizedAt))
                        .map((attempt, idx) => {
                          const finalStats = attempt.finalStats || attempt.preStats;
                          const hasProgress = attempt.finalStats && attempt.preStats;
                          const impressionsDelta = hasProgress ? attempt.finalStats.impressions - attempt.preStats.impressions : 0;
                          const clicksDelta = hasProgress ? attempt.finalStats.clicks - attempt.preStats.clicks : 0;
                          const positionDelta = hasProgress ? attempt.finalStats.position - attempt.preStats.position : 0;
                          
                          return (
                            <div 
                              key={idx} 
                              className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                    {attempt.type === "ctr-benchmark" ? "⚡ CTR Benchmark" : "📝 Meta Optimization"}
                                  </span>
                                  {attempt.keyword && (
                                    <span className="text-xs text-muted-foreground">
                                      Keyword: &quot;{attempt.keyword}&quot;
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {attempt.daysTracked} days tracked
                                </span>
                              </div>
                              
                              {/* Reason for optimization */}
                              {attempt.reason && (
                                <div className="text-xs text-red-600 dark:text-red-400 mb-2 bg-red-100/50 dark:bg-red-900/20 rounded px-2 py-1">
                                  {attempt.reason}
                                </div>
                              )}
                              
                              <div className="text-xs text-muted-foreground mb-3">
                                {new Date(attempt.implementedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })} → {new Date(attempt.optimizedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                              
                              {/* Stats comparison */}
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                {/* Pre stats */}
                                <div className="bg-white/50 dark:bg-gray-800/30 rounded p-2">
                                  <h6 className="text-xs font-medium text-muted-foreground mb-2">Before</h6>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Imp:</span> {attempt.preStats?.impressions || 0}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Clicks:</span> {attempt.preStats?.clicks || 0}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">CTR:</span> {((attempt.preStats?.ctr || 0) * 100).toFixed(2)}%
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Pos:</span> {(attempt.preStats?.position || 0).toFixed(1)}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Final stats */}
                                <div className="bg-white/50 dark:bg-gray-800/30 rounded p-2">
                                  <h6 className="text-xs font-medium text-muted-foreground mb-2">After ({attempt.daysTracked}d)</h6>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Imp:</span> {finalStats?.impressions || 0}
                                      {hasProgress && (
                                        <span className={cn("ml-1", impressionsDelta >= 0 ? "text-green-600" : "text-red-600")}>
                                          ({impressionsDelta >= 0 ? '+' : ''}{impressionsDelta})
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Clicks:</span> {finalStats?.clicks || 0}
                                      {hasProgress && (
                                        <span className={cn("ml-1", clicksDelta >= 0 ? "text-green-600" : "text-red-600")}>
                                          ({clicksDelta >= 0 ? '+' : ''}{clicksDelta})
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">CTR:</span> {((finalStats?.ctr || 0) * 100).toFixed(2)}%
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Pos:</span> {(finalStats?.position || 0).toFixed(1)}
                                      {hasProgress && (
                                        <span className={cn("ml-1", positionDelta <= 0 ? "text-green-600" : "text-red-600")}>
                                          ({positionDelta <= 0 ? '↑' : '↓'}{Math.abs(positionDelta).toFixed(1)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Show CTR benchmark fail indicator */}
                              {attempt.type === "ctr-benchmark" && attempt.finalStats?.clicks === 0 && (
                                <div className="text-xs text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-900/30 rounded px-2 py-1">
                                  🚨 CTR Benchmark Fail: Good position but 0 clicks - meta title wasn&apos;t compelling enough
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SeoImpactLeaderboard;
