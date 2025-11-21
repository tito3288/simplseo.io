# Access Request Feature Flag

## Overview
The access request system can be easily enabled/disabled using a feature flag. When disabled, all approval checks are skipped and users can sign up normally.

## Current Status: **DISABLED** (Default)

## How to Enable/Disable

### To Disable (Current State)
In `.env.local`, either:
- Don't include the variable, OR
- Set: `NEXT_PUBLIC_ENABLE_ACCESS_REQUEST=false`

### To Enable
In `.env.local`, set:
```bash
NEXT_PUBLIC_ENABLE_ACCESS_REQUEST=true
```

Then restart your dev server.

## What Happens When Disabled

✅ **Users can sign up normally** - No approval checks
✅ **No API calls** - Approval endpoints are never called
✅ **No performance impact** - Code is skipped entirely
✅ **Request-access page redirects** - Automatically goes to `/auth`
✅ **Verify-code page redirects** - Automatically goes to `/auth`

## What Happens When Enabled

🔒 **Users must be approved** - Approval checks run
📧 **Email notifications** - Admin gets notified of requests
🎫 **Invitation codes** - Required for new signups
✅ **Full access control** - Complete approval workflow active

## Files Updated

- `app/lib/accessRequestConfig.js` - Feature flag helper
- `app/page.js` - Home page routing
- `app/auth/page.js` - Signup approval checks
- `app/request-access/page.js` - Redirects if disabled
- `app/verify-code/page.js` - Redirects if disabled

## Testing

### Test Disabled (Current):
1. Visit `http://localhost:3000/`
2. Should go directly to `/auth`
3. Try to create account → Should work without approval

### Test Enabled:
1. Set `NEXT_PUBLIC_ENABLE_ACCESS_REQUEST=true` in `.env.local`
2. Restart server
3. Visit `http://localhost:3000/`
4. Try to create account → Should redirect to `/request-access`

## Quick Enable Command

When you need to enable it, just say:
> "Enable access request logic"

And I'll help you set it up!

