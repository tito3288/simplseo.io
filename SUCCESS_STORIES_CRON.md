# Success Stories Background Checking & Notifications

## Overview

This system automatically checks Google Search Console daily to find when user-created pages start ranking, and sends email notifications when matches are found.

## How It Works

### Background Process (Phase 2)
- **Runs daily at 2:00 AM** via Vercel Cron
- Checks all users who have marked opportunities as "created"
- Fetches latest GSC data for each user
- Matches created page URLs with GSC data
- Sends email notifications when matches are found
- Updates Firestore with ranking metrics

### Fallback (Always Active)
- When users visit the Extra Opportunities page, it **always** fetches fresh GSC data
- Matches are done in real-time
- Success cards appear immediately if matches exist
- **This works even if the cron job fails**

## Files

- `vercel.json` - Cron configuration (runs daily at 2 AM)
- `app/api/cron/check-success-stories/route.js` - Cron job handler
- `app/generic-keywords/page.js` - Page with fallback logic (unchanged)

## Environment Variables Required

### For Email Notifications (Choose One):

#### Option 1: SendGrid (Recommended)
```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
```

#### Option 2: Gmail SMTP (Fallback)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### For Cron Security:
```bash
CRON_SECRET=your-random-secret-key-here
```

### For GSC Token Refresh:
```bash
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### For App URL (in emails):
```bash
NEXT_PUBLIC_APP_URL=https://simplseo-io.vercel.app
```

## Setup Instructions

### 1. Set Up SendGrid (Recommended)

1. **Create SendGrid Account**
   - Go to https://sendgrid.com
   - Sign up for a free account (100 emails/day free)

2. **Create API Key**
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Name it "SimplSEO Cron"
   - Give it "Mail Send" permissions
   - Copy the API key

3. **Add to Environment Variables**
   - In Vercel: Project Settings → Environment Variables
   - Add: `SENDGRID_API_KEY` = your API key
   - Or in `.env.local` for local testing:
     ```bash
     SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
     ```

4. **Verify Domain (Optional but Recommended)**
   - Go to Settings → Sender Authentication
   - Verify your domain (improves deliverability)
   - Or use single sender verification for testing

### 2. Set Up Gmail SMTP (Alternative)

If you prefer Gmail instead of SendGrid:

1. **Enable 2-Factor Authentication** on your Gmail account

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "SimplSEO"
   - Copy the 16-character password

3. **Add to Environment Variables**
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # App password (no spaces)
   SMTP_FROM=your-email@gmail.com
   ```

### 3. Set Up Cron Secret

Generate a random secret for cron authentication:

```bash
# Generate a random secret
openssl rand -base64 32
```

Add to environment variables:
```bash
CRON_SECRET=your-generated-secret-here
```

### 4. Deploy to Vercel

1. **Push to GitHub** (if not already)
2. **Deploy to Vercel**
   - Vercel will automatically detect `vercel.json`
   - Cron job will be registered automatically

3. **Verify Cron Job**
   - Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
   - You should see: `/api/cron/check-success-stories` scheduled for `0 2 * * *`

## Testing

### Test Cron Job Manually

You can test the cron job by calling it directly:

```bash
curl -X GET "https://simplseo-io.vercel.app/api/cron/check-success-stories" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or in browser (if CRON_SECRET is set):
```
https://simplseo-io.vercel.app/api/cron/check-success-stories
```

### Test Email Notifications

1. Mark an opportunity as "created" with a URL
2. Wait for that page to appear in GSC (or manually trigger cron)
3. Check email inbox for notification

### Verify Fallback Works

1. Disable cron job (or let it fail)
2. Visit Extra Opportunities page
3. Success card should still appear if page is ranking

## Email Notification Content

When a match is found, users receive an email with:
- **Subject**: "🎉 Your page is now ranking in Google! - [Keyword]"
- **Content**:
  - Keyword
  - Page URL (clickable)
  - Position
  - Impressions
  - Clicks
  - CTR
  - Link to view success stories

## Monitoring

### Check Cron Logs

In Vercel Dashboard:
- Go to Deployments → Click latest deployment → Functions
- Find `/api/cron/check-success-stories`
- View logs to see:
  - How many users were checked
  - How many matches were found
  - How many notifications were sent
  - Any errors

### Example Log Output

```
🔄 Starting daily success stories check...
✅ Notification sent to user@example.com for keyword: best dentist independence
✅ Success stories check complete. Checked: 10, Matches: 2, Notifications: 2
```

## Troubleshooting

### Cron Job Not Running

1. **Check Vercel Cron Status**
   - Vercel Dashboard → Settings → Cron Jobs
   - Verify it's enabled and scheduled correctly

2. **Check CRON_SECRET**
   - Must match in environment variables
   - Used for authentication

3. **Check Logs**
   - Look for errors in Vercel function logs
   - Check for API rate limits or token issues

### Emails Not Sending

1. **Check Email Configuration**
   - Verify SendGrid API key or SMTP credentials
   - Check SendGrid dashboard for delivery status
   - Check spam folder

2. **Check Logs**
   - Look for email sending errors
   - Verify transporter is created successfully

3. **Test Email Service**
   - Try sending a test email manually
   - Check SendGrid activity feed

### No Matches Found

1. **Verify GSC Connection**
   - User must have GSC connected
   - Check if tokens are valid

2. **Check Page URLs**
   - URLs must match exactly (after normalization)
   - Check for trailing slashes, www, etc.

3. **Check GSC Data**
   - Page must appear in GSC data
   - Must be within last 28 days

## Rate Limits

- **GSC API**: ~600 requests/minute per project
- **SendGrid Free**: 100 emails/day
- **SendGrid Paid**: Based on plan

The cron job processes users sequentially to stay under rate limits.

## Cost

- **Vercel Cron**: Free (included in Pro plan)
- **SendGrid**: Free tier (100 emails/day) or paid plans
- **Gmail SMTP**: Free (with Gmail account)
- **GSC API**: Free (Google Search Console)

## Security

- Cron job requires `CRON_SECRET` header for authentication
- Only Vercel can trigger cron jobs (with secret)
- User emails are fetched from Firestore (secure)
- GSC tokens are stored securely in Firestore

## Future Enhancements

- [ ] Add caching to reduce API calls
- [ ] Add retry logic for failed notifications
- [ ] Add webhook notifications
- [ ] Add in-app notifications
- [ ] Add notification preferences (email frequency)

