export async function POST(req) {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const { token, siteUrl, pageUrl } = await req.json();

  const today = new Date();
  const start = new Date();
  // Change from 7 days to 30 days to better capture older documents
  start.setDate(today.getDate() - 30);

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
    }, { headers }); // Add CORS headers
  } else {
    return Response.json({
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: 0,
    }, { headers }); // Add CORS headers
  }
}

// Handle preflight OPTIONS request for CORS
export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
