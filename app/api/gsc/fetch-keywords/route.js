import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { userId, dateRange = "28" } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get GSC data from Firestore using Admin SDK
    const gscDoc = await db.collection('gscTokens').doc(userId).get();
    
    if (!gscDoc.exists) {
      return NextResponse.json(
        { error: "No GSC data found for user" },
        { status: 404 }
      );
    }

    const gscData = gscDoc.data();
    const accessToken = gscData.accessToken;
    const siteUrl = gscData.siteUrl;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No valid GSC access token found" },
        { status: 401 }
      );
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: "No GSC site URL found" },
        { status: 400 }
      );
    }

    // Fetch GSC data for the specified date range (same logic as dashboard)
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

    console.log(`🔍 Fetching GSC data from ${from} to ${to} for ${siteUrl}`);

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
          startDate: from,
          endDate: to,
          dimensions: ["query", "page"],
          rowLimit: 100,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`GSC API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.rows) {
      const keywords = data.rows.map((row) => ({
        keyword: row.keys[0].replace(/^\[|\]$/g, ""),
        page: row.keys[1],
        clicks: row.clicks,
        impressions: row.impressions,
        position: Math.round(row.position),
        ctr: `${(row.ctr * 100).toFixed(1)}%`,
      }));

      console.log(`✅ Fetched ${keywords.length} GSC keywords`);
      return NextResponse.json({ success: true, keywords });
    } else {
      console.log("⚠️ No GSC data rows found");
      return NextResponse.json({ success: true, keywords: [] });
    }
  } catch (error) {
    console.error("❌ GSC Fetch Keywords API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GSC keywords" },
      { status: 500 }
    );
  }
}
