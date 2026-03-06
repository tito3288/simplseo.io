import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // 1. Get user's website URL from onboarding
    const onboardingDoc = await db.collection("onboarding").doc(userId).get();
    if (!onboardingDoc.exists) {
      return NextResponse.json({ error: "No onboarding data found" }, { status: 404 });
    }

    const { websiteUrl } = onboardingDoc.data();
    if (!websiteUrl) {
      return NextResponse.json({ error: "No website URL configured" }, { status: 400 });
    }

    // 2. Delete old pageContentCache entries (subcollection structure)
    const subcollectionRef = db.collection("pageContentCache").doc(userId).collection("pages");
    const subcollectionSnap = await subcollectionRef.get();
    if (!subcollectionSnap.empty) {
      const batch = db.batch();
      subcollectionSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // 3. Delete old pageContentCache entries (flat structure)
    const flatSnap = await db
      .collection("pageContentCache")
      .where("userId", "==", userId)
      .get();
    if (!flatSnap.empty) {
      const batch = db.batch();
      flatSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // 4. Reset siteCrawls preferences for a fresh crawl
    const crawlDocRef = db.collection("siteCrawls").doc(userId);
    const crawlSnap = await crawlDocRef.get();
    if (crawlSnap.exists) {
      await crawlDocRef.update({
        approvedUrls: [],
        excludedUrls: [],
        manualUrls: [],
        priorityUrls: [],
      });
    }

    // 5. Trigger crawl via internal fetch
    const crawlRes = await fetch(`${BASE_URL}/api/crawl-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        websiteUrl,
        mode: "confirmed",
      }),
    });

    if (!crawlRes.ok) {
      const errorData = await crawlRes.json().catch(() => ({}));
      throw new Error(errorData.error || `Crawl failed with status ${crawlRes.status}`);
    }

    const crawlData = await crawlRes.json();

    // 6. Extract page URLs from crawl results
    const pages = (crawlData.pages || []).map((p) => ({
      url: p.pageUrl || p.url,
      discovered: false,
      impressions: 0,
      clicks: 0,
    }));

    return NextResponse.json({
      success: true,
      pages,
      totalPages: pages.length,
    });
  } catch (error) {
    console.error("Revamp crawl failed:", error);
    return NextResponse.json(
      { error: "Failed to crawl site. Please try again.", details: error.message },
      { status: 500 }
    );
  }
}
