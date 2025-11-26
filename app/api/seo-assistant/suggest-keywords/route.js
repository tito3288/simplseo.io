"use server";

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

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

    // Fetch page content from pageContentCache
    let pageContent = "";
    let pageTitle = "";
    let headings = [];

    try {
      // Try NEW structure first: pageContentCache/{userId}/pages/{pageUrl}
      const newDocRef = db
        .collection("pageContentCache")
        .doc(userId)
        .collection("pages")
        .doc(encodeURIComponent(pageUrl));
      
      const newDoc = await newDocRef.get();
      
      if (newDoc.exists) {
        const data = newDoc.data();
        pageContent = data.textContent || data.content || data.text || "";
        pageTitle = data.title || data.metaTitle || "";
        headings = data.headings || [];
        console.log(`✅ Found page content in new structure`);
      } else {
        // Fallback to OLD structure: pageContentCache/{userId}_{pageUrl}
        const oldKey = `${userId}_${encodeURIComponent(pageUrl)}`;
        const oldDocRef = db.collection("pageContentCache").doc(oldKey);
        const oldDoc = await oldDocRef.get();
        
        if (oldDoc.exists) {
          const data = oldDoc.data();
          pageContent = data.textContent || data.content || data.text || "";
          pageTitle = data.title || data.metaTitle || "";
          headings = data.headings || [];
          console.log(`✅ Found page content in old structure`);
        }
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
    
    const prompt = `Analyze this webpage and generate 3-5 SEO-focused keyword suggestions with confidence scores and detailed explanations.

Page URL: ${pageUrl}
Page Title: ${pageTitle}
Headings: ${headingsText}
Page Content: ${contentPreview}

Business Type: ${businessType || "not specified"}
Location: ${location || "extract from content if available"}

Requirements:
- Format: "service/product location" (e.g., "group tour mexico city", "custom tour mexico city")
- Include location if available in content or business data
- Make keywords specific and actionable
- Avoid brand names
- Focus on what customers would actually search for
- Return a JSON array of objects with: keyword (string), confidence (number 0-1), reason (string)

IMPORTANT for the "reason" field:
- Reference specific elements from the page content (title, headings, content mentions)
- Explain WHY this keyword fits based on what you see in the page
- Be specific about what content supports this keyword
- Examples of good reasons:
  * "The page title, meta description, and content strongly emphasize [topic] in [location]"
  * "The content describes a [service type] experience of [location]"
  * "The content highlights [specific elements] which will be covered in the [service]"
  * "The page content mentions [specific items], indicating a [service aspect] element"
  * "Page content suggests [service focus], location is [location]"

Example format: [
  {"keyword": "centro histórico tour mexico city", "confidence": 0.95, "reason": "The page title, meta description, and content strongly emphasize the Centro Histórico tour in Mexico City."},
  {"keyword": "guided tour mexico city", "confidence": 0.90, "reason": "The content describes a guided tour experience of Centro Histórico in Mexico City."},
  {"keyword": "historical landmarks tour mexico city", "confidence": 0.85, "reason": "The content highlights the historical landmarks of Centro Histórico in Mexico City which will be covered in the tour."},
  {"keyword": "cultural tour mexico city", "confidence": 0.80, "reason": "The content suggests the tour gives an insight into the diverse cultures of Mexico City."},
  {"keyword": "food tour mexico city", "confidence": 0.75, "reason": "The page content mentions churros, tacos, and pastries, indicating a food tasting element of the tour."}
]`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an SEO expert. Analyze webpage content carefully and generate keyword suggestions with confidence scores and detailed explanations. For each keyword, provide a specific reason that references actual page elements (title, headings, content mentions). Return only valid JSON arrays of objects with keyword, confidence (0-1), and reason fields. The reason should explain WHY the keyword fits based on specific content you see on the page.",
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
          { error: "Failed to parse AI response" },
          { status: 500 }
        );
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

