import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { keywords, businessName, businessType } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "No keywords provided" }, { status: 400 });
    }

    if (!businessName) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    // Limit keywords to prevent API overload
    const keywordsToProcess = keywords.slice(0, 500);
    console.log(`🔍 AI Brand Filtering: ${keywordsToProcess.length} keywords for business "${businessName}" (limited from ${keywords.length})`);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OpenAI API key not found");
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Create a prompt for OpenAI to identify branded vs non-branded keywords
    const prompt = `You are an SEO expert analyzing keywords for a ${businessType || 'business'} called "${businessName}".

Your task: Classify each keyword as either "BRANDED" or "GENERIC".

BRANDED keywords are:
- EXACT variations of the business name "${businessName}" (e.g., "drive n shine", "drive & shine", "driveshine", "drive and shine")
- Keywords that contain the FULL business name "${businessName}" or clear variations
- Keywords that are clearly about this specific business

GENERIC keywords are:
- Service-based terms (e.g., "car wash near me", "auto detailing", "oil change")
- Location-based terms (e.g., "car wash lima ohio", "car wash fort wayne") 
- Industry terms that could apply to any business in the same industry
- Keywords that DON'T contain the business name "${businessName}"

IMPORTANT: 
- Only mark as BRANDED if the keyword clearly contains "${businessName}" or its variations
- If a keyword is just about the service or location without the business name, mark it as GENERIC
- You MUST return BOTH "branded" and "generic" arrays - even if one is empty

Return ONLY a JSON object with this exact format:
{
  "branded": ["keyword1", "keyword2"],
  "generic": ["keyword3", "keyword4"]
}

Keywords to classify:
${keywordsToProcess.map(kw => `"${kw.keyword}"`).join(', ')}

Remember: Be balanced - only mark as branded if it clearly contains the business name.`;

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
            content: 'You are an expert SEO consultant who accurately classifies keywords as branded or generic. Always return valid JSON with "branded" and "generic" arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1 // Low temperature for consistent results
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content?.trim();
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    // Clean and parse JSON response
    let cleanedResponse = aiResponse
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    console.log('🔍 Raw AI Response length:', aiResponse.length);
    console.log('🔍 Cleaned AI Response length:', cleanedResponse.length);
    
    // Try to fix common JSON issues
    try {
      // Look for the JSON object boundaries
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      // Try to fix unterminated strings by finding the last complete entry
      if (cleanedResponse.includes('"') && !cleanedResponse.endsWith('}')) {
        // Find the last complete keyword entry
        const lastCompleteEntry = cleanedResponse.lastIndexOf('",');
        if (lastCompleteEntry !== -1) {
          cleanedResponse = cleanedResponse.substring(0, lastCompleteEntry + 1) + ']}';
        }
      }
      
      console.log('🔍 Final cleaned response:', cleanedResponse.substring(0, 200) + '...');
      
      const classification = JSON.parse(cleanedResponse);
      
      if (!classification.branded || !classification.generic) {
        console.error('❌ Invalid AI response format:', classification);
        console.log('🔄 Using fallback parsing due to missing generic array...');
        
        // Use fallback parsing when AI response is incomplete
        const businessNameLower = businessName.toLowerCase();
        const brandedKeywords = [];
        const genericKeywords = [];
        
        keywordsToProcess.forEach(kw => {
          const keywordLower = kw.keyword.toLowerCase();
          // Only mark as branded if it clearly contains the business name
          const isBranded = keywordLower.includes(businessNameLower) || 
                           keywordLower.includes(businessNameLower.replace(/\s+/g, '')) ||
                           keywordLower.includes(businessNameLower.replace(/\s+/g, ' n ')) ||
                           keywordLower.includes(businessNameLower.replace(/\s+/g, ' & '));
          
          if (isBranded) {
            brandedKeywords.push(kw.keyword);
          } else {
            genericKeywords.push(kw.keyword);
          }
        });
        
        console.log(`🔄 Fallback due to incomplete AI response: ${brandedKeywords.length} branded, ${genericKeywords.length} generic`);
        
        // Filter the processed keywords based on fallback classification
        const brandedKeywordsFiltered = keywordsToProcess.filter(kw => 
          brandedKeywords.includes(kw.keyword)
        );
        
        const genericKeywordsFiltered = keywordsToProcess.filter(kw => 
          genericKeywords.includes(kw.keyword)
        );
        
        return NextResponse.json({
          success: true,
          branded: brandedKeywordsFiltered,
          generic: genericKeywordsFiltered,
          brandedCount: brandedKeywordsFiltered.length,
          genericCount: genericKeywordsFiltered.length,
          totalProcessed: keywordsToProcess.length,
          totalReceived: keywords.length,
          limited: keywords.length > 500,
          fallback: true,
          reason: 'incomplete_ai_response'
        });
      }
      
      // If we get here, the JSON parsing was successful and complete
      console.log(`✅ AI Classification: ${classification.branded.length} branded, ${classification.generic.length} generic`);
      console.log('🔍 Branded keywords:', classification.branded.slice(0, 10));
      console.log('🔍 Generic keywords:', classification.generic.slice(0, 10));
      
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.error('🔍 Problematic response:', cleanedResponse.substring(0, 500));
      
      // Fallback: try to extract keywords manually
      const brandedKeywords = [];
      const genericKeywords = [];
      
      // Look for keywords in the response text
      const keywordMatches = cleanedResponse.match(/"([^"]+)"/g);
      if (keywordMatches) {
        keywordMatches.forEach(match => {
          const keyword = match.replace(/"/g, '');
          // More balanced heuristic: only mark as branded if it clearly contains the business name
          const businessNameLower = businessName.toLowerCase();
          const keywordLower = keyword.toLowerCase();
          
          // Check for exact business name or clear variations
          const isBranded = keywordLower.includes(businessNameLower) || 
                           keywordLower.includes(businessNameLower.replace(/\s+/g, '')) ||
                           keywordLower.includes(businessNameLower.replace(/\s+/g, ' n ')) ||
                           keywordLower.includes(businessNameLower.replace(/\s+/g, ' & '));
          
          if (isBranded) {
            brandedKeywords.push(keyword);
          } else {
            genericKeywords.push(keyword);
          }
        });
      }
      
      console.log(`🔄 Fallback parsing: ${brandedKeywords.length} branded, ${genericKeywords.length} generic`);
      
      // If we have no generic keywords, use a more lenient approach
      if (genericKeywords.length === 0) {
        console.log('🔄 No generic keywords found, using lenient filtering...');
        const businessNameLower = businessName.toLowerCase();
        
        keywordsToProcess.forEach(kw => {
          const keywordLower = kw.keyword.toLowerCase();
          // Only mark as branded if it clearly contains the business name
          const isBranded = keywordLower.includes(businessNameLower) || 
                           keywordLower.includes(businessNameLower.replace(/\s+/g, ''));
          
          if (isBranded) {
            brandedKeywords.push(kw.keyword);
          } else {
            genericKeywords.push(kw.keyword);
          }
        });
      }
      
      // Filter the processed keywords based on fallback classification
      const brandedKeywordsFiltered = keywordsToProcess.filter(kw => 
        brandedKeywords.includes(kw.keyword)
      );
      
      const genericKeywordsFiltered = keywordsToProcess.filter(kw => 
        genericKeywords.includes(kw.keyword)
      );
      
      return NextResponse.json({
        success: true,
        branded: brandedKeywordsFiltered,
        generic: genericKeywordsFiltered,
        brandedCount: brandedKeywordsFiltered.length,
        genericCount: genericKeywordsFiltered.length,
        totalProcessed: keywordsToProcess.length,
        totalReceived: keywords.length,
        limited: keywords.length > 500,
        fallback: true
      });
    }

    // If we get here, the JSON parsing was successful
    const classification = JSON.parse(cleanedResponse);
    
    console.log(`✅ AI Classification: ${classification.branded.length} branded, ${classification.generic.length} generic`);
    console.log('🔍 Branded keywords:', classification.branded.slice(0, 10));
    console.log('🔍 Generic keywords:', classification.generic.slice(0, 10));

    // Filter the processed keywords based on AI classification
    const brandedKeywords = keywordsToProcess.filter(kw => 
      classification.branded.includes(kw.keyword)
    );
    
    const genericKeywords = keywordsToProcess.filter(kw => 
      classification.generic.includes(kw.keyword)
    );

    return NextResponse.json({
      success: true,
      branded: brandedKeywords,
      generic: genericKeywords,
      brandedCount: brandedKeywords.length,
      genericCount: genericKeywords.length,
      totalProcessed: keywordsToProcess.length,
      totalReceived: keywords.length,
      limited: keywords.length > 500
    });

  } catch (error) {
    console.error("❌ Error in brand filtering API:", error);
    return NextResponse.json({ 
      error: "Failed to filter branded keywords",
      details: error.message 
    }, { status: 500 });
  }
}
