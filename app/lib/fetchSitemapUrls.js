// ✅ app/lib/fetchSitemapUrls.js
export async function fetchSitemapUrls() {
  try {
    const res = await fetch("/api/sitemap");
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const json = await res.json();
    return json.urls || [];
  } catch (err) {
    console.error("❌ Client failed to fetch sitemap URLs:", err.message);
    return [];
  }
}
