import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      return NextResponse.json({ error: "Access token is required" }, { status: 400 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken
    });

    // Create Search Console client
    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: oauth2Client
    });

    // Fetch sites (properties) from GSC
    const response = await searchConsole.sites.list();
    const sites = response.data.siteEntry || [];

    // Format the properties for our dropdown
    const properties = sites.map(site => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel,
      verified: site.verified
    })).filter(site => 
      site.permissionLevel === 'siteOwner' || site.permissionLevel === 'siteFullUser'
    );

    return NextResponse.json({ 
      success: true, 
      properties 
    });

  } catch (error) {
    console.error("Error fetching GSC properties:", error);
    return NextResponse.json({ 
      error: "Failed to fetch GSC properties",
      details: error.message 
    }, { status: 500 });
  }
}
