import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

const SeoTitleSuggestionPanel = ({ keyword, pageUrl, suggestedTitle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [implemented, setImplemented] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(suggestedTitle);
      toast.success("Meta title copied to clipboard");
    } catch {
      toast.error("Failed to copy");
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
              implemented ? "bg-green-500" : "bg-yellow-500"
            }`}
          />
          <span>{keyword} → Suggest Title</span>
        </div>
        <div className="text-muted-foreground">{isOpen ? "Hide" : "Show"}</div>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 rounded-lg border bg-card p-4 shadow-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="metaTitle">Suggested Meta Title</Label>
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            id="metaTitle"
            value={suggestedTitle}
            readOnly
            className="resize-none"
          />
          <p className="text-sm text-muted-foreground">
            Focus on aligning the title with searcher intent.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="implemented"
            checked={implemented}
            onCheckedChange={setImplemented}
          />
          <Label htmlFor="implemented">I've added this title to my page</Label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SeoTitleSuggestionPanel;
