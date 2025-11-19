// app/api/seo-assistant/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  logTrainingEvent,
  summarizeSeoContext,
} from "../../../lib/trainingLogger";
import { db } from "../../../lib/firebaseAdmin";

// Create the OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const getCachedSitePages = async (userId, desiredCount = 10) => {
  if (!userId) return [];
  try {
    // Use backward-compatible helper (checks both old and new structures)
    const { getCachedSitePages: getCachedPages } = await import("../../../lib/firestoreMigrationHelpers");
    const pages = await getCachedPages(userId, {
      limit: Math.max(desiredCount * 3, 30),
      useAdminSDK: true // Use admin SDK for server-side
    });

    // Sort pages
    pages.sort((a, b) => {
      const navScore =
        (b.isNavLink ? 1 : 0) - (a.isNavLink ? 1 : 0);
      if (navScore !== 0) return navScore;

      const orderA =
        typeof a.crawlOrder === "number"
          ? a.crawlOrder
          : Number.MAX_SAFE_INTEGER;
      const orderB =
        typeof b.crawlOrder === "number"
          ? b.crawlOrder
          : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      const aTime = a.cachedAt ? new Date(a.cachedAt).getTime() : 0;
      const bTime = b.cachedAt ? new Date(b.cachedAt).getTime() : 0;
      return bTime - aTime;
    });

    return pages;
  } catch (error) {
    console.error("Failed to fetch cached site pages:", error);
    return [];
  }
};

const normalizeUrl = (url) => {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
};

// Detect page type based on URL, title, and content
const detectPageType = (page) => {
  const url = (page.pageUrl || "").toLowerCase();
  const title = (page.title || "").toLowerCase();
  const content = (page.textContent || "").toLowerCase();
  const description = (page.metaDescription || "").toLowerCase();
  
  // Common page type patterns
  const patterns = {
    about: ['about', 'about-us', 'who-we-are', 'our-story', 'team', 'about me', 'about the company'],
    services: ['services', 'service', 'what-we-do', 'offerings', 'solutions', 'what we offer', 'our services'],
    contact: ['contact', 'contact-us', 'get-in-touch', 'reach-us', 'reach out', 'contact us'],
    blog: ['blog', 'post', 'article', 'news', '/blog/', '/posts/'],
    portfolio: ['portfolio', 'work', 'projects', 'case-studies', 'case studies', 'my work', 'our work'],
    pricing: ['pricing', 'plans', 'packages', 'cost', 'price', 'rates'],
    home: ['', '/', 'home', 'index', 'welcome'],
    products: ['products', 'product', 'shop', 'store', 'catalog'],
    testimonials: ['testimonials', 'reviews', 'testimonial', 'what clients say'],
  };
  
  // Check URL path segments
  try {
    const urlObj = new URL(page.pageUrl);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean).map(s => s.toLowerCase());
    
    for (const [type, keywords] of Object.entries(patterns)) {
      // Check URL segments
      const urlMatch = pathSegments.some(seg => 
        keywords.some(keyword => seg.includes(keyword) || keyword.includes(seg))
      );
      
      // Check title
      const titleMatch = keywords.some(keyword => title.includes(keyword));
      
      // Check description
      const descMatch = keywords.some(keyword => description.includes(keyword));
      
      // Check content (only for longer keywords to avoid false positives)
      const contentMatch = keywords
        .filter(keyword => keyword.length > 5)
        .some(keyword => content.includes(keyword));
      
      if (urlMatch || titleMatch || descMatch || contentMatch) {
        return type;
      }
    }
  } catch {
    // If URL parsing fails, just check title and content
    for (const [type, keywords] of Object.entries(patterns)) {
      const titleMatch = keywords.some(keyword => title.includes(keyword));
      const descMatch = keywords.some(keyword => description.includes(keyword));
      const contentMatch = keywords
        .filter(keyword => keyword.length > 5)
        .some(keyword => content.includes(keyword));
      
      if (titleMatch || descMatch || contentMatch) {
        return type;
      }
    }
  }
  
  return 'other';
};

