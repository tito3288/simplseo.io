import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { fromUrl, toUrl, pageTitle } = await req.json();

    const prompt = `
    You are an SEO expert. Suggest a short, natural-sounding anchor text for an internal link.
    
    You're linking FROM this page:
    → ${fromUrl}
    
    You're linking TO this destination page:
    → ${toUrl}
    
    Use the title of the destination page: "${pageTitle || ""}"
    
    Rules:
    - The anchor text must accurately reflect the destination.
    - It should feel natural and be no more than 6 words.
    - Do not describe the source page.
    - Do not use generic terms like "click here".
    - Just return the anchor text only — no quotes or markdown.
    `;

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
