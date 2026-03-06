"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  MessageCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  ArrowRight,
  X,
  Plus,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import FocusKeywordSelector from "../components/dashboard/FocusKeywordSelector";

// Normalize page URL for consistent matching
const normalizePageKey = (page) => {
  if (!page) return "__unknown__";
  try {
    const u = new URL(page);
    const normalized =
      u.pathname === "/" ? u.origin : u.origin + u.pathname.replace(/\/$/, "");
    return normalized.toLowerCase();
  } catch {
    return page.trim().replace(/\/$/, "").toLowerCase();
  }
};

export default function RevampPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data, updateData } = useOnboarding();

  // Local UI state
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState(null);
  const [gscCheckLoading, setGscCheckLoading] = useState(false);
  const [gscCheckError, setGscCheckError] = useState(null);

  // Review step state (between crawl and waiting)
  const [crawledPages, setCrawledPages] = useState(null);
  const [addUrlInput, setAddUrlInput] = useState("");
  const [addUrlLoading, setAddUrlLoading] = useState(false);
  const [addUrlError, setAddUrlError] = useState(null);
  const [speedUpOpen, setSpeedUpOpen] = useState(false);

  // Keywords step state
  const [gscKeywordsRaw, setGscKeywordsRaw] = useState([]);
  const [groupedByPage, setGroupedByPage] = useState(new Map());
  const [focusKeywordByPage, setFocusKeywordByPage] = useState(new Map());
  const [keywordsSaving, setKeywordsSaving] = useState(false);
  const [keywordsLoading, setKeywordsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (data && data.revampStatus !== "in-progress") {
      router.push("/dashboard");
    }
  }, [data, router]);

  // Determine current step from context
  const revampStep = data?.revampStep || null;

  // Auto-trigger crawl when on step 1
  const triggerCrawl = useCallback(async () => {
    if (!user?.id || crawlLoading) return;
    setCrawlLoading(true);
    setCrawlError(null);
    setCrawledPages(null);

    try {
      const res = await fetch("/api/revamp/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Crawl failed");
      }

      const result = await res.json();

      // Store pages locally for review (don't advance to waiting yet)
      setCrawledPages(result.pages || []);
    } catch (error) {
      console.error("Crawl failed:", error);
      setCrawlError(error.message);
    } finally {
      setCrawlLoading(false);
    }
  }, [user?.id, crawlLoading]);

  useEffect(() => {
    if (
      !authLoading &&
      user &&
      data &&
      data.revampStatus === "in-progress" &&
      (!revampStep || revampStep === "crawl")
    ) {
      triggerCrawl();
    }
  }, [authLoading, user, data?.revampStatus, revampStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove a page from the review list
  const handleRemovePage = (urlToRemove) => {
    setCrawledPages((prev) => prev.filter((p) => (p.url || p) !== urlToRemove));
  };

  // Add a URL to the review list
  const handleAddUrl = async () => {
    if (!addUrlInput.trim() || addUrlLoading) return;

    const urlToAdd = addUrlInput.trim();
    setAddUrlLoading(true);
    setAddUrlError(null);

    // Check if already in the list
    const normalizedNew = normalizePageKey(urlToAdd);
    const alreadyExists = crawledPages.some(
      (p) => normalizePageKey(p.url || p) === normalizedNew
    );
    if (alreadyExists) {
      setAddUrlError("This URL is already in your list.");
      setAddUrlLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/revamp/validate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlToAdd,
          websiteUrl: data?.websiteUrl || "",
        }),
      });

      if (!res.ok) {
        throw new Error("Validation request failed");
      }

      const result = await res.json();

      if (!result.valid) {
        setAddUrlError(result.reason || "URL is not valid.");
        setAddUrlLoading(false);
        return;
      }

      // Add to the list
      setCrawledPages((prev) => [
        ...prev,
        { url: urlToAdd, discovered: false, impressions: 0, clicks: 0 },
      ]);
      setAddUrlInput("");
    } catch (error) {
      console.error("URL validation failed:", error);
      setAddUrlError("Failed to validate URL. Please try again.");
    } finally {
      setAddUrlLoading(false);
    }
  };

  // Confirm the reviewed page list and advance to waiting
  const confirmPages = async () => {
    if (!crawledPages || crawledPages.length === 0) return;

    await updateData({
      revampStep: "waiting",
      revampPages: crawledPages,
    });
    setCrawledPages(null);
  };

  // Check GSC discovery
  const checkGscDiscovery = async () => {
    if (!user?.id || gscCheckLoading) return;
    setGscCheckLoading(true);
    setGscCheckError(null);

    try {
      const res = await fetch("/api/revamp/check-gsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "GSC check failed");
      }

      const result = await res.json();
      // Update context with fresh page discovery data
      await updateData({ revampPages: result.pages });
    } catch (error) {
      console.error("GSC check failed:", error);
      setGscCheckError(error.message);
    } finally {
      setGscCheckLoading(false);
    }
  };

  // Load GSC keywords for step 3
  const loadGscKeywords = useCallback(async () => {
    if (!user?.id || keywordsLoading) return;
    setKeywordsLoading(true);

    try {
      const res = await fetch("/api/gsc/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!res.ok) throw new Error("Failed to fetch GSC keywords");

      const result = await res.json();
      const keywords = result.keywords || [];

      setGscKeywordsRaw(keywords);

      // Build groupedByPage map
      const grouped = new Map();
      keywords.forEach((kw) => {
        const pageKey = normalizePageKey(kw.page);
        if (!grouped.has(pageKey)) {
          grouped.set(pageKey, []);
        }
        const keywordLower = kw.keyword.toLowerCase();
        if (!grouped.get(pageKey).includes(keywordLower)) {
          grouped.get(pageKey).push(keywordLower);
        }
      });
      setGroupedByPage(grouped);
    } catch (error) {
      console.error("Failed to load GSC keywords:", error);
    } finally {
      setKeywordsLoading(false);
    }
  }, [user?.id, keywordsLoading]);

  useEffect(() => {
    if (revampStep === "keywords" && user?.id) {
      loadGscKeywords();
    }
  }, [revampStep, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyword toggle
  const handleKeywordToggle = ({ keyword, page, isSelectedForPage }) => {
    const pageKey = normalizePageKey(page);
    const lowerKeyword = keyword.toLowerCase();
    const newMap = new Map(focusKeywordByPage);

    if (isSelectedForPage) {
      const current = newMap.get(pageKey);
      if (current?.toLowerCase() === lowerKeyword) {
        newMap.delete(pageKey);
      }
    } else {
      newMap.set(pageKey, keyword);
    }

    setFocusKeywordByPage(newMap);
  };

  // Save keywords and complete revamp
  const handleSaveKeywords = async () => {
    if (!user?.id || keywordsSaving) return;
    setKeywordsSaving(true);

    try {
      // Build keywords array from selections
      const keywords = [];
      focusKeywordByPage.forEach((keyword, pageKey) => {
        const matchingKw = gscKeywordsRaw.find(
          (kw) => normalizePageKey(kw.page) === pageKey
        );
        keywords.push({
          keyword,
          pageUrl: matchingKw?.page || pageKey,
          source: "gsc-existing",
        });
      });

      // Build snapshot
      const snapshot = {
        groupedByPage: Array.from(groupedByPage.entries()).map(
          ([page, kws]) => ({ page, keywords: kws })
        ),
        gscKeywordsRaw: gscKeywordsRaw.map((kw) => ({
          keyword: kw.keyword,
          page: kw.page,
          clicks: kw.clicks || 0,
          impressions: kw.impressions || 0,
          position: kw.position || 999,
          ctr: kw.ctr || "0%",
          source: "gsc-existing",
        })),
        selectedByPage: Array.from(focusKeywordByPage.entries()).map(
          ([page, keyword]) => ({ page, keyword })
        ),
      };

      // Save to focus keywords API
      const res = await fetch("/api/focus-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, keywords, snapshot }),
      });

      if (!res.ok) throw new Error("Failed to save focus keywords");

      // Complete revamp
      await updateData({
        revampStep: "complete",
        revampStatus: "complete",
        postOnboardingStep: "complete",
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to save keywords:", error);
    } finally {
      setKeywordsSaving(false);
    }
  };

  if (authLoading || !user) return null;

  const pages = data?.revampPages || [];
  const discoveredCount = pages.filter((p) => p.discovered).length;
  const allDiscovered = pages.length > 0 && discoveredCount === pages.length;

  // Determine visual step number
  const isReviewing = crawledPages !== null && !crawlLoading;
  const stepNumber =
    revampStep === "keywords"
      ? 3
      : revampStep === "waiting"
      ? 2
      : isReviewing
      ? 1.5
      : 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-green-500" />
          <span className="font-semibold text-lg">Site Revamp</span>
        </div>
        <a
          href="/chatbot"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Need Help?
        </a>
      </header>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 py-6">
        {[
          { num: 1, label: "Scan Site" },
          { num: 2, label: "Wait for Google" },
          { num: 3, label: "Choose Keywords" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  s.num <= Math.ceil(stepNumber)
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.num < Math.ceil(stepNumber) ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  s.num
                )}
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div
                className={`w-12 h-0.5 mb-4 sm:mb-0 ${
                  s.num < Math.ceil(stepNumber) ? "bg-green-600" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center p-6">
        <div className="max-w-2xl w-full">
          {/* Step 1: Scan Site (crawling) */}
          {(!revampStep || revampStep === "crawl") && !isReviewing && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="bg-green-100 dark:bg-green-900/20 inline-flex items-center justify-center w-16 h-16 rounded-full mb-2">
                  {crawlLoading ? (
                    <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  ) : crawlError ? (
                    <Rocket className="w-8 h-8 text-red-600" />
                  ) : (
                    <Rocket className="w-8 h-8 text-green-600" />
                  )}
                </div>

                {crawlLoading ? (
                  <>
                    <h2 className="text-2xl font-bold">
                      Scanning Your Updated Site
                    </h2>
                    <p className="text-muted-foreground">
                      We&apos;re crawling your website to discover your new
                      pages. This may take a minute...
                    </p>
                    <div className="flex justify-center gap-1 pt-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </>
                ) : crawlError ? (
                  <>
                    <h2 className="text-2xl font-bold text-red-600">
                      Scan Failed
                    </h2>
                    <p className="text-muted-foreground">{crawlError}</p>
                    <Button
                      onClick={triggerCrawl}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry Scan
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold">Preparing to Scan</h2>
                    <p className="text-muted-foreground">
                      Starting your site scan...
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 1.5: Review Crawled Pages */}
          {(!revampStep || revampStep === "crawl") && isReviewing && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-2">
                  <div className="bg-green-100 dark:bg-green-900/20 inline-flex items-center justify-center w-16 h-16 rounded-full mb-2">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    Review Your Pages
                  </h2>
                  <p className="text-muted-foreground">
                    We found {crawledPages.length} page{crawledPages.length !== 1 ? "s" : ""} on your site.
                    Remove any irrelevant pages or add URLs that were missed before continuing.
                  </p>
                </div>

                {/* Page list with remove buttons */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {crawledPages.map((page) => {
                    const url = page.url || page;
                    const cleanUrl = url
                      .replace(/^https?:\/\//, "")
                      .replace(/\/$/, "");
                    return (
                      <div
                        key={url}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-background group"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm truncate flex-1">
                          {cleanUrl}
                        </span>
                        <button
                          onClick={() => handleRemovePage(url)}
                          className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Remove page"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add URL section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Add a missing page
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={addUrlInput}
                      onChange={(e) => {
                        setAddUrlInput(e.target.value);
                        if (addUrlError) setAddUrlError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddUrl();
                        }
                      }}
                      placeholder={`https://${data?.websiteUrl?.replace(/^https?:\/\//, "") || "yoursite.com"}/new-page`}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <Button
                      onClick={handleAddUrl}
                      disabled={!addUrlInput.trim() || addUrlLoading}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      {addUrlLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {addUrlError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {addUrlError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    URL must belong to your domain and return a live page.
                  </p>
                </div>

                {/* Confirm button */}
                <div className="flex justify-center pt-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={crawledPages.length === 0}
                    onClick={confirmPages}
                  >
                    Confirm {crawledPages.length} Page{crawledPages.length !== 1 ? "s" : ""} & Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Waiting Room */}
          {revampStep === "waiting" && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-2">
                  <div className="bg-blue-100 dark:bg-blue-900/20 inline-flex items-center justify-center w-16 h-16 rounded-full mb-2">
                    <Search className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    Waiting for Google to Discover Your Pages
                  </h2>
                  <p className="text-muted-foreground">
                    Google typically takes 3-28 days to index new pages. We
                    check daily, or you can check manually below.
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {discoveredCount} of {pages.length} pages discovered
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: pages.length
                        ? `${(discoveredCount / pages.length) * 100}%`
                        : "0%",
                    }}
                  />
                </div>

                {/* Page list */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pages.map((page) => {
                    const url = page.url || page;
                    const cleanUrl = url
                      .replace(/^https?:\/\//, "")
                      .replace(/\/$/, "");
                    return (
                      <div
                        key={url}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-background"
                      >
                        {page.discovered ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm truncate flex-1">
                          {cleanUrl}
                        </span>
                        {page.discovered && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {page.impressions} impressions
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Speed Up Discovery Guide */}
                <Collapsible open={speedUpOpen} onOpenChange={setSpeedUpOpen}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors cursor-pointer">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Want to speed things up?
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${
                        speedUpOpen ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-5">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        You can tell Google about your new pages directly. Here&apos;s how:
                      </p>

                      {/* Step 1 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            Check your sitemap
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Open your browser and go to{" "}
                            <a
                              href={`${(data?.websiteUrl || "").replace(/\/$/, "")}/sitemap.xml`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium underline hover:text-blue-600 dark:hover:text-blue-300"
                            >
                              {(data?.websiteUrl || "yoursite.com").replace(/^https?:\/\//, "").replace(/\/$/, "")}/sitemap.xml
                            </a>
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            You should see an XML file listing all your pages. If it loads, you&apos;re good! If not, check with your hosting provider — most platforms generate one automatically.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            Submit your sitemap in Google Search Console
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Go to{" "}
                            <a
                              href="https://search.google.com/search-console"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium underline hover:text-blue-600 dark:hover:text-blue-300"
                            >
                              Google Search Console
                            </a>{" "}
                            and select your website from the dropdown at the top-left.
                          </p>
                          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-none">
                            <li>1. In the left sidebar, click <strong>Sitemaps</strong></li>
                            <li>2. In the &quot;Add a new sitemap&quot; field, type <strong>sitemap.xml</strong></li>
                            <li>3. Click <strong>Submit</strong></li>
                          </ul>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Google will now know about all your pages and start crawling them.
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          3
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            Request indexing for your most important pages
                          </p>
                          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-none">
                            <li>1. In the search bar at the top of Google Search Console, paste one of your page URLs and press Enter</li>
                            <li>2. Click <strong>Request Indexing</strong></li>
                            <li>3. Repeat for your most important pages (homepage, main services, etc.)</li>
                          </ul>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            You can request about 10-12 pages per day, so start with your key pages first.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {gscCheckError && (
                  <p className="text-sm text-red-600 text-center">
                    {gscCheckError}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={checkGscDiscovery}
                    disabled={gscCheckLoading}
                  >
                    {gscCheckLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Now
                      </>
                    )}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!allDiscovered}
                    onClick={() => updateData({ revampStep: "keywords" })}
                  >
                    Continue to Keywords
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {!allDiscovered && pages.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    All {pages.length} pages must be discovered by Google (10+
                    impressions each) before you can proceed.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Focus Keywords */}
          {revampStep === "keywords" && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">Choose Focus Keywords</h2>
                  <p className="text-muted-foreground">
                    Select one focus keyword per page to track in your dashboard.
                    These will be used for your SEO performance tracking.
                  </p>
                </div>

                {keywordsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Loading keywords from Google Search Console...
                    </span>
                  </div>
                ) : gscKeywordsRaw.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No keywords found in Google Search Console yet. Try
                      checking again later.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={loadGscKeywords}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reload Keywords
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[500px] overflow-y-auto border rounded-lg p-3">
                      <FocusKeywordSelector
                        keywords={gscKeywordsRaw}
                        selectedByPage={focusKeywordByPage}
                        onToggle={handleKeywordToggle}
                        isSaving={keywordsSaving}
                        suggestions={[]}
                        groupedByPage={groupedByPage}
                        businessName={data?.businessName || ""}
                        businessType={data?.businessType || ""}
                        businessLocation={data?.businessLocation || ""}
                        userId={user?.id || ""}
                      />
                    </div>

                    <div className="flex justify-center">
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleSaveKeywords}
                        disabled={
                          keywordsSaving || focusKeywordByPage.size === 0
                        }
                      >
                        {keywordsSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Save & Complete Revamp
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
