# Playbook Feature Flag System

This document explains how to manage the playbook feature flag system.

## Overview

The playbook feature is controlled by a feature flag system that ensures it only activates when there's enough validated, high-quality data. This prevents the app from using insufficient or unreliable data.

## Configuration

The configuration is stored in Firestore:

```
appConfig/
  └── playbook_config (single document)
```

### Configuration Fields

- `enabled` (boolean) - Master switch (false = playbook disabled)
- `minStrategiesPerBusinessType` (number) - Minimum strategies needed (default: 5)
- `minSuccessRate` (number) - Minimum success rate 0-1 (default: 0.6 = 60%)
- `minDaysOld` (number) - Minimum age in days (default: 7)
- `minBusinessesPerType` (number) - Minimum unique businesses (default: 3)
- `enabledBusinessTypes` (array) - Manual list of enabled types (empty = auto-enable)

## How It Works

### 1. Master Switch

When `enabled: false`, the playbook is completely disabled regardless of data quality.

### 2. Auto-Enable Mode

When `enabled: true` and `enabledBusinessTypes: []`:
- System automatically checks data quality for each business type
- Only enables playbook for business types that meet all thresholds

### 3. Manual Enable Mode

When `enabled: true` and `enabledBusinessTypes: ["car wash", "dentist"]`:
- Only enables playbook for listed business types
- Ignores data quality checks (use with caution)

## Thresholds

A business type must meet ALL of these to be enabled:

1. **Minimum Strategies:** 5+ successful strategies
2. **Success Rate:** 60%+ of strategies show improvement
3. **Unique Businesses:** 3+ different businesses (not just 1 user)
4. **Age:** Strategies must be 7+ days old (validated)

## API Endpoints

### Get Configuration & Stats

```bash
GET /api/playbook/config?stats=true
```

Returns:
- Current configuration
- Statistics for all business types
- Which types are ready to enable

### Update Configuration

```bash
POST /api/playbook/config
{
  "secret": "YOUR_ADMIN_SECRET",
  "enabled": true,
  "minStrategiesPerBusinessType": 5,
  "minSuccessRate": 0.6,
  "minDaysOld": 7,
  "minBusinessesPerType": 3,
  "enabledBusinessTypes": []
}
```

### Get Statistics Only

```bash
GET /api/playbook/stats
```

Returns detailed statistics for all business types.

## Admin Script

Use the admin script to update configuration:

```bash
node scripts/managePlaybookConfig.js
```

Edit the script to change configuration values, then run it.

## Checking Data Quality

### Step 1: Check Stats

```bash
GET /api/playbook/stats
```

Look for business types where `ready: true`:

```json
{
  "stats": [
    {
      "businessType": "car wash",
      "totalStrategies": 8,
      "successRate": 0.75,
      "uniqueBusinesses": 4,
      "oldEnoughStrategies": 8,
      "ready": true,
      "meetsThresholds": {
        "minStrategies": true,
        "minSuccessRate": true,
        "minBusinesses": true,
        "minDaysOld": true
      }
    }
  ]
}
```

### Step 2: Enable Master Switch

If you see business types with `ready: true`, enable the master switch:

```bash
POST /api/playbook/config
{
  "secret": "YOUR_ADMIN_SECRET",
  "enabled": true
}
```

### Step 3: Monitor

The system will automatically enable playbook for business types that meet thresholds.

## Example Workflow

### Week 1-4: Collect Data
```json
{
  "enabled": false  // Playbook disabled, collecting data
}
```

### Week 5: Check Stats
```bash
GET /api/playbook/stats
```

Result:
- Car wash: 8 strategies, 75% success, 4 businesses ✅ READY
- Dentist: 3 strategies, 67% success, 2 businesses ❌ NOT READY

### Week 5: Enable Master Switch
```bash
POST /api/playbook/config
{
  "secret": "YOUR_ADMIN_SECRET",
  "enabled": true,
  "enabledBusinessTypes": []  // Auto-enable based on data quality
}
```

Result:
- Playbook enabled for "car wash" ✅
- Playbook stays disabled for "dentist" ❌

### Week 8: Check Again
```bash
GET /api/playbook/stats
```

Result:
- Car wash: 12 strategies ✅ (still enabled)
- Dentist: 7 strategies, 71% success, 3 businesses ✅ NOW READY

Result:
- Playbook automatically enabled for "dentist" ✅

## Integration

The playbook helpers automatically check the feature flag:

```javascript
// In app/lib/playbookHelpers.js
const strategies = await getPlaybookStrategies({
  businessType: "car wash",
  strategyType: "meta_title_optimization"
});

// Returns empty array if playbook not enabled for this business type
// Returns strategies if enabled and data quality is good
```

## Safety Features

1. **Fail-Safe:** If config doesn't exist, playbook defaults to disabled
2. **Error Handling:** Errors default to disabled (safe)
3. **Data Quality Checks:** Multiple thresholds prevent bad data
4. **Gradual Rollout:** Enable one business type at a time

## Monitoring

Check stats regularly to see:
- Which business types are ready
- How many strategies you have
- Success rates
- Data quality trends

## Environment Variables

Set `ADMIN_SECRET` in your environment for API access:

```bash
ADMIN_SECRET=your_secret_here
```

## Notes

- **Time doesn't matter** - Only data quality matters
- **Gradual rollout** - Start with 1 business type, expand as data improves
- **Monitor closely** - Check stats weekly to see progress
- **Safe defaults** - System defaults to disabled if anything goes wrong

