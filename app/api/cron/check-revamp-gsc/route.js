import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

const DISCOVERY_THRESHOLD = 10;

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

  await db.collection("gscTokens").doc(userId).update({
    accessToken: newAccessToken,
    expiresAt,
  });

  return newAccessToken;
}

async function checkGscForUser(userId, onboardingData) {
  const { revampPages, revampDate } = onboardingData;

  if (!revampPages || revampPages.length === 0 || !revampDate) {
    return { userId, skipped: true, reason: "Missing revampPages or revampDate" };
  }

  // Get GSC tokens
  const gscDoc = await db.collection("gscTokens").doc(userId).get();
  if (!gscDoc.exists) {
    return { userId, skipped: true, reason: "No GSC tokens" };
  }

  const gscData = gscDoc.data();
  let accessToken = gscData.accessToken;
  const siteUrl = gscData.siteUrl;

  if (!accessToken || !siteUrl) {
    return { userId, skipped: true, reason: "GSC not configured" };
  }

  // Refresh token if expired
  if (gscData.expiresAt && gscData.expiresAt < Date.now() + 300000) {
    accessToken = await refreshAccessToken(gscData, userId);
  }

  // Query GSC from revampDate to today
  const formatDate = (d) => new Date(d).toISOString().split("T")[0];
  const startDate = formatDate(revampDate);
  const endDate = formatDate(new Date());

  let gscResult;
  const fetchGsc = async (token) => {
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        siteUrl
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    return response;
  };

  let response = await fetchGsc(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken(gscData, userId);
    response = await fetchGsc(accessToken);
  }

  if (!response.ok) {
    return { userId, skipped: true, reason: `GSC API error: ${response.status}` };
  }

  gscResult = await response.json();

  // Build GSC page map
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

  // Update revampPages
  const updatedPages = revampPages.map((page) => {
    const normalizedUrl = (page.url || page).replace(/\/$/, "").toLowerCase();
    const pageGscData = gscPageMap.get(normalizedUrl);

    return {
      url: page.url || page,
      discovered: pageGscData ? pageGscData.impressions >= DISCOVERY_THRESHOLD : false,
      impressions: pageGscData ? pageGscData.impressions : 0,
      clicks: pageGscData ? pageGscData.clicks : 0,
    };
  });

  await db.collection("onboarding").doc(userId).update({
    revampPages: updatedPages,
  });

  const discoveredCount = updatedPages.filter((p) => p.discovered).length;
  return {
    userId,
    checked: true,
    discoveredCount,
    totalPages: updatedPages.length,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const secret =
      searchParams.get("secret") ||
      req.headers.get("authorization")?.replace("Bearer ", "");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all users in revamp waiting state
    const snapshot = await db
      .collection("onboarding")
      .where("revampStatus", "==", "in-progress")
      .where("revampStep", "==", "waiting")
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No users in revamp waiting state",
        usersChecked: 0,
      });
    }

    const results = [];
    for (const doc of snapshot.docs) {
      try {
        const result = await checkGscForUser(doc.id, doc.data());
        results.push(result);
      } catch (error) {
        results.push({ userId: doc.id, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      usersChecked: results.length,
      results,
    });
  } catch (error) {
    console.error("Revamp GSC cron failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error.message },
      { status: 500 }
    );
  }
}
