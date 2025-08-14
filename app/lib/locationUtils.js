// Utility functions for location-related operations

/**
 * Generate the recommended keyword by intelligently inserting the service area
 * @param {string} originalKeyword - The original keyword (e.g., "bend local seo")
 * @param {string} serviceArea - The service area (e.g., "South Bend, IN")
 * @returns {string} The recommended keyword (e.g., "South Bend local seo")
 */
export const generateRecommendedKeyword = (originalKeyword, serviceArea) => {
  if (!originalKeyword || !serviceArea) return originalKeyword;
  
  // Extract the main city name from service area (e.g., "South Bend" from "South Bend, IN")
  const cityName = serviceArea.split(',')[0]?.trim() || '';
  if (!cityName) return originalKeyword;
  
  // Convert to lowercase for comparison
  const cleanCity = cityName.toLowerCase();
  const cleanKeyword = originalKeyword.toLowerCase();
  
  // Split city into words (e.g., "south bend" -> ["south", "bend"])
  const cityWords = cleanCity.split(' ').filter(word => word.length > 0);
  
  // Find the ambiguous city word in the keyword (e.g., "bend" in "bend local seo")
  let ambiguousWord = '';
  for (const cityWord of cityWords) {
    if (cityWord.length > 2 && cleanKeyword.includes(cityWord)) {
      ambiguousWord = cityWord;
      break;
    }
  }
  
  if (!ambiguousWord) return originalKeyword;
  
  // Replace the ambiguous word with the full city name
  const regex = new RegExp(`\\b${ambiguousWord}\\b`, 'gi');
  const recommended = originalKeyword.replace(regex, cityName);
  
  return recommended;
};

/**
 * Update a suggestion text to use the recommended keyword
 * @param {string} suggestion - The original suggestion text
 * @param {string} oldKeyword - The old keyword to replace
 * @param {string} newKeyword - The new keyword to use
 * @returns {string} The updated suggestion text
 */
export const updateSuggestionWithKeyword = (suggestion, oldKeyword, newKeyword) => {
  if (!suggestion || !oldKeyword || !newKeyword) return suggestion;
  
  // Replace all instances of the old keyword with the new one
  const regex = new RegExp(`'${oldKeyword}'`, 'gi');
  return suggestion.replace(regex, `'${newKeyword}'`);
};
