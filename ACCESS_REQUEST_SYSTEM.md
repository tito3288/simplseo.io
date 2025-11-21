# Access Request System - Implementation Guide

## Overview
This system implements a waitlist/access request feature that requires admin approval before users can sign up for SimplSEO.

## How It Works

### User Flow
1. **First-time visitor** → Redirected to `/request-access`
2. **User submits request** → Saved to Firestore `accessRequests` collection
3. **Admin approves** → Invitation code generated and sent via email
4. **User verifies code** → Email stored in localStorage, redirected to `/auth`
5. **User signs up/logs in** → Access granted, can use the app

### Approval Status Check
- **Home page (`/`)** checks approval status:
  - If logged in → Check their email approval → Dashboard or Request page
  - If not logged in → Check localStorage for approved email → Auth or Request page
  - No stored email → Request page

### After Logout
- Checks if user's email is approved
- If approved → `/auth`
- If not approved → `/request-access`

## Firestore Collections

### `accessRequests`
Stores all access requests:
```javascript
{
  email: "user@example.com",
  name: "John Doe",
  company: "Acme Inc",
  reason: "Want to improve SEO",
  status: "pending" | "approved" | "rejected",
  requestedAt: "2024-01-01T00:00:00Z",
  approvedAt: "2024-01-02T00:00:00Z" | null,
  invitationCode: "A3F9-K2M7" | null,
  approvedBy: "admin" | null
}
```

### `approvedUsers`
Stores approved users by email:
```javascript
{
  email: "user@example.com",
  invitationCode: "A3F9-K2M7",
  approvedAt: "2024-01-02T00:00:00Z",
  usedAt: "2024-01-03T00:00:00Z" | null,
  approvedBy: "admin"
}
```

### `invitationCodes`
Stores invitation codes:
```javascript
{
  code: "A3F9-K2M7",
  email: "user@example.com",
  createdAt: "2024-01-02T00:00:00Z",
  expiresAt: "2024-02-01T00:00:00Z", // 30 days
  used: false,
  usedAt: null,
  approvedBy: "admin"
}
```

## API Routes

### `/api/access-request` (POST)
- Creates a new access request
- Validates email
- Prevents duplicate requests

### `/api/verify-code` (POST)
- Verifies invitation code
- Marks code as used
- Updates access request status
- Stores email in `approvedUsers`

### `/api/check-approval` (GET)
- Checks if email is approved
- Query param: `?email=user@example.com`
- Returns: `{ approved: true/false, ... }`

### `/api/admin/approve` (POST/GET)
- **POST**: Approve/reject requests
- **GET**: List requests by status
- Requires `adminSecret` in body/query

## Admin Dashboard

### Access
Visit: `/admin/access-requests`

### Features
- View pending/approved/rejected requests
- Approve requests (generates code, sends email)
- Reject requests
- See invitation codes

### Setup
1. Set `ADMIN_SECRET` environment variable
2. Visit `/admin/access-requests`
3. Enter admin secret to access

## Environment Variables

### Required
```bash
# Firebase Admin (for API routes)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# Admin Access
ADMIN_SECRET=your-secret-key-here

# Email (for sending invitation codes)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# App URL (for email links)
NEXT_PUBLIC_APP_URL=https://simplseo-io.vercel.app
```

## Pages

### `/request-access`
- Public page (no auth required)
- Form to request access
- Shows success message after submission

### `/verify-code`
- Public page (no auth required)
- Form to enter invitation code
- Redirects to `/auth` after successful verification

### `/admin/access-requests`
- Admin dashboard
- Requires admin secret
- Manage access requests

## Code Generation

Invitation codes are generated in format: `XXXX-XXXX`
- Example: `A3F9-K2M7`
- Uses characters: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (removes confusing chars)
- Expires after 30 days
- One-time use

## Email Templates

When a request is approved, an email is sent with:
- Invitation code
- Link to verify code page
- Instructions
- Expiration date

## Security Notes

1. **Admin Secret**: Store `ADMIN_SECRET` securely (not in public env vars)
2. **Email Validation**: All emails are normalized (lowercase, trimmed)
3. **Code Uniqueness**: Codes are checked for uniqueness before assignment
4. **Expiration**: Codes expire after 30 days
5. **One-time Use**: Codes can only be used once

## Testing

### Test Flow
1. Visit `/request-access`
2. Submit a request
3. Go to `/admin/access-requests` (with admin secret)
4. Approve the request
5. Check email for invitation code
6. Visit `/verify-code` and enter code
7. Should redirect to `/auth`
8. Sign up with the approved email
9. Should work normally

### Test Scenarios
- ✅ First-time visitor → Request page
- ✅ Approved user visiting → Auth page
- ✅ Logged out approved user → Auth page
- ✅ Logged out non-approved user → Request page
- ✅ Signup with non-approved email → Blocked
- ✅ Code verification → Stores email, redirects to auth

## Troubleshooting

### Users can't sign up
- Check if email is in `approvedUsers` collection
- Check if invitation code was verified
- Check localStorage for `approvedEmail`

### Admin can't approve
- Verify `ADMIN_SECRET` is set correctly
- Check Firebase Admin credentials
- Check email SMTP settings

### Codes not working
- Check if code exists in `invitationCodes` collection
- Check if code is already used
- Check if code is expired

## Future Enhancements

- [ ] Bulk approval
- [ ] Email notifications for admin on new requests
- [ ] Request analytics
- [ ] Custom invitation code formats
- [ ] Multiple admin users
- [ ] Request comments/notes

