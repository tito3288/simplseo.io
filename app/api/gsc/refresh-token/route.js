import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { refreshToken } = await request.json();

    console.log("🔄 Attempting to refresh GSC token...");
    console.log("🔍 Refresh token length:", refreshToken?.length);

    if (!refreshToken) {
      console.log("❌ No refresh token provided");
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_CLIENT_SECRET) {
      console.error("❌ GOOGLE_CLIENT_SECRET is not set!");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: "956212275866-7dtgdq7b38b156riehghuvh8b8469ktg.apps.googleusercontent.com",
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Token refresh failed:", errorData);
      return NextResponse.json(
        { error: "Failed to refresh token" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error("❌ Error refreshing GSC token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 