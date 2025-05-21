// app/api/extract-keywords/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  const { pageUrl } = await req.json();

  await new Promise((r) => setTimeout(r, 2000)); // Prevent hitting token limit

  try {
    // 🌐 Fetch the HTML content
    const res = await fetch(pageUrl);
    const html = await res.text();

    // 🧼 Extract visible text
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").trim();

    // 🔍 Prompt OpenAI
    const prompt = `
Extract 1–2 focus keywords that best describe this page, including any relevant geographic locations:
---
${text}
---
Return them as a comma-separated list only.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 40,
    });

    const keywordsRaw = response.choices[0].message.content.trim();
    const keywords = keywordsRaw
      .split(",")
      .map((kw) => kw.trim())
      .filter(Boolean);

    // 🧠 Grouped logs for clarity
    console.log(`\n=== 🔍 Keyword Extraction Summary ===`);
    console.log(`📄 Page URL: ${pageUrl}`);
    console.log(`🧠 Raw Response: ${keywordsRaw}`);
    console.log(`✅ Keywords: ${JSON.stringify(keywords)}\n`);

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error("⚠️ Keyword extraction failed:", err);

    return NextResponse.json({
      keywords: [],
      error:
        "Keyword extraction failed. Using fallback prompt without keywords.",
    });
  }
}
