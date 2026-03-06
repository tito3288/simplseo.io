import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const counts = { implementations: 0, audits: 0, suggestions: 0, focusKeywords: 0 };

    // Archive implementedSeoTips
    const implSnapshot = await db
      .collection("implementedSeoTips")
      .where("userId", "==", userId)
      .get();

    if (!implSnapshot.empty) {
      const batch = db.batch();
      implSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { preRevampArchived: true, preRevampDate: now });
        counts.implementations++;
      });
      await batch.commit();
    }

    // Archive contentAuditResults
    const auditSnapshot = await db
      .collection("contentAuditResults")
      .where("userId", "==", userId)
      .get();

    if (!auditSnapshot.empty) {
      const batch = db.batch();
      auditSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { preRevampArchived: true, preRevampDate: now });
        counts.audits++;
      });
      await batch.commit();
    }

    // Archive aiSuggestions
    const suggestionsSnapshot = await db
      .collection("aiSuggestions")
      .where("userId", "==", userId)
      .get();

    if (!suggestionsSnapshot.empty) {
      const batch = db.batch();
      suggestionsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { preRevampArchived: true, preRevampDate: now });
        counts.suggestions++;
      });
      await batch.commit();
    }

    // Archive focus keywords
    const focusKeywordsRef = db.collection("focusKeywords").doc(userId);
    const focusKeywordsDoc = await focusKeywordsRef.get();
    if (focusKeywordsDoc.exists) {
      await focusKeywordsRef.update({ preRevampArchived: true, preRevampDate: now });
      counts.focusKeywords = 1;
    }

    return NextResponse.json({
      success: true,
      archivedCounts: counts,
    });
  } catch (error) {
    console.error("Failed to archive revamp data:", error);
    return NextResponse.json(
      { error: "Failed to archive data. Please try again.", details: error.message },
      { status: 500 }
    );
  }
}
