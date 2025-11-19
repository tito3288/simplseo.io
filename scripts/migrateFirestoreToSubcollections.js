/**
 * Migration script to move existing Firestore data to subcollection structure
 * 
 * This script migrates:
 * - pageContentCache: {userId}_{pageUrl} → pageContentCache/{userId}/pages/{pageUrl}
 * - intentMismatches: {cacheKey} → intentMismatches/{userId}/analyses/{cacheKey}
 * - seoMetaTitles: {cacheKey} → seoMetaTitles/{userId}/titles/{cacheKey}
 * - seoMetaDescriptions: {cacheKey} → seoMetaDescriptions/{userId}/descriptions/{cacheKey}
 * 
 * Usage: node scripts/migrateFirestoreToSubcollections.js
 * 
 * Note: This script is idempotent - safe to run multiple times
 */

// Load environment variables from .env.local if dotenv is available
try {
  require("dotenv").config({ path: ".env.local" });
} catch (error) {
  // dotenv not available, continue without it
}

const admin = require("firebase-admin");

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Try to use environment variables first (same as app)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
      console.log("✅ Using environment variables for Firebase Admin");
    } else {
      // Try to use service account file if it exists
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../firebase-service-account.json";
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Using service account file for Firebase Admin");
    }
  } catch (error) {
    // Fallback to default credentials (if running in Firebase environment)
    console.log("⚠️  No credentials found, trying default credentials...");
    try {
      admin.initializeApp();
    } catch (defaultError) {
      console.error("❌ Failed to initialize Firebase Admin:");
      console.error("   Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables");
      console.error("   Or provide a service account file at ../firebase-service-account.json");
      process.exit(1);
    }
  }
}

const db = admin.firestore();

/**
 * Migrate pageContentCache from flat to subcollection structure
 */
