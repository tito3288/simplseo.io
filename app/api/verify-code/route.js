import { NextResponse } from "next/server";
import { db } from "../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "-");

    // Check invitationCodes collection
    const codeDoc = await db.collection("invitationCodes").doc(normalizedCode).get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: "Invalid invitation code" },
        { status: 400 }
      );
    }

    const codeData = codeDoc.data();

    // Check if code is already used
    if (codeData.used) {
      return NextResponse.json(
        { error: "This invitation code has already been used" },
        { status: 400 }
      );
    }

    // Check if code is expired (if expiresAt exists)
    if (codeData.expiresAt) {
      const expiresAt = new Date(codeData.expiresAt);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: "This invitation code has expired" },
          { status: 400 }
        );
      }
    }

    // Mark code as used
    await codeDoc.ref.update({
      used: true,
      usedAt: new Date().toISOString(),
    });

    // Update access request status if exists
    const email = codeData.email;
    if (email) {
      const requestsSnapshot = await db
        .collection("accessRequests")
        .where("email", "==", email)
        .get();

      if (!requestsSnapshot.empty) {
        const requestDoc = requestsSnapshot.docs[0];
        await requestDoc.ref.update({
          status: "approved",
          approvedAt: new Date().toISOString(),
        });
      }

      // Ensure email is in approvedUsers collection
      await db.collection("approvedUsers").doc(email).set({
        email: email,
        invitationCode: normalizedCode,
        approvedAt: codeData.createdAt || new Date().toISOString(),
        usedAt: new Date().toISOString(),
        approvedBy: codeData.approvedBy || null,
      }, { merge: true });
    }

    console.log(`✅ Invitation code verified: ${normalizedCode} for ${email}`);

    return NextResponse.json({
      success: true,
      email: email,
      message: "Code verified successfully",
    });
  } catch (error) {
    console.error("❌ Error verifying code:", error);
    return NextResponse.json(
      { error: "Failed to verify code", details: error.message },
      { status: 500 }
    );
  }
}

