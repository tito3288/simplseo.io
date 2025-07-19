import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code is required" },
        { status: 400 }
      );
    }

    // Add debugging
    console.log("🔍 Environment check:");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("GOOGLE_CLIENT_SECRET exists:", !!process.env.GOOGLE_CLIENT_SECRET);
    console.log("GOOGLE_CLIENT_SECRET length:", process.env.GOOGLE_CLIENT_SECRET?.length);
    
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      console.error("❌ GOOGLE_CLIENT_SECRET is not set!");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: "956212275866-7dtgdq7b38b156riehghuvh8b8469ktg.apps.googleusercontent.com",
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: process.env.NODE_ENV === "production" 
          ? "https://simplseo-io.vercel.app/gsc-callback"
          : "http://localhost:3000/gsc-callback",
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Token exchange failed:", errorData);
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: response.status }
      );
    }

               const data = await response.json();
           
           console.log("🔍 Google OAuth response:", {
             hasAccessToken: !!data.access_token,
             hasRefreshToken: !!data.refresh_token,
             refreshTokenLength: data.refresh_token?.length,
             expiresIn: data.expires_in
           });
           
           return NextResponse.json({
             access_token: data.access_token,
             refresh_token: data.refresh_token,
             expires_in: data.expires_in,
           });
  } catch (error) {
    console.error("❌ Error exchanging authorization code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 