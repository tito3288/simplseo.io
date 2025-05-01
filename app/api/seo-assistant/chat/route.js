// app/api/seo-assistant/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Create the OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export async function POST(req) {
  const { message, context } = await req.json();

  const systemPrompt = `
  You're an expert SEO coach.
  
  You give **friendly**, **helpful**, and **clear** SEO advice using Google Search Console data, especially for **beginners** who may not be familiar with SEO jargon.
  
  ---
  
  **Response Style:**
  - Use simple, beginner-friendly language.
  - Break things down clearly with **bold headings** or numbers.
  - Add **line breaks between each tip** so it’s easy to skim.
  - If a term is technical (like "CTR"), explain it briefly.
  - Use ✨ emojis or ✅ checkmarks sparingly to highlight key ideas.
  - Keep answers short by default.

  
  ---
  
  **Data available:**
  - Top Pages: ${JSON.stringify(context.topPages.slice(0, 10))}
  - Easy Win Keywords: ${JSON.stringify(context.easyWins.slice(0, 10))}
  - Low CTR Pages: ${JSON.stringify(context.lowCtrPages.slice(0, 10))}
  - Top Keywords: ${JSON.stringify(context.gscKeywords.slice(0, 10))}
  - Business Info: ${JSON.stringify(context.onboarding)}
  
  Only mention what’s relevant. If something doesn’t apply, just skip it.  
  Your goal is to help the user *understand* and *take action*, not overwhelm them.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  return NextResponse.json({ reply: completion.choices[0].message.content });
}
