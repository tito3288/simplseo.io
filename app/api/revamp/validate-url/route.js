import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { url, websiteUrl } = await req.json();

    if (!url || !websiteUrl) {
      return NextResponse.json(
        { error: "url and websiteUrl are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl, parsedSite;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { valid: false, reason: "Invalid URL format" },
        { status: 200 }
      );
    }

    try {
      parsedSite = new URL(websiteUrl);
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
    try {
      let response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });

      // Some servers don't support HEAD, try GET
      if (response.status === 405 || response.status === 403) {
        response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
      }

      if (response.ok) {
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
