import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "../../../lib/firebaseAdmin";
// import { doc, getDoc, setDoc } from "firebase/firestore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  const {
    pageUrl,
    onboarding = {},
    context = {},
    focusKeywords = "",
  } = await req.json();
  // 🔁 Use admin.firestore() syntax
  const docRef = db
    .collection("seoMetaDescriptions")
    .doc(encodeURIComponent(pageUrl));
  const cached = await docRef.get();

  if (cached.exists) {
    return NextResponse.json({ description: cached.data().description });
  }

  const prompt = `
You are an SEO expert. Suggest a compelling meta description for the following page.

Page: ${pageUrl}
Business Location: ${onboarding.businessLocation}
Business Type: ${onboarding.businessType}
Context: ${JSON.stringify(context)}

The meta description should:
- Be around 150 characters.
- Highlight the page’s purpose or benefit.
- Include a strong call-to-action if possible.
Only return the meta description — no quotes or explanations.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100,
  });

  const description = response.choices[0].message.content.trim();

  await docRef.set({
    description,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ description });
}
