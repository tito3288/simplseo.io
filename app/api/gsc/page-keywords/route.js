import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { userId, pageUrl, dateRange = "28", token, siteUrl } = await req.json();

    console.log("🔍 [PAGE-KEYWORDS] Request received:", { userId, pageUrl, dateRange, hasToken: !!token, hasSiteUrl: !!siteUrl });

    if (!pageUrl) {
      return NextResponse.json(
        { error: "Page URL is required" },
        { status: 400 }
      );
    }

    let accessToken = token;
    let gscSiteUrl = siteUrl;

    // If token and siteUrl are provided directly, use them (preferred)
    // Otherwise, try to get from Firestore
    if (!accessToken || !gscSiteUrl) {
      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required when token/siteUrl not provided" },
          { status: 400 }
        );
      }

      console.log("🔍 [PAGE-KEYWORDS] Fetching GSC data from Firestore for user:", userId);
      
      // Get GSC data from Firestore using Admin SDK
      const gscDoc = await db.collection('gscTokens').doc(userId).get();
      
      if (!gscDoc.exists) {
        console.log("❌ [PAGE-KEYWORDS] No GSC document found for user:", userId);
        return NextResponse.json(
          { error: "No GSC data found for user", details: "gscTokens document does not exist" },
          { status: 404 }
        );
      }

      const gscData = gscDoc.data();
      accessToken = accessToken || gscData.accessToken;
      gscSiteUrl = gscSiteUrl || gscData.siteUrl;

      console.log("🔍 [PAGE-KEYWORDS] Got GSC data:", { hasAccessToken: !!accessToken, siteUrl: gscSiteUrl });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "No valid GSC access token found" },
        { status: 401 }
      );
    }

    if (!gscSiteUrl) {
      return NextResponse.json(
        { error: "No GSC site URL found" },
        { status: 400 }
      );
    }

    // Fetch GSC data for the specified date range
    const today = new Date();
    const startDate = new Date();
    
    if (dateRange === "all") {
      startDate.setFullYear(today.getFullYear() - 1);
    } else {
      startDate.setDate(today.getDate() - parseInt(dateRange));
    }

    const formatDate = (d) => d.toISOString().split("T")[0];
    const from = formatDate(startDate);
    const to = formatDate(today);

    console.log(`🔍 [PAGE-KEYWORDS] Fetching keywords for page ${pageUrl} from ${from} to ${to}`);

    // Use dimensionFilterGroups to filter by specific page URL
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        gscSiteUrl
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: from,
          endDate: to,
          dimensions: ["query"],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: "page",
                  operator: "equals",
                  expression: pageUrl,
                },
              ],
            },
          ],
          rowLimit: 500, // Get more keywords to capture the "other" category
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [PAGE-KEYWORDS] GSC API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `GSC API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(`🔍 [PAGE-KEYWORDS] GSC response:`, { rowCount: data.rows?.length || 0 });

    if (data.rows && data.rows.length > 0) {
      // Sort by impressions descending to identify top performers
      const sortedKeywords = data.rows
        .map((row) => ({
          keyword: row.keys[0].replace(/^\[|\]$/g, ""),
          clicks: row.clicks,
          impressions: row.impressions,
          position: Math.round(row.position * 10) / 10, // Round to 1 decimal
          ctr: `${(row.ctr * 100).toFixed(1)}%`,
          ctrRaw: row.ctr * 100,
        }))
        .sort((a, b) => b.impressions - a.impressions);

      // Split into top performers (meaningful traffic) and others (testing keywords)
      // Top performers: keywords with 5+ impressions OR any clicks
      const topPerformers = sortedKeywords.filter(
        (k) => k.impressions >= 5 || k.clicks > 0
      );
      
      const otherKeywords = sortedKeywords.filter(
        (k) => k.impressions < 5 && k.clicks === 0
      );

      // Calculate totals
      const totalImpressions = sortedKeywords.reduce((sum, k) => sum + k.impressions, 0);
      const totalClicks = sortedKeywords.reduce((sum, k) => sum + k.clicks, 0);

      console.log(`✅ [PAGE-KEYWORDS] Fetched ${sortedKeywords.length} keywords for page (${topPerformers.length} top, ${otherKeywords.length} other)`);
      
      return NextResponse.json({ 
        success: true, 
        keywords: {
          topPerformers,
          otherKeywords,
          totals: {
            impressions: totalImpressions,
            clicks: totalClicks,
            totalKeywords: sortedKeywords.length,
          }
        }
      });
    } else {
      console.log("⚠️ [PAGE-KEYWORDS] No keywords found for this page");
      return NextResponse.json({ 
        success: true, 
        keywords: {
          topPerformers: [],
          otherKeywords: [],
          totals: {
            impressions: 0,
            clicks: 0,
            totalKeywords: 0,
          }
        }
      });
    }
  } catch (error) {
    console.error("❌ [PAGE-KEYWORDS] API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch page keywords", details: error.message },
      { status: 500 }
    );
  }
}
