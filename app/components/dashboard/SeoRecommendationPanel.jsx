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

// Helper function to create safe document IDs
const createSafeDocId = (userId, pageUrl) => {
  // Create a more unique hash to avoid collisions
  let hash = 0;
  for (let i = 0; i < pageUrl.length; i++) {
    const char = pageUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string and take first 16 chars
  const urlHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
  return `${userId}_${urlHash}`;
};

// Helper function to capitalize first letter of each word
const capitalizeWords = (text) => {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const SeoRecommendationPanel = ({
  title,
  pageUrl,
  metaTitleTip = "",
  metaDescriptionTip = "",
  suggestedTitle = "",
  suggestedDescription = "",
  keywordSource = "gsc-existing", // "ai-generated" or "gsc-existing"
  focusKeyword = "",
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
  const [currentH1, setCurrentH1] = useState(null);
  const [loadingH1, setLoadingH1] = useState(false);

  const copyToClipboard = async (text, type) => {
    try {
      // Remove any surrounding quotes before copying
      const cleanText = text?.replace(/^["']|["']$/g, '') || '';
      await navigator.clipboard.writeText(cleanText);
      const typeLabel = 
        type === "title" ? "Meta title" :
        type === "description" ? "Meta description" :
        type === "h1" ? "H1" :
        "Text";
      toast.success(`${typeLabel} copied to clipboard`);
    } catch {
      toast.error("Failed to copy text");
    }
  };

  const handleImplementation = async (checked) => {
    setIsImplemented(checked);

    if (checked && user?.id && pageUrl) {
      try {
        // Get GSC data using the token manager
        const { createGSCTokenManager } = await import("../../lib/gscTokenManager");
        const tokenManager = createGSCTokenManager(user.id);
        
        let preStats = { impressions: 0, clicks: 0, ctr: 0, position: 0 };
        let gscToken = null;
        let siteUrl = null;

        try {
          // Get stored GSC data
          const gscData = await tokenManager.getStoredGSCData();
          if (gscData?.accessToken && gscData?.siteUrl) {
            gscToken = gscData.accessToken;
            siteUrl = gscData.siteUrl;
            
            // Get valid access token
            const validToken = await tokenManager.getValidAccessToken();
            if (validToken) {
              const res = await fetch("/api/gsc/page-metrics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: validToken, siteUrl, pageUrl }),
              });
              if (res.ok) preStats = await res.json();
            }
          }
        } catch (error) {
          console.error("Error getting GSC data:", error);
        }

        const docId = createSafeDocId(user.id, pageUrl);
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
            gscToken, // Save the token for the Firebase function
            siteUrl,  // Save the site URL for the Firebase function
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
    console.log(`🔍 [${pageUrl}] useEffect triggered - checking if implemented`);
    const fetchExisting = async () => {
      if (!user?.id || !pageUrl) {
        console.log(`🔍 [${pageUrl}] Missing user.id or pageUrl, skipping`);
        return;
      }

      try {
        const docId = createSafeDocId(user.id, pageUrl);
        console.log(`🔍 [${pageUrl}] Fetching implementedSeoTips document:`, docId);
        const snapshot = await getDoc(doc(db, "implementedSeoTips", docId));
        const data = snapshot.data();
        console.log(`🔍 [${pageUrl}] Document data:`, data);
        
        // Check if document exists and has the right status
        if (!data || !data.status || data.status !== "implemented") {
          console.log(`🔍 [${pageUrl}] Document doesn&apos;t exist or status is not &apos;implemented&apos;`);
          return;
        }
        
        console.log(`✅ [${pageUrl}] Document found and status is 'implemented'`);

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
      } catch (error) {
        console.error(`❌ [${pageUrl}] Error fetching implementedSeoTips:`, error);
        console.error(`❌ [${pageUrl}] Error details:`, {
          code: error.code,
          message: error.message,
          docId: createSafeDocId(user.id, pageUrl)
        });
        return;
      }
    };

    fetchExisting();
  }, [user, pageUrl]);

  // Fetch H1 from pageContentCache for AI-generated keywords
  useEffect(() => {
    const fetchH1 = async () => {
      if (keywordSource !== "ai-generated" || !user?.id || !pageUrl) {
        return;
      }

      setLoadingH1(true);
      try {
        const response = await fetch("/api/page-content/get-h1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            pageUrl,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentH1(data.h1 || null);
        }
      } catch (error) {
        console.error("Error fetching H1:", error);
      } finally {
        setLoadingH1(false);
      }
    };

    if (isOpen && keywordSource === "ai-generated") {
      fetchH1();
    }
  }, [isOpen, keywordSource, user?.id, pageUrl]);

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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Fix this SEO issue</h3>
            {keywordSource === "ai-generated" && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                AI Suggested Keyword
              </span>
            )}
          </div>

          {keywordSource === "ai-generated" && focusKeyword && (
            <div className="rounded-md border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-3 mb-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Keyword: <span className="font-semibold">{focusKeyword}</span>
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Status: Not ranking yet (AI suggested)
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {keywordSource === "ai-generated" ? "Step 1: Optimize Meta Tags" : "Optimize Meta Tags"}
              </Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Suggested Meta Title</Label>
                  <div className="flex items-center justify-between">
                    <Textarea
                      value={suggestedTitle?.replace(/^["']|["']$/g, '') || ''}
                      readOnly
                      className="resize-none"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(suggestedTitle?.replace(/^["']|["']$/g, '') || '', "title")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Suggested Meta Description</Label>
                  <div className="flex items-center justify-between">
                    <Textarea
                      value={suggestedDescription?.replace(/^["']|["']$/g, '') || ''}
                      readOnly
                      className="resize-none"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(suggestedDescription?.replace(/^["']|["']$/g, '') || '', "description")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* H1 Replacement Section for AI-generated keywords */}
            {keywordSource === "ai-generated" && focusKeyword && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                <Label className="mb-3 block font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Step 2: Update Page Content
                </Label>
                {loadingH1 ? (
                  <p className="text-sm text-muted-foreground">Loading current H1...</p>
                ) : currentH1 ? (
                  <div className="space-y-3">
                    <div className="rounded-md border bg-background p-3 space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Current H1: <span className="text-muted-foreground/70 font-normal">(H1 is the header/title in your page)</span></span>
                        <div className="mt-1 p-2 bg-muted/50 rounded border border-muted">
                          <span className="font-medium text-foreground">{currentH1}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center text-muted-foreground">
                        ↓
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Replace with:</span>
                        <div className="mt-1 p-2 bg-primary/10 rounded border border-primary/30">
                          <span className="font-semibold text-primary">{capitalizeWords(focusKeyword)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(capitalizeWords(focusKeyword), "h1")}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy H1 Replacement
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Suggested H1:</span>
                        <div className="mt-1 p-2 bg-primary/10 rounded border border-primary/30">
                          <span className="font-semibold text-primary">{capitalizeWords(focusKeyword)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(capitalizeWords(focusKeyword), "h1")}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy H1 Replacement
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  💡 <strong>Why:</strong> This keyword isn&apos;t ranking yet. Adding it to your H1 helps Google understand what this page is about.
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              {!isImplemented ? (
                <>
                  <Checkbox
                    id="implemented"
                    checked={isImplemented}
                    onCheckedChange={onCheckboxChange}
                  />
                  <Label htmlFor="implemented">
                    I&apos;ve updated this on my site
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
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Waiting for Results (7 Days)</span>
                    <span>{daysSinceImplementation}/7 days</span>
                  </div>
                  <div className="h-2 w-full rounded bg-muted/60">
                    <div
                      className="h-2 rounded bg-primary transition-all duration-500"
                      style={{
                        width: `${(daysSinceImplementation / 7) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your changes are being tracked! Google recommends waiting 7
                    days to let your SEO changes take effect. We&apos;ll track
                    performance and show results in the SEO Progress section
                    once enough data is available.
                  </p>
                </div>

                {/* 30-Day Progress */}
                {thirtyDayProgress !== null && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Check Back for New Ideas (30 Days)</span>
                      <span>{thirtyDayProgress}/30 days</span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted/60">
                      <div
                        className="h-2 rounded bg-primary/70 transition-all duration-500"
                        style={{
                          width: `${(thirtyDayProgress / 30) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      No clicks after 30 days? You&apos;ll be able to refresh this
                      recommendation and get updated suggestions tailored to
                      your page
                    </p>
                  </div>
                )}

                {/* ✅ NEW: Continuous Progress Info */}
                <div className="mt-3 rounded border border-primary/20 bg-primary/10 p-2 text-xs text-primary">
                  <span className="font-medium">💡 Tip:</span> After 7 days, your progress will appear in the SEO Progress section below. 
                  The system continues monitoring your performance daily, so check back regularly for ongoing updates!
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg transition-colors">
            <h2 className="mb-2 text-lg font-semibold text-foreground">Confirm Update</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you&apos;ve updated this SEO recommendation on your live
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
