import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { db, admin } from "../../lib/firebaseAdmin";

const DEFAULT_MAX_PAGES = 25;
const SCRAPE_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const normalizeUrl = (websiteUrl) => {
  if (!websiteUrl) return null;
  try {
    const hasProtocol = websiteUrl.startsWith("http://") || websiteUrl.startsWith("https://");
    const url = new URL(hasProtocol ? websiteUrl : `https://${websiteUrl}`);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const fetchSitemapUrls = async (origin) => {
  const parser = new XMLParser();
  const possibleSitemaps = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  const discovered = new Set();

  for (const sitemapUrl of possibleSitemaps) {
    try {
      const res = await fetch(sitemapUrl, { cache: "no-store" });
      if (!res.ok) continue;
      const xml = await res.text();
      const json = parser.parse(xml);

      if (json.urlset?.url) {
        const urls = Array.isArray(json.urlset.url)
          ? json.urlset.url
          : [json.urlset.url];
        urls.forEach((entry) => {
          if (entry?.loc) discovered.add(entry.loc);
        });
      }

      if (json.sitemapindex?.sitemap) {
        const childSitemaps = Array.isArray(json.sitemapindex.sitemap)
          ? json.sitemapindex.sitemap
          : [json.sitemapindex.sitemap];

        for (const child of childSitemaps) {
          if (!child?.loc) continue;
          try {
            const childRes = await fetch(child.loc, { cache: "no-store" });
            if (!childRes.ok) continue;
            const childXml = await childRes.text();
            const childJson = parser.parse(childXml);
            const urls = childJson.urlset?.url || [];
            const normalized = Array.isArray(urls) ? urls : [urls];
            normalized.forEach((entry) => {
              if (entry?.loc) discovered.add(entry.loc);
            });
          } catch (error) {
            console.warn(`⚠️ Failed to fetch child sitemap ${child.loc}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Unable to fetch sitemap ${sitemapUrl}:`, error.message);
    }
  }

  return Array.from(discovered);
};

const fetchNavLinks = async (homepageUrl) => {
  try {
    const res = await fetch(`${SCRAPE_BASE_URL}/api/scrape-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageUrl: homepageUrl }),
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    const links = Array.isArray(json?.data?.links) ? json.data.links : [];
    const filtered = links
      .map((link) => link?.href || "")
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href, homepageUrl).toString();
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((url) => url.startsWith(homepageUrl));

    return Array.from(new Set(filtered));
  } catch (error) {
    console.warn("⚠️ Failed to fetch nav links:", error.message);
    return [];
  }
};

const junkPatterns = [
  "/tag/",
  "/category/",
  "/author/",
  "/feed",
  "/wp-json",
  "/wp-admin",
  "/format",
  "/sample",
  "/archive",
  "/test-",
  "/lorem",
  "/ipsum",
  "/demo",
  "/draft",
  "/placeholder",
  "/temp",
  "?",
  "#",
  "format-",
];

const isLikelyJunk = (url) => {
  return junkPatterns.some((pattern) =>
    url.toLowerCase().includes(pattern.toLowerCase())
  );
};

const toDepth = (url) => {
  try {
    const { pathname } = new URL(url);
    return pathname.split("/").filter(Boolean).length;
  } catch {
    return 99;
  }
};

export async function POST(req) {
  try {
    const { userId, websiteUrl, maxPages = DEFAULT_MAX_PAGES } = await req.json();
    if (!userId || !websiteUrl) {
      return NextResponse.json(
        { error: "userId and websiteUrl are required" },
        { status: 400 }
      );
    }

    const normalizedWebsite = normalizeUrl(websiteUrl);
    if (!normalizedWebsite) {
      return NextResponse.json(
        { error: "Invalid website URL" },
        { status: 400 }
      );
    }

    const origin = new URL(normalizedWebsite).origin;

    const crawlDocRef = db.collection("siteCrawls").doc(userId);
    await crawlDocRef.set(
      {
        status: "in-progress",
        websiteUrl: origin,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        maxPages,
      },
      { merge: true }
    );

    await db.collection("onboarding").doc(userId).set(
      {
        siteCrawlStatus: "in-progress",
      },
      { merge: true }
    );

    const navLinks = await fetchNavLinks(normalizedWebsite);
    const sitemapUrls = await fetchSitemapUrls(origin);
    const combined = new Set([normalizedWebsite, ...navLinks, ...sitemapUrls]);

    const navSet = new Set(navLinks);

    const filteredUrls = Array.from(combined)
      .filter((url) => url.startsWith(origin))
      .filter((url) => !isLikelyJunk(url))
      .map((url) => ({
        url,
        isNav: navSet.has(url),
        weight:
          (navSet.has(url) ? 10 : 0) -
          Math.min(toDepth(url), 5),
      }));

    const nonNavUrls = filteredUrls.filter((entry) => !entry.isNav);

    const contentFiltered = nonNavUrls
      .filter((entry) => !entry.url.toLowerCase().includes("/blog/"))
      .filter((entry) => !entry.url.toLowerCase().includes("/faq/"));

    const reassembled = [
      ...filteredUrls.filter((entry) => entry.isNav),
      ...contentFiltered,
    ];

    const targetEntries = reassembled
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxPages);

    let processed = 0;
    const errors = [];

    for (const [index, entry] of targetEntries.entries()) {
      const { url, isNav } = entry;
      try {
        const scrapeRes = await fetch(`${SCRAPE_BASE_URL}/api/scrape-content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageUrl: url }),
        });

        if (!scrapeRes.ok) {
          throw new Error(`Scrape failed with status ${scrapeRes.status}`);
        }

        const scrapeJson = await scrapeRes.json();
        if (!scrapeJson?.data) {
          throw new Error("No data returned from scrape endpoint");
        }

        const docId = `${userId}_${encodeURIComponent(url)}`;
        await db.collection("pageContentCache").doc(docId).set(
          {
            ...scrapeJson.data,
            userId,
            pageUrl: url,
            source: "site-crawl",
            isNavLink: !!isNav,
            crawlOrder: index,
            cachedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          { merge: true }
        );

        processed += 1;
      } catch (error) {
        console.warn(`⚠️ Failed to crawl ${url}:`, error.message);
        errors.push({ url, message: error.message });
      }
    }

    await crawlDocRef.set(
      {
        status: errors.length > 0 ? "completed-with-errors" : "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        pageCount: processed,
        errorCount: errors.length,
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection("onboarding").doc(userId).set(
      {
        siteCrawlStatus: errors.length > 0 ? "completed-with-errors" : "completed",
        lastSiteCrawlAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      processed,
      attempted: targetEntries.length,
      errors,
    });
  } catch (error) {
    console.error("❌ Site crawl failed:", error);

    try {
      const { userId } = await req.json();
      if (userId) {
        await db.collection("siteCrawls").doc(userId).set(
          {
            status: "error",
            errorMessage: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await db.collection("onboarding").doc(userId).set(
          {
            siteCrawlStatus: "error",
          },
          { merge: true }
        );
      }
    } catch {
      // ignore secondary failure
    }

    return NextResponse.json(
      { error: "Site crawl failed", details: error.message },
      { status: 500 }
    );
  }
}

