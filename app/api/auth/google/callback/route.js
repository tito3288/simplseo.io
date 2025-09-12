import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('Google OAuth Callback Debug:', {
      code: code ? 'present' : 'missing',
      state,
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? 'present' : 'missing',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'present' : 'missing',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'missing'
    });

    if (!code) {
      return NextResponse.json({ error: "Authorization code is required" }, { status: 400 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Redirect back to onboarding with tokens (preserve step 4)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/onboarding', baseUrl);
    redirectUrl.searchParams.set('access_token', tokens.access_token);
    redirectUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
    redirectUrl.searchParams.set('email', userInfo.data.email);
    redirectUrl.searchParams.set('step', '4'); // Stay on Analytics Setup step

    return NextResponse.redirect(redirectUrl.toString());

  } catch (error) {
    console.error("Google OAuth callback error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/onboarding?error=google_auth_failed`);
  }
}
