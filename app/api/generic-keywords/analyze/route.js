import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { gscKeywords, businessType, businessLocation, websiteUrl, customBusinessType } = await req.json();

    // Use custom business type if provided, otherwise use the selected business type
    const effectiveBusinessType = (businessType === "Other" && customBusinessType) ? customBusinessType : businessType;

    console.log("🔍 AI-Generated Generic Keywords Analysis starting for:", { 
      gscKeywordsCount: gscKeywords?.length || 0,
      businessType,
      customBusinessType,
      effectiveBusinessType,
      businessLocation 
    });

    // Allow empty GSC keywords for pure AI generation
    if (!gscKeywords) {
      return NextResponse.json({ error: "No GSC keywords provided" }, { status: 400 });
    }

    // Extract existing keywords from GSC data for filtering
    const existingKeywords = gscKeywords.length > 0 ? gscKeywords.map(kw => kw.keyword.toLowerCase()) : [];
    console.log("📋 Existing GSC keywords for filtering:", existingKeywords.length);

    // Generate new AI-powered generic keyword opportunities
    const aiGeneratedOpportunities = await generateAIGenericKeywords(
      effectiveBusinessType, 
      businessLocation, 
      websiteUrl,
      existingKeywords
    );

    console.log("🤖 AI-generated opportunities:", aiGeneratedOpportunities.length);

    // Analyze keyword cannibalization for the new opportunities
    const cannibalizationAnalysis = analyzeKeywordCannibalization(aiGeneratedOpportunities);

    // Create hub-and-spoke keyword strategy
    const hubAndSpokeStrategy = createHubAndSpokeStrategy(aiGeneratedOpportunities, effectiveBusinessType, businessLocation);

    // Filter out pages that have Low CTR issues (avoid duplicate work)
    const lowCtrPages = gscKeywords
      .filter(kw => parseFloat(kw.ctr.replace('%', '')) <= 2 && kw.impressions > 20)
      .map(kw => kw.page);
    
    const uniqueLowCtrPages = [...new Set(lowCtrPages)];
    console.log("🚫 Low CTR pages to exclude from Generic Keywords:", uniqueLowCtrPages);

    // Filter out opportunities for pages that have Low CTR issues
    const filteredOpportunities = aiGeneratedOpportunities.filter(opportunity => {
      const page = opportunity.currentPerformance?.page;
      return !uniqueLowCtrPages.includes(page);
    });

    console.log(`🔄 Filtered out ${aiGeneratedOpportunities.length - filteredOpportunities.length} opportunities from Low CTR pages`);

    return NextResponse.json({
      opportunities: filteredOpportunities.slice(0, 50), // Return top 50
      cannibalizationAnalysis,
      hubAndSpokeStrategy,
      excludedLowCtrPages: uniqueLowCtrPages,
      excludedCount: aiGeneratedOpportunities.length - filteredOpportunities.length,
      totalGenerated: aiGeneratedOpportunities.length,
      totalFiltered: filteredOpportunities.length,
      strategy: "ai_generated_content_creation"
    });

  } catch (error) {
    console.error("❌ Error in Generic Keywords API:", error);
    return NextResponse.json({ error: "Failed to generate generic keyword opportunities" }, { status: 500 });
  }
}

// Generate AI-powered generic keywords using Google Trends and business context
async function generateAIGenericKeywords(businessType, businessLocation, websiteUrl, existingKeywords) {
  console.log("🤖 Generating AI-powered generic keywords...");
  
  const opportunities = [];
  
  try {
    // 1. Get trending keywords from Google Trends
    const trendingKeywords = await getGoogleTrendsData(businessType, businessLocation);
    console.log("📈 Trending keywords found:", trendingKeywords.length);
    
    // 2. Generate AI-powered keyword suggestions
    const aiSuggestions = await generateAIKeywordSuggestions(businessType, businessLocation, websiteUrl);
    console.log("🧠 AI suggestions generated:", aiSuggestions.length);
    
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
    
    console.log(`🔄 Filtered out ${allSuggestions.length - filteredSuggestions.length} existing keywords`);
    console.log(`✅ New opportunities: ${filteredSuggestions.length}`);
    console.log("🔍 Sample AI suggestions before filtering:", aiSuggestions.slice(0, 3).map(s => s.keyword));
    console.log("🔍 Sample existing GSC keywords:", existingKeywords.slice(0, 5));
    console.log("🔍 Sample filtered suggestions:", filteredSuggestions.slice(0, 3).map(s => s.keyword));
    
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
    
    console.log(`🎯 Using ${finalSuggestions.length} final suggestions`);
    
    // 4. Convert to opportunity format with content creation focus
    return finalSuggestions.map((suggestion, index) => ({
      keyword: suggestion.keyword,
      category: suggestion.category,
      priority: suggestion.priority,
      searchVolume: suggestion.searchVolume || "Unknown",
      competition: suggestion.competition || "Medium",
      contentIdea: suggestion.contentIdea,
      actionItems: getContentCreationActionItems(suggestion, businessType, businessLocation),
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
    }));
    
  } catch (error) {
    console.error("❌ Error generating AI keywords:", error);
    return [];
  }
}

// Generate trending-style keywords without external API
async function getGoogleTrendsData(businessType, businessLocation) {
  try {
    console.log("📈 Generating trending-style keywords...");
    
    const location = businessLocation.split(',')[0].trim();
    
    // Generate trending-style keywords based on common patterns
    const trendingKeywords = [
      {
        keyword: `${businessType} 2024`,
        category: 'trending_search',
        priority: 8,
        searchVolume: "High",
        competition: "Medium",
        contentIdea: generateContentIdea(`${businessType} 2024`, businessType, businessLocation),
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
    
    console.log(`📈 Generated ${trendingKeywords.length} trending-style keywords`);
    return trendingKeywords;
    
  } catch (error) {
    console.error("❌ Error generating trending keywords:", error);
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
  console.log("🔍 Analyzing keyword cannibalization...");
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
  
  console.log(`⚠️ Found ${cannibalizedKeywords.length} cannibalized keywords`);
  console.log("📋 Primary page assignments:", primaryPageAssignments);
  
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
  
  console.log("✅ Hub-and-spoke strategy created:", {
    hubKeywords: strategy.hub?.primaryKeywords?.length || 0,
    spokesCount: strategy.spokes.length,
    totalRecommendations: strategy.recommendations.length
  });
  
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
