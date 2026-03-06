// app/lib/chatEnrichmentHelper.js
// Server-side helper for enriching chat context with implementation tracking,
// content audit results, and AI suggestions data from Firestore.
// Uses Firebase Admin SDK — only for use in API routes.

import { db } from "./firebaseAdmin";

// Replicate the client-side hash function for implementedSeoTips doc IDs
// (same as ContentAuditPanel.jsx, SeoRecommendationPanel.jsx, PivotOptionsPanel.jsx)
function createSafeDocId(userId, url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const urlHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
  return `${userId}_${urlHash}`;
}

/**
 * Phase 1: Lightweight summary of ALL tracked pages for a user.
 * Always included in system prompt so AI knows what's being tracked.
 */
export async function getImplementationSummary(userId) {
  if (!userId) return [];

  try {
    const snapshot = await db
      .collection("implementedSeoTips")
      .where("userId", "==", userId)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs.filter((doc) => !doc.data().preRevampArchived).map((doc) => {
      const data = doc.data();
      const daysSince = data.implementedAt
        ? Math.floor((Date.now() - new Date(data.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        pageUrl: data.pageUrl,
        status: data.status,
        implementationType: data.implementationType || "unknown",
        currentKeyword: data.currentKeyword || data.focusKeywords?.[0] || null,
        daysSince,
        totalDaysTarget: data.extendedTotalDays || 45,
        hasPostStats: !!data.postStats,
        preStats: data.preStats || null,
        postStats: data.postStats || null,
      };
    });
  } catch (error) {
    console.error("Failed to fetch implementation summary:", error);
    return [];
  }
}

/**
 * Phase 2: Deep enrichment data for ONE specific page.
 * Only called for pages the user is actively asking about.
 */
export async function getPageEnrichmentData(userId, pageUrl) {
  if (!userId || !pageUrl) return null;

  try {
    // Different doc ID formats per collection
    const implementationDocId = createSafeDocId(userId, pageUrl);
    const auditDocId = `${userId}_${encodeURIComponent(pageUrl)}`;

    // Fetch all three in parallel
    const [implementationSnap, auditSnap, suggestionsSnap] = await Promise.all([
      db.collection("implementedSeoTips").doc(implementationDocId).get(),
      db.collection("contentAuditResults").doc(auditDocId).get(),
      db.collection("aiSuggestions").doc(auditDocId).get(),
    ]);

    const implementation = implementationSnap.exists ? implementationSnap.data() : null;
    const contentAudit = auditSnap.exists ? auditSnap.data() : null;
    const aiSuggestions = suggestionsSnap.exists ? suggestionsSnap.data() : null;

    // If no data exists at all, return null
    if (!implementation && !contentAudit && !aiSuggestions) return null;

    // Build a clean enrichment object
    const result = {};

    if (implementation) {
      const daysSince = implementation.implementedAt
        ? Math.floor((Date.now() - new Date(implementation.implementedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      result.implementation = {
        status: implementation.status,
        implementationType: implementation.implementationType,
        implementedAt: implementation.implementedAt,
        daysSince,
        totalDaysTarget: implementation.extendedTotalDays || 45,
        currentKeyword: implementation.currentKeyword || implementation.focusKeywords?.[0],
        preStats: implementation.preStats || null,
        postStats: implementation.postStats || null,
        keywordHistory: (implementation.keywordHistory || []).map((h) => ({
          keyword: h.keyword,
          testedAt: h.testedAt,
        })),
        metaOptimizationCount: (implementation.metaOptimizationHistory || []).length,
        rewriteCount: (implementation.rewriteHistory || []).length,
        fortyFiveDayProgress: implementation.fortyFiveDayProgress || null,
      };
    }

    if (contentAudit) {
      result.contentAudit = {
        contentScore: contentAudit.contentScore || contentAudit.analysis?.overallScore,
        suggestions: (contentAudit.suggestions || []).slice(0, 5).map((s) => ({
          priority: s.priority,
          title: s.title,
          description: s.description,
        })),
      };
    }

    if (aiSuggestions) {
      result.aiSuggestions = {
        suggestions: (aiSuggestions.suggestions || []).slice(0, 5).map((s) => ({
          priority: s.priority,
          title: s.title,
          description: s.description,
          action: s.action,
        })),
      };
    }

    return result;
  } catch (error) {
    console.error(`Failed to fetch enrichment for ${pageUrl}:`, error);
    return null;
  }
}

/**
 * Match user's message to tracked pages.
 * Returns page URLs that should get deep enrichment.
 */
export function matchMessageToTrackedPages(message, summary, cachedPages = []) {
  if (!summary || summary.length === 0) return [];

  const messageLower = message.toLowerCase();

  // Generic implementation queries → return all tracked pages (cap at 5)
  const genericPhrases = [
    "my implementations", "my changes", "tracking progress",
    "how are my", "what's being tracked", "implementation status",
    "45 day", "45-day", "how is my seo doing", "my tracked pages",
    "all my pages", "my progress",
  ];

  if (genericPhrases.some((phrase) => messageLower.includes(phrase))) {
    return summary.slice(0, 5).map((s) => s.pageUrl);
  }

  const matched = [];

  for (const tracked of summary) {
    const pageUrl = tracked.pageUrl || "";

    // Check if URL appears in message
    if (messageLower.includes(pageUrl.toLowerCase())) {
      matched.push(pageUrl);
      continue;
    }

    // Extract path segments and check for keyword matches
    try {
      const urlObj = new URL(pageUrl);
      const pathSegments = urlObj.pathname
        .split("/")
        .filter((s) => s.length > 2)
        .map((s) => s.replace(/-/g, " ").toLowerCase());

      if (pathSegments.some((seg) => messageLower.includes(seg))) {
        matched.push(pageUrl);
        continue;
      }
    } catch {
      // Not a valid URL, try simple path extraction
      const path = pageUrl.replace(/^https?:\/\/[^/]+/, "");
      const segments = path
        .split("/")
        .filter((s) => s.length > 2)
        .map((s) => s.replace(/-/g, " ").toLowerCase());

      if (segments.some((seg) => messageLower.includes(seg))) {
        matched.push(pageUrl);
        continue;
      }
    }

    // Check if tracked keyword appears in message
    if (tracked.currentKeyword && messageLower.includes(tracked.currentKeyword.toLowerCase())) {
      matched.push(pageUrl);
    }
  }

  // Also check cached pages for title matches cross-referenced with tracked URLs
  if (matched.length === 0 && cachedPages.length > 0) {
    const trackedUrls = new Set(summary.map((s) => s.pageUrl));
    for (const page of cachedPages) {
      if (!trackedUrls.has(page.url || page.pageUrl)) continue;
      const title = (page.title || "").toLowerCase();
      if (title && title.length > 3) {
        // Check if significant title words appear in message
        const titleWords = title.split(/\s+/).filter((w) => w.length > 3);
        const matchCount = titleWords.filter((w) => messageLower.includes(w)).length;
        if (matchCount >= 2) {
          matched.push(page.url || page.pageUrl);
        }
      }
    }
  }

  return [...new Set(matched)].slice(0, 5);
}

/**
 * Format enrichment data into a token-efficient string for the system prompt.
 */
export function formatEnrichmentForPrompt(summary, enrichedPages) {
  if (!summary || summary.length === 0) {
    return null;
  }

  const lines = [];

  // Phase 1: Compact summary of all tracked pages
  lines.push(`Pages Being Tracked (${summary.length} total):`);
  for (let i = 0; i < summary.length; i++) {
    const s = summary[i];
    const shortUrl = (s.pageUrl || "").replace(/^https?:\/\/[^/]+/, "") || "/";
    const dayInfo = s.daysSince !== null ? `Day ${s.daysSince}/${s.totalDaysTarget}` : "Not started";
    const statsInfo = s.hasPostStats ? "has post-stats" : "awaiting update";
    lines.push(`  ${i + 1}. ${shortUrl} - ${s.implementationType}, ${dayInfo}, keyword: "${s.currentKeyword || "none"}", ${statsInfo}`);
  }

  // Phase 2: Detailed data for mentioned pages
  if (enrichedPages && enrichedPages.length > 0) {
    lines.push("");
    lines.push("Detailed Data for Mentioned Pages:");

    for (const { pageUrl, data } of enrichedPages) {
      if (!data) continue;

      const shortUrl = (pageUrl || "").replace(/^https?:\/\/[^/]+/, "") || "/";
      lines.push("");
      lines.push(`--- ${shortUrl} ---`);

      if (data.implementation) {
        const impl = data.implementation;
        const tierLabel = (impl.implementationType || "unknown").replace(/-/g, " ").toUpperCase();
        lines.push(`  Implementation: ${tierLabel} (Day ${impl.daysSince || 0} of ${impl.totalDaysTarget || 45})`);
        lines.push(`  Keyword: "${impl.currentKeyword || "none"}"`);

        if (impl.preStats) {
          lines.push(`  Pre-implementation: ${impl.preStats.impressions || 0} impressions, ${impl.preStats.clicks || 0} clicks, position ${impl.preStats.position || "N/A"}`);
        }
        if (impl.postStats) {
          lines.push(`  Post-implementation: ${impl.postStats.impressions || 0} impressions, ${impl.postStats.clicks || 0} clicks, position ${impl.postStats.position || "N/A"}`);

          if (impl.preStats) {
            const impDelta = (impl.postStats.impressions || 0) - (impl.preStats.impressions || 0);
            const clickDelta = (impl.postStats.clicks || 0) - (impl.preStats.clicks || 0);
            const posDelta = (impl.preStats.position || 0) - (impl.postStats.position || 0);
            const impPct = impl.preStats.impressions ? Math.round((impDelta / impl.preStats.impressions) * 100) : 0;
            lines.push(`  Change: ${impDelta >= 0 ? "+" : ""}${impDelta} impressions (${impPct >= 0 ? "+" : ""}${impPct}%), ${clickDelta >= 0 ? "+" : ""}${clickDelta} clicks, position ${posDelta >= 0 ? "improved" : "dropped"} by ${Math.abs(posDelta).toFixed(1)}`);
          }
        }

        if (impl.keywordHistory && impl.keywordHistory.length > 0) {
          const kwList = impl.keywordHistory.map((h) => `"${h.keyword}"`).join(", ");
          lines.push(`  Previous keywords tried: ${kwList}`);
        }

        if (impl.metaOptimizationCount > 0) {
          lines.push(`  Meta optimization attempts: ${impl.metaOptimizationCount}`);
        }
        if (impl.rewriteCount > 0) {
          lines.push(`  Content rewrite attempts: ${impl.rewriteCount}`);
        }
      }

      if (data.contentAudit) {
        lines.push(`  Content Audit Score: ${data.contentAudit.contentScore || "N/A"}/100`);
        if (data.contentAudit.suggestions && data.contentAudit.suggestions.length > 0) {
          lines.push("  Audit Recommendations:");
          for (const s of data.contentAudit.suggestions) {
            lines.push(`    - ${s.title} (${s.priority} priority): ${s.description}`);
          }
        }
      }

      if (data.aiSuggestions && data.aiSuggestions.suggestions && data.aiSuggestions.suggestions.length > 0) {
        lines.push("  AI-Generated Suggestions:");
        for (const s of data.aiSuggestions.suggestions) {
          lines.push(`    - ${s.title} (${s.priority} priority): ${s.description}`);
        }
      }
    }
  }

  return lines.join("\n");
}
