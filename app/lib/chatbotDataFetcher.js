// app/lib/chatbotDataFetcher.js
import { createGSCTokenManager } from "./gscTokenManager";
import { db } from "../lib/firebaseAdmin";

export const fetchChatbotData = async (userId) => {
  try {
    console.log("🔍 Fetching chatbot data for user:", userId);
    
    const tokenManager = createGSCTokenManager(userId);
    
    // Add a small delay to ensure tokens are stored
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const gscData = await tokenManager.getStoredGSCData();
    
    if (!gscData?.accessToken || !gscData?.siteUrl) {
      console.log("❌ Missing GSC access token or site URL");
      return {
        success: false,
        error: "Google Search Console not connected",
        data: null
      };
    }

    // Get valid access token (refresh if needed)
    const validToken = await tokenManager.getValidAccessToken();
    if (!validToken) {
      console.log("❌ Could not get valid access token");
      return {
        success: false,
        error: "Could not get valid access token",
        data: null
      };
    }

    console.log("✅ Got valid token, fetching all data...");
    
    // Fetch all data from GSC
    const allData = await fetchAllGSCData(gscData.siteUrl, validToken);
    
    // Fetch focus keywords from Firestore (server-side)
    let focusKeywords = [];
    try {
      const focusKeywordsDoc = await db.collection("focusKeywords").doc(userId).get();
      if (focusKeywordsDoc.exists) {
        const data = focusKeywordsDoc.data();
        if (Array.isArray(data.keywords)) {
          focusKeywords = data.keywords
            .map((entry) => {
              if (!entry) return null;
              if (typeof entry === "string") {
                return { keyword: entry.trim(), pageUrl: null, source: "gsc-existing" };
              }
              const keyword = typeof entry.keyword === "string" ? entry.keyword.trim() : null;
              if (!keyword) return null;
              const pageUrl = typeof entry.pageUrl === "string" && entry.pageUrl.trim().length
                ? entry.pageUrl.trim()
                : null;
              const source = entry.source === "ai-generated" ? "ai-generated" : "gsc-existing";
              return { keyword, pageUrl, source };
            })
            .filter(Boolean);
          console.log("✅ Focus keywords loaded:", focusKeywords.length);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching focus keywords:", error);
      // Continue without focus keywords if fetch fails
    }
    
    return {
      success: true,
      data: {
        ...allData,
        focusKeywords
      }
    };
    
  } catch (error) {
    console.error("❌ Error fetching chatbot data:", error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

const fetchAllGSCData = async (siteUrl, token) => {
  try {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 28);

    const format = (d) => d.toISOString().split("T")[0];
    const from = format(start);
    const to = format(today);

    // Fetch keywords data
    const keywordRes = await fetch(
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
          startDate: from,
          endDate: to,
          dimensions: ["query", "page"],
          rowLimit: 250,
        }),
      }
    );

    const keywordJson = await keywordRes.json();

    if (!keywordJson.rows) {
      return {
        gscKeywords: [],
        topPages: [],
        lowCtrPages: [],
        aiTips: [],
        easyWins: [],
        impressionTrends: []
      };
    }

    const formatted = keywordJson.rows.map((row) => ({
      keyword: row.keys[0].replace(/^\[|\]$/g, ""),
      page: row.keys[1],
      clicks: row.clicks,
      impressions: row.impressions,
      position: Math.round(row.position),
      ctr: `${(row.ctr * 100).toFixed(1)}%`,
    }));

    // Top pages by clicks
    const pageClickMap = {};
    formatted.forEach((row) => {
      pageClickMap[row.page] = (pageClickMap[row.page] || 0) + row.clicks;
    });

    const topPages = Object.entries(pageClickMap)
      .map(([page, clicks]) => ({ page, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    // Low CTR pages
    const lowCtr = formatted.filter(
      (kw) =>
        parseFloat(kw.ctr.replace("%", "")) === 0 && kw.impressions > 20
    );

    const lowCtrPages = Object.values(
      lowCtr.reduce((acc, item) => {
        if (!acc[item.page]) {
          acc[item.page] = { ...item, clicks: 0, impressions: 0 };
        }
        acc[item.page].clicks += item.clicks;
        acc[item.page].impressions += item.impressions;
        return acc;
      }, {})
    );

    // AI tips
    const aiTips = lowCtrPages.map((kw) => {
      return `Your page ${kw.page} is ranking but not getting clicks. Consider improving your title or meta description.`;
    });

    // Easy wins (keywords close to page 1)
    const easyWins = formatted.filter((kw) => {
      const pos = kw.position;
      const ctr = parseFloat(kw.ctr.replace("%", ""));
      return pos > 10 && pos <= 20 && ctr < 5;
    });

    // Fetch impression trends
    const trendsRes = await fetch(
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
          startDate: from,
          endDate: to,
          dimensions: ["date"],
          rowLimit: 1000,
        }),
      }
    );

    const trendsJson = await trendsRes.json();
    const impressionTrends = trendsJson.rows ? trendsJson.rows.map((row) => ({
      date: row.keys[0],
      impressions: row.impressions,
      clicks: row.clicks,
    })) : [];

    console.log("✅ All chatbot data fetched successfully!");
    
    return {
      gscKeywords: formatted,
      topPages,
      lowCtrPages,
      aiTips,
      easyWins,
      impressionTrends
    };

  } catch (error) {
    console.error("❌ Error fetching GSC data:", error);
    throw error;
  }
};
