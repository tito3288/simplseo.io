import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";
import {
  logTrainingEvent,
  summarizeSeoContext,
} from "../../../lib/trainingLogger";
import { getPlaybookStrategies } from "../../../lib/playbookHelpers";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  let {
    pageUrl,
    onboarding,
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

  let focusKeywordList = normalizeFocusKeywordList(focusKeywords);

  // 🧠 Fallback if onboarding was not passed in
  if (!onboarding && userId) {
    try {
      const snap = await db.collection("onboarding").doc(userId).get();
      if (snap.exists) {
        onboarding = snap.data();
      }
    } catch (err) {
      console.error("Failed to load onboarding:", err);
    }
  }

  const resolveBaseUrl = () => {
    const explicitBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    if (explicitBase) return explicitBase;
    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (vercelUrl) {
      const prefix = vercelUrl.startsWith("http") ? "" : "https://";
      return `${prefix}${vercelUrl}`;
    }
    return null;
  };

  if (!focusKeywordList.length) {
    const baseUrl = resolveBaseUrl();
    if (baseUrl) {
      try {
        const kwRes = await fetch(new URL("/api/extract-keywords", baseUrl).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageUrl }),
        });

        const kwData = await kwRes.json();
        focusKeywordList = normalizeFocusKeywordList(kwData.keywords);
      } catch (err) {
        // Fallback keyword extraction failed - continue without keywords
      }
    }
  }

  const focusKeywordCacheKey = focusKeywordList.length
    ? `${pageUrl}::${focusKeywordList
        .map((kw) => kw.toLowerCase())
        .join("||")}`
    : pageUrl;

  // Check cache using backward-compatible helper
  const { getCachedMetaTitle } = await import("../../../lib/firestoreMigrationHelpers");
  const cached = await getCachedMetaTitle(userId, focusKeywordCacheKey);

  if (cached.success && cached.data?.title) {
    return NextResponse.json({ title: cached.data.title });
  }

  const focusKeywordsString = focusKeywordList.join(", ");

  // 🧠 Try to get playbook strategies (returns [] if feature flag disabled)
  let playbookStrategies = [];
  if (onboarding?.businessType) {
    try {
      playbookStrategies = await getPlaybookStrategies({
        businessType: onboarding.businessType,
        businessLocation: onboarding.businessLocation,
        strategyType: "meta_title_optimization",
        limit: 5,
      });
    } catch (error) {
      console.error("Error fetching playbook strategies:", error);
      // Continue without playbook data - fallback to OpenAI only
    }
  }

  // Build prompt with or without playbook examples
  let prompt = `
You are an SEO expert.

Suggest a **short, clear, keyword-optimized meta title** for the following page:

---
Page URL: ${pageUrl}
Business Location: ${onboarding?.businessLocation || "N/A"}
Business Type: ${onboarding?.businessType || "N/A"}
Focus Keywords: ${focusKeywordsString || "N/A"}
Context (Impressions, CTR, etc): ${JSON.stringify(context)}
---`;

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
      prompt += `${index + 1}. "${strategy.title}"${improvementText}\n`;
    });
    prompt += `\nUse these successful examples as inspiration, but create a unique title tailored to this specific page.\n`;
  }

  prompt += `\n**Rules:**
- Stay under 60 characters whenever possible.
- Keep the title visually short (target under ~580px width).
- Prefer short, powerful words (e.g., "SEO", "Marketing", "Web Design" vs. long words like "Optimization", "Solutions").
- Focus on clarity and primary keywords.
- Use separators like "|" or "-" if needed, but keep them short.
- Avoid repeating words or making the title feel too long.
- **Only** output the meta title — no quotes, no extra text.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 60,
  });

  const aiTitle = response.choices[0].message.content.trim();

  const createdAt = new Date().toISOString();

  // Save using backward-compatible helper (writes to both structures)
  if (userId) {
    const { saveMetaTitle } = await import("../../../lib/firestoreMigrationHelpers");
    await saveMetaTitle(userId, focusKeywordCacheKey, {
      title: aiTitle,
      createdAt,
      focusKeywords: focusKeywordList,
      pageUrl,
    });
  }

  await logTrainingEvent({
    userId,
    eventType: "meta_title_generated",
    businessType: onboarding?.businessType,
    businessLocation: onboarding?.businessLocation,
    payload: {
      pageUrl,
      focusKeywords: focusKeywordList,
      context: await summarizeSeoContext(context),
      aiTitle,
      createdAt,
    },
  });

  return NextResponse.json({ title: aiTitle });
}
