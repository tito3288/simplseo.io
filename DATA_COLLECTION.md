# Data Collection System

This document explains the Firestore data collection structure for training and playbook purposes.

## Overview

We collect three types of data:
1. **Meta Title/Description Generation** - What works for similar businesses
2. **Performance Tracking → Playbook Strategies** - Successful SEO strategies
3. **Chat Conversation Summaries** - Training data (not full conversations)

All data is stored in Firestore using a subcollection structure for easy organization and future BigQuery migration.

## Firestore Structure

### 1. Training Events (`trainingEvents`)

**Purpose:** Track meta title/description generation for training

**Structure:**
```
trainingEvents/
  └── {hashedUserId}/
      └── events/ (subcollection)
          └── {autoId}
              ├── event_timestamp
              ├── event_type (e.g., "meta_title_generated", "meta_description_generated")
              ├── hashed_user_id
              ├── business_type
              ├── business_location
              ├── payload_json (contains pageUrl, focusKeywords, generated content, context)
              └── userId (for easy querying, remove before BigQuery migration)
```

**When it's saved:**
- Automatically when meta titles are generated (`/api/seo-assistant/meta-title`)
- Automatically when meta descriptions are generated (`/api/seo-assistant/meta-description`)

**How to find user data:**
- Navigate to `trainingEvents/{hashedUserId}/events` in Firestore console
- All events for that user are in the subcollection

---

### 2. Playbook Strategies (`playbookStrategies`)

**Purpose:** Store successful SEO strategies that meet success criteria

**Structure:**
```
playbookStrategies/
  └── {hashedUserId}/
      └── strategies/ (subcollection)
          └── {autoId}
              ├── businessType
              ├── businessLocation (city only)
              ├── businessState
              ├── strategyType ("meta_title_optimization", "meta_description_optimization", "keyword_targeting")
              ├── pageType ("home", "services", "about", etc.)
              ├── pagePath (anonymized, e.g., "/services")
              ├── focusKeywords (array)
              ├── title (for meta_title_optimization)
              ├── description (for meta_description_optimization)
              ├── preStats/postStats (impressions, clicks, ctr, position)
              ├── improvement (clicksIncrease, ctrIncrease, positionImprovement, impressionsIncrease, successScore)
              ├── timeToResults (days)
              ├── implementedAt
              ├── measuredAt
              ├── status ("success")
              └── userId (hashed, for queries)
```

**Success Criteria (must meet at least one):**
- Clicks increased by 20%+ OR
- CTR increased by 10%+ OR
- Position improved by 2+ positions OR
- Impressions increased by 25%+

**When it's saved:**
- Automatically detected from `implementedSeoTips` when:
  - PostStats exist (measured after 7+ days)
  - Strategy meets success criteria
  - Not already saved

**How to trigger detection:**
```bash
# For a specific user
POST /api/playbook/detect-success
{ "userId": "user123" }

# For all users (cron job)
GET /api/playbook/detect-success?secret=YOUR_CRON_SECRET
```

**How to find user data:**
- Navigate to `playbookStrategies/{hashedUserId}/strategies` in Firestore console
- All successful strategies for that user are in the subcollection

---

### 3. Conversation Summaries (`conversationSummaries`)

**Purpose:** Store summaries of chat conversations for training (privacy-friendly)

**Structure:**
```
conversationSummaries/
  └── {hashedUserId}/
      └── summaries/ (subcollection)
          └── {autoId}
              ├── businessType
              ├── businessLocation
              ├── userQuestionsCount
              ├── userQuestionsSample (first 3 questions only)
              ├── aiResponsesCount
              ├── totalMessages
              ├── conversationLength (total characters)
              ├── topics (extracted keywords, max 10)
              ├── source ("main-chatbot" or "corner-bubble")
              ├── hashedUserId
              └── createdAt
```

**What's NOT stored:**
- Full conversation messages
- User IDs (only hashed)
- Personal information
- Exact URLs or business names

**When it's saved:**
- Automatically when conversations are created (`/api/conversations` POST)
- Automatically when conversations are updated with 2+ messages (`/api/conversations/[id]` PUT)

**How to find user data:**
- Navigate to `conversationSummaries/{hashedUserId}/summaries` in Firestore console
- All conversation summaries for that user are in the subcollection

---

## Privacy & Security

- **User IDs are hashed** using SHA-256 before storage
- **Full URLs are anonymized** (only page paths stored, e.g., "/services")
- **Business names are not stored** in playbook strategies
- **Full conversations are not stored** - only summaries with sample questions
- **Server-side only** - All collections deny client access (Firestore rules)

## Finding Data in Firestore Console

### For a specific user:

1. **Get hashed user ID:**
   ```javascript
   // In browser console or Node.js
   const crypto = require('crypto');
   const hashUserId = (userId) => crypto.createHash('sha256').update(userId).digest('hex');
   const hashedId = hashUserId('user123');
   ```

2. **Navigate in Firestore:**
   - `trainingEvents/{hashedId}/events` - All training events
   - `playbookStrategies/{hashedId}/strategies` - All successful strategies
   - `conversationSummaries/{hashedId}/summaries` - All conversation summaries

### Querying for playbook (similar businesses):

```javascript
// Get successful strategies for "car wash" businesses
const strategies = await db
  .collectionGroup('strategies')
  .where('businessType', '==', 'car wash')
  .where('strategyType', '==', 'meta_title_optimization')
  .where('status', '==', 'success')
  .limit(5)
  .get();
```

## Migration to BigQuery

The data structure is designed to be BigQuery-ready:

1. **Training Events:** Already uses BigQuery schema (`event_timestamp`, `event_type`, `hashed_user_id`, etc.)
2. **Playbook Strategies:** Can be exported as JSON or flattened to BigQuery tables
3. **Conversation Summaries:** Can be exported as JSON

**Migration script (future):**
```javascript
// Export Firestore → BigQuery
const snapshot = await db.collectionGroup('events').get();
const rows = snapshot.docs.map(doc => {
  const data = doc.data();
  return {
    event_timestamp: data.event_timestamp,
    event_type: data.event_type,
    hashed_user_id: data.hashed_user_id,
    business_type: data.business_type,
    business_location: data.business_location,
    payload_json: data.payload_json,
  };
});
// Insert into BigQuery...
```

## API Endpoints

### Detect Successful Strategies

**POST** `/api/playbook/detect-success`
```json
{
  "userId": "user123"
}
```

**GET** `/api/playbook/detect-success?secret=YOUR_CRON_SECRET`
- Processes all users (for cron jobs)

## Files

- `app/lib/trainingLogger.js` - Logs training events to Firestore
- `app/lib/playbookHelpers.js` - Saves successful strategies to playbook
- `app/lib/successDetector.js` - Detects successful strategies from implementedSeoTips
- `app/lib/conversationSummarizer.js` - Creates conversation summaries
- `app/api/playbook/detect-success/route.js` - API endpoint to trigger success detection

## Notes

- All data collection is **non-blocking** - failures don't affect user experience
- Data is collected **asynchronously** - doesn't slow down API responses
- **Firestore rules** prevent client access - only server-side writes allowed
- **Easy to find** - subcollection structure makes it simple to find all data for a user

