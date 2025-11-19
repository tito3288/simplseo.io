/**
 * Quick script to verify the migration worked correctly
 * Shows how many pages are in each user's subcollection
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

if (!admin.apps.length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function verifyMigration() {
  console.log("🔍 Verifying migration...\n");

  try {
    // Get all user documents in pageContentCache
    const usersSnapshot = await db.collection("pageContentCache").get();
    
    console.log(`Found ${usersSnapshot.docs.length} user documents in pageContentCache\n`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Check pages subcollection
      const pagesSnapshot = await db
        .collection("pageContentCache")
        .doc(userId)
        .collection("pages")
        .get();

      console.log(`📁 User: ${userId.substring(0, 20)}...`);
      console.log(`   Pages in subcollection: ${pagesSnapshot.docs.length}`);
      
      if (pagesSnapshot.docs.length > 0) {
        console.log(`   Sample pages:`);
        pagesSnapshot.docs.slice(0, 3).forEach((pageDoc) => {
          const pageData = pageDoc.data();
          console.log(`     - ${pageData.pageUrl || pageDoc.id}`);
        });
        if (pagesSnapshot.docs.length > 3) {
          console.log(`     ... and ${pagesSnapshot.docs.length - 3} more`);
        }
      }
      console.log("");
    }

    console.log("✅ Verification complete!");
  } catch (error) {
    console.error("❌ Error verifying migration:", error);
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

