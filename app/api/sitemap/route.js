import { XMLParser } from "fast-xml-parser";

export async function GET() {
  const sitemapIndexUrl = "https://bryandevelops.com/sitemap.xml";

  try {
    const parser = new XMLParser();

    // Step 1: Fetch the sitemap index
    const indexRes = await fetch(sitemapIndexUrl);
    const indexXml = await indexRes.text();
    const indexJson = parser.parse(indexXml);

    const sitemapList = indexJson.sitemapindex?.sitemap || [];
    const sitemapUrls = Array.isArray(sitemapList)
      ? sitemapList.map((s) => s.loc)
      : [sitemapList.loc];

    const allUrls = [];

    // Step 2: Fetch each child sitemap and collect URLs
    for (const url of sitemapUrls) {
      try {
        const res = await fetch(url);
        const xml = await res.text();
        const json = parser.parse(xml);
        const urls = json.urlset?.url || [];

        const normalized = Array.isArray(urls) ? urls : [urls];
        const locs = normalized.map((u) => u.loc);
        allUrls.push(...locs);
      } catch (err) {
        console.warn(`⚠️ Failed to fetch child sitemap: ${url}`, err.message);
      }
    }

    return new Response(JSON.stringify({ urls: allUrls }), {
      status: 200,
    });
  } catch (err) {
    console.error("❌ Error in sitemap API:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
