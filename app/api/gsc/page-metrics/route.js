export async function POST(req) {
  const { token, siteUrl, pageUrl } = await req.json();

  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 7);

  const from = start.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  const gscRes = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      siteUrl
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: from,
        endDate: to,
        dimensions: ["page"],
        rowLimit: 1000,
      }),
    }
  );

  const json = await gscRes.json();

  const matchingRow = json.rows?.find((row) => row.keys[0] === pageUrl);

  if (matchingRow) {
    return Response.json({
      impressions: matchingRow.impressions,
      clicks: matchingRow.clicks,
      ctr: matchingRow.ctr,
      position: matchingRow.position,
    });
  } else {
    return Response.json({
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: 0,
    });
  }
}
