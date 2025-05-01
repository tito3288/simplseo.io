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
import { useState } from "react";
import { toast } from "sonner";
import { db } from "../../lib/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";

const SeoRecommendationPanel = ({
  title,
  pageUrl,
  metaTitleTip = "Make the title specific to user intent",
  metaDescriptionTip = "Include your main keyword and a clear call to action",
  suggestedTitle = "",
  suggestedDescription = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isImplemented, setIsImplemented] = useState(false);
  const { user } = useAuth();

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        `${
          type === "title" ? "Meta title" : "Meta description"
        } copied to clipboard`
      );
    } catch (err) {
      toast.error("Failed to copy text");
    }
  };

  const handleImplementation = async (checked) => {
    setIsImplemented(checked);

    if (checked && user?.id && pageUrl) {
      try {
        const docId = `${user.id}_${encodeURIComponent(pageUrl)}`;
        await setDoc(doc(db, "implementedSeoTips", docId), {
          userId: user.id,
          pageUrl,
          implementedAt: new Date().toISOString(),
          title: suggestedTitle,
          description: suggestedDescription,
          status: "implemented",
        });
        toast.success("✅ SEO tip marked as implemented.");
      } catch (err) {
        console.error("Failed to save implementation:", err);
        toast.error("❌ Failed to save to Firestore.");
      }
    }
  };

  return (
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

      <CollapsibleContent className="space-y-4 rounded-lg border bg-card p-4 shadow-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <h3 className="text-lg font-semibold">Fix this SEO issue</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="metaTitle">Suggested Meta Title</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(suggestedTitle, "title")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              id="metaTitle"
              value={suggestedTitle}
              readOnly
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">{metaTitleTip}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="metaDescription">
                Suggested Meta Description
              </Label>
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
            <Textarea
              id="metaDescription"
              value={suggestedDescription}
              readOnly
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              {metaDescriptionTip}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="implemented"
              checked={isImplemented}
              onCheckedChange={handleImplementation}
            />
            <Label htmlFor="implemented">I've updated this on my site</Label>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SeoRecommendationPanel;
