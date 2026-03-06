import { NextResponse } from "next/server";
import { cachePageContent } from "../../../lib/firestoreMigrationHelpers";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function POST(req) {
  try {
    const { url, websiteUrl, userId } = await req.json();

    if (!url || !websiteUrl) {
      return NextResponse.json(
        { error: "url and websiteUrl are required" },
        { status: 400 }
      );
    }

    // Normalize URLs — auto-prepend https:// if missing
    const ensureProtocol = (u) =>
      /^https?:\/\//i.test(u) ? u : `https://${u}`;

    let parsedUrl, parsedSite;
    try {
      parsedUrl = new URL(ensureProtocol(url));
    } catch {
      return NextResponse.json(
        { valid: false, reason: "Invalid URL format" },
        { status: 200 }
      );
    }

    try {
      parsedSite = new URL(ensureProtocol(websiteUrl));
    } catch {
      return NextResponse.json(
        { valid: false, reason: "Invalid website URL" },
        { status: 200 }
      );
    }

    // Check domain match (strip www for comparison)
    const stripWww = (host) => host.replace(/^www\./, "").toLowerCase();
    if (stripWww(parsedUrl.hostname) !== stripWww(parsedSite.hostname)) {
      return NextResponse.json(
        {
          valid: false,
          reason: `URL must belong to ${parsedSite.hostname}`,
        },
        { status: 200 }
      );
    }

    // Check if the URL returns content (HEAD request with GET fallback)
    const fetchUrl = parsedUrl.href;
    try {
      let response = await fetch(fetchUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });

      // Some servers don't support HEAD, try GET
      if (response.status === 405 || response.status === 403) {
        response = await fetch(fetchUrl, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
      }

      if (response.ok) {
        // Scrape and cache page content (best-effort, don't block validation)
        if (userId) {
          try {
            const scrapeRes = await fetch(`${BASE_URL}/api/scrape-content`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pageUrl: fetchUrl }),
            });

            if (scrapeRes.ok) {
              const scrapeJson = await scrapeRes.json();
              if (scrapeJson?.data) {
                await cachePageContent(userId, fetchUrl, {
                  ...scrapeJson.data,
                  source: "site-crawl",
                  isNavLink: false,
                  crawlOrder: null,
                  crawlTags: ["manual", "revamp-added"],
                });
              }
            }
          } catch (scrapeError) {
            console.warn("Scrape/cache failed for manually added URL:", scrapeError.message);
          }
        }

        return NextResponse.json({ valid: true }, { status: 200 });
      }

      return NextResponse.json(
        {
          valid: false,
          reason: `Page returned status ${response.status}`,
        },
        { status: 200 }
      );
    } catch (fetchError) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Could not reach the URL. Make sure the page is live.",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("URL validation failed:", error);
    return NextResponse.json(
      { error: "Validation failed", details: error.message },
      { status: 500 }
    );
  }
}
