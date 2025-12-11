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

  // ✅ FIX: Check if GSC request was successful before parsing
  if (!gscRes.ok) {
    const errorText = await gscRes.text();
    console.error(`❌ GSC API error: ${gscRes.status} - ${errorText}`);
    
    // Return an error response instead of zeros
    // This allows the cron job to skip instead of saving bad data
    return Response.json({
      error: true,
      status: gscRes.status,
      message: `GSC API failed: ${gscRes.status}`,
    }, { status: gscRes.status, headers });
  }

  const json = await gscRes.json();

  // Check if the response indicates an error (e.g., invalid token)
  if (json.error) {
    console.error(`❌ GSC API returned error:`, json.error);
    return Response.json({
      error: true,
      status: json.error.code || 400,
      message: json.error.message || "GSC API error",
    }, { status: json.error.code || 400, headers });
  }

  const matchingRow = json.rows?.find((row) => row.keys[0] === pageUrl);

  if (matchingRow) {
    return Response.json({
      impressions: matchingRow.impressions,
      clicks: matchingRow.clicks,
      ctr: matchingRow.ctr,
      position: matchingRow.position,
    }, { headers });
  } else {
    // No data for this page - this is legitimate (page has no impressions)
    // Return zeros but mark it as valid data
    return Response.json({
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: 0,
      noData: true, // Flag to indicate this is valid "no data" vs an error
    }, { headers });
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
