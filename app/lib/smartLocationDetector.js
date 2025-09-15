// Smart Location Detector - Only alerts on genuinely problematic keywords
// Focuses on detecting location ambiguity and partial matches that could attract wrong traffic

/**
 * Check if a keyword is a brand name or general keyword that shouldn't have location context
 * @param {string} cleanKeyword - The keyword in lowercase
 * @returns {boolean} True if it's a brand name or general keyword
 */
function isBrandNameOrGeneralKeyword(cleanKeyword) {
  // Common brand name patterns
  const brandPatterns = [
    // Single word brands (2+ characters)
    /^[a-z]{2,}$/,
    // Two word combinations that are likely brand names
    /^[a-z]+\s+[a-z]+$/,
    // Common brand suffixes
    /(inc|llc|corp|company|co|group|enterprises|solutions|services|systems|technologies|tech)$/,
    // Common brand prefixes
    /^(the|a|an)\s+[a-z]+/,
  ];
  
  // Check if it matches brand patterns
  for (const pattern of brandPatterns) {
    if (pattern.test(cleanKeyword)) {
      return true;
    }
  }
  
  // Common general keywords that shouldn't have location context
  const generalKeywords = [
    'google', 'facebook', 'instagram', 'twitter', 'youtube', 'linkedin',
    'amazon', 'apple', 'microsoft', 'netflix', 'spotify', 'uber', 'lyft',
    'walmart', 'target', 'costco', 'home depot', 'lowes', 'best buy',
    'nike', 'adidas', 'starbucks', 'mcdonalds', 'subway', 'pizza hut',
    'dominos', 'kfc', 'burger king', 'wendys', 'taco bell',
    'drive and shine', 'jiffy lube', 'valvoline', 'firestone',
    'goodyear', 'bridgestone', 'michelin', 'continental'
  ];
  
  // Check against known general keywords
  if (generalKeywords.includes(cleanKeyword)) {
    return true;
  }
  
  // Check if it's a very short keyword (likely a brand)
  if (cleanKeyword.length <= 3) {
    return true;
  }
  
  // Check if it contains common business/service words that are typically global
  const globalServiceWords = [
    'app', 'website', 'online', 'digital', 'software', 'platform',
    'network', 'system', 'tool', 'service', 'solution', 'product'
  ];
  
  for (const word of globalServiceWords) {
    if (cleanKeyword.includes(word)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a keyword has location issues that need user attention
 * @param {string} keyword - The keyword to analyze
 * @param {string} userLocation - User's business location (e.g., "South Bend, IN")
 * @returns {object|null} Location issue details or null if no issues
 */
export const detectLocationIssues = (keyword, userLocation) => {
  if (!keyword || !userLocation) return null;

  const cleanKeyword = keyword.toLowerCase().trim();
  const cleanLocation = userLocation.toLowerCase().trim();
  
  // FIRST: Check if this is a brand name or general keyword that shouldn't have location context
  if (isBrandNameOrGeneralKeyword(cleanKeyword)) {
    return null;
  }
  
  // Parse location into parts
  const locationParts = cleanLocation.split(',').map(part => part.trim());
  const city = locationParts[0] || '';
  const state = locationParts[1] || '';
  
  // Extract individual words from city name
  const cityWords = city.split(' ').filter(word => word.length > 0);
  
  // Check if keyword contains the full city name (this is GOOD)
  if (cleanKeyword.includes(city)) {
    return null; // No issues - full city name is present
  }
  
  // Check if keyword contains the full location (city + state)
  if (cleanKeyword.includes(cleanLocation)) {
    return null; // No issues - full location is present
  }
  
  // Check for compound city names (like "south bend")
  if (cityWords.length > 1) {
    
    // SPECIAL CASE: If location contains numbers (like ZIP codes), be more flexible
    const hasNumbers = cityWords.some(word => /\d/.test(word));
    
    if (hasNumbers) {
      // For locations with numbers, check if keyword contains the main city parts
      // BUT exclude state names and ZIP codes - only check core city words
      const coreCityWords = cityWords.filter(word => {
        // Exclude numbers (ZIP codes)
        if (/\d/.test(word)) return false;
        // Exclude state names (indiana, illinois, michigan, etc.)
        const stateNames = ['indiana', 'illinois', 'michigan', 'ohio', 'kentucky', 'wisconsin'];
        if (stateNames.includes(word.toLowerCase())) return false;
        // Only include words that are part of the city name
        return word.length > 2;
      });
      
      if (coreCityWords.length > 0) {
        const hasCoreCity = coreCityWords.every(word => {
          return cleanKeyword.includes(word);
        });
        
        if (hasCoreCity) {
          return null; // No issues - core city parts are present
        }
      }
    } else {
      // For normal compound cities, check if keyword contains ALL parts
      const hasAllParts = cityWords.every(word => {
        return cleanKeyword.includes(word);
      });
      
      if (hasAllParts) {
        return null; // No issues - compound city name is complete
      }
    }
  }
  
  // Check for state-level targeting (this is also good)
  if (state && cleanKeyword.includes(state)) {
    return null; // No issues - state targeting is fine
  }
  
  // Now check for actual problems...
  const issues = [];
  
  // Problem 1: Ambiguous city words that could match multiple locations
  const ambiguousCityWords = ['bend', 'spring', 'franklin', 'madison', 'washington', 'portland'];
  
  for (const word of cityWords) {
    if (ambiguousCityWords.includes(word)) {
      // Check if keyword uses this ambiguous word without the full city context
      if (cleanKeyword.includes(word) && !cleanKeyword.includes(city)) {
        issues.push({
          type: 'ambiguous_city_word',
          severity: 'medium',
          description: `"${word}" is a common city name that could match multiple locations`,
          problem: `This could attract traffic from other cities named "${word}" instead of "${city}"`,
          suggestion: `Use the full location "${city}" or "${city}, ${state}" to avoid confusion`
        });
        break; // Only flag once per keyword
      }
    }
  }
  
  // Problem 2: No location context at all
  const hasAnyLocationTerms = cityWords.some(word => {
    return cleanKeyword.includes(word);
  }) || (state && cleanKeyword.includes(state));
  
  if (!hasAnyLocationTerms) {
    issues.push({
      type: 'no_location_context',
      severity: 'low',
      description: 'Keyword has no location terms',
      problem: 'This keyword could attract traffic from anywhere, not just your local area',
      suggestion: `Consider adding location context like "${city}" or "${city}, ${state}" to target local traffic`
    });
  }
  
  // Only return issues if there are real problems
  if (issues.length === 0) {
    return null;
  }
  
  return {
    keyword,
    userLocation,
    issues,
    severity: issues.some(issue => issue.severity === 'medium') ? 'medium' : 'low',
    recommendation: issues[0].suggestion, // Use the first issue's suggestion
    shouldShowAlert: true
  };
};

/**
 * Check if a keyword should trigger a location alert
 * @param {string} keyword - The keyword to check
 * @param {string} userLocation - User's business location
 * @returns {boolean} True if alert should be shown
 */
export const shouldShowLocationAlert = (keyword, userLocation) => {
  const issues = detectLocationIssues(keyword, userLocation);
  return issues !== null && issues.shouldShowAlert;
};

export default {
  detectLocationIssues,
  shouldShowLocationAlert
};
