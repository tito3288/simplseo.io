# Google OAuth Setup for GSC Integration

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Search Console API
   - Google+ API (for user info)

## 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in required fields:
   - App name: "SimplSEO"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/webmasters.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`

## 3. Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Application type: "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (development)
   - `https://yourdomain.com/api/auth/google/callback` (production)

## 4. Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 5. Test the Integration

1. Start your development server: `npm run dev`
2. Go to onboarding page
3. Toggle "Do you have Google Search Console set up?" to "Yes"
4. Click "Connect Google Account"
5. Complete OAuth flow
6. Select your GSC property from the dropdown

## Notes

- Make sure your GSC properties are verified in Google Search Console
- The user must have owner or full user permissions on the GSC properties
- Only verified properties will be shown in the dropdown
