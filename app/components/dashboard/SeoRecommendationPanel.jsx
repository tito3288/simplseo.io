"use client";

import { Copy } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { db } from "../../lib/firebaseConfig";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const SeoRecommendationPanel = ({
  title,
  pageUrl,
  metaTitleTip = "",
  metaDescriptionTip = "",
  suggestedTitle = "",
  suggestedDescription = "",
}) => {
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isImplemented, setIsImplemented] = useState(false);
  const [checking, setChecking] = useState(false);
  const [postStats, setPostStats] = useState(null);
  const [delta, setDelta] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCheckboxValue, setPendingCheckboxValue] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [daysSinceImplementation, setDaysSinceImplementation] = useState(null);
  const [thirtyDayProgress, setThirtyDayProgress] = useState(null);

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        `${
          type === "title" ? "Meta title" : "Meta description"
        } copied to clipboard`
      );
    } catch {
      toast.error("Failed to copy text");
    }
  };

  const handleImplementation = async (checked) => {
    setIsImplemented(checked);

    if (checked && user?.id && pageUrl) {
      try {
        const token = localStorage.getItem("gscAccessToken");
        const siteUrl = localStorage.getItem("gscSiteUrl");

        let preStats = { impressions: 0, clicks: 0, ctr: 0, position: 0 };

        if (token && siteUrl) {
          const res = await fetch("/api/gsc/page-metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, siteUrl, pageUrl }),
          });
          if (res.ok) preStats = await res.json();
        }

        const docId = `${user.id}_${encodeURIComponent(pageUrl)}`;
        await setDoc(
          doc(db, "implementedSeoTips", docId),
          {
            userId: user.id,
            pageUrl,
            implementedAt: new Date().toISOString(),
            title: suggestedTitle,
            description: suggestedDescription,
            status: "implemented",
            preStats,
          },
          { merge: true }
        );

        toast.success("✅ SEO tip marked as implemented.");
      } catch (err) {
        console.error("Failed to save implementation:", err);
        toast.error("❌ Failed to save to Firestore.");
      }
    }
  };

  const handleRefreshSuggestions = async () => {
    try {
      const titleRes = await fetch("/api/seo-assistant/meta-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl }),
      });
      const descRes = await fetch("/api/seo-assistant/meta-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl }),
      });

      await deleteDoc(doc(db, "seoMetaTitles", encodeURIComponent(pageUrl)));
      await deleteDoc(
        doc(db, "seoMetaDescriptions", encodeURIComponent(pageUrl))
      );

      toast.success("✨ New AI suggestions will appear on next refresh.");
    } catch (err) {
      console.error("Error refreshing suggestions:", err);
      toast.error("❌ Failed to refresh suggestions.");
    }
  };

  const onCheckboxChange = (checked) => {
    setPendingCheckboxValue(checked);
    if (checked) {
      setShowConfirmModal(true);
    } else {
      handleImplementation(false);
    }
  };

  useEffect(() => {
    const fetchExisting = async () => {
      if (!user?.id || !pageUrl) return;

      const docId = `${user.id}_${encodeURIComponent(pageUrl)}`;
      const snapshot = await getDoc(doc(db, "implementedSeoTips", docId));
      const data = snapshot.data();
      if (!data?.status || data.status !== "implemented") return;

      setIsImplemented(true);

      const implementedDate = new Date(data.implementedAt);
      const today = new Date();
      const days = Math.floor(
        (today - implementedDate) / (1000 * 60 * 60 * 24)
      );
      setDaysSinceImplementation(Math.min(days, 7)); // cap at 7 days

      const totalDays = Math.floor(
        (today - implementedDate) / (1000 * 60 * 60 * 24)
      );
      setDaysSinceImplementation(Math.min(totalDays, 7)); // already exists
      setThirtyDayProgress(Math.min(totalDays, 30)); // 👈 new state to track 30-day progress

      if (data.preStats && data.postStats) {
        setDelta({
          impressions: data.postStats.impressions - data.preStats.impressions,
          clicks: data.postStats.clicks - data.preStats.clicks,
          ctr: (data.postStats.ctr - data.preStats.ctr).toFixed(2),
          position: (data.postStats.position - data.preStats.position).toFixed(
            2
          ),
        });
      }

      const daysSince =
        (Date.now() - new Date(data.implementedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      const zeroClicks = data?.postStats?.clicks === 0;

      if (daysSince >= 30 && zeroClicks) {
        setShowRefreshButton(true);
      }
    };

    fetchExisting();
  }, [user, pageUrl]);

  return (
    <>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="w-full space-y-2"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 font-medium hover:bg-muted/50 data-[state=open]:bg-muted/50">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isImplemented ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary hover:text-primary/80 truncate"
            >
              {title.replace(/^Fix:\s*/, "")}
            </a>
          </div>
          <div className="text-muted-foreground">
            {isOpen ? "Hide details" : "Show details"}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Fix this SEO issue</h3>

          <div className="space-y-4">
            <div>
              <Label className="mb-2">Suggested Meta Title</Label>
              <div className="flex items-center justify-between">
                <Textarea
                  value={suggestedTitle}
                  readOnly
                  className="resize-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(suggestedTitle, "title")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{metaTitleTip}</p>
            </div>

            <div>
              <Label className="mb-2">Suggested Meta Description</Label>
              <div className="flex items-center justify-between">
                <Textarea
                  value={suggestedDescription}
                  readOnly
                  className="resize-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(suggestedDescription, "description")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {metaDescriptionTip}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {!isImplemented ? (
                <>
                  <Checkbox
                    id="implemented"
                    checked={isImplemented}
                    onCheckedChange={onCheckboxChange}
                  />
                  <Label htmlFor="implemented">
                    I've updated this on my site
                  </Label>
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  You’ve marked this as implemented.
                </div>
              )}
            </div>

            {isImplemented && daysSinceImplementation !== null && (
              <div className="space-y-4 mt-3 w-full">
                {/* 7-Day Progress */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Waiting for Results (7 Days)</span>
                    <span>{daysSinceImplementation}/7 days</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded">
                    <div
                      className="h-2 bg-green-500 rounded transition-all duration-500"
                      style={{
                        width: `${(daysSinceImplementation / 7) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your changes are being tracked! Google recommends waiting 7
                    days to let your SEO changes take effect. We’ll track
                    performance and show results in the SEO Progress section
                    once enough data is available.
                  </p>
                </div>

                {/* 30-Day Progress */}
                {thirtyDayProgress !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Check Back for New Ideas (30 Days)</span>
                      <span>{thirtyDayProgress}/30 days</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded">
                      <div
                        className="h-2 bg-blue-500 rounded transition-all duration-500"
                        style={{
                          width: `${(thirtyDayProgress / 30) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      No clicks after 30 days? You’ll be able to refresh this
                      recommendation and get updated suggestions tailored to
                      your page
                    </p>
                  </div>
                )}
              </div>
            )}

            {showRefreshButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleRefreshSuggestions}>
                    🔁 Try New Suggestions
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  No clicks after 30 days. Click to get fresh AI title and
                  description.
                </TooltipContent>
              </Tooltip>
            )}

            {/* {delta && (
              <div className="text-sm text-muted-foreground mt-2">
                <strong>📈 Performance Change (vs. before):</strong>
                <ul className="list-disc pl-4">
                  <li>Impressions: {delta.impressions}</li>
                  <li>Clicks: {delta.clicks}</li>
                  <li>CTR: {delta.ctr}</li>
                  <li>Position: {delta.position}</li>
                </ul>
              </div>
            )} */}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {showConfirmModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-md max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Confirm Update</h2>
            <p className="text-sm mb-4">
              Are you sure you've updated this SEO recommendation on your live
              site? This will impact your performance tracking.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingCheckboxValue(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowConfirmModal(false);
                  handleImplementation(true);
                }}
              >
                Yes, I’ve updated it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SeoRecommendationPanel;
