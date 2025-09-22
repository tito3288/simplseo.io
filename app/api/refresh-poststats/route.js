import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    message: "Refresh postStats API is working",
    timestamp: new Date().toISOString()
  });
}

export async function POST(req) {
  try {
    const { userId, forceUpdate = false } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    console.log("🔄 Refreshing postStats for user:", userId, "forceUpdate:", forceUpdate);

    // First, let's test if the Cloud Function exists by trying different URLs
    const possibleUrls = [
      'https://us-central1-simpleseo-90570.cloudfunctions.net/updateAilMissingPostStats',
      'https://us-central1-simpleseo-90570.cloudfunctions.net/updateAllMissingPostStats',
      'https://us-central1-simpleseo-90570.cloudfunctions.net/updateMissingPostStats',
      'https://us-central1-simpleseo-90570.cloudfunctions.net/refreshPostStats'
    ];

    let workingUrl = null;
    let response = null;

    // Test each URL to find the working one
    for (const url of possibleUrls) {
      try {
        console.log("🧪 Testing URL:", url);
        const testResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            forceUpdate: forceUpdate
          })
        });

        console.log(`📊 ${url} response status:`, testResponse.status);
        
        if (testResponse.status !== 404) {
          workingUrl = url;
          response = testResponse;
          console.log("✅ Found working URL:", url);
          break;
        }
      } catch (error) {
        console.log(`❌ ${url} failed:`, error.message);
        continue;
      }
    }

    if (!workingUrl) {
      return NextResponse.json({ 
        error: "No working Cloud Function found",
        details: "Tried all possible URLs but none responded successfully",
        testedUrls: possibleUrls
      }, { status: 404 });
    }

    console.log("📊 Using working Cloud Function:", workingUrl);
    console.log("📊 Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Cloud Function error:", response.status, errorText);
      return NextResponse.json({ 
        error: "Cloud Function failed", 
        details: errorText,
        status: response.status,
        workingUrl: workingUrl
      }, { status: response.status });
    }

    const result = await response.json();
    console.log("✅ Cloud Function success:", result);

    return NextResponse.json({
      success: true,
      message: "postStats refreshed successfully",
      data: result,
      workingUrl: workingUrl
    });

  } catch (error) {
    console.error("❌ Error in refresh-poststats API:", error);
    return NextResponse.json({ 
      error: "Failed to refresh postStats",
      details: error.message 
    }, { status: 500 });
  }
}
