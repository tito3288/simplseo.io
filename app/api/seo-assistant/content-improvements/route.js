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
        model: "gpt-4",
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

    // Parse the AI response into structured suggestions
    const suggestions = parseAiSuggestions(aiResponse, auditResult);

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
  
  return `Analyze this content audit and provide specific, actionable improvement suggestions.

PAGE INFORMATION:
- URL: ${pageUrl}
- Title: ${title}
- Meta Description: ${metaDescription}
- Content Length: ${pageContent.length} characters
- Headings: ${headings.map(h => h.tag + ': ' + h.text).join(', ')}

CONTENT AUDIT RESULTS:
- Overall Score: ${contentScore}/100
- Content Length: ${analysis.contentLength.score}/100 (${analysis.contentLength.value} characters)
- Readability: ${analysis.readability.score}/100 (${analysis.readability.value.toFixed(1)} Flesch-Kincaid)
- Heading Structure: ${analysis.headingStructure.score}/100 (${analysis.headingStructure.value.totalHeadings} headings)
- Title Optimization: ${analysis.titleOptimization.score}/100 (${analysis.titleOptimization.value.length} characters)
- Meta Description: ${analysis.metaDescription.score}/100 (${analysis.metaDescription.value.length} characters)
- Content Structure: ${analysis.contentStructure.score}/100 (${analysis.contentStructure.value.paragraphCount} paragraphs)

CURRENT ISSUES:
${suggestions.map(s => `- ${s.title}: ${s.description}`).join('\n')}

CONTENT PREVIEW (first 500 characters):
${pageContent.substring(0, 500)}...

Please provide 3-5 specific, actionable improvement suggestions. For each suggestion include:
1. A clear title
2. Detailed description of the problem
3. Specific AI recommendation on how to fix it
4. 2-3 concrete examples of what to add/change
5. Priority level (high/medium/low)

Format your response as JSON with this structure:
{
  "suggestions": [
    {
      "title": "Improve Heading Structure",
      "description": "Your page lacks proper heading hierarchy...",
      "aiRecommendation": "Add an H1 main heading and organize content with H2 and H3 subheadings...",
      "examples": [
        "H1: South Bend Web Developer Services",
        "H2: Custom Website Design",
        "H3: Responsive Design Features"
      ],
      "priority": "high"
    }
  ]
}`;
}

function parseAiSuggestions(aiResponse, auditResult) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions;
      }
    }
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", error);
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
