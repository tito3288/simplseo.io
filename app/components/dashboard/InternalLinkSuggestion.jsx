"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// 🔧 Helper to extract slug from a URL
function extractSlug(url) {
  try {
    const path = new URL(url).pathname;
    const slug = path.split("/").filter(Boolean).pop(); // last part of the URL
    return slug || "/";
  } catch {
    return "invalid-url";
  }
}

export default function InternalLinkSuggestion({
  userId,
  page,
  targetPage,
  sitemapUrls,
  lowCtrUrls = new Set(),
}) {
  const [show, setShow] = useState(true);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const checkEligibility = async () => {
      const docId = `${userId}_${encodeURIComponent(page)}`;
      const snapshot = await getDoc(doc(db, "implementedSeoTips", docId));
      const data = snapshot.data();

      if (!data?.postStats || !data?.implementedAt) return;

      const daysSince =
        (Date.now() - new Date(data.implementedAt).getTime()) /
        (1000 * 60 * 60 * 24);

      if (data.postStats.clicks === 0 /* && daysSince >= 30 */) {
        setShow(true);
      }
    };

    checkEligibility();
  }, [page, userId]);

  useEffect(() => {
    const extractSlug = (url) => {
      try {
        const path = new URL(url).pathname;
        return path.split("/").filter(Boolean).pop() || "/";
      } catch {
        return "invalid-url";
      }
    };

    const usedUrls = new Set(); // Track used fromUrls

    const fetchAnchorTextSuggestions = async () => {
      if (!Array.isArray(sitemapUrls)) return;

      const available = sitemapUrls.filter(
        (url) => url !== page && !lowCtrUrls.has(url) && !usedUrls.has(url)
      );

      const filtered = available.sort(() => 0.5 - Math.random()).slice(0, 1);

      const targetSlug = extractSlug(targetPage);
      console.log("🧩 targetPage:", targetPage, "→ slug:", targetSlug);

      const results = await Promise.all(
        filtered.map(async (fromUrl) => {
          const fromSlug = extractSlug(fromUrl);
          console.log("🔗 fromUrl:", fromUrl, "→ slug:", fromSlug);

          try {
            const res = await fetch("/api/seo-assistant/anchor-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fromUrl,
                toUrl: targetPage,
                targetSlug,
              }),
            });

            const json = await res.json();
            usedUrls.add(fromUrl); // ✅ Mark this fromUrl as used
            return {
              page: fromUrl,
              anchorText: json.anchorText || "Learn more",
            };
          } catch (err) {
            console.error("❌ Failed to fetch anchor text:", err.message);
            return {
              page: fromUrl,
              anchorText: "Learn more",
            };
          }
        })
      );

      setSuggestions(results);
    };

    fetchAnchorTextSuggestions();
  }, [sitemapUrls, page, lowCtrUrls, targetPage]);

  if (!show) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{page}</CardTitle>
        <CardDescription>
          Link this page from others on your site to help it get discovered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-muted p-2 rounded text-sm">
            <p className="text-muted-foreground mb-1">Suggested link:</p>
            <code>{`<a href="${s.page}">${s.anchorText}</a>`}</code>
            <div className="mt-2">
              <Button variant="secondary" size="sm">
                Copy Link Snippet
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