async function migratePageContentCache() {
  console.log("\n🔄 Migrating pageContentCache...");
  
  try {
    const snapshot = await db.collection("pageContentCache").get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Extract userId from document ID (format: userId_pageUrl)
      // Or use userId field if it exists
      let userId = data.userId;
      let pageUrl = data.pageUrl;
      
      if (!userId && docId.includes("_")) {
        // Try to extract userId from document ID
        const parts = docId.split("_");
        userId = parts[0];
        // Reconstruct pageUrl from remaining parts
        const urlParts = parts.slice(1).join("_");
        try {
          pageUrl = decodeURIComponent(urlParts);
        } catch {
          pageUrl = urlParts;
        }
      }

      if (!userId || !pageUrl) {
        console.log(`⏭️  Skipping ${docId} - missing userId or pageUrl`);
        skipped++;
        continue;
      }

      // Check if already migrated
      const newDocRef = db
        .collection("pageContentCache")
        .doc(userId)
        .collection("pages")
        .doc(encodeURIComponent(pageUrl));
      
      const newDoc = await newDocRef.get();
      if (newDoc.exists) {
        console.log(`✅ Already migrated: ${pageUrl}`);
        skipped++;
        continue;
      }

      // Migrate to new structure
      try {
        await newDocRef.set({
          ...data,
          userId,
          pageUrl,
          migratedAt: new Date().toISOString(),
          migratedFrom: docId
        });
        migrated++;
        console.log(`✅ Migrated: ${pageUrl} (user: ${userId.substring(0, 8)}...)`);
      } catch (error) {
        console.error(`❌ Failed to migrate ${docId}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ pageContentCache migration complete:`);
    console.log(`   - Migrated: ${migrated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Error migrating pageContentCache:", error);
  }
}

/**
 * Migrate intentMismatches from flat to subcollection structure
 */
async function migrateIntentMismatches() {
  console.log("\n🔄 Migrating intentMismatches...");
  
  try {
    const snapshot = await db.collection("intentMismatches").get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Extract userId from data or document ID
      let userId = data.userId;
      
      if (!userId && docId.includes("_")) {
        // Try to extract userId from document ID (format: userId_keyword_pageUrl)
        const parts = docId.split("_");
        userId = parts[0];
      }

      if (!userId) {
        console.log(`⏭️  Skipping ${docId} - missing userId`);
        skipped++;
        continue;
      }

      // Check if already migrated
      const newDocRef = db
        .collection("intentMismatches")
        .doc(userId)
        .collection("analyses")
        .doc(docId);
      
      const newDoc = await newDocRef.get();
      if (newDoc.exists) {
        console.log(`✅ Already migrated: ${docId}`);
        skipped++;
        continue;
      }

      // Migrate to new structure
      try {
        await newDocRef.set({
          ...data,
          userId,
          migratedAt: new Date().toISOString(),
          migratedFrom: docId
        });
        migrated++;
        console.log(`✅ Migrated: ${docId.substring(0, 50)}... (user: ${userId.substring(0, 8)}...)`);
      } catch (error) {
        console.error(`❌ Failed to migrate ${docId}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ intentMismatches migration complete:`);
    console.log(`   - Migrated: ${migrated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Error migrating intentMismatches:", error);
  }
}

/**
 * Migrate seoMetaTitles from flat to subcollection structure
 */
async function migrateSeoMetaTitles() {
  console.log("\n🔄 Migrating seoMetaTitles...");
  
  try {
    const snapshot = await db.collection("seoMetaTitles").get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Extract userId from data
      const userId = data.userId;
      
      if (!userId) {
        console.log(`⏭️  Skipping ${docId} - missing userId`);
        skipped++;
        continue;
      }

      // Check if already migrated
      const newDocRef = db
        .collection("seoMetaTitles")
        .doc(userId)
        .collection("titles")
        .doc(docId);
      
      const newDoc = await newDocRef.get();
      if (newDoc.exists) {
        console.log(`✅ Already migrated: ${docId}`);
        skipped++;
        continue;
      }

      // Migrate to new structure
      try {
        await newDocRef.set({
          ...data,
          migratedAt: new Date().toISOString(),
          migratedFrom: docId
        });
        migrated++;
        console.log(`✅ Migrated: ${docId.substring(0, 50)}... (user: ${userId.substring(0, 8)}...)`);
      } catch (error) {
        console.error(`❌ Failed to migrate ${docId}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ seoMetaTitles migration complete:`);
    console.log(`   - Migrated: ${migrated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Error migrating seoMetaTitles:", error);
  }
}

/**
 * Migrate seoMetaDescriptions from flat to subcollection structure
 */
async function migrateSeoMetaDescriptions() {
  console.log("\n🔄 Migrating seoMetaDescriptions...");
  
  try {
    const snapshot = await db.collection("seoMetaDescriptions").get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Extract userId from data
      const userId = data.userId;
      
      if (!userId) {
        console.log(`⏭️  Skipping ${docId} - missing userId`);
        skipped++;
        continue;
      }

      // Check if already migrated
      const newDocRef = db
        .collection("seoMetaDescriptions")
        .doc(userId)
        .collection("descriptions")
        .doc(docId);
      
      const newDoc = await newDocRef.get();
      if (newDoc.exists) {
        console.log(`✅ Already migrated: ${docId}`);
        skipped++;
        continue;
      }

      // Migrate to new structure
      try {
        await newDocRef.set({
          ...data,
          migratedAt: new Date().toISOString(),
          migratedFrom: docId
        });
        migrated++;
        console.log(`✅ Migrated: ${docId.substring(0, 50)}... (user: ${userId.substring(0, 8)}...)`);
      } catch (error) {
        console.error(`❌ Failed to migrate ${docId}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ seoMetaDescriptions migration complete:`);
    console.log(`   - Migrated: ${migrated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Error migrating seoMetaDescriptions:", error);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log("🚀 Starting Firestore migration to subcollection structure...\n");
  console.log("This will migrate existing data to the new structure.");
  console.log("Old data will remain intact for backward compatibility.\n");

  await migratePageContentCache();
  await migrateIntentMismatches();
  await migrateSeoMetaTitles();
  await migrateSeoMetaDescriptions();

  console.log("\n✅ Migration complete!");
  console.log("\nNote: Old data structures are preserved for backward compatibility.");
  console.log("You can delete old data later once you're confident the migration is complete.");
}

// Run migration
runMigration()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });

