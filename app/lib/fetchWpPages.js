export async function fetchWpPages(domain) {
  try {
    const res = await fetch(
      `https://${domain}/wp-json/wp/v2/pages?per_page=100`
    );
    if (!res.ok) throw new Error(`Failed to fetch pages: ${res.status}`);
    const data = await res.json();
    return data.map((page) => page.link); // full URLs
  } catch (err) {
    console.error("❌ fetchWpPages error:", err.message);
    return [];
  }
}
