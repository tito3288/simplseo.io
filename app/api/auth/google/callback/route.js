import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req) {
  try {
    // ✅ FIX: Extract origin dynamically from request URL
    const requestUrl = new URL(req.url);
    const origin = `${requestUrl.protocol}//${requestUrl.host}`;
    const callbackUrl = `${origin}/api/auth/google/callback`;
    
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('Google OAuth Callback Debug:', {
      code: code ? 'present' : 'missing',
      state,
      origin,
      callbackUrl,
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? 'present' : 'missing',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'present' : 'missing',
    });

    if (!code) {
      // ✅ FIX: Include step=4 in error redirect
      const errorUrl = new URL('/onboarding', origin);
      errorUrl.searchParams.set('error', 'google_auth_failed');
      errorUrl.searchParams.set('step', '4');
      return NextResponse.redirect(errorUrl.toString());
    }

    // ✅ FIX: Use dynamic origin for OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // ✅ FIX: Use dynamic origin for redirect
    const redirectUrl = new URL('/onboarding', origin);
    redirectUrl.searchParams.set('access_token', tokens.access_token);
    redirectUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
    redirectUrl.searchParams.set('email', userInfo.data.email);
    redirectUrl.searchParams.set('step', '4'); // Stay on Analytics Setup step

    return NextResponse.redirect(redirectUrl.toString());

  } catch (error) {
    console.error("Google OAuth callback error:", error);
    // ✅ FIX: Extract origin dynamically and include step=4
    const requestUrl = new URL(req.url);
    const origin = `${requestUrl.protocol}//${requestUrl.host}`;
    const errorUrl = new URL('/onboarding', origin);
    errorUrl.searchParams.set('error', 'google_auth_failed');
    errorUrl.searchParams.set('step', '4');
    return NextResponse.redirect(errorUrl.toString());
  }
}