// Build a page index organized by type
const buildPageIndex = (pages) => {
  const index = {};
  
  pages.forEach(page => {
    const type = detectPageType(page);
    if (!index[type]) index[type] = [];
    index[type].push({
      url: page.pageUrl,
      title: page.title || 'Untitled',
      description: page.metaDescription || '',
    });
  });
  
  // Format the index for the system prompt
  const sections = [];
  
  for (const [type, pages] of Object.entries(index)) {
    if (pages.length === 0) continue;
    
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + (type === 'services' ? ' Pages' : type === 'products' ? ' Pages' : ' Page' + (pages.length > 1 ? 's' : ''));
    sections.push(
      `**${typeLabel}:**\n` +
      pages.map((p, i) => `  ${i+1}. "${p.title}" - ${p.url}`).join('\n')
    );
  }
  
  return sections.join('\n\n');
};

const selectRelevantPages = (sortedPages, message, limit = 15) => {
  if (!sortedPages.length) return [];

  const normalizedMessage = message.toLowerCase();
  
  // Extract page type queries (semantic matching)
  const pageTypeQueries = {
    about: ['about page', 'about us', 'about page', 'tell me about', 'my about', 'the about'],
    services: ['services page', 'service pages', 'all services', 'my services', 'services pages', 'service page', 'the services'],
    contact: ['contact page', 'contact us', 'my contact', 'the contact'],
    blog: ['blog posts', 'blog pages', 'articles', 'blog post', 'my blog'],
    portfolio: ['portfolio', 'work page', 'projects', 'my work', 'portfolio page'],
    products: ['products', 'product page', 'product pages', 'my products'],
    testimonials: ['testimonials', 'reviews', 'testimonial page'],
    pricing: ['pricing', 'pricing page', 'price page'],
  };
  
  // Detect what type of pages user is asking about
  let requestedPageType = null;
  for (const [type, queries] of Object.entries(pageTypeQueries)) {
    if (queries.some(q => normalizedMessage.includes(q))) {
      requestedPageType = type;
      break;
    }
  }
  
  // If asking for a specific page type, return all matching pages
  if (requestedPageType) {
    const matchingPages = sortedPages
      .filter(page => detectPageType(page) === requestedPageType)
      .slice(0, limit);
    
    // If we found matching pages, return them
    if (matchingPages.length > 0) {
      return matchingPages;
    }
    // If no exact match, fall through to keyword matching
  }

  // URL matching
  const urlRegex = /(https?:\/\/[^\s'"]+)/g;
  const referencedUrls = new Set();
  let match;
  while ((match = urlRegex.exec(message)) !== null) {
    referencedUrls.add(normalizeUrl(match[1]));
  }

  // Keyword extraction
  const keywords = new Set(
    normalizedMessage.split(/\W+/).filter((word) => word.length >= 3)
  );

  const result = [];
  const seen = new Set();

  const addPage = (page) => {
    const key = normalizeUrl(page.pageUrl || page.id || Math.random().toString());
    if (!seen.has(key)) {
      result.push(page);
      seen.add(key);
    }
  };

  // First pass: URL matches
  for (const page of sortedPages) {
    if (result.length >= limit) break;
    const normalizedPageUrl = normalizeUrl(page.pageUrl || "");
    if (normalizedPageUrl && referencedUrls.has(normalizedPageUrl)) {
      addPage(page);
    }
  }

  // Second pass: Keyword matches in URL, title, or content
  for (const page of sortedPages) {
    if (result.length >= limit) break;

    const normalizedPageUrl = normalizeUrl(page.pageUrl || "");
    if (seen.has(normalizedPageUrl)) continue;

    let keywordMatch = false;
    
    // Check URL path segments
      try {
        const { pathname } = new URL(page.pageUrl);
        const segments = pathname
          .split("/")
          .filter(Boolean)
          .map((seg) => seg.toLowerCase());
        keywordMatch = segments.some(
          (seg) => seg.length >= 3 && normalizedMessage.includes(seg)
        );
      } catch {
        keywordMatch = false;
      }
    
    // Check title
      if (!keywordMatch && page.title) {
        const titleWords = page.title
          .toLowerCase()
          .split(/\W+/)
          .filter((word) => word.length >= 3);
        keywordMatch = titleWords.some((word) => keywords.has(word));
      }
    
    // Check content (for longer keywords)
    if (!keywordMatch && page.textContent) {
      const contentLower = page.textContent.toLowerCase();
      keywordMatch = Array.from(keywords)
        .filter(word => word.length > 4)
        .some(word => contentLower.includes(word));
    }

    if (keywordMatch) {
      addPage(page);
    }
  }

  // Third pass: Fill remaining slots with high-priority pages
  if (result.length < limit) {
    for (const page of sortedPages) {
      if (result.length >= limit) break;
      addPage(page);
    }
  }

  return result;
};

const buildPageSummary = (page) => {
  const cleanText = (text = "", length = 320) => {
    if (!text) return "";
    const trimmed = text.replace(/\s+/g, " ").trim();
    return trimmed.length > length ? `${trimmed.slice(0, length)}…` : trimmed;
  };

  const keyHeadings = Array.isArray(page.headings)
    ? page.headings
        .map((heading) =>
          typeof heading === "string"
            ? heading
            : heading?.text || heading?.value || ""
        )
        .filter(Boolean)
        .slice(0, 5)
    : [];

  return {
    pageUrl: page.pageUrl,
    title: cleanText(page.title || ""),
    metaDescription: cleanText(page.metaDescription || ""),
    summary: cleanText(page.textContent || "", 200),
    headings: keyHeadings,
  };
};

export async function POST(req) {
  const { message, conversationHistory = [], context, userId } = await req.json();

  // Get all cached pages (increase limit to get more pages for better indexing)
  const cachedPages = await getCachedSitePages(userId, 25);

  // Select relevant pages based on the message
  const selectedPages = selectRelevantPages(cachedPages, message, 15);
  const pageSummaries = selectedPages.map(buildPageSummary);
  
  // Build full page index for reference
  const pageIndex = buildPageIndex(cachedPages);
  
  // Build detailed summaries for selected pages
  const renderedPageSummaries = pageSummaries.length
    ? pageSummaries
        .map((page, idx) => {
          const headingsFormatted = page.headings
            .map((heading) => `      • ${heading}`)
            .join("\n");
          return `    ${idx + 1}. URL: ${page.pageUrl}
       Title: ${page.title || "N/A"}
       Description: ${page.metaDescription || "N/A"}
       Summary: ${page.summary || "N/A"}
       Headings:
${headingsFormatted || "      • (none)"}`;
        })
        .join("\n\n")
    : "    (No cached pages available yet)";

  // Build focus keyword context section if available
  const focusKeywordSection = context.focusKeywordContext ? `
  
  **🎯 FOCUS KEYWORD SELECTION CONTEXT (Active):**
  The user is asking for help choosing focus keywords. This is a critical SEO task!
  
  **Current Status:**
  - Total pages with keywords: ${context.focusKeywordContext.totalPages || 0}
  - Pages with focus keywords selected: ${context.focusKeywordContext.totalSelected || 0}
  - Pages without focus keywords: ${context.focusKeywordContext.pagesWithoutKeywords?.length || 0}
  - Business Name: ${context.focusKeywordContext.businessName || 'Not provided'}
  - Business Type: ${context.focusKeywordContext.businessType || 'Not provided'}
  - Business Location: ${context.focusKeywordContext.businessLocation || 'Not provided'}
  
  **Selected Keywords:**
  ${context.focusKeywordContext.selectedKeywords?.length > 0 
    ? context.focusKeywordContext.selectedKeywords.map((s, i) => 
        `${i + 1}. Page: ${s.page || 'Unassigned'} → Keyword: "${s.keyword}"`
      ).join('\n  ')
    : '  (None selected yet)'
  }
  
  **Pages Without Focus Keywords:**
  ${context.focusKeywordContext.pagesWithoutKeywords?.length > 0
    ? context.focusKeywordContext.pagesWithoutKeywords.map((p, i) => {
        const topKeywords = p.keywords?.slice(0, 3).map(kw => 
          `"${kw.keyword}" (${kw.impressions} impressions, pos ${kw.position})`
        ).join(', ') || 'No keywords';
        return `${i + 1}. ${p.pageUrl || 'Unassigned'}: ${topKeywords}`;
      }).join('\n  ')
    : '  (All pages have focus keywords selected)'
  }
  
  **Available Keywords Data:**
  ${context.focusKeywordContext.keywordData?.length > 0
    ? `Total keywords available: ${context.focusKeywordContext.keywordData.length}`
    : 'No keyword data available'
  }
  
  **CRITICAL FOCUS KEYWORD RULES (You MUST follow these):**
  
  1. **ONE KEYWORD PER PAGE ONLY** ⚠️
     - Each page should have exactly ONE focus keyword
     - Multiple keywords on the same page cause "keyword cannibalization"
     - This means keywords compete against each other, diluting SEO efforts
     - Explain: "Think of it like trying to be the best at two sports at once - you'll be mediocre at both instead of great at one"
  
  2. **EACH KEYWORD CAN ONLY BE USED ONCE ACROSS ALL PAGES** 🚫
     - CRITICAL: Once a keyword is assigned to one page, it CANNOT be used on any other page
     - Each keyword must be unique across the entire website
     - If you recommend a keyword for Page A, you CANNOT recommend the same keyword for Page B
     - Check the "Selected Keywords" list above - if a keyword is already assigned, suggest a DIFFERENT keyword
     - When recommending keywords, always verify it's not already assigned to another page
     - Example: If "mexico city taco tours" is assigned to /our-tours, you CANNOT recommend it for /cdmx-local-taco-tour - suggest a different keyword instead
  
  3. **PREFER NON-BRANDED KEYWORDS** 🎯
     - Non-branded keywords (without business name) attract NEW customers
     - Branded keywords only help people who already know your business
     - Example: "emergency plumber austin" is better than "john's plumbing austin"
     - Exception: If a page ONLY has branded keywords, use the best one BUT suggest creating content for non-branded alternatives
  
  4. **DON'T SKIP PAGES WITH ONLY BRANDED KEYWORDS** ✅
     - If a page only has branded keywords, still select the best one
     - Explain that branded keywords help with brand awareness
     - Suggest creating new content targeting non-branded keywords
     - Example: "This page only has branded keywords. Let's use '[best branded keyword]' for now, but I recommend creating a blog post or service page targeting '[suggested non-branded keyword]'"
  
  5. **KEYWORD SELECTION PRIORITIES** 📊
     - Priority 1: Non-branded + High impressions (100+) + NOT already assigned to another page
     - Priority 2: Non-branded + Service + Location (e.g., "dentist seattle") + NOT already assigned
     - Priority 3: Non-branded + Service (e.g., "emergency plumber") + NOT already assigned
     - Priority 4: Best branded keyword (if no non-branded available) + NOT already assigned
     - Consider position: Keywords ranking 11-20 are easier to improve
     - Consider CTR: Low CTR keywords have optimization potential
     - ALWAYS check if keyword is already assigned before recommending
  
  6. **HELPING THE USER** 🤝
     - Analyze each page's available keywords
     - Identify the best non-branded option for each page that is NOT already assigned
     - If the best keyword is already assigned, find the NEXT best option for that page
     - If multiple good options exist, recommend the one with highest impressions that isn't already used
     - Explain WHY each recommendation is good
     - For pages with only branded keywords, provide specific non-branded alternatives to target
     - When user clicks Help button, start with: "Hello [name]! I see you need help with the Focus Keywords card. Let me explain what this card does and help you choose the best keywords for each page."
  
  **When User Clicks Help Button (Initial Response):**
  - Start with a friendly greeting: "Hello [user's name]! I see you need help with the Focus Keywords card."
  - Explain what the Focus Keywords card does in simple terms
  - Then provide guidance on choosing keywords
  - Be welcoming and instructional, not like you're answering a detailed question
  
  **When User Asks About Focus Keywords:**
  - Be specific: Reference actual pages and keywords from the data above
  - Be actionable: Give clear recommendations they can implement immediately
  - Be educational: Explain the "why" behind each recommendation
  - Be encouraging: Acknowledge their progress and guide next steps
  - ALWAYS verify no keyword is recommended twice across different pages
  ` : '';

  const systemPrompt = `
  You&apos;re an expert SEO coach for ${context.userFirstName || 'the user'}.
  
  You give **friendly**, **helpful**, and **clear** SEO advice using Google Search Console data, especially for **beginners** who may not be familiar with SEO jargon.
  
  **Current Context:**
  - User is on: ${context.currentPage || '/dashboard'}
  - User's name: ${context.userFirstName || 'User'}
  - Business: ${context.onboarding?.businessName || 'their business'}
  - Location: ${context.onboarding?.businessLocation || 'their area'}
  
  ---
  
  **Response Style:**
  - Use simple, beginner-friendly language.
  - Break things down clearly with **bold headings** or numbers.
  - Add **line breaks between each tip** so it's easy to skim.
  - If a term is technical (like "CTR"), explain it briefly.
  - Use ✨ emojis or ✅ checkmarks sparingly to highlight key ideas.
  - Keep answers short by default.
  - Personalize responses using their name and business info when relevant.

  
  ---
  
  **Data available:**
  - Top Pages: ${JSON.stringify(context.topPages.slice(0, 10))}
  - Easy Win Keywords: ${JSON.stringify(context.easyWins.slice(0, 10))}
  - Low CTR Pages: ${JSON.stringify(context.lowCtrPages.slice(0, 10))}
  - Top Keywords: ${JSON.stringify(context.gscKeywords.slice(0, 10))}
  - Business Info: ${JSON.stringify(context.onboarding)}
  
  **Page-Specific Focus:**
  ${context.currentPage === '/low-ctr' ? 'Focus on improving click-through rates and meta descriptions.' : ''}
  ${context.currentPage === '/easy-wins' ? 'Focus on keywords close to page 1 and ranking improvements.' : ''}
  ${context.currentPage === '/top-keywords' ? 'Focus on maintaining and improving top-performing keywords.' : ''}
  ${context.currentPage === '/dashboard' ? 'Focus on overall SEO strategy and next steps.' : ''}
${focusKeywordSection}

  **Complete Website Page Index:**
  When users ask about pages without providing URLs, use this index to find the right pages:
${pageIndex || '  (No pages indexed yet)'}

  **Understanding Page Queries:**
  - When user says "my about page" or "the about page", find pages with type "about" from the index above
  - When user says "services pages" or "all services", find ALL pages with type "services" from the index above
  - When user says "contact page", find pages with type "contact"
  - Always identify which specific page(s) the user is referring to before answering
  - If multiple pages match, mention all of them and their URLs
  - Use the full content from the identified page(s) to answer questions

  **Detailed Page Content (for selected relevant pages):**
${renderedPageSummaries}
  
  **Important Guidelines:**
  - When answering questions about specific pages, FIRST identify which page(s) from the index match the query
  - Use the detailed content summaries above to provide accurate, specific answers
  - Always include the page URL when referencing a specific page
  - If user asks about "all [type] pages", provide information about ALL matching pages
  - Only mention what&apos;s relevant. If something doesn&apos;t apply, just skip it.  
  - Your goal is to help the user *understand* and *take action*, not overwhelm them.

  **Fallback When Page Not Found:**
  If you cannot find the specific page the user is asking about:
  1. First, check the page index above to see if there are similar pages (e.g., if they ask about "pricing" but only "services" pages exist, suggest those)
  2. Recommend 2-3 relevant pages from the index that might be what they&apos;re looking for, with their URLs
  3. If no similar pages exist, politely ask: "I couldn&apos;t find that page in your website. Could you share the URL of the page you&apos;d like help with? That way I can give you specific recommendations."
  4. Always be helpful and suggest alternative pages that might be relevant to their question
  5. Example response: "I couldn&apos;t find a specific [requested page type] page, but I found these related pages: [list with URLs]. Would any of these help, or could you share the URL of the page you&apos;re thinking of?"`;

  // Build messages array with conversation history
  const messagesArray = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    { role: "user", content: message }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messagesArray,
  });

  const reply = completion.choices[0].message.content;

  await logTrainingEvent({
    userId: userId || context?.onboarding?.userId,
    eventType: "chat_reply",
    businessType: context?.onboarding?.businessType,
    businessLocation: context?.onboarding?.businessLocation,
    payload: {
      message,
      reply,
      currentPage: context?.currentPage,
      timestamp: context?.timestamp ?? new Date().toISOString(),
      context: await summarizeSeoContext(context),
      pageContext: context?.pageContext
        ? {
            targetKeyword: context.pageContext.targetKeyword,
            pageUrl: context.pageContext.pageUrl,
            matchScore: context.pageContext.matchScore,
          }
        : null,
      cachedPageSummaries: pageSummaries,
    },
  });

  return NextResponse.json({ reply });
}
