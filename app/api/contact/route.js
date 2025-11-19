import { NextResponse } from "next/server";
import { db } from "../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { name, email, subject, message, userId, userEmail } = await req.json();

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (message.trim().length < 10) {
      return NextResponse.json(
        { error: "Message must be at least 10 characters" },
        { status: 400 }
      );
    }

    const validSubjects = ["question", "feedback", "bug", "feature"];
    if (!validSubjects.includes(subject)) {
      return NextResponse.json(
        { error: "Invalid subject" },
        { status: 400 }
      );
    }

    // Save to Firestore
    const contactData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject,
      message: message.trim(),
      userId: userId || null,
      userEmail: userEmail || null,
      createdAt: new Date().toISOString(),
      status: "new", // new, read, replied
      readAt: null,
      repliedAt: null,
    };

    // Save to contactMessages collection
    const docRef = await db.collection("contactMessages").add(contactData);

    console.log(`✅ Contact message saved: ${docRef.id}`);

    return NextResponse.json({
      success: true,
      messageId: docRef.id,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("❌ Error saving contact message:", error);
    return NextResponse.json(
      { error: "Failed to send message", details: error.message },
      { status: 500 }
    );
  }
}

