import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  let {
    pageUrl,
    onboarding,
    context = {},
    focusKeywords = "",
    userId,
  } = await req.json();

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

  const docRef = db
    .collection("seoMetaTitles")
    .doc(encodeURIComponent(pageUrl));
  const cached = await docRef.get();

  if (cached.exists) {
    return NextResponse.json({ title: cached.data().title });
  }

  // 🧪 Attempt fallback keyword extraction
  if (!focusKeywords) {
    try {
      const kwRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/extract-keywords`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageUrl }),
        }
      );

      const kwData = await kwRes.json();
      focusKeywords = kwData.keywords?.join(", ") || "";
    } catch (err) {
      console.warn("⚠️ Fallback keyword extraction failed", err);
    }
  }

  const prompt = `
You are an SEO expert.

Suggest a **short, clear, keyword-optimized meta title** for the following page:

---
Page URL: ${pageUrl}
Business Location: ${onboarding?.businessLocation || "N/A"}
Business Type: ${onboarding?.businessType || "N/A"}
Focus Keywords: ${focusKeywords}
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

  await docRef.set({
    title: aiTitle,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ title: aiTitle });
}
