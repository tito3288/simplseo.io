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
    const snapshot = await db
      .collection("pageContentCache")
      .where("userId", "==", userId)
      .limit(Math.max(desiredCount * 3, 30))
      .get();

    const pages = snapshot.docs.map((docRef) => docRef.data());

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
    console.error("Failed to fetch cached site pages with admin SDK:", error);
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

const selectRelevantPages = (sortedPages, message, limit = 8) => {
  if (!sortedPages.length) return [];

  const normalizedMessage = message.toLowerCase();
  const urlRegex = /(https?:\/\/[^\s'"]+)/g;
  const referencedUrls = new Set();
  let match;
  while ((match = urlRegex.exec(message)) !== null) {
    referencedUrls.add(normalizeUrl(match[1]));
  }

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

  for (const page of sortedPages) {
    if (result.length >= limit) break;

    const normalizedPageUrl = normalizeUrl(page.pageUrl || "");
    const urlMatch =
      normalizedPageUrl && referencedUrls.has(normalizedPageUrl);

    let keywordMatch = false;
    if (!urlMatch) {
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
      if (!keywordMatch && page.title) {
        const titleWords = page.title
          .toLowerCase()
          .split(/\W+/)
          .filter((word) => word.length >= 3);
        keywordMatch = titleWords.some((word) => keywords.has(word));
      }
    }

    if (urlMatch || keywordMatch) {
      addPage(page);
    }
  }

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
  const { message, context, userId } = await req.json();

  const cachedPages = await getCachedSitePages(userId, 10);
  const selectedPages = selectRelevantPages(cachedPages, message, 8);
  const pageSummaries = selectedPages.map(buildPageSummary);
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

  **Website Content Summaries (use when relevant):**
${renderedPageSummaries}
  
  Only mention what&apos;s relevant. If something doesn&apos;t apply, just skip it.  
  Your goal is to help the user *understand* and *take action*, not overwhelm them.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
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
