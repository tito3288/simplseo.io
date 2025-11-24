# Email Notifications Guide

## How Notifications Work

### Flow Overview

```
1. User marks opportunity as "created" → URL saved to Firestore
   ↓
2. Daily cron job runs (2 AM) → Checks GSC data
   ↓
3. Match found? → Send email notification
   ↓
4. User receives email → "🎉 Your page is now ranking!"
```

### What Gets Notified

- **When**: A page you marked as "created" appears in Google Search Console
- **Who**: The email address used to create the SimplSEO account
- **What**: Email includes:
  - Keyword
  - Page URL
  - Position
  - Impressions
  - Clicks
  - CTR
  - Link to view success stories

### Email Address Used

The notification is sent to the **Google email address** the user used to:
- Create their SimplSEO account
- Sign in with Google OAuth

This email is stored in the `users` collection in Firestore:
```javascript
{
  email: "user@gmail.com",  // ← This is where notifications go
  // ... other user data
}
```

## Email Service Setup

### Option 1: SendGrid (Recommended)

**Why SendGrid?**
- ✅ Better deliverability
- ✅ Free tier: 100 emails/day
- ✅ Easy setup
- ✅ Good for production

**Setup Steps:**

1. **Create Account**
   - Go to https://sendgrid.com
   - Sign up (free account)

2. **Create API Key**
   ```
   Settings → API Keys → Create API Key
   Name: "SimplSEO Cron"
   Permissions: Mail Send (Full Access)
   ```

3. **Copy API Key**
   - Looks like: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Save it immediately** (can't view again)

4. **Add to Vercel**
   ```
   Project Settings → Environment Variables
   Key: SENDGRID_API_KEY
   Value: SG.xxxxxxxxxxxxx
   ```

5. **Verify Domain (Optional)**
   - Settings → Sender Authentication
   - Verify your domain for better deliverability
   - Or use single sender verification for testing

**That's it!** The cron job will automatically use SendGrid.

### Option 2: Gmail SMTP (Fallback)

**Why Gmail?**
- ✅ Free
- ✅ Easy if you already have Gmail
- ⚠️ Less reliable for bulk emails
- ⚠️ Rate limits

**Setup Steps:**

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable 2FA if not already enabled

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name: "SimplSEO"
   - Copy the 16-character password (looks like: `xxxx xxxx xxxx xxxx`)

3. **Add to Vercel**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # App password (no spaces)
   SMTP_FROM=your-email@gmail.com
   ```

**Note**: Remove spaces from the app password when adding to Vercel.

## Email Content Example

**Subject:**
```
🎉 Your page is now ranking in Google! - best dentist independence
```

**Body:**
```
🎉 Great News! Your Page is Ranking!

We have exciting news - the page you created is now appearing in Google Search Console!

Page Details:
Keyword: best dentist independence
Page URL: https://example.com/best-dentist-independence
Position: 12
Impressions: 150
Clicks: 5
CTR: 3.3%

[View Success Stories Button]
```

## Testing Notifications

### Test Email Sending

1. **Mark an opportunity as created**
   - Go to Extra Opportunities page
   - Click "Mark as Created"
   - Enter a page URL

2. **Wait for cron job** (or trigger manually)
   - Cron runs daily at 2 AM
   - Or test manually via API

3. **Check email inbox**
   - Look for email from SimplSEO
   - Check spam folder if not in inbox

### Manual Test

You can test the cron job manually:

```bash
curl -X GET "https://simplseo-io.vercel.app/api/cron/check-success-stories" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Troubleshooting

### Emails Not Arriving

1. **Check Spam Folder**
   - Emails might be filtered as spam
   - Mark as "Not Spam" if found

2. **Verify Email Configuration**
   - Check SendGrid API key or SMTP credentials
   - Verify in Vercel environment variables

3. **Check SendGrid Dashboard**
   - Go to Activity Feed
   - See if emails were sent
   - Check delivery status

4. **Check Logs**
   - Vercel Dashboard → Functions → Logs
   - Look for email sending errors

### Wrong Email Address

The email is sent to the address stored in:
- `users/{userId}/email` in Firestore
- This is the email used to create the account

To change it, update the user's email in Firestore.

### Rate Limits

- **SendGrid Free**: 100 emails/day
- **Gmail**: ~500 emails/day
- **Cron job**: Processes users sequentially to avoid rate limits

## Notification Frequency

- **One notification per opportunity**: Only sent once when first match is found
- **Tracked in Firestore**: `notificationSentAt` field prevents duplicates
- **Daily check**: Cron runs once per day at 2 AM

## Disabling Notifications

To disable notifications temporarily:

1. **Remove email configuration**
   - Remove `SENDGRID_API_KEY` or SMTP credentials
   - Cron will still run but skip email sending

2. **Or disable cron job**
   - Remove from `vercel.json`
   - Or comment out in Vercel dashboard

## Security

- ✅ Email addresses stored securely in Firestore
- ✅ API keys stored in environment variables (never in code)
- ✅ Cron job requires authentication (`CRON_SECRET`)
- ✅ Only Vercel can trigger cron jobs

## Cost

- **SendGrid Free**: 100 emails/day (free forever)
- **SendGrid Paid**: Starts at $19.95/month (40,000 emails)
- **Gmail**: Free (with Gmail account)

For most use cases, the free SendGrid tier is sufficient.

