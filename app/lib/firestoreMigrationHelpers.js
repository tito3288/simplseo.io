"use server";

/**
 * Backward-compatible Firestore helpers for migrating to subcollection structure
 * These functions support both old (flat) and new (subcollection) structures
 */

/**
 * Get cached page content (checks new structure first, falls back to old)
 */
export async function getCachedPageContent(userId, pageUrl) {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    // Try NEW structure first: pageContentCache/{userId}/pages/{pageUrl}
    try {
      const newDocRef = doc(
        db,
        "pageContentCache",
        userId,
        "pages",
        encodeURIComponent(pageUrl)
      );
      const newDoc = await getDoc(newDocRef);
      
      if (newDoc.exists()) {
        console.log(`✅ Using cached page content (new structure) for: ${pageUrl}`);
        return {
          success: true,
          data: newDoc.data(),
          cached: true,
          structure: "new"
        };
      }
    } catch (error) {
      console.log("New structure not found, checking old structure...");
    }

    // Fallback to OLD structure: pageContentCache/{userId}_{pageUrl}
    try {
      const oldKey = `${userId}_${encodeURIComponent(pageUrl)}`;
      const oldDocRef = doc(db, "pageContentCache", oldKey);
      const oldDoc = await getDoc(oldDocRef);
      
      if (oldDoc.exists()) {
        const data = oldDoc.data();
        console.log(`✅ Using cached page content (old structure) for: ${pageUrl}`);
        
        // Auto-migrate: copy to new structure (async, non-blocking)
        migratePageContentToNewStructure(userId, pageUrl, data).catch(err => {
          console.error("Migration failed (non-critical):", err);
        });
        
        return {
          success: true,
          data: data,
          cached: true,
          structure: "old"
        };
      }
    } catch (error) {
      console.error(`❌ Error reading old structure:`, error);
    }
    
    return { success: false, cached: false };
  } catch (error) {
    console.error(`❌ Error getting cached content for ${pageUrl}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Cache page content (writes to BOTH old and new structures for backward compatibility)
 * Works with both client SDK (browser) and admin SDK (server)
 */
export async function cachePageContent(userId, pageUrl, contentData) {
  try {
    const cacheData = {
      ...contentData,
      userId,
      pageUrl,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    // Check if we're in a server context (API route) or client context
    const isServerSide = typeof window === 'undefined';
    
    if (isServerSide) {
      // Server-side: Use Admin SDK
      const { db } = await import("./firebaseAdmin");
      
      // Write to NEW structure: pageContentCache/{userId}/pages/{pageUrl}
      try {
        await db
          .collection("pageContentCache")
          .doc(userId)
          .collection("pages")
          .doc(encodeURIComponent(pageUrl))
          .set(cacheData);
        console.log(`✅ Cached page content (new structure, admin SDK) for: ${pageUrl}`);
      } catch (error) {
        console.error("Failed to write to new structure (admin SDK):", error);
      }

      // Also write to OLD structure: pageContentCache/{userId}_{pageUrl}
      try {
        const oldKey = `${userId}_${encodeURIComponent(pageUrl)}`;
        await db
          .collection("pageContentCache")
          .doc(oldKey)
          .set(cacheData, { merge: true });
        console.log(`✅ Cached page content (old structure, admin SDK) for: ${pageUrl}`);
      } catch (error) {
        console.error("Failed to write to old structure (admin SDK):", error);
      }
    } else {
      // Client-side: Use client SDK
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("./firebaseConfig");
      
      // Write to NEW structure: pageContentCache/{userId}/pages/{pageUrl}
      try {
        const newDocRef = doc(
          db,
          "pageContentCache",
          userId,
          "pages",
          encodeURIComponent(pageUrl)
        );
        await setDoc(newDocRef, cacheData);
        console.log(`✅ Cached page content (new structure) for: ${pageUrl}`);
      } catch (error) {
        console.error("Failed to write to new structure:", error);
      }

      // Also write to OLD structure for backward compatibility: pageContentCache/{userId}_{pageUrl}
      try {
        const oldKey = `${userId}_${encodeURIComponent(pageUrl)}`;
        const oldDocRef = doc(db, "pageContentCache", oldKey);
        await setDoc(oldDocRef, cacheData, { merge: true });
        console.log(`✅ Cached page content (old structure) for: ${pageUrl}`);
      } catch (error) {
        console.error("Failed to write to old structure:", error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`❌ Error caching content for ${pageUrl}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cached site pages (checks both structures)
 * Works with both client SDK (browser) and admin SDK (server)
 */
export async function getCachedSitePages(userId, options = {}) {
  const { source = "site-crawl", limit = 50, useAdminSDK = false } = options;
  
  try {
    const pages = [];

    if (useAdminSDK) {
      // Server-side: Use admin SDK
      const { db } = await import("./firebaseAdmin");
      
      // Try NEW structure first: pageContentCache/{userId}/pages
      try {
        const newSnapshot = await db
          .collection("pageContentCache")
          .doc(userId)
          .collection("pages")
          .where("source", "==", source)
          .limit(limit)
          .get();
        
        newSnapshot.docs.forEach(doc => {
          pages.push(doc.data());
        });
        
        if (pages.length > 0) {
          console.log(`✅ Found ${pages.length} pages in new structure (admin SDK)`);
          return pages;
        }
      } catch (error) {
        console.log("New structure query failed, trying old structure...");
      }

      // Fallback to OLD structure: pageContentCache with where clause
      try {
        const oldSnapshot = await db
          .collection("pageContentCache")
          .where("userId", "==", userId)
          .where("source", "==", source)
          .limit(limit)
          .get();
        
        oldSnapshot.docs.forEach(doc => {
          const data = doc.data();
          pages.push(data);
          
          // Auto-migrate (async, non-blocking)
          if (data.pageUrl) {
            migratePageContentToNewStructureAdmin(userId, data.pageUrl, data).catch(err => {
              console.error("Migration failed (non-critical):", err);
            });
          }
        });
        
        console.log(`✅ Found ${pages.length} pages in old structure (admin SDK)`);
      } catch (error) {
        console.error("Error querying old structure:", error);
      }
    } else {
      // Client-side: Use client SDK
      const { collection, query, where, limit: limitQuery, getDocs } = await import("firebase/firestore");
      const { db } = await import("./firebaseConfig");
      
      // Try NEW structure first: pageContentCache/{userId}/pages
      try {
        const newQuery = query(
          collection(db, "pageContentCache", userId, "pages"),
          where("source", "==", source),
          limitQuery(limit)
        );
        const newSnapshot = await getDocs(newQuery);
        
        newSnapshot.docs.forEach(doc => {
          pages.push(doc.data());
        });
        
        if (pages.length > 0) {
          console.log(`✅ Found ${pages.length} pages in new structure`);
          return pages;
        }
      } catch (error) {
        console.log("New structure query failed, trying old structure...");
      }

      // Fallback to OLD structure: pageContentCache with where clause
      try {
        const oldQuery = query(
          collection(db, "pageContentCache"),
          where("userId", "==", userId),
          where("source", "==", source),
          limitQuery(limit)
        );
        const oldSnapshot = await getDocs(oldQuery);
        
        oldSnapshot.docs.forEach(doc => {
          const data = doc.data();
          pages.push(data);
          
          // Auto-migrate (async, non-blocking)
          if (data.pageUrl) {
            migratePageContentToNewStructure(userId, data.pageUrl, data).catch(err => {
              console.error("Migration failed (non-critical):", err);
            });
          }
        });
        
        console.log(`✅ Found ${pages.length} pages in old structure`);
      } catch (error) {
        console.error("Error querying old structure:", error);
      }
    }

    return pages;
  } catch (error) {
    console.error("Failed to fetch cached site pages:", error);
    return [];
  }
}

/**
 * Migrate page content to new structure using admin SDK (server-side)
 */
async function migratePageContentToNewStructureAdmin(userId, pageUrl, data) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    await db
      .collection("pageContentCache")
      .doc(userId)
      .collection("pages")
      .doc(encodeURIComponent(pageUrl))
      .set({
        ...data,
        userId,
        pageUrl,
        migratedAt: new Date().toISOString()
      }, { merge: true });
    
    console.log(`✅ Migrated page content to new structure (admin SDK): ${pageUrl}`);
  } catch (error) {
    console.error(`❌ Migration failed for ${pageUrl}:`, error);
  }
}

