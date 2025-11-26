import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    let deleteCount = 0;

    // 1. Delete onboarding data
    try {
      const onboardingRef = db.collection("onboarding").doc(userId);
      const onboardingSnap = await onboardingRef.get();
      if (onboardingSnap.exists) {
        await onboardingRef.delete();
        deleteCount++;
        console.log("✅ Deleted onboarding data");
      }
    } catch (error) {
      console.log("⚠️ Error deleting onboarding:", error.message);
    }

    // 2. Delete user profile data
    try {
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.delete();
        deleteCount++;
        console.log("✅ Deleted user profile data");
      }
    } catch (error) {
      console.log("⚠️ Error deleting user profile:", error.message);
    }

    // 3. Delete implementedSeoTips
    try {
      const implementedSeoTipsSnapshot = await db
        .collection("implementedSeoTips")
        .where("userId", "==", userId)
        .get();
      
      const batch1 = db.batch();
      implementedSeoTipsSnapshot.docs.forEach((doc) => {
        batch1.delete(doc.ref);
        deleteCount++;
      });
      if (implementedSeoTipsSnapshot.docs.length > 0) {
        await batch1.commit();
        console.log(`✅ Deleted ${implementedSeoTipsSnapshot.docs.length} implementedSeoTips documents`);
      }
    } catch (error) {
      console.log("⚠️ Error deleting implementedSeoTips:", error.message);
    }

    // 4. Delete intentMismatches (both structures)
    try {
      // New structure: intentMismatches/{userId}/analyses
      try {
        const newAnalysesSnapshot = await db
          .collection("intentMismatches")
          .doc(userId)
          .collection("analyses")
          .get();
        
        const batch2a = db.batch();
        newAnalysesSnapshot.docs.forEach((doc) => {
          batch2a.delete(doc.ref);
          deleteCount++;
        });
        if (newAnalysesSnapshot.docs.length > 0) {
          await batch2a.commit();
          console.log(`✅ Deleted ${newAnalysesSnapshot.docs.length} intentMismatches from new structure`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting from new intentMismatches structure:", error.message);
      }

      // Old structure: intentMismatches (flat)
      try {
        const intentMismatchesSnapshot = await db
          .collection("intentMismatches")
          .where("userId", "==", userId)
          .get();
        
        const batch2b = db.batch();
        intentMismatchesSnapshot.docs.forEach((doc) => {
          batch2b.delete(doc.ref);
          deleteCount++;
        });
        if (intentMismatchesSnapshot.docs.length > 0) {
          await batch2b.commit();
          console.log(`✅ Deleted ${intentMismatchesSnapshot.docs.length} intentMismatches from old structure`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting from old intentMismatches structure:", error.message);
      }
    } catch (error) {
      console.log("⚠️ Error deleting intentMismatches:", error.message);
    }

    // 5. Delete internalLinkSuggestions
    try {
      const internalLinkSnapshot = await db
        .collection("internalLinkSuggestions")
        .where("userId", "==", userId)
        .get();
      
      const batch3 = db.batch();
      internalLinkSnapshot.docs.forEach((doc) => {
        batch3.delete(doc.ref);
        deleteCount++;
      });
      if (internalLinkSnapshot.docs.length > 0) {
        await batch3.commit();
        console.log(`✅ Deleted ${internalLinkSnapshot.docs.length} internalLinkSuggestions documents`);
      }
    } catch (error) {
      console.log("⚠️ Error deleting internalLinkSuggestions:", error.message);
    }

    // 6. Delete contentAuditResults
    try {
      const contentAuditSnapshot = await db
        .collection("contentAuditResults")
        .where("userId", "==", userId)
        .get();
      
      const batch4 = db.batch();
      contentAuditSnapshot.docs.forEach((doc) => {
        batch4.delete(doc.ref);
        deleteCount++;
      });
      if (contentAuditSnapshot.docs.length > 0) {
        await batch4.commit();
        console.log(`✅ Deleted ${contentAuditSnapshot.docs.length} contentAuditResults documents`);
      }
    } catch (error) {
      console.log("⚠️ Error deleting contentAuditResults:", error.message);
    }

    // 7. Delete aiSuggestions
    try {
      const aiSuggestionsSnapshot = await db
        .collection("aiSuggestions")
        .where("userId", "==", userId)
        .get();
      
      const batch5 = db.batch();
      aiSuggestionsSnapshot.docs.forEach((doc) => {
        batch5.delete(doc.ref);
        deleteCount++;
      });
      if (aiSuggestionsSnapshot.docs.length > 0) {
        await batch5.commit();
        console.log(`✅ Deleted ${aiSuggestionsSnapshot.docs.length} aiSuggestions documents`);
      }
    } catch (error) {
      console.log("⚠️ Error deleting aiSuggestions:", error.message);
    }

    // 8. Delete pageContentCache (both structures)
    try {
      // New structure: pageContentCache/{userId}/pages
      try {
        const newPagesSnapshot = await db
          .collection("pageContentCache")
          .doc(userId)
          .collection("pages")
          .get();
        
        if (newPagesSnapshot.docs.length > 0) {
          const batch6a = db.batch();
          newPagesSnapshot.docs.forEach((doc) => {
            batch6a.delete(doc.ref);
            deleteCount++;
          });
          await batch6a.commit();
          console.log(`✅ Deleted ${newPagesSnapshot.docs.length} pageContentCache from new structure`);
        }
      } catch (error) {
        console.error("❌ Error deleting from new pageContentCache structure:", error.message);
      }

      // Old structure: pageContentCache (flat)
      try {
        const pageCacheSnapshot = await db
          .collection("pageContentCache")
          .where("userId", "==", userId)
          .get();
        
        if (pageCacheSnapshot.docs.length > 0) {
          const batch6b = db.batch();
          pageCacheSnapshot.docs.forEach((doc) => {
            batch6b.delete(doc.ref);
            deleteCount++;
          });
          await batch6b.commit();
          console.log(`✅ Deleted ${pageCacheSnapshot.docs.length} pageContentCache from old structure`);
        }
      } catch (error) {
        console.error("❌ Error deleting from old pageContentCache structure:", error.message);
      }
    } catch (error) {
      console.log("⚠️ Error deleting pageContentCache:", error.message);
    }

    // 9. Delete siteCrawls
    try {
      const siteCrawlsRef = db.collection("siteCrawls").doc(userId);
      const siteCrawlsSnap = await siteCrawlsRef.get();
      if (siteCrawlsSnap.exists) {
        await siteCrawlsRef.delete();
        deleteCount++;
        console.log("✅ Deleted siteCrawls data");
      }
    } catch (error) {
      console.error("❌ Error deleting siteCrawls:", error.message);
    }

    // 10. Delete focusKeywords
    try {
      const focusKeywordsRef = db.collection("focusKeywords").doc(userId);
      const focusKeywordsSnap = await focusKeywordsRef.get();
      if (focusKeywordsSnap.exists) {
        await focusKeywordsRef.delete();
        deleteCount++;
        console.log("✅ Deleted focusKeywords data");
      }
    } catch (error) {
      console.error("❌ Error deleting focusKeywords:", error.message);
    }

    // 11. Delete conversations
    try {
      const conversationsSnapshot = await db
        .collection("conversations")
        .where("userId", "==", userId)
        .get();
      
      const batch7 = db.batch();
      conversationsSnapshot.docs.forEach((doc) => {
        batch7.delete(doc.ref);
        deleteCount++;
      });
      if (conversationsSnapshot.docs.length > 0) {
        await batch7.commit();
        console.log(`✅ Deleted ${conversationsSnapshot.docs.length} conversations`);
      }
    } catch (error) {
      console.log("⚠️ Error deleting conversations:", error.message);
    }

    // 12. Delete seoMetaTitles (both structures)
    try {
      // New structure: seoMetaTitles/{userId}/titles
      try {
        const newTitlesSnapshot = await db
          .collection("seoMetaTitles")
          .doc(userId)
          .collection("titles")
          .get();
        
        if (newTitlesSnapshot.docs.length > 0) {
          const batch8a = db.batch();
          newTitlesSnapshot.docs.forEach((doc) => {
            batch8a.delete(doc.ref);
            deleteCount++;
          });
          await batch8a.commit();
          console.log(`✅ Deleted ${newTitlesSnapshot.docs.length} seoMetaTitles from new structure`);
        }
      } catch (error) {
        console.error("❌ Error deleting from new seoMetaTitles structure:", error.message);
      }

      // Old structure: seoMetaTitles (flat)
      try {
        const seoTitlesSnapshot = await db
          .collection("seoMetaTitles")
          .where("userId", "==", userId)
          .get();
        
        if (seoTitlesSnapshot.docs.length > 0) {
          const batch8b = db.batch();
          seoTitlesSnapshot.docs.forEach((doc) => {
            batch8b.delete(doc.ref);
            deleteCount++;
          });
          await batch8b.commit();
          console.log(`✅ Deleted ${seoTitlesSnapshot.docs.length} seoMetaTitles from old structure`);
        }
      } catch (error) {
        console.error("❌ Error deleting from old seoMetaTitles structure:", error.message);
      }
    } catch (error) {
      console.log("⚠️ Error deleting seoMetaTitles:", error.message);
    }

    // 13. Delete seoMetaDescriptions (both structures)
    try {
      // New structure: seoMetaDescriptions/{userId}/descriptions
      try {
        const newDescriptionsSnapshot = await db
          .collection("seoMetaDescriptions")
          .doc(userId)
          .collection("descriptions")
          .get();
        
        if (newDescriptionsSnapshot.docs.length > 0) {
          const batch9a = db.batch();
          newDescriptionsSnapshot.docs.forEach((doc) => {
            batch9a.delete(doc.ref);
            deleteCount++;
          });
          await batch9a.commit();
          console.log(`✅ Deleted ${newDescriptionsSnapshot.docs.length} seoMetaDescriptions from new structure`);
        }
      } catch (error) {
        console.error("❌ Error deleting from new seoMetaDescriptions structure:", error.message);
      }

      // Old structure: seoMetaDescriptions (flat)
      try {
        const seoDescriptionsSnapshot = await db
          .collection("seoMetaDescriptions")
          .where("userId", "==", userId)
          .get();
        
        if (seoDescriptionsSnapshot.docs.length > 0) {
          const batch9b = db.batch();
          seoDescriptionsSnapshot.docs.forEach((doc) => {
            batch9b.delete(doc.ref);
            deleteCount++;
          });
          await batch9b.commit();
          console.log(`✅ Deleted ${seoDescriptionsSnapshot.docs.length} seoMetaDescriptions from old structure`);
        }
      } catch (error) {
        console.error("❌ Error deleting from old seoMetaDescriptions structure:", error.message);
      }
    } catch (error) {
      console.log("⚠️ Error deleting seoMetaDescriptions:", error.message);
    }

    // 14. Delete genericKeywordsCache
    try {
      const genericKeywordsSnapshot = await db
        .collection("genericKeywordsCache")
        .where("userId", "==", userId)
        .get();
      
      if (genericKeywordsSnapshot.docs.length > 0) {
        const batch10 = db.batch();
        genericKeywordsSnapshot.docs.forEach((doc) => {
          batch10.delete(doc.ref);
          deleteCount++;
        });
        await batch10.commit();
        console.log(`✅ Deleted ${genericKeywordsSnapshot.docs.length} genericKeywordsCache documents`);
      }
    } catch (error) {
      console.error("❌ Error deleting genericKeywordsCache:", error.message);
    }

    // 15. Delete contentKeywordEdits
    try {
      const contentKeywordEditsRef = db.collection("contentKeywordEdits").doc(userId);
      const contentKeywordEditsSnap = await contentKeywordEditsRef.get();
      if (contentKeywordEditsSnap.exists) {
        await contentKeywordEditsRef.delete();
        deleteCount++;
        console.log("✅ Deleted contentKeywordEdits data");
      }
    } catch (error) {
      console.error("❌ Error deleting contentKeywordEdits:", error.message);
    }

    console.log(`✅ Successfully deleted ${deleteCount} documents for user ${userId}`);

    return NextResponse.json({
      success: true,
      deletedCount: deleteCount,
      message: `Successfully deleted ${deleteCount} documents`,
    });
  } catch (error) {
    console.error("Error deleting user data:", error);
    return NextResponse.json(
      { error: "Failed to delete user data", details: error.message },
      { status: 500 }
    );
  }
}

