import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

// Helper function to sanitize URL for use in Firestore document IDs
function sanitizeUrlForCache(url) {
  if (!url) return '';
  // Remove protocol (http:// or https://)
  let sanitized = url.replace(/^https?:\/\//, '');
  // Replace any remaining special characters with underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '_');
  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized;
}

export async function POST(req) {
  try {
    const { gscKeywords, businessType, businessLocation, websiteUrl, customBusinessType, userId } = await req.json();

    // Use custom business type if provided, otherwise use the selected business type
    const effectiveBusinessType = (businessType === "Other" && customBusinessType) ? customBusinessType : businessType;

    // Check for cached results first
    if (userId) {
      const sanitizedUrl = sanitizeUrlForCache(websiteUrl);
      const cacheKey = `genericKeywords_${userId}_${effectiveBusinessType}_${sanitizedUrl}`;
      
      try {
        const cachedDoc = await db.collection("genericKeywordsCache").doc(cacheKey).get();
        
        if (cachedDoc.exists) {
          const cachedData = cachedDoc.data();
          const cacheAge = Date.now() - cachedData.timestamp;
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          
          if (cacheAge < maxAge) {
            return NextResponse.json({
              success: true,
              opportunities: cachedData.opportunities,
              cannibalizationAnalysis: cachedData.cannibalizationAnalysis,
              hubAndSpokeStrategy: cachedData.hubAndSpokeStrategy,
              fromCache: true,
              cacheAge: Math.round(cacheAge / (60 * 60 * 1000)) // hours
            });
          } else {
            console.log("⏰ Cache expired, generating new data");
          }
        } else {
          console.log("📝 No cache found, generating new data");
        }
      } catch (cacheError) {
        console.error("⚠️ Error checking cache:", cacheError);
        // Continue with generation if cache check fails
      }
    }

    // Allow empty GSC keywords for pure AI generation
    if (!gscKeywords) {
      return NextResponse.json({ error: "No GSC keywords provided" }, { status: 400 });
    }

    // Extract existing keywords from GSC data for filtering
    const existingKeywords = gscKeywords.length > 0 ? gscKeywords.map(kw => kw.keyword.toLowerCase()) : [];

    // Crawl the user's website to understand current structure
    const siteAnalysis = await analyzeUserWebsite(websiteUrl, effectiveBusinessType);

    // Generate new AI-powered generic keyword opportunities
    const aiGeneratedOpportunities = await generateAIGenericKeywords(
      effectiveBusinessType, 
      businessLocation, 
      websiteUrl,
      existingKeywords,
      siteAnalysis
    );

    // Analyze keyword cannibalization for the new opportunities
    const cannibalizationAnalysis = analyzeKeywordCannibalization(aiGeneratedOpportunities);

    // Create hub-and-spoke keyword strategy
    const hubAndSpokeStrategy = createHubAndSpokeStrategy(aiGeneratedOpportunities, effectiveBusinessType, businessLocation);

    // Filter out pages that have Low CTR issues (avoid duplicate work)
    const lowCtrPages = gscKeywords
      .filter(kw => parseFloat(kw.ctr.replace('%', '')) <= 2 && kw.impressions > 20)
      .map(kw => kw.page);
    
    const uniqueLowCtrPages = [...new Set(lowCtrPages)];

    // Filter out opportunities for pages that have Low CTR issues
    const filteredOpportunities = aiGeneratedOpportunities.filter(opportunity => {
      const page = opportunity.currentPerformance?.page;
      return !uniqueLowCtrPages.includes(page);
    });

    // Prepare the response data
    const responseData = {
      opportunities: filteredOpportunities.slice(0, 50), // Return top 50
      cannibalizationAnalysis,
      hubAndSpokeStrategy,
      excludedLowCtrPages: uniqueLowCtrPages,
      excludedCount: aiGeneratedOpportunities.length - filteredOpportunities.length,
      totalGenerated: aiGeneratedOpportunities.length,
      totalFiltered: filteredOpportunities.length,
      strategy: "ai_generated_content_creation"
    };

    // Cache the results if userId is provided
    if (userId) {
      const sanitizedUrl = sanitizeUrlForCache(websiteUrl);
      const cacheKey = `genericKeywords_${userId}_${effectiveBusinessType}_${sanitizedUrl}`;
      console.log("💾 Caching generic keywords data for key:", cacheKey);
      
      try {
        await db.collection("genericKeywordsCache").doc(cacheKey).set({
          ...responseData,
          userId,
          businessType: effectiveBusinessType,
          websiteUrl,
          businessLocation,
          timestamp: Date.now(),
          createdAt: new Date().toISOString()
        });
      } catch (cacheError) {
        console.error("⚠️ Error caching data:", cacheError);
        // Continue even if caching fails
      }
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error("Error in Generic Keywords API:", error);
    return NextResponse.json({ error: "Failed to generate generic keyword opportunities" }, { status: 500 });
  }
}

// Generate AI-powered generic keywords using Google Trends and business context
async function generateAIGenericKeywords(businessType, businessLocation, websiteUrl, existingKeywords, siteAnalysis) {
  const opportunities = [];
  
  try {
    // 1. Get trending keywords from Google Trends
    const trendingKeywords = await getGoogleTrendsData(businessType, businessLocation);
    
    // 2. Generate AI-powered keyword suggestions
    const aiSuggestions = await generateAIKeywordSuggestions(businessType, businessLocation, websiteUrl);
    
    // 3. Combine and filter out existing keywords (less aggressive filtering)
    const allSuggestions = [...trendingKeywords, ...aiSuggestions];
    const filteredSuggestions = allSuggestions.filter(suggestion => {
      const suggestionLower = suggestion.keyword.toLowerCase();
      return !existingKeywords.some(existing => {
        const existingLower = existing.toLowerCase();
        // Only filter if it's an exact match or very close match
        return existingLower === suggestionLower || 
               (existingLower.length > 10 && suggestionLower.includes(existingLower)) ||
               (suggestionLower.length > 10 && existingLower.includes(suggestionLower));
      });
    });
    
    // If all suggestions were filtered out, use some fallback suggestions
    const finalSuggestions = filteredSuggestions.length > 0 ? filteredSuggestions : [
      {
        keyword: `${businessType} services`,
        category: 'service_based',
        priority: 7,
        searchVolume: "High",
        competition: "Medium",
        contentIdea: generateContentIdea(`${businessType} services`, businessType, businessLocation),
        difficulty: "Medium",
        potential: "High"
      },
      {
        keyword: `best ${businessType} near me`,
        category: 'location_based',
        priority: 8,
        searchVolume: "High",
        competition: "High",
        contentIdea: generateContentIdea(`best ${businessType} near me`, businessType, businessLocation),
        difficulty: "High",
        potential: "High"
      },
      {
        keyword: `${businessType} packages`,
        category: 'service_based',
        priority: 6,
        searchVolume: "Medium",
        competition: "Medium",
        contentIdea: generateContentIdea(`${businessType} packages`, businessType, businessLocation),
        difficulty: "Medium",
        potential: "High"
      }
    ];
    
    // 4. Convert to opportunity format with content creation focus
    const opportunities = await Promise.all(
      finalSuggestions.map(async (suggestion, index) => ({
        keyword: suggestion.keyword,
        category: suggestion.category,
        priority: suggestion.priority,
        searchVolume: suggestion.searchVolume || "Unknown",
        competition: suggestion.competition || "Medium",
        contentIdea: suggestion.contentIdea,
        actionItems: await getPersonalizedActionItems(suggestion, businessType, businessLocation, siteAnalysis),
        currentPerformance: {
          position: 0, // New keyword, not ranking yet
          ctr: "0%",
          impressions: 0,
          clicks: 0,
          page: null // No existing page
        },
        opportunity: "content_creation",
        difficulty: suggestion.difficulty || "Medium",
        potential: suggestion.potential || "High"
      }))
    );
    
    return opportunities;
    
  } catch (error) {
    console.error("❌ Error generating AI keywords:", error);
    return [];
  }
}

// Generate trending-style keywords without external API
async function getGoogleTrendsData(businessType, businessLocation) {
  try {
    const location = businessLocation.split(',')[0].trim();
    
    // Generate trending-style keywords based on common patterns
    const currentYear = new Date().getFullYear();
    const trendingKeywords = [
      {
        keyword: `${businessType} ${currentYear}`,
        category: 'trending_search',
        priority: 8,
        searchVolume: "High",
        competition: "Medium",
        contentIdea: generateContentIdea(`${businessType} ${currentYear}`, businessType, businessLocation),
        difficulty: "Medium",
        potential: "High"
      },
      {
        keyword: `${businessType} trends`,
        category: 'trending_search',
        priority: 7,
        searchVolume: "Medium",
        competition: "Low",
        contentIdea: generateContentIdea(`${businessType} trends`, businessType, businessLocation),
        difficulty: "Low",
        potential: "High"
      },
      {
        keyword: `best ${businessType} ${location}`,
        category: 'trending_search',
        priority: 9,
        searchVolume: "High",
        competition: "High",
        contentIdea: generateContentIdea(`best ${businessType} ${location}`, businessType, businessLocation),
        difficulty: "High",
        potential: "High"
      },
      {
        keyword: `${businessType} near me`,
        category: 'trending_search',
        priority: 8,
        searchVolume: "Very High",
        competition: "High",
        contentIdea: generateContentIdea(`${businessType} near me`, businessType, businessLocation),
        difficulty: "High",
        potential: "Very High"
      },
      {
        keyword: `${businessType} tips`,
        category: 'trending_search',
        priority: 6,
        searchVolume: "Medium",
        competition: "Medium",
        contentIdea: generateContentIdea(`${businessType} tips`, businessType, businessLocation),
        difficulty: "Medium",
        potential: "High"
      }
    ];
    
    return trendingKeywords;
    
  } catch (error) {
    console.error("Error generating trending keywords:", error);
    return [];
  }
}

// Generate AI-powered keyword suggestions
async function generateAIKeywordSuggestions(businessType, businessLocation, websiteUrl) {
  try {
    console.log("🧠 Generating AI keyword suggestions...");
    
    const location = businessLocation.split(',')[0].trim();
    
    const prompt = `Generate 15 highly relevant, searchable keywords for a ${businessType} business in ${location}. 
    
    IMPORTANT: Only suggest keywords that people actually search for in real life. Avoid made-up or overly specific terms.
    
    Focus on keywords that:
    1. Service-based: Actual services offered (e.g., "mobile ${businessType}", "${businessType} packages")
    2. Location-based: Local search terms (e.g., "${businessType} ${location}")
    3. Problem-solving: Common customer pain points (e.g., "affordable ${businessType}", "quick ${businessType}")
    4. Comparison: Competitive terms (e.g., "best ${businessType} near me", "top ${businessType} services")
    5. Long-tail: Specific use cases (e.g., "${businessType} for small business", "${businessType} maintenance")
    
    Avoid:
    - Overly specific or niche terms
    - Keywords that sound artificial
    - Terms that are too broad or generic
    - Made-up industry jargon
    
    Return ONLY a valid JSON array with this exact format:
    [{"keyword": "mobile ${businessType} services", "category": "service_based", "priority": 9, "contentIdea": "Create a dedicated page showcasing mobile services with pricing and booking", "difficulty": "Medium", "potential": "High"}]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No AI response received');
    }

    // Clean and parse JSON response
    const cleanedResponse = aiResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const suggestions = JSON.parse(cleanedResponse);
    console.log(`🧠 AI generated ${suggestions.length} keyword suggestions`);
    
    return suggestions;
    
  } catch (error) {
    console.error("❌ AI keyword generation error:", error);
    // Return fallback suggestions if AI fails
    return [
      {
        keyword: `${businessType} consultation`,
        category: 'service_based',
        priority: 7,
        contentIdea: `Create a consultation page for ${businessType} services with booking form`,
        difficulty: "Medium",
        potential: "High"
      },
      {
        keyword: `${businessType} pricing`,
        category: 'service_based',
        priority: 8,
        contentIdea: `Develop a pricing page with transparent ${businessType} service costs`,
        difficulty: "Low",
        potential: "High"
      },
      {
        keyword: `${businessType} portfolio`,
        category: 'service_based',
        priority: 6,
        contentIdea: `Create a portfolio page showcasing ${businessType} work examples`,
        difficulty: "Medium",
        potential: "Medium"
      }
    ];
  }
}

// Generate content ideas for keywords
function generateContentIdea(keyword, businessType, businessLocation) {
  const ideas = [
    `Create a comprehensive guide about "${keyword}" with local insights for ${businessLocation}`,
    `Write a detailed blog post explaining "${keyword}" and how it benefits customers`,
    `Develop a service page specifically for "${keyword}" with pricing and booking options`,
    `Create location-specific content about "${keyword}" in ${businessLocation.split(',')[0]}`,
    `Build a comparison page showing why your "${keyword}" services are the best`,
    `Develop FAQ content answering common questions about "${keyword}"`,
    `Create seasonal content about "${keyword}" with time-sensitive offers`,
    `Build a landing page for "${keyword}" with clear calls-to-action`
  ];
  
  return ideas[Math.floor(Math.random() * ideas.length)];
}

// Get content creation action items
function getContentCreationActionItems(suggestion, businessType, businessLocation) {
  const baseActions = [
    "Create dedicated content page",
    "Add to main navigation menu",
    "Include local SEO optimization",
    "Add customer testimonials",
    "Create booking/contact forms"
  ];
  
  const categoryActions = {
    'trending_search': [
      "Monitor trending performance",
      "Create timely content",
      "Add social media promotion"
    ],
    'service_based': [
      "Detail service offerings",
      "Add pricing information",
      "Include service areas"
    ],
    'location_based': [
      "Add local business info",
      "Include directions/maps",
      "Add local testimonials"
    ],
    'problem_solving': [
      "Address pain points",
      "Show solutions clearly",
      "Add before/after examples"
    ],
    'comparison': [
      "Compare with competitors",
      "Highlight unique benefits",
      "Add comparison charts"
    ]
  };
  
  return [...baseActions, ...(categoryActions[suggestion.category] || [])];
}

// Check if a keyword is a generic opportunity (not branded)
function isGenericOpportunity(keyword) {
  const brandedTerms = [
    'drive and shine', 'driveandshine', 'bryan develops', 'bryandevelops',
    'taco mensh', 'tacomensh'
  ];
  
  const lowerKeyword = keyword.toLowerCase();
  return !brandedTerms.some(term => lowerKeyword.includes(term));
}

// Analyze keyword cannibalization
function analyzeKeywordCannibalization(opportunities) {
  const keywordGroups = {};
  
  opportunities.forEach(opportunity => {
    const keyword = opportunity.keyword.toLowerCase();
    const page = opportunity.currentPerformance?.page || 'New Content';
    
    if (!keywordGroups[keyword]) {
      keywordGroups[keyword] = [];
    }
    keywordGroups[keyword].push({
      page,
      position: opportunity.currentPerformance?.position || 0,
      ctr: opportunity.currentPerformance?.ctr || '0%',
      impressions: opportunity.currentPerformance?.impressions || 0,
      clicks: opportunity.currentPerformance?.clicks || 0,
      priority: opportunity.priority
    });
  });
  
  const cannibalizedKeywords = Object.entries(keywordGroups)
    .filter(([keyword, pages]) => pages.length > 1)
    .map(([keyword, pages]) => ({
      keyword,
      pages: pages.sort((a, b) => b.priority - a.priority),
      issue: 'Multiple content pieces targeting same keyword',
      recommendation: getCannibalizationRecommendation(keyword, pages)
    }));
  
  const primaryPageAssignments = {};
  cannibalizedKeywords.forEach(({ keyword, pages }) => {
    const primaryPage = pages[0];
    primaryPageAssignments[keyword] = {
      primaryPage: primaryPage.page,
      reason: `Best performance: Position ${primaryPage.position}, CTR ${primaryPage.ctr}`,
      removeFrom: pages.slice(1).map(p => p.page)
    };
  });
  
  return {
    cannibalizedKeywords,
    primaryPageAssignments,
    totalCannibalized: cannibalizedKeywords.length,
    summary: `Found ${cannibalizedKeywords.length} keywords appearing on multiple pages. Consider consolidating to one primary page per keyword.`
  };
}

// Get cannibalization recommendation
function getCannibalizationRecommendation(keyword, pages) {
  if (pages.length <= 1) return "No cannibalization detected";
  
  const primaryPage = pages[0];
  const otherPages = pages.slice(1);
  
  return `Focus on "${primaryPage.page}" as the primary page for "${keyword}". Consider redirecting or updating content on: ${otherPages.map(p => p.page).join(', ')}`;
}

// Create hub-and-spoke keyword strategy
function createHubAndSpokeStrategy(opportunities, businessType, businessLocation) {
  console.log("🏗️ Creating hub-and-spoke keyword strategy...");
  
  const opportunitiesByPage = opportunities.reduce((acc, opportunity) => {
    const page = opportunity.currentPerformance?.page || 'New Content';
    if (!acc[page]) {
      acc[page] = [];
    }
    acc[page].push(opportunity);
    return acc;
  }, {});

  const pageTypes = identifyPageTypes(Object.keys(opportunitiesByPage));
  const strategy = { hub: null, spokes: [], assignments: {}, recommendations: [] };
  
  // Homepage as hub for broad keywords
  const homepage = Object.keys(opportunitiesByPage).find(page => 
    page.endsWith('/') || page.includes('homepage') || page === 'https://driveandshine.com/'
  );
  
  if (homepage) {
    strategy.hub = {
      page: homepage,
      type: 'homepage',
      keywords: opportunitiesByPage[homepage] || [],
      primaryKeywords: selectPrimaryKeywords(opportunitiesByPage[homepage] || [], 4),
      strategy: 'Focus on high-volume, broad keywords that represent your main services'
    };
  }
  
  // Other pages as spokes
  Object.entries(opportunitiesByPage).forEach(([page, pageOpportunities]) => {
    if (page === homepage) return;
    
    const pageType = pageTypes[page] || 'service';
    const primaryKeywords = selectPrimaryKeywords(pageOpportunities, 3);
    
    strategy.spokes.push({
      page,
      type: pageType,
      keywords: pageOpportunities,
      primaryKeywords,
      strategy: getPageSpecificStrategy(page, pageType, primaryKeywords)
    });
  });
  
  strategy.recommendations = generateOptimizationRecommendations(strategy, businessType, businessLocation);
  
  return strategy;
}

// Identify page types
function identifyPageTypes(pages) {
  const pageTypes = {};
  pages.forEach(page => {
    if (page === 'https://driveandshine.com/' || (page.endsWith('/') && !page.includes('/'))) {
      pageTypes[page] = 'homepage';
    } else if (page.includes('oil-change') || page.includes('oil')) {
      pageTypes[page] = 'oil-change';
    } else if (page.includes('detailing') || page.includes('detail')) {
      pageTypes[page] = 'detailing';
    } else if (page.includes('fort-wayne') || page.includes('location')) {
      pageTypes[page] = 'location';
    } else if (page.includes('free-car-wash') || page.includes('landing-page')) {
      pageTypes[page] = 'landing-page';
    } else if (page.includes('vip-membership') || page.includes('faq')) {
      pageTypes[page] = 'faq';
    } else if (page.includes('coupon') || page.includes('deal')) {
      pageTypes[page] = 'coupon';
    } else if (page.includes('service') || page.includes('services')) {
      pageTypes[page] = 'service';
    } else {
      pageTypes[page] = 'service';
    }
  });
  
  console.log("🔍 Page type identification:", pageTypes);
  return pageTypes;
}

// Select primary keywords for a page
function selectPrimaryKeywords(opportunities, maxCount) {
  return opportunities
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxCount)
    .map(opp => opp.keyword);
}

// Get page-specific strategy
function getPageSpecificStrategy(page, pageType, primaryKeywords) {
  const strategies = {
    'homepage': `Focus on broad service keywords like "${primaryKeywords[0]}" and "${primaryKeywords[1] || 'your main service'}" in your main heading and meta description`,
    'oil-change': `Create detailed content about "${primaryKeywords[0]}" with pricing, process, and benefits`,
    'detailing': `Develop comprehensive guides about "${primaryKeywords[0]}" with before/after photos and packages`,
    'location': `Optimize for local keywords like "${primaryKeywords[0]}" with location-specific content and testimonials`,
    'landing-page': `Focus on conversion-optimized content for "${primaryKeywords[0]}" with clear CTAs`,
    'faq': `Answer common questions about "${primaryKeywords[0]}" and related services`,
    'coupon': `Create time-sensitive offers for "${primaryKeywords[0]}" with clear expiration dates`,
    'service': `Develop detailed service pages for "${primaryKeywords[0]}" with pricing and booking options`
  };
  
  return strategies[pageType] || `Create comprehensive content about "${primaryKeywords[0]}" with clear value propositions`;
}

// Generate optimization recommendations
function generateOptimizationRecommendations(strategy, businessType, businessLocation) {
  const recommendations = [];
  
  if (strategy.hub) {
    recommendations.push({
      type: 'homepage_optimization',
      priority: 'High',
      title: 'Optimize Homepage for Broad Keywords',
      description: `Focus on ${strategy.hub.primaryKeywords.join(', ')} in your main heading and meta description`,
      action: 'Update homepage title and meta description to include primary keywords'
    });
  }
  
  strategy.spokes.forEach(spoke => {
    recommendations.push({
      type: 'content_creation',
      priority: 'Medium',
      title: `Create ${spoke.type} Content`,
      description: `Develop content for ${spoke.primaryKeywords.join(', ')}`,
      action: `Create or update ${spoke.page} with keyword-optimized content`
    });
  });
  
  recommendations.push({
    type: 'local_seo',
    priority: 'High',
    title: 'Local SEO Optimization',
    description: `Include ${businessLocation} in all content and meta descriptions`,
    action: 'Add location-specific content and local business schema markup'
  });
  
  return recommendations;
}

// Analyze user's website to understand current structure and content
async function analyzeUserWebsite(websiteUrl, businessType) {
  try {
    // Ensure the URL has a protocol
    const fullUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    
    // Use the existing scrape-content API to get homepage data
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/scrape-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pageUrl: fullUrl })
    });

    if (!response.ok) {
      console.warn("⚠️ Could not crawl website, using fallback analysis");
      return getFallbackSiteAnalysis(businessType);
    }

    const data = await response.json();
    const { title, metaDescription, textContent, headings } = data.data;

    // Analyze the content to understand current structure
    const analysis = {
      title: title || '',
      metaDescription: metaDescription || '',
      contentLength: textContent?.length || 0,
      headings: headings || [],
      navigation: extractNavigationInfo(headings, textContent),
      footer: extractFooterInfo(textContent),
      pages: extractPageInfo(headings, textContent),
      contentGaps: identifyContentGaps(headings, textContent, businessType),
      hasContactForm: checkForContactForm(textContent),
      hasTestimonials: checkForTestimonials(textContent),
      hasPricing: checkForPricing(textContent),
      hasLocationInfo: checkForLocationInfo(textContent)
    };

    return analysis;

  } catch (error) {
    console.error("Error analyzing website:", error);
    return getFallbackSiteAnalysis(businessType);
  }
}

// Extract navigation information from headings and content
function extractNavigationInfo(headings, content) {
  const navKeywords = ['services', 'about', 'contact', 'pricing', 'portfolio', 'gallery', 'testimonials'];
  const foundNavItems = [];
  
  headings.forEach(heading => {
    const headingLower = heading.toLowerCase();
    navKeywords.forEach(keyword => {
      if (headingLower.includes(keyword)) {
        foundNavItems.push(heading);
      }
    });
  });

  return {
    items: foundNavItems,
    hasServices: foundNavItems.some(item => item.toLowerCase().includes('service')),
    hasAbout: foundNavItems.some(item => item.toLowerCase().includes('about')),
    hasContact: foundNavItems.some(item => item.toLowerCase().includes('contact')),
    hasPricing: foundNavItems.some(item => item.toLowerCase().includes('pricing'))
  };
}

// Extract footer information
function extractFooterInfo(content) {
  const footerKeywords = ['copyright', 'privacy', 'terms', 'address', 'phone', 'email'];
  const foundFooterItems = [];
  
  footerKeywords.forEach(keyword => {
    if (content.toLowerCase().includes(keyword)) {
      foundFooterItems.push(keyword);
    }
  });

  return {
    items: foundFooterItems,
    hasContactInfo: foundFooterItems.some(item => ['address', 'phone', 'email'].includes(item)),
    hasLegalPages: foundFooterItems.some(item => ['privacy', 'terms'].includes(item))
  };
}

// Extract page information
function extractPageInfo(headings, content) {
  const pages = [];
  const h1Headings = headings.filter(h => h.startsWith('H1:') || h.includes('h1'));
  
  h1Headings.forEach(heading => {
    const cleanHeading = heading.replace(/^H1:\s*/, '').trim();
    if (cleanHeading) {
      pages.push({
        title: cleanHeading,
        type: categorizePageType(cleanHeading),
        hasContent: content.length > 500
      });
    }
  });

  return pages;
}

// Categorize page type based on heading
function categorizePageType(heading) {
  const headingLower = heading.toLowerCase();
  
  if (headingLower.includes('service')) return 'service';
  if (headingLower.includes('about')) return 'about';
  if (headingLower.includes('contact')) return 'contact';
  if (headingLower.includes('pricing')) return 'pricing';
  if (headingLower.includes('portfolio')) return 'portfolio';
  if (headingLower.includes('testimonial')) return 'testimonial';
  if (headingLower.includes('gallery')) return 'gallery';
  
  return 'content';
}

// Identify content gaps
function identifyContentGaps(headings, content, businessType) {
  const gaps = [];
  const contentLower = content.toLowerCase();
  
  // Check for common business content gaps
  const commonGaps = [
    { keyword: 'pricing', check: () => !contentLower.includes('pricing') && !contentLower.includes('price') },
    { keyword: 'testimonials', check: () => !contentLower.includes('testimonial') && !contentLower.includes('review') },
    { keyword: 'contact', check: () => !contentLower.includes('contact') && !contentLower.includes('phone') },
    { keyword: 'about', check: () => !contentLower.includes('about') && !contentLower.includes('story') },
    { keyword: 'location', check: () => !contentLower.includes('location') && !contentLower.includes('address') },
    { keyword: 'hours', check: () => !contentLower.includes('hours') && !contentLower.includes('open') },
    { keyword: 'booking', check: () => !contentLower.includes('book') && !contentLower.includes('appointment') }
  ];

  commonGaps.forEach(gap => {
    if (gap.check()) {
      gaps.push(gap.keyword);
    }
  });

  return gaps;
}

// Check for contact form
function checkForContactForm(content) {
  const formKeywords = ['form', 'contact', 'book', 'appointment', 'quote', 'inquiry'];
  return formKeywords.some(keyword => content.toLowerCase().includes(keyword));
}

// Check for testimonials
function checkForTestimonials(content) {
  const testimonialKeywords = ['testimonial', 'review', 'customer', 'client', 'satisfied', 'happy'];
  return testimonialKeywords.some(keyword => content.toLowerCase().includes(keyword));
}

// Check for pricing information
function checkForPricing(content) {
  const pricingKeywords = ['pricing', 'price', 'cost', 'rate', 'fee', '$', 'dollar'];
  return pricingKeywords.some(keyword => content.toLowerCase().includes(keyword));
}

// Check for location information
function checkForLocationInfo(content) {
  const locationKeywords = ['location', 'address', 'near', 'area', 'city', 'state', 'zip'];
  return locationKeywords.some(keyword => content.toLowerCase().includes(keyword));
}

// Get fallback site analysis when crawling fails
function getFallbackSiteAnalysis(businessType) {
  return {
    title: '',
    metaDescription: '',
    contentLength: 0,
    headings: [],
    navigation: { items: [], hasServices: false, hasAbout: false, hasContact: false, hasPricing: false },
    footer: { items: [], hasContactInfo: false, hasLegalPages: false },
    pages: [],
    contentGaps: ['pricing', 'testimonials', 'contact', 'about', 'location', 'hours', 'booking'],
    hasContactForm: false,
    hasTestimonials: false,
    hasPricing: false,
    hasLocationInfo: false
  };
}

// Get AI-generated personalized action items based on site analysis
async function getPersonalizedActionItems(suggestion, businessType, businessLocation, siteAnalysis) {
  try {
    // Generate AI-powered recommendations
    const aiActions = await generateAIActionItems(suggestion, businessType, businessLocation, siteAnalysis);
    return aiActions;
  } catch (error) {
    console.error("AI action generation failed, using fallback:", error);
    // Fallback to basic actions if AI fails
    return [
      `Create a dedicated page or blog post specifically about "${suggestion.keyword}" to help you rank for this keyword`,
      `Write content that directly addresses what people are looking for when they search "${suggestion.keyword}"`,
      `Include "${suggestion.keyword}" in your page titles, headings, and content naturally`,
      `Add local SEO optimization if this is a location-based keyword`
    ];
  }
}

// Generate AI-powered action items
async function generateAIActionItems(suggestion, businessType, businessLocation, siteAnalysis) {
  const prompt = `You are an SEO expert helping a ${businessType} business in ${businessLocation}. 

Generate 4-6 specific, actionable recommendations for the keyword: "${suggestion.keyword}"

Business Context:
- Business Type: ${businessType}
- Location: ${businessLocation}
- Keyword Category: ${suggestion.category}
- Search Volume: ${suggestion.searchVolume}
- Difficulty: ${suggestion.difficulty}

Current Website Analysis:
- Content Gaps: ${siteAnalysis?.contentGaps?.join(', ') || 'None identified'}
- Navigation Issues: ${!siteAnalysis?.navigation?.hasServices ? 'Missing Services menu' : 'Has Services menu'}, ${!siteAnalysis?.navigation?.hasPricing ? 'Missing Pricing menu' : 'Has Pricing menu'}, ${!siteAnalysis?.navigation?.hasContact ? 'Missing Contact menu' : 'Has Contact menu'}

Requirements:
1. Make each recommendation specific to the exact keyword "${suggestion.keyword}"
2. Include the keyword naturally in each recommendation
3. Focus on beginner-friendly, actionable steps
4. Explain WHY each action helps with SEO
5. Be specific about what content to create and where to put it
6. Consider the business type and location context
7. Address any identified content gaps or navigation issues

Format as a JSON array of strings, each string being one complete recommendation.

Example format:
[
  "Create a dedicated landing page for '${suggestion.keyword}' with clear calls-to-action and local contact information",
  "Write blog posts about '${suggestion.keyword}' topics and share them on social media to build authority",
  "Add '${suggestion.keyword}' to your page titles, meta descriptions, and H1 headings for better search visibility"
]`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO consultant who provides specific, actionable recommendations for small businesses. Always include the exact keyword in your recommendations and explain the SEO benefit.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content?.trim();
  
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  try {
    // Clean up the content first - remove any markdown formatting
    let cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/^json\s*/g, '')
      .trim();
    
    // Try to parse as JSON
    const actions = JSON.parse(cleanContent);
    if (Array.isArray(actions) && actions.length > 0) {
      // Clean up each action item
      return actions.map(action => {
        if (typeof action === 'string') {
          return action.trim();
        }
        return String(action).trim();
      }).filter(action => action.length > 0);
    } else {
      throw new Error('Invalid JSON format');
    }
  } catch (parseError) {
    console.error("❌ Failed to parse AI response as JSON:", content);
    // Fallback: split by lines and clean up
    const lines = content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // Remove bullet points, quotes, and other formatting
        return line
          .replace(/^[-•*]\s*/, '')
          .replace(/^"\s*/, '')
          .replace(/"$/, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/^json\s*/, '')
          .replace(/^\[/, '')
          .replace(/\]$/, '')
          .trim();
      })
      .filter(line => line.length > 0 && !line.match(/^[\[\]{}"]*$/));
    
    return lines;
  }
}