/**
 * Migrate single page content to new structure (internal helper)
 */
async function migratePageContentToNewStructure(userId, pageUrl, data) {
  try {
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    const newDocRef = doc(
      db,
      "pageContentCache",
      userId,
      "pages",
      encodeURIComponent(pageUrl)
    );
    
    await setDoc(newDocRef, {
      ...data,
      userId,
      pageUrl,
      migratedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log(`✅ Migrated page content to new structure: ${pageUrl}`);
  } catch (error) {
    console.error(`❌ Migration failed for ${pageUrl}:`, error);
    throw error;
  }
}

/**
 * Get intent mismatch analysis (checks both structures)
 */
export async function getIntentMismatch(userId, keyword, pageUrl) {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    // Cache key format matches old structure: userId_keyword_pageUrl
    const cacheKey = `${userId}_${encodeURIComponent(keyword)}_${encodeURIComponent(pageUrl)}`;
    
    // Try NEW structure first: intentMismatches/{userId}/analyses/{cacheKey}
    try {
      const newDocRef = doc(
        db,
        "intentMismatches",
        userId,
        "analyses",
        cacheKey
      );
      const newDoc = await getDoc(newDocRef);
      
      if (newDoc.exists()) {
        return { success: true, data: newDoc.data(), structure: "new" };
      }
    } catch (error) {
      // Continue to old structure
    }

    // Fallback to OLD structure: intentMismatches/{cacheKey}
    try {
      const oldDocRef = doc(db, "intentMismatches", cacheKey);
      const oldDoc = await getDoc(oldDocRef);
      
      if (oldDoc.exists()) {
        const data = oldDoc.data();
        
        // Auto-migrate (async, non-blocking)
        migrateIntentMismatchToNewStructure(userId, cacheKey, data).catch(() => {});
        
        return { success: true, data: data, structure: "old" };
      }
    } catch (error) {
      console.error("Error reading old intent mismatch:", error);
    }
    
    return { success: false };
  } catch (error) {
    console.error("Error getting intent mismatch:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save intent mismatch (writes to both structures)
 */
export async function saveIntentMismatch(userId, keyword, pageUrl, analysisData) {
  try {
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    // Cache key format matches old structure: userId_keyword_pageUrl
    const cacheKey = `${userId}_${encodeURIComponent(keyword)}_${encodeURIComponent(pageUrl)}`;
    const data = {
      ...analysisData,
      userId,
      keyword,
      pageUrl,
      createdAt: analysisData.createdAt || new Date().toISOString()
    };

    // Write to NEW structure: intentMismatches/{userId}/analyses/{cacheKey}
    try {
      const newDocRef = doc(
        db,
        "intentMismatches",
        userId,
        "analyses",
        cacheKey
      );
      await setDoc(newDocRef, data);
      console.log(`✅ Saved intent mismatch to new structure: ${keyword}`);
    } catch (error) {
      console.error("Failed to write to new structure:", error);
    }

    // Also write to OLD structure: intentMismatches/{cacheKey}
    try {
      const oldDocRef = doc(db, "intentMismatches", cacheKey);
      await setDoc(oldDocRef, data, { merge: true });
      console.log(`✅ Saved intent mismatch to old structure: ${keyword}`);
    } catch (error) {
      console.error("Failed to write to old structure:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving intent mismatch:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Migrate intent mismatch to new structure (internal helper)
 */
async function migrateIntentMismatchToNewStructure(userId, cacheKey, data) {
  try {
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    const newDocRef = doc(
      db,
      "intentMismatches",
      userId,
      "analyses",
      cacheKey
    );
    
    await setDoc(newDocRef, {
      ...data,
      migratedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

/**
 * Get cached meta title (checks both structures)
 */
export async function getCachedMetaTitle(userId, cacheKey) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    // Try NEW structure first: seoMetaTitles/{userId}/titles/{cacheKey}
    try {
      const newDoc = await db
        .collection("seoMetaTitles")
        .doc(userId)
        .collection("titles")
        .doc(encodeURIComponent(cacheKey))
        .get();
      
      if (newDoc.exists) {
        return { success: true, data: newDoc.data(), structure: "new" };
      }
    } catch (error) {
      // Continue to old structure
    }

    // Fallback to OLD structure: seoMetaTitles/{cacheKey}
    try {
      const oldDoc = await db
        .collection("seoMetaTitles")
        .doc(encodeURIComponent(cacheKey))
        .get();
      
      if (oldDoc.exists) {
        const data = oldDoc.data();
        
        // Auto-migrate if it belongs to this user
        if (data.userId === userId || !data.userId) {
          migrateMetaTitleToNewStructure(userId, cacheKey, data).catch(() => {});
        }
        
        return { success: true, data: data, structure: "old" };
      }
    } catch (error) {
      console.error("Error reading old meta title:", error);
    }
    
    return { success: false };
  } catch (error) {
    console.error("Error getting cached meta title:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save meta title (writes to both structures)
 */
export async function saveMetaTitle(userId, cacheKey, titleData) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    const data = {
      ...titleData,
      userId,
      createdAt: new Date().toISOString()
    };

    // Write to NEW structure
    try {
      await db
        .collection("seoMetaTitles")
        .doc(userId)
        .collection("titles")
        .doc(encodeURIComponent(cacheKey))
        .set(data);
    } catch (error) {
      console.error("Failed to write to new structure:", error);
    }

    // Also write to OLD structure
    try {
      await db
        .collection("seoMetaTitles")
        .doc(encodeURIComponent(cacheKey))
        .set(data, { merge: true });
    } catch (error) {
      console.error("Failed to write to old structure:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving meta title:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Migrate meta title to new structure (internal helper)
 */
async function migrateMetaTitleToNewStructure(userId, cacheKey, data) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    await db
      .collection("seoMetaTitles")
      .doc(userId)
      .collection("titles")
      .doc(encodeURIComponent(cacheKey))
      .set({
        ...data,
        migratedAt: new Date().toISOString()
      }, { merge: true });
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

/**
 * Get cached meta description (checks both structures)
 */
export async function getCachedMetaDescription(userId, cacheKey) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    // Try NEW structure first: seoMetaDescriptions/{userId}/descriptions/{cacheKey}
    try {
      const newDoc = await db
        .collection("seoMetaDescriptions")
        .doc(userId)
        .collection("descriptions")
        .doc(encodeURIComponent(cacheKey))
        .get();
      
      if (newDoc.exists) {
        return { success: true, data: newDoc.data(), structure: "new" };
      }
    } catch (error) {
      // Continue to old structure
    }

    // Fallback to OLD structure: seoMetaDescriptions/{cacheKey}
    try {
      const oldDoc = await db
        .collection("seoMetaDescriptions")
        .doc(encodeURIComponent(cacheKey))
        .get();
      
      if (oldDoc.exists) {
        const data = oldDoc.data();
        
        // Auto-migrate if it belongs to this user
        if (data.userId === userId || !data.userId) {
          migrateMetaDescriptionToNewStructure(userId, cacheKey, data).catch(() => {});
        }
        
        return { success: true, data: data, structure: "old" };
      }
    } catch (error) {
      console.error("Error reading old meta description:", error);
    }
    
    return { success: false };
  } catch (error) {
    console.error("Error getting cached meta description:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save meta description (writes to both structures)
 */
export async function saveMetaDescription(userId, cacheKey, descriptionData) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    const data = {
      ...descriptionData,
      userId,
      createdAt: new Date().toISOString()
    };

    // Write to NEW structure
    try {
      await db
        .collection("seoMetaDescriptions")
        .doc(userId)
        .collection("descriptions")
        .doc(encodeURIComponent(cacheKey))
        .set(data);
    } catch (error) {
      console.error("Failed to write to new structure:", error);
    }

    // Also write to OLD structure
    try {
      await db
        .collection("seoMetaDescriptions")
        .doc(encodeURIComponent(cacheKey))
        .set(data, { merge: true });
    } catch (error) {
      console.error("Failed to write to old structure:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving meta description:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Migrate meta description to new structure (internal helper)
 */
async function migrateMetaDescriptionToNewStructure(userId, cacheKey, data) {
  try {
    const { db } = await import("./firebaseAdmin");
    
    await db
      .collection("seoMetaDescriptions")
      .doc(userId)
      .collection("descriptions")
      .doc(encodeURIComponent(cacheKey))
      .set({
        ...data,
        migratedAt: new Date().toISOString()
      }, { merge: true });
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

