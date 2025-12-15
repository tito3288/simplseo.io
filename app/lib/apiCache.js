/**
 * API Response Caching Utility
 * Caches API responses in localStorage with expiration times
 */

const CACHE_PREFIX = 'api_cache_';
const CACHE_VERSION = 'v1';

// Cache durations in milliseconds
export const CACHE_DURATIONS = {
  FILTER_BRANDED_KEYWORDS: 24 * 60 * 60 * 1000, // 24 hours
  GENERIC_KEYWORDS_ANALYZE: 24 * 60 * 60 * 1000, // 24 hours
  META_TITLE: 6 * 60 * 60 * 1000, // 6 hours
  META_DESCRIPTION: 6 * 60 * 60 * 1000, // 6 hours
};

/**
 * Generate a simple hash from a string (for keyword signatures and cache keys)
 */
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a signature from keywords array (for cache invalidation)
 */
export function generateKeywordSignature(keywords = []) {
  if (!keywords || keywords.length === 0) return 'empty';
  
  // Create a signature from keyword text and page URLs
  const signature = keywords
    .slice(0, 100) // Limit to first 100 keywords for performance
    .map(kw => `${kw.keyword || ''}_${kw.page || ''}`)
    .sort()
    .join('|');
  
  return simpleHash(signature);
}

/**
 * Generate a cache key from API endpoint and parameters
 */
function generateCacheKey(endpoint, params = {}) {
  const paramString = JSON.stringify(params);
  const key = `${endpoint}_${paramString}`;
  // Use simpleHash for server/client compatibility
  const hash = simpleHash(key);
  return `${CACHE_PREFIX}${CACHE_VERSION}_${hash}`;
}

/**
 * Get cached data if it exists and is not expired
 */
export function getCachedData(endpoint, params = {}, cacheDuration) {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = generateCacheKey(endpoint, params);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    const age = now - timestamp;

    // Check if cache is expired
    if (age > cacheDuration) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return {
      data,
      age,
      ageHours: Math.round(age / (60 * 60 * 1000) * 10) / 10,
      fromCache: true
    };
  } catch (error) {
    console.warn('Error reading cache:', error);
    return null;
  }
}

/**
 * Save data to cache
 */
export function setCachedData(endpoint, params = {}, data) {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = generateCacheKey(endpoint, params);
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error saving cache:', error);
    // If storage is full, try to clear old caches
    if (error.name === 'QuotaExceededError') {
      clearExpiredCaches();
    }
  }
}

/**
 * Clear cache for a specific endpoint and params
 */
export function clearCache(endpoint, params = {}) {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = generateCacheKey(endpoint, params);
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Error clearing cache:', error);
  }
}

/**
 * Clear all expired caches
 */
export function clearExpiredCaches() {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    let cleared = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            // Remove if older than 7 days (safety cleanup)
            if (now - timestamp > 7 * 24 * 60 * 60 * 1000) {
              localStorage.removeItem(key);
              cleared++;
            }
          }
        } catch (e) {
          // Invalid cache entry, remove it
          localStorage.removeItem(key);
          cleared++;
        }
      }
    });

    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} expired cache entries`);
    }
  } catch (error) {
    console.warn('Error clearing expired caches:', error);
  }
}

/**
 * Clear all meta title and description caches
 * Used when editing suggestions to ensure fresh data is fetched
 */
export function clearAllMetaCaches() {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage);
    let cleared = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        // Clear all API caches to ensure fresh meta data is fetched
        localStorage.removeItem(key);
        cleared++;
      }
    });

    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} cache entries after edit`);
    }
  } catch (error) {
    console.warn('Error clearing meta caches:', error);
  }
}

/**
 * Wrapper function to fetch with caching
 */
export async function fetchWithCache(
  endpoint,
  options = {},
  cacheDuration,
  params = {}
) {
  // Try to get from cache first
  const cached = getCachedData(endpoint, params, cacheDuration);
  if (cached) {
    console.log(`✅ Cache hit for ${endpoint} (${cached.ageHours}h old)`);
    return {
      ...cached.data,
      fromCache: true,
      cacheAge: cached.ageHours
    };
  }

  // Fetch from API
  console.log(`🔄 Cache miss for ${endpoint}, fetching fresh data...`);
  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  // Save to cache
  setCachedData(endpoint, params, data);

  return {
    ...data,
    fromCache: false
  };
}

