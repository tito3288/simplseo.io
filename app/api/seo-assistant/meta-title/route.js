import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  const { pageUrl, onboarding, context } = await req.json();

  const docRef = db
    .collection("seoMetaTitles")
    .doc(encodeURIComponent(pageUrl));
  const cached = await docRef.get();

  if (cached.exists) {
    return NextResponse.json({ title: cached.data().title });
  }

  const prompt = `
You are an SEO expert.

Suggest a **short, clear, keyword-optimized meta title** for the following page:

---
Page URL: ${pageUrl}
Business Location: ${onboarding.businessLocation}
Business Type: ${onboarding.businessType}
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
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 60,
  });

  const aiTitle = response.choices[0].message.content.trim();

  await docRef.set({
    title: aiTitle,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ title: aiTitle });
}
