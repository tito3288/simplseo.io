import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { userId, keyword, pageUrl, opportunityId } = await req.json();

    // Validation
    if (!userId || !keyword || !pageUrl) {
      return NextResponse.json(
        { error: "userId, keyword, and pageUrl are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    let normalizedUrl;
    try {
      const url = new URL(pageUrl);
      normalizedUrl = url.href;
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Generate opportunity ID if not provided
    const oppId = opportunityId || `${userId}_${keyword.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`;

    // Store in Firestore
    const createdOpportunity = {
      keyword: keyword.trim(),
      pageUrl: normalizedUrl,
      createdAt: new Date().toISOString(),
      status: "created",
      firstRankedAt: null, // Will be set when detected in GSC
      userId: userId,
    };

    await db
      .collection("createdContentOpportunities")
      .doc(userId)
      .collection("created")
      .doc(oppId)
      .set(createdOpportunity, { merge: true });

    console.log(`✅ Created opportunity marked: ${oppId} for ${userId}`);

    return NextResponse.json({
      success: true,
      opportunityId: oppId,
      message: "Opportunity marked as created",
    });
  } catch (error) {
    console.error("❌ Error marking opportunity as created:", error);
    return NextResponse.json(
      { error: "Failed to mark opportunity as created", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch created opportunities
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const snapshot = await db
      .collection("createdContentOpportunities")
      .doc(userId)
      .collection("created")
      .get();

    const opportunities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      opportunities: opportunities,
    });
  } catch (error) {
    console.error("❌ Error fetching created opportunities:", error);
    return NextResponse.json(
      { error: "Failed to fetch created opportunities", details: error.message },
      { status: 500 }
    );
  }
}

