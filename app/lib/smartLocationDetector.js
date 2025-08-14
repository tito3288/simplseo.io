// Smart Location Detector - Only alerts on genuinely problematic keywords
// Focuses on detecting location ambiguity and partial matches that could attract wrong traffic

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
  
  // Debug logging
  console.log(`🔍 Location Analysis for "${keyword}":`);
  console.log(`  User Location: "${userLocation}"`);
  console.log(`  Clean Location: "${cleanLocation}"`);
  console.log(`  Original Keyword: "${keyword}"`);
  console.log(`  Cleaned Keyword: "${cleanKeyword}"`);
  
  // Parse location into parts
  const locationParts = cleanLocation.split(',').map(part => part.trim());
  const city = locationParts[0] || '';
  const state = locationParts[1] || '';
  
  console.log(`  Parsed City: "${city}"`);
  console.log(`  Parsed State: "${state}"`);
  
  // Extract individual words from city name
  const cityWords = city.split(' ').filter(word => word.length > 0);
  
  console.log(`  City Words: [${cityWords.join(', ')}]`);
  console.log(`  Keyword: "${cleanKeyword}"`);
  
  // Check if keyword contains the full city name (this is GOOD)
  console.log(`  🔍 Checking full city name: "${city}" in keyword: ${cleanKeyword.includes(city)}`);
  if (cleanKeyword.includes(city)) {
    console.log(`  ✅ Full city name found - no issues`);
    return null; // No issues - full city name is present
  }
  
  // Check if keyword contains the full location (city + state)
  console.log(`  🔍 Checking full location: "${cleanLocation}" in keyword: ${cleanKeyword.includes(cleanLocation)}`);
  if (cleanKeyword.includes(cleanLocation)) {
    console.log(`  ✅ Full location found - no issues`);
    return null; // No issues - full location is present
  }
  
  // Check for compound city names (like "south bend")
  if (cityWords.length > 1) {
    console.log(`  🔍 Checking compound city: [${cityWords.join(', ')}]`);
    
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
      
      console.log(`  🔍 Core city words (no numbers, no state): [${coreCityWords.join(', ')}]`);
      
      if (coreCityWords.length > 0) {
        console.log(`  🔍 Checking each core city word:`);
        const hasCoreCity = coreCityWords.every(word => {
          const hasWord = cleanKeyword.includes(word);
          console.log(`    "${word}" in "${cleanKeyword}": ${hasWord}`);
          console.log(`    Word length: ${word.length}, Keyword length: ${cleanKeyword.length}`);
          console.log(`    Word: "${word}", Keyword: "${cleanKeyword}"`);
          return hasWord;
        });
        console.log(`  🔍 Has core city parts: ${hasCoreCity}`);
        
        if (hasCoreCity) {
          console.log(`  ✅ Core city parts found - no issues`);
          return null; // No issues - core city parts are present
        }
      }
    } else {
      // For normal compound cities, check if keyword contains ALL parts
      const hasAllParts = cityWords.every(word => {
        const hasPart = cleanKeyword.includes(word);
        console.log(`    "${word}" in keyword: ${hasPart}`);
        return hasPart;
      });
      
      if (hasAllParts) {
        console.log(`  ✅ Compound city complete - no issues`);
        return null; // No issues - compound city name is complete
      }
    }
    
    console.log(`  ❌ Compound city incomplete`);
  }
  
  // Check for state-level targeting (this is also good)
  if (state && cleanKeyword.includes(state)) {
    console.log(`  ✅ State found - no issues`);
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
  const hasAnyLocationTerms = cityWords.some(word => cleanKeyword.includes(word)) || 
                             (state && cleanKeyword.includes(state));
  
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
    console.log(`  ✅ No location issues found`);
    return null;
  }
  
  console.log(`  ❌ Found ${issues.length} location issues:`, issues.map(i => i.type));
  
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
