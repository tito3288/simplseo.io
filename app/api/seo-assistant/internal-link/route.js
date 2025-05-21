import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { fromUrl } = await req.json();

    const slug = new URL(fromUrl).pathname
      .replace(/\/$/, "")
      .split("/")
      .pop()
      .replace(/[-_]/g, " ")
      .trim();

    const prompt = `
You are a helpful SEO copywriter. 

Rewrite this slug into a short, natural anchor text for internal linking:
Slug: "${slug}"

Guidelines:
- Make it sound human-friendly and clickable.
- No more than 6 words.
- Capitalize where appropriate.
- Do NOT include the word "slug".
- Only return the anchor text — no quotes, no markdown, no explanation.
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
