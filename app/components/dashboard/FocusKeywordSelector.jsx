"use client";

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const normalizePage = (page) => page || "__unknown__";

const FocusKeywordSelector = ({
  keywords = [],
  selectedByPage = new Map(),
  onToggle,
  isSaving = false,
  suggestions = [],
  groupedByPage = new Map(),
}) => {
  const aggregatedKeywords = useMemo(() => {
    if (!keywords?.length) {
      return [];
    }

    const map = new Map();

    keywords.forEach((item) => {
      if (!item?.keyword) return;
      const key = item.keyword;
      const existing = map.get(key);
      if (existing) {
        existing.clicks += item.clicks || 0;
        existing.impressions += item.impressions || 0;
        const candidatePosition = item.position ?? Number.MAX_SAFE_INTEGER;
        if (candidatePosition < existing.position) {
          existing.position = candidatePosition;
        }
      } else {
        map.set(key, {
          keyword: key,
          clicks: item.clicks || 0,
          impressions: item.impressions || 0,
          position: item.position ?? Number.MAX_SAFE_INTEGER,
          page: item.page || null,
        });
      }
    });

    return Array.from(map.values());
  }, [keywords]);

  const keywordMap = useMemo(() => {
    return aggregatedKeywords.reduce((acc, item) => {
      acc.set(item.keyword.toLowerCase(), item);
      return acc;
    }, new Map());
  }, [aggregatedKeywords]);

  const pageGroups = useMemo(() => {
    if (!groupedByPage?.size) {
      return [];
    }

    const groups = [];
    groupedByPage.forEach((value, pageUrl) => {
      const keywords = Array.isArray(value)
        ? value
        : Array.isArray(value.keywords)
        ? value.keywords
        : [];
      if (!keywords.length) return;
      const enriched = keywords
        .map((keyword) => keywordMap.get(keyword.toLowerCase()) || null)
        .filter(Boolean);
      if (!enriched.length) return;
      groups.push({ page: pageUrl === "__unknown__" ? null : pageUrl, keywords: enriched });
    });

    groups.sort((a, b) => {
      const impressionsA = Math.max(...a.keywords.map((kw) => kw.impressions || 0));
      const impressionsB = Math.max(...b.keywords.map((kw) => kw.impressions || 0));
      return impressionsB - impressionsA;
    });

    return groups;
  }, [groupedByPage, keywordMap]);

  const suggestionSet = useMemo(() => {
    return new Set(
      suggestions
        ?.map((item) => (typeof item === "string" ? item : item?.keyword))
        .filter(Boolean)
    );
  }, [suggestions]);

  const keywordAssignments = useMemo(() => {
    const map = new Map();
    if (!selectedByPage?.size) return map;
    selectedByPage.forEach((keyword, pageKey) => {
      if (!keyword) return;
      map.set(keyword.toLowerCase(), pageKey);
    });
    return map;
  }, [selectedByPage]);

  const selectedPageSet = useMemo(() => {
    return new Set(selectedByPage ? Array.from(selectedByPage.keys()) : []);
  }, [selectedByPage]);

  const selectedKeywordsSet = useMemo(() => {
    return new Set(
      selectedByPage ? Array.from(selectedByPage.values()).map((kw) => kw.toLowerCase()) : []
    );
  }, [selectedByPage]);

  const handleToggle = (keyword, page) => {
    if (!onToggle) return;
    const pageKey = normalizePage(page);
    const lowerKeyword = keyword.toLowerCase();
    const isSelectedForPage =
      selectedByPage?.get(pageKey)?.toLowerCase() === lowerKeyword;
    onToggle({
      keyword,
      page,
      isSelectedForPage,
    });
  };

  if (!pageGroups.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect Google Search Console to choose focus keywords.
      </p>
    );
  }

  const selectedCount = selectedByPage?.size || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="sm:text-right">
          Keywords selected: {selectedCount}
        </span>
      </div>
      <Alert className="w-full border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <AlertDescription className="!block text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
          <span className="font-medium">Tip:</span> choose a keyword that includes your service and location. Avoid keywords with your brand to attract new customers who haven't discovered your business name yet.{" "}
          <br>
          </br>For example:<span className="font-semibold"> emergency plumber austin, wedding photographer in los angeles, affordable dentist chicago</span>.
        </AlertDescription>
      </Alert>
      {/* <p className="text-xs text-muted-foreground">
        If a keyword shows up on more than one page, pick the page you want to focus on.
        When you switch pages, we&apos;ll move the keyword automatically.
      </p> */}

      {suggestionSet.size > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Overall suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {[...suggestionSet].slice(0, 5).map((keyword) => {
              const isSelected = selectedKeywordsSet.has(keyword.toLowerCase());
              return (
                <Button
                  key={`suggestion-${keyword}`}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleToggle(keyword, null)}
                >
                  {keyword}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border divide-y">
        {pageGroups.map((group, groupIdx) => {
          const pageKey = normalizePage(group.page);
          return (
            <div key={group.page || `group-${groupIdx}`} className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  Page:
                  {group.page ? (
                    <a
                      href={group.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-[#00BF63] underline"
                    >
                      {group.page.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="ml-1">Unassigned</span>
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Choose one keyword below
                </div>
              </div>
              <div className="space-y-2">
                {group.keywords.map((keyword) => {
                  const lowerKeyword = keyword.keyword.toLowerCase();
                  const assignedPageKey = keywordAssignments.get(lowerKeyword);
                  const isSelected =
                    selectedByPage?.get(pageKey)?.toLowerCase() === lowerKeyword;
                  const isSuggested = suggestionSet.has(keyword.keyword);
                  const isAssignedElsewhere =
                    assignedPageKey && assignedPageKey !== pageKey;
                  return (
                    <label
                      key={`${group.page || "__unknown__"}-${keyword.keyword}`}
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-transparent bg-muted/40 hover:bg-muted/60",
                        isAssignedElsewhere && !isSelected && "opacity-70"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            handleToggle(keyword.keyword, group.page)
                          }
                          disabled={isSaving}
                        />
                        <div>
                          <p className="font-medium leading-tight">{keyword.keyword}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{keyword.impressions} impressions</span>
                            <span>Pos. {keyword.position}</span>
                            {isSuggested && (
                              <Badge variant="secondary">Recommended</Badge>
                            )}
                            {isAssignedElsewhere && (
                              <Badge variant="outline">Selected on another page</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {keyword.clicks} clicks
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isSaving && (
        <p className="text-xs text-muted-foreground">
          Saving your focus keywords…
        </p>
      )}
    </div>
  );
};

export default FocusKeywordSelector;

