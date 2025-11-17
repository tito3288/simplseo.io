/**
 * Admin script to manage playbook configuration
 * 
 * Usage:
 *   node scripts/managePlaybookConfig.js
 * 
 * Or set environment variables:
 *   ADMIN_SECRET=your_secret node scripts/managePlaybookConfig.js
 */

import { db } from "../app/lib/firebaseAdmin.js";

async function updatePlaybookConfig() {
  try {
    const config = {
      enabled: false, // ✅ Set to true when ready to enable
      minStrategiesPerBusinessType: 5,
      minSuccessRate: 0.6, // 60%
      minDaysOld: 7,
      minBusinessesPerType: 3,
      enabledBusinessTypes: [
        // Add specific business types here to enable manually
        // Example: "car wash", "dentist"
        // Leave empty to auto-enable based on data quality
      ],
      lastUpdated: new Date().toISOString(),
    };

    await db.collection("appConfig").doc("playbook_config").set(config, {
      merge: true,
    });

    console.log("✅ Playbook config updated:");
    console.log(JSON.stringify(config, null, 2));
    console.log("\n📊 Current status:");
    console.log(`- Master switch: ${config.enabled ? "✅ ENABLED" : "❌ DISABLED"}`);
    console.log(`- Auto-enable: ${config.enabledBusinessTypes.length === 0 ? "✅ YES" : "❌ NO (manual list)"}`);
    console.log(`- Thresholds:`);
    console.log(`  - Min strategies: ${config.minStrategiesPerBusinessType}`);
    console.log(`  - Min success rate: ${config.minSuccessRate * 100}%`);
    console.log(`  - Min days old: ${config.minDaysOld}`);
    console.log(`  - Min businesses: ${config.minBusinessesPerType}`);
    
    if (config.enabledBusinessTypes.length > 0) {
      console.log(`- Enabled types: ${config.enabledBusinessTypes.join(", ")}`);
    }
  } catch (error) {
    console.error("❌ Error updating playbook config:", error);
    process.exit(1);
  }
}

updatePlaybookConfig();

