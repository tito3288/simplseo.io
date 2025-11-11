import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";
import {
  logTrainingEvent,
  summarizeSeoContext,
} from "../../../lib/trainingLogger";
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
  const focusKeywordsString = focusKeywordList.join(", ");
  const focusKeywordCacheKey = focusKeywordList.length
    ? `${pageUrl}::${focusKeywordList
        .map((kw) => kw.toLowerCase())
        .join("||")}`
    : pageUrl;

  // 🔁 Use admin.firestore() syntax
  const docRef = db
    .collection("seoMetaDescriptions")
    .doc(encodeURIComponent(focusKeywordCacheKey));
  const cached = await docRef.get();

  if (cached.exists) {
    return NextResponse.json({ description: cached.data().description });
  }

  const prompt = `
You are an SEO expert. Suggest a compelling meta description for the following page.

Page: ${pageUrl}
Business Location: ${onboarding.businessLocation}
Business Type: ${onboarding.businessType}
Focus Keywords: ${focusKeywordsString || "N/A"}
Context: ${JSON.stringify(context)}

The meta description should:
- Be around 150 characters.
- Highlight the page’s purpose or benefit.
- Include a strong call-to-action if possible.
- Naturally incorporate the provided focus keywords when available.
Only return the meta description — no quotes or explanations.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100,
  });

  const description = response.choices[0].message.content.trim();

  const createdAt = new Date().toISOString();

  await docRef.set({
    description,
    createdAt,
    focusKeywords: focusKeywordList,
  });

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
