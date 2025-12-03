import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { keyword, pageType, businessType, businessLocation, businessName, websiteUrl } = await req.json();

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const outline = await generateContentOutline(keyword, pageType, businessType, businessLocation, businessName, websiteUrl);

    return NextResponse.json({
      success: true,
      keyword,
      pageType,
      outline
    });

  } catch (error) {
    console.error("Error generating content outline:", error);
    return NextResponse.json({ error: "Failed to generate content outline" }, { status: 500 });
  }
}

async function generateContentOutline(keyword, pageType, businessType, businessLocation, businessName, websiteUrl) {
  try {
    const companyName = businessName || 'Your Company';
    
    const prompt = `Generate a complete SEO-optimized content outline for a ${pageType || 'service page'} targeting:

Keyword: "${keyword}"
Location: ${businessLocation}
Business Type: ${businessType}
Business Name: ${companyName}
${websiteUrl ? `Website: ${websiteUrl}` : ''}

Create a detailed, actionable outline that a small business owner can follow to create content that ranks.

Include:
1. H1 (main title) - Include the keyword naturally
2. Meta Title (60 chars max) - Optimized for clicks, include "${companyName}" as the brand
3. Meta Description (155 chars max) - Compelling with keyword
4. H2 sections (4-6 main sections) with brief descriptions of what to cover
5. Optional H3s under each H2 where helpful
6. CTA placements - Where to add calls-to-action
7. Schema markup suggestions (LocalBusiness, FAQ, etc.)
8. Internal linking suggestions
9. Word count recommendation

Return ONLY valid JSON in this exact format:
{
  "h1": "Main Page Title Here",
  "metaTitle": "Meta Title Under 60 Characters | ${companyName}",
  "metaDescription": "Compelling description under 155 characters that includes the keyword and encourages clicks.",
  "sections": [
    {
      "h2": "Section Heading",
      "description": "What to cover in this section",
      "h3s": ["Optional subheading 1", "Optional subheading 2"],
      "ctaPlacement": true
    }
  ],
  "schema": ["LocalBusiness", "FAQ"],
  "internalLinks": ["Link to service page", "Link to contact page"],
  "wordCount": "800-1200 words",
  "additionalTips": ["Tip 1", "Tip 2"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert SEO content strategist who creates detailed, actionable content outlines for small businesses. Your outlines help business owners create high-quality, ranking content without needing SEO expertise.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    // Clean and parse JSON
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanedContent);

  } catch (error) {
    console.error("Content outline generation error:", error);
    // Return a fallback outline
    return generateFallbackOutline(keyword, pageType, businessType, businessLocation, businessName);
  }
}

function generateFallbackOutline(keyword, pageType, businessType, businessLocation, businessName) {
  const location = businessLocation?.split(',')[0]?.trim() || 'Your Area';
  const companyName = businessName || 'Your Company';
  
  return {
    h1: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} in ${location}`,
    metaTitle: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} | ${companyName}`,
    metaDescription: `Looking for ${keyword} in ${location}? ${companyName} offers professional ${businessType} services. Contact us today for a free quote!`,
    sections: [
      {
        h2: `Why Choose Our ${keyword} Services`,
        description: "Explain your unique value proposition and what sets you apart from competitors.",
        h3s: ["Our Experience", "Quality Guarantee", "Customer-First Approach"],
        ctaPlacement: true
      },
      {
        h2: `Our ${keyword} Process`,
        description: "Walk customers through how you deliver this service step by step.",
        h3s: ["Step 1: Initial Consultation", "Step 2: Service Delivery", "Step 3: Follow-up"],
        ctaPlacement: false
      },
      {
        h2: `${keyword} Pricing`,
        description: "Be transparent about costs or provide a range. Include what's included.",
        h3s: [],
        ctaPlacement: true
      },
      {
        h2: `Serving ${location} and Surrounding Areas`,
        description: "Highlight your service area and local expertise.",
        h3s: [],
        ctaPlacement: false
      },
      {
        h2: "Frequently Asked Questions",
        description: "Answer 3-5 common questions about this service.",
        h3s: [],
        ctaPlacement: false
      },
      {
        h2: "Get Started Today",
        description: "Strong call-to-action with contact information and next steps.",
        h3s: [],
        ctaPlacement: true
      }
    ],
    schema: ["LocalBusiness", "Service", "FAQ"],
    internalLinks: [
      "Link to your main services page",
      "Link to your contact page",
      "Link to related services",
      "Link to testimonials/reviews page"
    ],
    wordCount: "800-1200 words",
    additionalTips: [
      `Include the keyword "${keyword}" naturally 3-5 times throughout the content`,
      "Add high-quality images with alt text containing the keyword",
      "Include your business phone number and address prominently",
      "Add customer testimonials or reviews if available",
      "Make sure the page loads quickly on mobile devices"
    ]
  };
}

