import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');

    if (!docId) {
      return NextResponse.json({ error: "docId parameter is required" }, { status: 400 });
    }

    console.log("🧪 Testing postStats creation for document:", docId);

    // Decode the URL to see what we're actually working with
    const decodedDocId = decodeURIComponent(docId);
    console.log("🔍 Decoded docId:", decodedDocId);

    // Extract the pageUrl from the document ID
    const parts = decodedDocId.split('_');
    if (parts.length < 2) {
      return NextResponse.json({ error: "Invalid document ID format" }, { status: 400 });
    }

    const pageUrl = parts.slice(1).join('_'); // Rejoin in case URL has multiple underscores
    console.log("🔍 Extracted pageUrl:", pageUrl);

    // Create a new safe document ID using the same logic as the components
    const createSafeDocId = (userId, pageUrl) => {
      const urlHash = btoa(pageUrl).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      return `${userId}_${urlHash}`;
    };

    const userId = parts[0];
    const safeDocId = createSafeDocId(userId, pageUrl);
    console.log("🔍 New safe docId:", safeDocId);

    // Now test the Cloud Function with the safe document ID
    const cloudFunctionUrl = `https://us-central1-simpleseo-90570.cloudfunctions.net/testPostStatsUpdate`;
    
    console.log("🌐 Calling Cloud Function with safe docId:", cloudFunctionUrl);
    
    const response = await fetch(cloudFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId: safeDocId })
    });
    
    const result = await response.json();

    console.log("📊 Cloud Function response status:", response.status);
    console.log("📊 Cloud Function response:", result);

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: "PostStats test completed successfully",
        result,
        oldDocId: decodedDocId,
        newSafeDocId: safeDocId
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Cloud Function failed",
        details: result,
        oldDocId: decodedDocId,
        newSafeDocId: safeDocId
      }, { status: 500 });
    }

  } catch (error) {
    console.error("❌ Error in test-poststats API:", error);
    return NextResponse.json(
      { error: "Failed to test postStats", details: error.message },
      { status: 500 }
    );
  }
}
