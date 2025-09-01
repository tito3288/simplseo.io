/**
 * Reusable page scraping utility for SEO analysis
 * Used by both Intent Mismatch and Content Audit features
 */

export const scrapePageContent = async (pageUrl) => {
  try {
    console.log(`🔍 Scraping content for: ${pageUrl}`);
    
    const scrapeResponse = await fetch("/api/scrape-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pageUrl }),
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Failed to scrape ${pageUrl}: ${scrapeResponse.status}`);
    }

    const scrapeData = await scrapeResponse.json();
    
    console.log(`✅ Scraped content for ${pageUrl}:`, {
      titleLength: scrapeData.data.title?.length || 0,
      contentLength: scrapeData.data.textContent?.length || 0,
      hasHeadings: scrapeData.data.headings?.length > 0
    });

    return {
      success: true,
      data: scrapeData.data,
      pageUrl
    };
  } catch (error) {
    console.error(`❌ Error scraping ${pageUrl}:`, error);
    return {
      success: false,
      error: error.message,
      pageUrl
    };
  }
};

/**
 * Get cached page content from Firestore
 */
export const getCachedPageContent = async (userId, pageUrl) => {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    const cacheKey = `${userId}_${encodeURIComponent(pageUrl)}`;
    const cachedDoc = await getDoc(doc(db, "pageContentCache", cacheKey));
    
    if (cachedDoc.exists()) {
      console.log(`✅ Using cached page content for: ${pageUrl}`);
      return {
        success: true,
        data: cachedDoc.data(),
        cached: true
      };
    }
    
    return { success: false, cached: false };
  } catch (error) {
    console.error(`❌ Error getting cached content for ${pageUrl}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Cache page content in Firestore
 */
export const cachePageContent = async (userId, pageUrl, contentData) => {
  try {
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseConfig");
    
    const cacheKey = `${userId}_${encodeURIComponent(pageUrl)}`;
    
    await setDoc(doc(db, "pageContentCache", cacheKey), {
      ...contentData,
      userId,
      pageUrl,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });
    
    console.log(`✅ Cached page content for: ${pageUrl}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error caching content for ${pageUrl}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get or scrape page content with caching
 */
export const getPageContent = async (userId, pageUrl, forceRefresh = false) => {
  // Try to get cached content first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedPageContent(userId, pageUrl);
    if (cached.success) {
      return cached;
    }
  }
  
  // Scrape fresh content
  const scraped = await scrapePageContent(pageUrl);
  if (scraped.success) {
    // Cache the fresh content
    await cachePageContent(userId, pageUrl, scraped.data);
  }
  
  return scraped;
};
