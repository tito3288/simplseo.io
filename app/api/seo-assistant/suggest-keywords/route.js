"use server";

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

/**
 * Normalize page URL for consistent searching
 * Removes trailing slashes (except for root) and normalizes the URL
 */
function normalizePageUrl(url) {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    // Remove trailing slash except for root path
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '') || '/';
    return urlObj.toString();
  } catch {
    // Fallback: just remove trailing slash
    return url.replace(/\/$/, '') || url;
  }
}

export async function POST(request) {
  try {
    const { pageUrl, userId, businessType = "", businessLocation = "" } = await request.json();

    if (!pageUrl || !userId) {
      return NextResponse.json(
        { error: "pageUrl and userId are required" },
        { status: 400 }
      );
    }

    console.log(`🤖 Generating AI keyword suggestions for: ${pageUrl}`);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "AI service unavailable" },
        { status: 500 }
      );
    }

    // Normalize the page URL (remove trailing slashes, etc.)
    const normalizedPageUrl = normalizePageUrl(pageUrl);
    console.log(`🔧 Normalized URL: ${normalizedPageUrl} (original: ${pageUrl})`);

    // Fetch page content from pageContentCache
    let pageContent = "";
    let pageTitle = "";
    let headings = [];

    try {
      // Try NEW structure first: pageContentCache/{userId}/pages/{pageUrl}
      // Try both normalized and original URL
      const encodedUrl = encodeURIComponent(normalizedPageUrl);
      const encodedOriginalUrl = encodeURIComponent(pageUrl);
      const newDocRef = db
        .collection("pageContentCache")
        .doc(userId)
        .collection("pages")
        .doc(encodedUrl);
      
      const newDoc = await newDocRef.get();
      
      if (newDoc.exists) {
        const data = newDoc.data();
        pageContent = data.textContent || data.content || data.text || "";
        pageTitle = data.title || data.metaTitle || "";
        headings = Array.isArray(data.headings) ? data.headings : [];
        console.log(`✅ Found page content in new structure (normalized)`);
        console.log(`📄 Content length: ${pageContent.length}, Title: ${pageTitle || "(none)"}, Headings: ${headings.length}`);
      } else if (encodedUrl !== encodedOriginalUrl) {
        // Try with original URL encoding if different
        const originalDocRef = db
          .collection("pageContentCache")
          .doc(userId)
          .collection("pages")
          .doc(encodedOriginalUrl);
        const originalDoc = await originalDocRef.get();
        
        if (originalDoc.exists) {
          const data = originalDoc.data();
          pageContent = data.textContent || data.content || data.text || "";
          pageTitle = data.title || data.metaTitle || "";
          headings = Array.isArray(data.headings) ? data.headings : [];
          console.log(`✅ Found page content in new structure (original URL)`);
          console.log(`📄 Content length: ${pageContent.length}, Title: ${pageTitle || "(none)"}, Headings: ${headings.length}`);
        }
      }
      
      // If still not found, try OLD structure
      if (!pageContent && pageTitle === "" && headings.length === 0) {
        // Fallback to OLD structure: pageContentCache/{userId}_{pageUrl}
        // Try both normalized and original
        const oldKeyNormalized = `${userId}_${encodedUrl}`;
        const oldKeyOriginal = `${userId}_${encodedOriginalUrl}`;
        
        const oldDocRef = db.collection("pageContentCache").doc(oldKeyNormalized);
        const oldDoc = await oldDocRef.get();
        
        if (oldDoc.exists) {
          const data = oldDoc.data();
          console.log(`📋 Available fields in document:`, Object.keys(data));
          pageContent = data.textContent || data.content || data.text || "";
          pageTitle = data.title || data.metaTitle || "";
          headings = Array.isArray(data.headings) ? data.headings : [];
          console.log(`✅ Found page content in old structure (normalized)`);
          console.log(`📄 Content length: ${pageContent.length}, Title: ${pageTitle || "(none)"}, Headings: ${headings.length}`);
        } else if (oldKeyNormalized !== oldKeyOriginal) {
          // Try with original URL encoding
          const oldDocRefOriginal = db.collection("pageContentCache").doc(oldKeyOriginal);
          const oldDocOriginal = await oldDocRefOriginal.get();
          
          if (oldDocOriginal.exists) {
            const data = oldDocOriginal.data();
            console.log(`📋 Available fields in document:`, Object.keys(data));
            pageContent = data.textContent || data.content || data.text || "";
            pageTitle = data.title || data.metaTitle || "";
            headings = Array.isArray(data.headings) ? data.headings : [];
            console.log(`✅ Found page content in old structure (original URL)`);
            console.log(`📄 Content length: ${pageContent.length}, Title: ${pageTitle || "(none)"}, Headings: ${headings.length}`);
          }
        }
      }
      
      // If still not found, try query fallback with multiple URL variations
      if (!pageContent && pageTitle === "" && headings.length === 0) {
        console.log(`⚠️ Page content not found in either structure for: ${pageUrl}`);
        console.log(`🔍 Searched for userId: ${userId}, normalized: ${normalizedPageUrl}, original: ${pageUrl}`);
        
        // FALLBACK: Query by pageUrl field (try both normalized and original, with/without trailing slash)
        try {
          console.log(`🔍 Trying query fallback by pageUrl field...`);
          
          // Create array of URL variations to try
          const urlVariations = [
            normalizedPageUrl,
            pageUrl,
            normalizedPageUrl.endsWith('/') ? normalizedPageUrl.slice(0, -1) : `${normalizedPageUrl}/`,
            pageUrl.endsWith('/') ? pageUrl.slice(0, -1) : `${pageUrl}/`,
          ];
          // Remove duplicates
          const uniqueVariations = [...new Set(urlVariations)];
          
          // Try querying in NEW structure with each variation
          for (const urlVar of uniqueVariations) {
            const newQuerySnapshot = await db
              .collection("pageContentCache")
              .doc(userId)
              .collection("pages")
              .where("pageUrl", "==", urlVar)
              .limit(1)
              .get();
            
            if (!newQuerySnapshot.empty) {
              const doc = newQuerySnapshot.docs[0];
              const data = doc.data();
              pageContent = data.textContent || data.content || data.text || "";
              pageTitle = data.title || data.metaTitle || "";
              headings = Array.isArray(data.headings) ? data.headings : [];
              console.log(`✅ Found page content via query (new structure) with URL: ${urlVar}`);
              console.log(`📄 Content length: ${pageContent.length}, Title: ${pageTitle || "(none)"}, Headings: ${headings.length}`);
              break;
            }
          }
          
          // If still not found, try OLD structure with each variation
          if (!pageContent && pageTitle === "" && headings.length === 0) {
            for (const urlVar of uniqueVariations) {
              const oldQuerySnapshot = await db
                .collection("pageContentCache")
                .where("userId", "==", userId)
                .where("pageUrl", "==", urlVar)
                .limit(1)
                .get();
              
              if (!oldQuerySnapshot.empty) {
                const doc = oldQuerySnapshot.docs[0];
                const data = doc.data();
                console.log(`📋 Found via query - Available fields:`, Object.keys(data));
                pageContent = data.textContent || data.content || data.text || "";
                pageTitle = data.title || data.metaTitle || "";
                headings = Array.isArray(data.headings) ? data.headings : [];
                console.log(`✅ Found page content via query (old structure) with URL: ${urlVar}`);
                console.log(`📄 Content length: ${pageContent.length}, Title: ${pageTitle || "(none)"}, Headings: ${headings.length}`);
                break;
              }
            }
          }
          
          if (!pageContent && pageTitle === "" && headings.length === 0) {
            console.log(`❌ Page content not found even with query fallback (tried variations: ${uniqueVariations.join(', ')})`);
          }
        } catch (queryError) {
          console.error("Error querying by pageUrl:", queryError);
        }
      }
      
      // Check if we actually have meaningful content
      const hasContent = pageContent.trim().length > 50 || pageTitle.trim().length > 0 || headings.length > 0;
      
      if (!hasContent) {
        console.log(`⚠️ Page content is empty or too short. Content length: ${pageContent.length}`);
        // Don't return error yet - let AI try with URL and business info
      }
    } catch (error) {
      console.error("Error fetching page content:", error);
    }

    // Extract location from page content or use onboarding data
    let location = businessLocation || "";
    
    // Try to extract location from page content if not provided
    if (!location && pageContent) {
      const locationMatch = pageContent.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
      if (locationMatch) {
        // Common location patterns
        const commonLocations = ["Mexico City", "Los Angeles", "New York", "Chicago", "Austin", "San Francisco"];
        const foundLocation = locationMatch.find(loc => 
          commonLocations.some(cl => loc.includes(cl))
        );
        if (foundLocation) {
          location = foundLocation;
        }
      }
    }

    // Build the prompt with page content
    // Increased content preview to give AI more context for generating detailed explanations
    const contentPreview = pageContent.slice(0, 3000); // Limit content to avoid token limits
    const headingsText = headings.slice(0, 15).join(", "); // Use first 15 headings for better context
    
    // Check if we have meaningful content
    const hasContent = pageContent.trim().length > 50 || pageTitle.trim().length > 0 || headings.length > 0;
    
    const prompt = `Analyze this webpage and generate 3-5 SEO-focused keyword suggestions with confidence scores and detailed explanations.

Page URL: ${pageUrl}
Page Title: ${pageTitle || "(not available)"}
Headings: ${headingsText || "(not available)"}
Page Content: ${hasContent ? contentPreview : "(Content not available - generate keywords based on URL structure and business type)"}

Business Type: ${businessType || "not specified"}
Location: ${location || "extract from content if available"}

Requirements:
- Format: "service/product location" (e.g., "group tour mexico city", "custom tour mexico city")
- Include location if available in content or business data
- Make keywords specific and actionable
- Avoid brand names
- Focus on what customers would actually search for
- Return a JSON array of objects with: keyword (string), confidence (number 0-1), reason (string)
- ALWAYS return valid JSON, even if content is limited. Use the URL structure and business type/location to generate suggestions.

${hasContent ? '' : 'NOTE: Page content is not available. Generate keywords based on the URL path structure and business type/location provided. For example, if URL is "/my-work" and location is "South Bend", generate keywords like "web design portfolio south bend" or "work examples south bend".'}

IMPORTANT for the "reason" field:
- Reference specific elements from the page content (title, headings, content mentions) when available
- If content is not available, explain WHY based on URL structure and business type/location
- Explain WHY this keyword fits based on what you see
- Be specific about what supports this keyword
- Examples of good reasons:
  * "The page title, meta description, and content strongly emphasize [topic] in [location]"
  * "The URL path '/my-work' and business location suggest [service type] portfolio/work showcase in [location]"
  * "The content describes a [service type] experience of [location]"
  * "The content highlights [specific elements] which will be covered in the [service]"

CRITICAL: You MUST return a valid JSON array. Never return error messages or explanations outside the JSON array.

Example format: [
  {"keyword": "web design south bend", "confidence": 0.95, "reason": "The URL path '/my-work' and business location suggest web design services portfolio in South Bend."},
  {"keyword": "portfolio south bend", "confidence": 0.90, "reason": "The URL path indicates a portfolio/work showcase page for a business in South Bend."},
  {"keyword": "website examples south bend", "confidence": 0.85, "reason": "The page showcases work examples for a web design business in South Bend."}
]`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-turbo", // Complex analysis - GPT-4-turbo maintains quality at lower cost
        messages: [
          {
            role: "system",
            content:
              "You are an SEO expert. Analyze webpage content carefully and generate keyword suggestions with confidence scores and detailed explanations. For each keyword, provide a specific reason. ALWAYS return only valid JSON arrays of objects with keyword, confidence (0-1), and reason fields. Never return error messages or explanations outside the JSON format. If content is limited or unavailable, use the URL structure, business type, and location to generate relevant keyword suggestions. The reason should explain WHY the keyword fits based on available information.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000, // Increased to allow for longer, more detailed explanations
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate suggestions" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI service" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let suggestions = [];
    try {
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, "");
      cleanContent = cleanContent.replace(/```\s*/g, "");
      cleanContent = cleanContent.trim();

      const parsed = JSON.parse(cleanContent);

      // Handle both array of objects and array of strings
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .map((item) => {
            if (typeof item === "string") {
              // Fallback: convert string to object
              return {
                keyword: item.trim(),
                confidence: 0.8,
                reason: "AI-generated keyword suggestion based on page content",
              };
            } else if (item && typeof item === "object" && item.keyword) {
              return {
                keyword: item.keyword.trim(),
                confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.8,
                reason: item.reason || "AI-generated keyword suggestion based on page content",
              };
            }
            return null;
          })
          .filter(Boolean)
          .slice(0, 5); // Limit to 5 suggestions
      } else {
        throw new Error("Response is not an array");
      }

      if (suggestions.length === 0) {
        throw new Error("No valid suggestions found");
      }
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.error("Raw response:", content);

      // Check if AI returned an error message instead of JSON
      if (content.toLowerCase().includes("sorry") || 
          content.toLowerCase().includes("cannot") || 
          content.toLowerCase().includes("no content") ||
          content.toLowerCase().includes("no information") ||
          content.toLowerCase().includes("i'm sorry")) {
        console.log("⚠️ AI returned an error message instead of JSON");
        
        // Try to generate keywords based on URL structure as fallback
        const urlPath = new URL(pageUrl).pathname.toLowerCase();
        const pathParts = urlPath.split('/').filter(p => p.length > 0);
        const locationPart = location ? ` ${location.toLowerCase()}` : '';
        
        // Generate basic keywords from URL structure
        suggestions = [];
        if (pathParts.length > 0) {
          const mainPath = pathParts[pathParts.length - 1];
          if (businessType) {
            suggestions.push({
              keyword: `${businessType.toLowerCase()}${locationPart}`,
              confidence: 0.75,
              reason: `Generated based on business type and location`,
            });
          }
          if (mainPath !== 'home' && mainPath !== 'index') {
            suggestions.push({
              keyword: `${mainPath.replace(/-/g, ' ')}${locationPart}`,
              confidence: 0.70,
              reason: `Generated based on URL path structure`,
            });
          }
        }
        
        if (suggestions.length === 0) {
          return NextResponse.json(
            { 
              error: "No page content available for analysis. Please crawl this page first to generate keyword suggestions.",
              suggestions: []
            },
            { status: 400 }
          );
        }
      } else {
        // Fallback: try to extract keywords from text response
        const lines = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith("```"));

        suggestions = lines
          .filter((line) => line.length > 5 && line.length < 100)
          .slice(0, 5)
          .map((keyword) => ({
            keyword: keyword.trim(),
            confidence: 0.75,
            reason: "AI-generated keyword suggestion based on page content",
          }));

        if (suggestions.length === 0) {
          return NextResponse.json(
            { 
              error: "No page content available. Please crawl this page first to generate keyword suggestions.",
              suggestions: []
            },
            { status: 400 }
          );
        }
      }
    }

    console.log(`✅ Generated ${suggestions.length} AI keyword suggestions`);

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("Failed to generate AI keyword suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

