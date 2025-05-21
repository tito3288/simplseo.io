const functions = require("firebase-functions"); // v1 SDK
const pubsub = require("firebase-functions/lib/providers/pubsub"); // required for .schedule
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ⏰ Daily cron job to check SEO progress after 7 days
exports.checkSeoTipProgress = pubsub
  .schedule("every 24 hours")
  .timeZone("America/New_York") // optional
  .onRun(async (context) => {
    const snapshot = await db
      .collection("implementedSeoTips")
      .where("status", "==", "implemented")
      .get();

    const now = Date.now();
    const updates = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const { implementedAt, pageUrl, userId, preStats } = data;

      if (!implementedAt || !userId || !pageUrl || !preStats) continue;

      const daysSince =
        (now - new Date(implementedAt).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 7) continue;
      
      const token = data.gscToken;
      const siteUrl = data.siteUrl;

      if (!token || !siteUrl) continue;

      try {
        // const res = await fetch(
        //   "https://localhost:3000/api/gsc/page-metrics", // ⛳️ Replace with your actual domain endpoint
        //   {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ token, siteUrl, pageUrl }),
        //   }
        // );

        // if (!res.ok) continue;

        // const postStats = await res.json();

        console.log(
          "🔌 Skipping fetch since API is not yet deployed. Using dummy postStats."
        );
        const postStats = {
          impressions: Math.floor(Math.random() * 1000),
          clicks: Math.floor(Math.random() * 200),
          ctr: Math.random().toFixed(2),
          position: Math.random() * 10 + 1,
        };

        updates.push(
          doc.ref.set(
            {
              postStats,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
        );
      } catch (err) {
        console.error(`❌ Error updating ${pageUrl}`, err);
      }
    }

    await Promise.all(updates);
    console.log(`✅ Updated ${updates.length} SEO tip documents`);
    return null;
  });
