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
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";

const SeoRecommendationPanel = ({
  title,
  pageUrl,
  metaTitleTip = "Make the title specific to user intent",
  metaDescriptionTip = "Include your main keyword and a clear call to action",
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

  const handleCheckPostStats = async () => {
    setChecking(true);
    try {
      if (!user?.id || !pageUrl) return;

      const docId = `${user.id}_${encodeURIComponent(pageUrl)}`;
      const snapshot = await getDoc(doc(db, "implementedSeoTips", docId));
      const data = snapshot.data();
      if (!data) return;

      const daysSince =
        (Date.now() - new Date(data.implementedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        toast.info("📆 Wait 7–14 days for meaningful results.");
        return;
      }

      const token = localStorage.getItem("gscAccessToken");
      const siteUrl = localStorage.getItem("gscSiteUrl");
      if (!token || !siteUrl) {
        toast.error("Missing GSC credentials.");
        return;
      }

      const res = await fetch("/api/gsc/page-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, siteUrl, pageUrl }),
      });

      const newPostStats = await res.json();
      setPostStats(newPostStats);

      if (data.preStats) {
        setDelta({
          impressions: newPostStats.impressions - data.preStats.impressions,
          clicks: newPostStats.clicks - data.preStats.clicks,
          ctr: (newPostStats.ctr - data.preStats.ctr).toFixed(4),
          position: (newPostStats.position - data.preStats.position).toFixed(2),
        });
      }

      await setDoc(docRef, { postStats: newPostStats }, { merge: true });
      toast.success("✅ Post-implementation stats updated!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to check results.");
    } finally {
      setChecking(false);
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
      if (data?.status === "implemented") setIsImplemented(true);
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
            <span>{title}</span>
          </div>
          <div className="text-muted-foreground">
            {isOpen ? "Hide details" : "Show details"}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Fix this SEO issue</h3>

          <div className="space-y-4">
            <div>
              <Label>Suggested Meta Title</Label>
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
              <Label>Suggested Meta Description</Label>
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
                  {/* <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckPostStats}
                    disabled={!isImplemented || checking}
                  >
                    {checking ? "Checking..." : "Check Results"}
                  </Button> */}
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  You’ve marked this as implemented.
                </div>
              )}
            </div>

            {delta && (
              <div className="text-sm text-muted-foreground mt-2">
                <strong>📈 Performance Change (vs. before):</strong>
                <ul className="list-disc pl-4">
                  <li>Impressions: {delta.impressions}</li>
                  <li>Clicks: {delta.clicks}</li>
                  <li>CTR: {delta.ctr}</li>
                  <li>Position: {delta.position}</li>
                </ul>
              </div>
            )}
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
