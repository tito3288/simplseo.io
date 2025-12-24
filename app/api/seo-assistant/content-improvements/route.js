export async function POST(req) {
  try {
    const { pageUrl, auditResult, pageContent, title, metaDescription, headings } = await req.json();

    if (!pageUrl || !auditResult) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`🤖 Generating AI content improvements for: ${pageUrl}`);

    // Prepare the prompt for OpenAI
    const prompt = createImprovementPrompt(pageUrl, auditResult, pageContent, title, metaDescription, headings);

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-turbo", // Complex analysis - GPT-4-turbo maintains quality at lower cost
        messages: [
          {
            role: "system",
            content: "You are an expert SEO content strategist. Provide specific, actionable suggestions to improve content quality, readability, and SEO performance. Focus on practical, implementable advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("OpenAI API error:", error);
      throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0].message.content;

    console.log("🔍 Raw AI Response:", aiResponse);

    // Parse the AI response into structured suggestions
    const suggestions = parseAiSuggestions(aiResponse, auditResult);
    
    console.log("🔍 Parsed Suggestions:", JSON.stringify(suggestions, null, 2));

    console.log(`✅ Generated ${suggestions.length} AI suggestions for ${pageUrl}`);

    return Response.json({
      pageUrl,
      suggestions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Content improvements error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function createImprovementPrompt(pageUrl, auditResult, pageContent, title, metaDescription, headings) {
  const { contentScore, analysis, suggestions } = auditResult;
  
  // Add safety checks for undefined values
  const safePageContent = pageContent || "";
  const safeTitle = title || "";
  const safeMetaDescription = metaDescription || "";
  const safeHeadings = headings || [];
  
  // Normalize headings to handle both old (string) and new (object) formats
  const normalizedHeadings = safeHeadings.map(h => {
    if (typeof h === 'string') {
      return { tag: 'h2', text: h };  // Old format - assume H2
    }
    return h;
  });
  
  return `You are an expert SEO content strategist. Analyze this specific page content and provide actionable improvements that users can copy-paste directly into their website.

PAGE INFORMATION:
- URL: ${pageUrl}
- Current Title: "${safeTitle}"
- Current Meta Description: "${safeMetaDescription}"
- Content Length: ${safePageContent.length} characters

CURRENT HEADINGS:
${normalizedHeadings.map(h => `- ${(h.tag || 'h2').toUpperCase()}: "${h.text || 'Unknown'}"`).join('\n')}

CONTENT AUDIT RESULTS:
- Overall Score: ${contentScore}/100
- Content Length: ${analysis.contentLength.score}/100 (${analysis.contentLength.value} characters)
- Readability: ${analysis.readability.score}/100 (${analysis.readability.value.toFixed(1)} Flesch-Kincaid)
- Heading Structure: ${analysis.headingStructure.score}/100 (${analysis.headingStructure.value.totalHeadings} headings)
- Title Optimization: ${analysis.titleOptimization.score}/100 (${analysis.titleOptimization.value.length} characters)
- Meta Description: ${analysis.metaDescription.score}/100 (${analysis.metaDescription.value.length} characters)
- Content Structure: ${analysis.contentStructure.score}/100 (${analysis.contentStructure.value.paragraphCount} paragraphs)

FULL PAGE CONTENT:
${safePageContent}

TASK: Based on the actual content above, provide specific, copy-paste ready improvements. For each suggestion:

1. Identify the EXACT problem in the current content
2. Provide the EXACT text that should be changed/added
3. Show BEFORE and AFTER examples using actual content from the page
4. Give specific implementation steps

Focus on:
- Rewriting complex sentences to be simpler
- Adding missing headings with specific text
- Improving the actual title and meta description
- Adding specific content sections
- Restructuring existing paragraphs

Format your response as JSON:
{
  "suggestions": [
    {
      "title": "Simplify Complex Sentences",
      "description": "Your content contains several complex sentences that reduce readability.",
      "aiRecommendation": "Rewrite these specific sentences to be clearer and more engaging.",
      "examples": [
        "BEFORE: 'Our comprehensive SEO optimization services ensure growth for your business'",
        "AFTER: 'We provide SEO services that help your business grow'",
        "BEFORE: 'Utilize our professional web development solutions'",
        "AFTER: 'Use our web development services'"
      ],
      "beforeAfter": [
        {
          "before": "EXACT complex sentence from the page",
          "after": "Simplified version that's easier to read"
        }
      ],
      "priority": "high"
    },
    {
      "title": "Add Missing Headings",
      "description": "Your content lacks proper heading structure for better organization.",
      "aiRecommendation": "Add these specific headings to organize your content better.",
      "examples": [
        "Add H1: 'South Bend Web Developer Services'",
        "Add H2: 'Our Web Development Process'",
        "Add H3: 'Discovery and Planning Phase'"
      ],
      "beforeAfter": [
        {
          "before": "Current paragraph without heading",
          "after": "H2: Specific Heading Title\n[Current paragraph content]"
        }
      ],
      "priority": "high"
    }
  ]
}`;
}

function parseAiSuggestions(aiResponse, auditResult) {
  try {
    // Try multiple approaches to extract JSON
    let jsonString = null;
    
    // Approach 1: Look for JSON between curly braces
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
    
    // Approach 2: Look for JSON after "suggestions" keyword
    if (!jsonString) {
      const suggestionsMatch = aiResponse.match(/suggestions[\s\S]*\}/);
      if (suggestionsMatch) {
        jsonString = '{' + suggestionsMatch[0];
      }
    }
    
    if (jsonString) {
      console.log("🔍 Attempting to parse JSON:", jsonString.substring(0, 500) + "...");
      
      // Try to parse as-is first
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          return cleanSuggestions(parsed.suggestions);
        }
      } catch (firstError) {
        console.log("🔍 First parse attempt failed, trying to clean JSON...");
        
        // Try cleaning the JSON
        try {
          // Remove problematic characters that break JSON
          const cleanedJson = jsonString
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/\n/g, ' ')  // Replace newlines with spaces
            .replace(/\r/g, ' ')  // Replace carriage returns with spaces
            .replace(/\t/g, ' ')  // Replace tabs with spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
          
          console.log("🔍 Cleaned JSON:", cleanedJson.substring(0, 500) + "...");
          
          const parsed = JSON.parse(cleanedJson);
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            return cleanSuggestions(parsed.suggestions);
          }
        } catch (secondError) {
          console.error("🔍 Second parse attempt also failed:", secondError.message);
        }
      }
    }
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", error);
    console.error("Raw response that failed:", aiResponse.substring(0, 1000));
  }
  
  // Helper function to clean suggestions
  function cleanSuggestions(suggestions) {
    return suggestions.map(suggestion => ({
      ...suggestion,
      examples: suggestion.examples ? suggestion.examples.map(example => {
        if (typeof example === 'string') {
          // Remove any curly braces that might be in the string
          return example.replace(/[{}]/g, '');
        }
        return JSON.stringify(example).replace(/[{}]/g, '');
      }) : [],
      beforeAfter: suggestion.beforeAfter ? suggestion.beforeAfter.map(change => ({
        before: typeof change.before === 'string' ? 
          change.before.replace(/[{}]/g, '') : 
          JSON.stringify(change.before).replace(/[{}]/g, ''),
        after: typeof change.after === 'string' ? 
          change.after.replace(/[{}]/g, '') : 
          JSON.stringify(change.after).replace(/[{}]/g, '')
      })) : []
    }));
  }

  // Fallback: create suggestions based on audit results
  const fallbackSuggestions = [];
  
  if (auditResult.analysis.contentLength.score < 80) {
    fallbackSuggestions.push({
      title: "Expand Content",
      description: `Your content is ${auditResult.analysis.contentLength.value} characters. Aim for at least 1,000 words for better SEO performance.`,
      aiRecommendation: "Add more detailed sections, examples, case studies, and comprehensive information about your services. Include FAQ sections and detailed service descriptions.",
      examples: [
        "Add a 'Why Choose Us' section with 3-4 key benefits",
        "Include detailed service descriptions with pricing information",
        "Add customer testimonials and case studies"
      ],
      priority: "high"
    });
  }

  if (auditResult.analysis.headingStructure.score < 80) {
    fallbackSuggestions.push({
      title: "Optimize Heading Structure",
      description: "Improve your heading hierarchy for better content organization and SEO.",
      aiRecommendation: "Create a clear heading hierarchy: H1 for main topic, H2 for major sections, H3 for subsections. This helps both users and search engines understand your content structure.",
      examples: [
        "H1: South Bend Web Developer Services",
        "H2: Our Web Development Process",
        "H3: Discovery and Planning Phase"
      ],
      priority: "high"
    });
  }

  if (auditResult.analysis.readability.score < 80) {
    fallbackSuggestions.push({
      title: "Improve Readability",
      description: `Your readability score is ${auditResult.analysis.readability.value.toFixed(1)}. Aim for 60+ for better user engagement.`,
      aiRecommendation: "Use shorter sentences, simpler words, and break up long paragraphs. Add bullet points and numbered lists to make content easier to scan.",
      examples: [
        "Break long paragraphs into shorter ones (2-3 sentences)",
        "Use bullet points for lists and key features",
        "Replace complex words with simpler alternatives"
      ],
      priority: "medium"
    });
  }

  return fallbackSuggestions;
}
