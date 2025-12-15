import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";
import {
  logTrainingEvent,
  summarizeSeoContext,
} from "../../../lib/trainingLogger";
import { getPlaybookStrategies } from "../../../lib/playbookHelpers";
// import { doc, getDoc, setDoc } from "firebase/firestore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  const {
    pageUrl,
    onboarding = {},
    context = {},
    focusKeywords = "",
    userId,
  } = await req.json();

  const normalizeFocusKeywordList = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((kw) => (typeof kw === "string" ? kw.trim() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((kw) => kw.trim())
        .filter(Boolean);
    }
    return [];
  };

  const focusKeywordList = normalizeFocusKeywordList(focusKeywords);
  
  // DEBUG: Log what we received
  console.log(`📥 [META DESC API] Received request for: ${pageUrl}`);
  console.log(`📥 [META DESC API] focusKeywords received:`, focusKeywords);
  console.log(`📥 [META DESC API] focusKeywordList (normalized):`, focusKeywordList);
  console.log(`📥 [META DESC API] userId:`, userId);
  console.log(`📥 [META DESC API] context.source:`, context?.source);
  console.log(`📥 [META DESC API] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));

  // 🚨 GUARD: Prevent creating documents with empty focusKeywords
  if (!focusKeywordList || focusKeywordList.length === 0) {
    console.error(`❌ [META DESC API] BLOCKED: Empty focusKeywords for ${pageUrl}`);
    console.error(`❌ [META DESC API] Request body:`, JSON.stringify({ pageUrl, focusKeywords, userId, context: context?.source }));
    return NextResponse.json(
      { 
        error: "focusKeywords is required. Please provide at least one focus keyword.",
        pageUrl 
      },
      { status: 400 }
    );
  }
  
  const focusKeywordsString = focusKeywordList.join(", ");
  const focusKeywordCacheKey = focusKeywordList.length
    ? `${pageUrl}::${focusKeywordList
        .map((kw) => kw.toLowerCase())
        .join("||")}`
    : pageUrl;

  // Check cache using backward-compatible helper
  const { getCachedMetaDescription } = await import("../../../lib/firestoreMigrationHelpers");
  const cached = await getCachedMetaDescription(userId, focusKeywordCacheKey);

  if (cached.success && cached.data?.description) {
    return NextResponse.json({ description: cached.data.description });
  }

  // 🧠 Try to get playbook strategies (returns [] if feature flag disabled)
  let playbookStrategies = [];
  if (onboarding?.businessType) {
    try {
      playbookStrategies = await getPlaybookStrategies({
        businessType: onboarding.businessType,
        businessLocation: onboarding.businessLocation,
        strategyType: "meta_description_optimization",
        limit: 5,
      });
    } catch (error) {
      console.error("Error fetching playbook strategies:", error);
      // Continue without playbook data - fallback to OpenAI only
    }
  }

  // Build prompt with or without playbook examples
  let prompt = `
You are an expert SEO copywriter who writes meta descriptions that get clicks.

Create a **compelling, action-driven meta description** for the following page:

---
Page URL: ${pageUrl}
Business Name: ${onboarding?.businessName || "N/A"}
Business Location: ${onboarding?.businessLocation || "N/A"}
Business Type: ${onboarding?.businessType || "N/A"}
Focus Keywords: ${focusKeywordsString || "N/A"}
Context: ${JSON.stringify(context)}
---

**CRITICAL:** If a Business Name is provided, use it EXACTLY as written — no modifications, abbreviations, or guesses.`;

  // Include playbook examples if available
  if (playbookStrategies.length > 0) {
    prompt += `\n\n**Successful Examples from Similar ${onboarding.businessType} Businesses:**\n`;
    playbookStrategies.forEach((strategy, index) => {
      const improvements = [];
      if (strategy.improvement?.ctrIncrease > 0) {
        improvements.push(`CTR +${strategy.improvement.ctrIncrease.toFixed(1)}%`);
      }
      if (strategy.improvement?.clicksIncrease > 0) {
        improvements.push(`Clicks +${strategy.improvement.clicksIncrease.toFixed(1)}%`);
      }
      if (strategy.improvement?.positionImprovement > 0) {
        improvements.push(`Position +${strategy.improvement.positionImprovement.toFixed(1)}`);
      }
      const improvementText = improvements.length > 0 ? ` (${improvements.join(", ")})` : "";
      prompt += `${index + 1}. "${strategy.description}"${improvementText}\n`;
    });
    prompt += `\nUse these successful examples as inspiration, but create a unique description tailored to this specific page.\n`;
  }

  prompt += `\n**WRITING GUIDELINES:**
- **Length:** Stay between 140-155 characters for optimal display in Google search results.
- **Structure:** Lead with a benefit or hook, include the focus keyword naturally, end with a clear call-to-action.
- **Tone:** Write like a human, not a robot. Be conversational and confident.
- **Avoid generic phrases:** Never use "elevate your online presence", "take your business to the next level", "solutions for your needs", or similar clichés.
- **Be specific:** Mention concrete benefits, outcomes, or differentiators (e.g., "free consultation", "same-day response", "10+ years experience").
- **Vary your approach:** Each description should feel unique and tailored to this specific page — not templated.
- **Call-to-action:** Use action words like "Get", "Discover", "See", "Learn", "Contact" — but vary them across pages.
- **CRITICAL:** Business name must appear EXACTLY as provided.
- **Output:** Only the meta description — no quotes, no explanations, no extra text.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100,
  });

  const description = response.choices[0].message.content.trim();

  const createdAt = new Date().toISOString();

  // Save using backward-compatible helper (writes to both structures)
  if (userId) {
    const { saveMetaDescription } = await import("../../../lib/firestoreMigrationHelpers");
    await saveMetaDescription(userId, focusKeywordCacheKey, {
      description,
      createdAt,
      focusKeywords: focusKeywordList,
      pageUrl,
    });
  }

  await logTrainingEvent({
    userId,
    eventType: "meta_description_generated",
    businessType: onboarding?.businessType,
    businessLocation: onboarding?.businessLocation,
    payload: {
      pageUrl,
      focusKeywords: focusKeywordList,
      context: await summarizeSeoContext(context),
      description,
      createdAt,
    },
  });

  return NextResponse.json({ description });
}
