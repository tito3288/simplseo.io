import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { fromUrl, toUrl, targetSlug } = await req.json();

    console.log("📥 Received targetSlug:", targetSlug);

    const readableSlug = targetSlug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const prompt = `
You are an SEO expert.

Your job is to create a short, natural-sounding anchor text that links TO a page titled: **${readableSlug}**.

Rules:
- Use the phrase above as your only source of context
- Make the anchor readable and no more than 6 words
- Do not mention the source page or use vague phrases like "click here" or "home page"
- Only return the anchor text (no quotes, no markdown, no explanation)
`.trim();

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const anchorText = response.choices[0].message.content.trim();
    return Response.json({ anchorText });
  } catch (err) {
    console.error("❌ Anchor Text API Error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
