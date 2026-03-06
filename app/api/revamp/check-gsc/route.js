import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebaseAdmin";

const DISCOVERY_THRESHOLD = 10; // Minimum impressions to count as "discovered"

async function refreshAccessToken(gscData, userId) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: gscData.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh GSC access token");
  }

  const tokenData = await res.json();
  const newAccessToken = tokenData.access_token;
  const expiresAt = Date.now() + tokenData.expires_in * 1000;

  // Update token in Firestore
  await db.collection("gscTokens").doc(userId).update({
    accessToken: newAccessToken,
    expiresAt,
  });

  return newAccessToken;
}

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // 1. Get onboarding data for revampPages and revampDate
    const onboardingDoc = await db.collection("onboarding").doc(userId).get();
    if (!onboardingDoc.exists) {
      return NextResponse.json({ error: "No onboarding data found" }, { status: 404 });
    }

    const onboarding = onboardingDoc.data();
    const { revampPages, revampDate } = onboarding;

    if (!revampPages || revampPages.length === 0) {
      return NextResponse.json({ error: "No revamp pages to check" }, { status: 400 });
    }

    if (!revampDate) {
      return NextResponse.json({ error: "No revamp date set" }, { status: 400 });
    }

    // 2. Get GSC tokens
    const gscDoc = await db.collection("gscTokens").doc(userId).get();
    if (!gscDoc.exists) {
      return NextResponse.json({ error: "No GSC data found" }, { status: 404 });
    }

    const gscData = gscDoc.data();
    let accessToken = gscData.accessToken;
    const siteUrl = gscData.siteUrl;

    if (!accessToken || !siteUrl) {
      return NextResponse.json({ error: "GSC not properly configured" }, { status: 400 });
    }

    // Refresh token if expired (5-min buffer)
    if (gscData.expiresAt && gscData.expiresAt < Date.now() + 300000) {
      accessToken = await refreshAccessToken(gscData, userId);
    }

    // 3. Query GSC with date range starting from revampDate
    const formatDate = (d) => new Date(d).toISOString().split("T")[0];
    const startDate = formatDate(revampDate);
    const endDate = formatDate(new Date());

    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        siteUrl
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["page"],
          rowLimit: 500,
        }),
      }
    );

    if (response.status === 401) {
      // Try refreshing token once
      accessToken = await refreshAccessToken(gscData, userId);
      const retryResponse = await fetch(
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
          siteUrl
        )}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ["page"],
            rowLimit: 500,
          }),
        }
      );

      if (!retryResponse.ok) {
        throw new Error(`GSC API error after token refresh: ${retryResponse.status}`);
      }

      var gscResult = await retryResponse.json();
    } else if (!response.ok) {
      throw new Error(`GSC API error: ${response.status}`);
    } else {
      var gscResult = await response.json();
    }

    // 4. Build a map of GSC page data (normalize URLs for matching)
    const gscPageMap = new Map();
    if (gscResult.rows) {
      gscResult.rows.forEach((row) => {
        const pageUrl = row.keys[0].replace(/\/$/, "").toLowerCase();
        gscPageMap.set(pageUrl, {
          impressions: row.impressions,
          clicks: row.clicks,
        });
      });
    }

    // 5. Match revampPages against GSC results
    const updatedPages = revampPages.map((page) => {
      const normalizedUrl = (page.url || page).replace(/\/$/, "").toLowerCase();
      const gscData = gscPageMap.get(normalizedUrl);

      return {
        url: page.url || page,
        discovered: gscData ? gscData.impressions >= DISCOVERY_THRESHOLD : false,
        impressions: gscData ? gscData.impressions : 0,
        clicks: gscData ? gscData.clicks : 0,
      };
    });

    // 6. Update revampPages in Firestore
    await db.collection("onboarding").doc(userId).update({
      revampPages: updatedPages,
    });

    const discoveredCount = updatedPages.filter((p) => p.discovered).length;

    return NextResponse.json({
      success: true,
      pages: updatedPages,
      discoveredCount,
      totalPages: updatedPages.length,
      allDiscovered: discoveredCount === updatedPages.length,
    });
  } catch (error) {
    console.error("Revamp GSC check failed:", error);
    return NextResponse.json(
      { error: "Failed to check GSC status. Please try again.", details: error.message },
      { status: 500 }
    );
  }
}
