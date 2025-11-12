import { NextResponse } from "next/server";
import { db, admin } from "../../../lib/firebaseAdmin";

const SCRAPE_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const sanitizeUrlArray = (value = []) => {
  if (!Array.isArray(value)) return [];
  const sanitized = value
    .filter((url) => typeof url === "string" && url.trim().length > 0)
    .map((url) => url.trim());
  return Array.from(new Set(sanitized));
};

export async function POST(req) {
  try {
    const {
      userId,
      approvedUrls = [],
      excludedUrls = [],
      manualUrls = [],
    } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const crawlDocRef = db.collection("siteCrawls").doc(userId);
    const crawlSnap = await crawlDocRef.get();

    if (!crawlSnap.exists) {
      return NextResponse.json(
        { error: "No crawl data found" },
        { status: 404 }
      );
    }

    const crawlData = crawlSnap.data();
    const pendingPages = Array.isArray(crawlData?.pendingPages)
      ? crawlData.pendingPages
      : [];

    const sanitizedApproved = sanitizeUrlArray(approvedUrls);
    const sanitizedExcluded = sanitizeUrlArray(excludedUrls);
    const sanitizedManual = sanitizeUrlArray(manualUrls);

    // Create a set of approved URLs for quick lookup
    const approvedSet = new Set(sanitizedApproved);
    const excludedSet = new Set(sanitizedExcluded);

    // Allow the operation if:
    // 1. There are pending pages to save, OR
    // 2. There are manual URLs to process, OR
    // 3. There are excluded URLs to remove (user is removing pages)
    const hasManualUrls = sanitizedManual.length > 0;
    const hasExcludedUrls = excludedSet.size > 0;
    
    if (pendingPages.length === 0 && !hasManualUrls && !hasExcludedUrls) {
      return NextResponse.json(
        { error: "No pending pages, manual URLs, or pages to remove" },
        { status: 400 }
      );
    }

    // Filter pending pages to only include approved ones
    const pagesToSave = pendingPages.filter(
      (page) =>
        page?.pageUrl &&
        approvedSet.has(page.pageUrl) &&
        !excludedSet.has(page.pageUrl)
    );

    // Handle new manual URLs that weren't in the initial crawl
    const existingPageUrls = new Set(pagesToSave.map((p) => p.pageUrl));
    const newManualUrls = sanitizedManual.filter(
      (url) => !existingPageUrls.has(url) && !excludedSet.has(url)
    );

    // Convert new manual URLs to page objects for processing
    for (const url of newManualUrls) {
      pagesToSave.push({
        pageUrl: url,
        tags: ["manual", "Added"],
        isNavLink: false,
        crawlOrder: null,
      });
    }

    // Allow operation even if no pages to save, as long as we're removing pages
    // This handles the case where user just wants to remove unchecked pages
    if (pagesToSave.length === 0 && !hasExcludedUrls) {
      return NextResponse.json(
        { error: "No approved pages to save" },
        { status: 400 }
      );
    }

    const errors = [];
    let savedCount = 0;

    // Scrape and save each approved page (only if there are pages to save)
    if (pagesToSave.length > 0) {
      for (const page of pagesToSave) {
      try {
        const { pageUrl, tags = [], isNavLink = false, crawlOrder = null } =
          page;

        // Scrape the page content
        const scrapeRes = await fetch(`${SCRAPE_BASE_URL}/api/scrape-content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageUrl }),
        });

        if (!scrapeRes.ok) {
          throw new Error(`Scrape failed with status ${scrapeRes.status}`);
        }

        const scrapeJson = await scrapeRes.json();
        if (!scrapeJson?.data) {
          throw new Error("No data returned from scrape endpoint");
        }

        const cachedAt = new Date().toISOString();
        const tagList = Array.isArray(tags) ? tags : [];

        // Save to pageContentCache
        const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
        await db.collection("pageContentCache").doc(docId).set(
          {
            ...scrapeJson.data,
            userId,
            pageUrl,
            source: "site-crawl",
            isNavLink: !!isNavLink,
            crawlOrder,
            cachedAt,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            crawlTags: tagList,
          },
          { merge: true }
        );

        savedCount += 1;
      } catch (error) {
        console.warn(`⚠️ Failed to save page ${page.pageUrl}:`, error.message);
        errors.push({ url: page.pageUrl, message: error.message });
      }
    }
    }

    // Remove any pages from pageContentCache that are excluded
    if (excludedSet.size > 0) {
      const existingSnapshot = await db
        .collection("pageContentCache")
        .where("userId", "==", userId)
        .where("source", "==", "site-crawl")
        .get();

      for (const docSnap of existingSnapshot.docs) {
        const data = docSnap.data();
        if (data?.pageUrl && excludedSet.has(data.pageUrl)) {
          await docSnap.ref.delete();
        }
      }
    }

    // Update crawl document with preferences and mark as completed
    await crawlDocRef.set(
      {
        status: errors.length > 0 ? "completed-with-errors" : "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        approvedUrls: sanitizedApproved,
        excludedUrls: Array.from(excludedSet),
        manualUrls: sanitizedManual,
        pendingPages: admin.firestore.FieldValue.delete(),
        pendingGeneratedAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    // Update onboarding document
    await db.collection("onboarding").doc(userId).set(
      {
        siteCrawlStatus:
          errors.length > 0 ? "completed-with-errors" : "completed",
        lastSiteCrawlAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const removedCount = excludedSet.size;
    
    return NextResponse.json({
      success: true,
      saved: savedCount,
      removed: removedCount,
      errors,
      total: pagesToSave.length,
    });
  } catch (error) {
    console.error("❌ Failed to save pages:", error);
    return NextResponse.json(
      { error: "Failed to save pages", details: error.message },
      { status: 500 }
    );
  }
}

