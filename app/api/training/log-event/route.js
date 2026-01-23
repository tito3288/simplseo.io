import { NextResponse } from "next/server";
import { logTrainingEvent } from "../../../lib/trainingLogger";

/**
 * API endpoint for logging training events from client-side components
 * This allows us to capture important outcomes (success/failure) for AI learning
 */
export async function POST(req) {
  try {
    const {
      userId,
      eventType,
      businessType,
      businessLocation,
      payload,
    } = await req.json();

    if (!userId || !eventType) {
      return NextResponse.json(
        { error: "Missing required fields: userId, eventType" },
        { status: 400 }
      );
    }

    await logTrainingEvent({
      userId,
      eventType,
      businessType,
      businessLocation,
      payload,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging training event:", error);
    return NextResponse.json(
      { error: "Failed to log training event" },
      { status: 500 }
    );
  }
}
