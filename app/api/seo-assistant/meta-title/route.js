import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";
import {
  logTrainingEvent,
  summarizeSeoContext,
} from "../../../lib/trainingLogger";

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

  const docRef = db
    .collection("seoMetaTitles")
    .doc(encodeURIComponent(focusKeywordCacheKey));
  const cached = await docRef.get();

  if (cached.exists) {
    return NextResponse.json({ title: cached.data().title });
  }

  const focusKeywordsString = focusKeywordList.join(", ");

  const prompt = `
You are an SEO expert.

Suggest a **short, clear, keyword-optimized meta title** for the following page:

---
Page URL: ${pageUrl}
Business Location: ${onboarding?.businessLocation || "N/A"}
Business Type: ${onboarding?.businessType || "N/A"}
Focus Keywords: ${focusKeywordsString || "N/A"}
Context (Impressions, CTR, etc): ${JSON.stringify(context)}
---

**Rules:**
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

  await docRef.set({
    title: aiTitle,
    createdAt,
    focusKeywords: focusKeywordList,
  });

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
