import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req) {
  try {
    const { pageUrl } = await req.json();

    if (!pageUrl) {
      return NextResponse.json(
        { error: "Page URL is required" },
        { status: 400 }
      );
    }

    // Fetch the HTML content
    console.log(`🔍 Scraping content from: ${pageUrl}`);
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)',
      },
      timeout: 10000, // 10 second timeout
    });

    console.log(`📊 Response status: ${response.status} for ${pageUrl}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim();

    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || '';

    // Remove script and style elements
    $('script, style, noscript, iframe, img, video, audio').remove();

    // Extract clean text content
    let textContent = '';
    
    // Get text from body, prioritizing main content areas
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main',
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        textContent = element.text();
        break;
      }
    }

    // Clean up the text
    textContent = textContent
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace multiple newlines with single space
      .trim()
      .substring(0, 3000); // Limit to first 3000 characters

    // Extract headings for context
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const headingText = $(el).text().trim();
      if (headingText) {
        headings.push(headingText);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        title,
        metaDescription,
        textContent,
        headings: headings.slice(0, 10), // Limit to first 10 headings
        url: pageUrl
      }
    });

  } catch (error) {
    console.error("Error scraping content:", error);
    return NextResponse.json(
      { 
        error: "Failed to scrape content",
        details: error.message 
      },
      { status: 500 }
    );
  }
} 