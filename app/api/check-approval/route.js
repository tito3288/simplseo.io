import { NextResponse } from "next/server";
import { db } from "../../lib/firebaseAdmin";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check approvedUsers collection
    const approvedUserDoc = await db.collection("approvedUsers").doc(normalizedEmail).get();

    if (approvedUserDoc.exists) {
      const data = approvedUserDoc.data();
      return NextResponse.json({
        approved: true,
        email: normalizedEmail,
        approvedAt: data.approvedAt,
        invitationCode: data.invitationCode,
      });
    }

    // Also check accessRequests for pending/approved status
    const requestsSnapshot = await db
      .collection("accessRequests")
      .where("email", "==", normalizedEmail)
      .get();

    if (!requestsSnapshot.empty) {
      const requestData = requestsSnapshot.docs[0].data();
      return NextResponse.json({
        approved: requestData.status === "approved",
        email: normalizedEmail,
        status: requestData.status,
        requestedAt: requestData.requestedAt,
      });
    }

    // No record found - not approved
    return NextResponse.json({
      approved: false,
      email: normalizedEmail,
      status: "not_found",
    });
  } catch (error) {
    console.error("❌ Error checking approval:", error);
    return NextResponse.json(
      { error: "Failed to check approval", details: error.message },
      { status: 500 }
    );
  }
}

