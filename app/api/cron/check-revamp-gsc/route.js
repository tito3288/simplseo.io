import { NextResponse } from "next/server";
import { db, admin } from "../../../lib/firebaseAdmin";
import nodemailer from "nodemailer";

const DISCOVERY_THRESHOLD = 10;

// Create reusable transporter (supports both SendGrid and Gmail SMTP)
const createTransporter = () => {
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      service: "SendGrid",
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

async function refreshAccessToken(gscData, userId) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: gscData.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh GSC access token");
  }

  const tokenData = await res.json();
  const newAccessToken = tokenData.access_token;
  const expiresAt = Date.now() + tokenData.expires_in * 1000;

  await db.collection("gscTokens").doc(userId).update({
    accessToken: newAccessToken,
    expiresAt,
  });

  return newAccessToken;
}

async function checkGscForUser(userId, onboardingData) {
  const { revampPages, revampDate } = onboardingData;

  if (!revampPages || revampPages.length === 0 || !revampDate) {
    return { userId, skipped: true, reason: "Missing revampPages or revampDate" };
  }

  // Get GSC tokens
  const gscDoc = await db.collection("gscTokens").doc(userId).get();
  if (!gscDoc.exists) {
    return { userId, skipped: true, reason: "No GSC tokens" };
  }

  const gscData = gscDoc.data();
  let accessToken = gscData.accessToken;
  const siteUrl = gscData.siteUrl;

  if (!accessToken || !siteUrl) {
    return { userId, skipped: true, reason: "GSC not configured" };
  }

  // Refresh token if expired
  if (gscData.expiresAt && gscData.expiresAt < Date.now() + 300000) {
    accessToken = await refreshAccessToken(gscData, userId);
  }

  // Query GSC from revampDate to today
  const formatDate = (d) => new Date(d).toISOString().split("T")[0];
  const startDate = formatDate(revampDate);
  const endDate = formatDate(new Date());

  let gscResult;
  const fetchGsc = async (token) => {
    const response = await fetch(
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
          startDate,
          endDate,
          dimensions: ["page"],
          rowLimit: 500,
        }),
      }
    );
    return response;
  };

  let response = await fetchGsc(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken(gscData, userId);
    response = await fetchGsc(accessToken);
  }

  if (!response.ok) {
    return { userId, skipped: true, reason: `GSC API error: ${response.status}` };
  }

  gscResult = await response.json();

  // Build GSC page map
  const gscPageMap = new Map();
  if (gscResult.rows) {
    gscResult.rows.forEach((row) => {
      const pageUrl = row.keys[0].replace(/\/$/, "").toLowerCase();
      gscPageMap.set(pageUrl, {
        impressions: row.impressions,
        clicks: row.clicks,
      });
    });
  }

  // Update revampPages
  const updatedPages = revampPages.map((page) => {
    const normalizedUrl = (page.url || page).replace(/\/$/, "").toLowerCase();
    const pageGscData = gscPageMap.get(normalizedUrl);

    return {
      url: page.url || page,
      discovered: pageGscData ? pageGscData.impressions >= DISCOVERY_THRESHOLD : false,
      impressions: pageGscData ? pageGscData.impressions : 0,
      clicks: pageGscData ? pageGscData.clicks : 0,
    };
  });

  // Determine which pages are newly discovered (not yet notified)
  const previouslyNotified = new Set(onboardingData.revampNotifiedPages || []);
  const newlyDiscovered = updatedPages.filter(
    (p) => p.discovered && !previouslyNotified.has(p.url)
  );

  const discoveredCount = updatedPages.filter((p) => p.discovered).length;
  const allDiscovered = discoveredCount === updatedPages.length;

  await db.collection("onboarding").doc(userId).update({
    revampPages: updatedPages,
  });

  return {
    userId,
    checked: true,
    discoveredCount,
    totalPages: updatedPages.length,
    newlyDiscovered,
    allDiscovered,
    alreadyNotifiedAll: !!onboardingData.revampAllDiscoveredNotifiedAt,
    userName: onboardingData.name || "",
  };
}

// Send daily digest email for newly discovered pages
async function sendDiscoveryDigest(userEmail, { userName, newlyDiscovered, discoveredCount, totalPages }) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://simplseo-io.vercel.app";
  const pageList = newlyDiscovered
    .map((p) => {
      const cleanUrl = p.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return `<li style="padding: 4px 0;"><strong>${cleanUrl}</strong> — ${p.impressions} impressions</li>`;
    })
    .join("");

  const remaining = totalPages - discoveredCount;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@simplseo.io",
      to: userEmail,
      subject: `📈 ${newlyDiscovered.length} of your revamped pages ${newlyDiscovered.length === 1 ? "is" : "are"} now in Google!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00BF63;">📈 Your Pages Are Getting Discovered!</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Great news! Google has started picking up your revamped pages in Search Console:</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #00BF63; margin-top: 0;">Newly Discovered Today:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">${pageList}</ul>
          </div>

          <p><strong>Overall Progress:</strong> ${discoveredCount} of ${totalPages} pages discovered${remaining > 0 ? ` — ${remaining} more to go` : ""}.</p>

          <p>We check daily and will email you as more pages appear.</p>

          <a href="${appUrl}/revamp" style="display: inline-block; background-color: #00BF63; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-top: 15px;">
            View Progress
          </a>

          <p style="margin-top: 30px; font-size: 0.8em; color: #999;">
            This email was sent from SimplSEO. If you have any questions, feel free to contact us.
          </p>
        </div>
      `,
      text: `Your Pages Are Getting Discovered!\n\nHi ${userName || "there"},\n\nGoogle has started picking up your revamped pages:\n\n${newlyDiscovered.map((p) => `- ${p.url.replace(/^https?:\/\//, "")} (${p.impressions} impressions)`).join("\n")}\n\nOverall Progress: ${discoveredCount} of ${totalPages} pages discovered.\n\nView progress: ${appUrl}/revamp`,
    });
    return true;
  } catch (error) {
    console.error("❌ Error sending revamp discovery digest:", error);
    return false;
  }
}

// Send milestone email when all pages are discovered
async function sendAllDiscoveredEmail(userEmail, { userName, totalPages }) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://simplseo-io.vercel.app";

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@simplseo.io",
      to: userEmail,
      subject: `🎉 All ${totalPages} of your revamped pages are now in Google!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00BF63;">🎉 All Your Pages Are Discovered!</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Congratulations! All <strong>${totalPages}</strong> of your revamped pages now have 10+ impressions in Google Search Console.</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #00BF63; margin-top: 0;">What's Next?</h3>
            <p>You're ready to choose focus keywords for each page. This will set up your SEO performance tracking on your dashboard.</p>
          </div>

          <a href="${appUrl}/revamp" style="display: inline-block; background-color: #00BF63; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-top: 15px;">
            Choose Keywords
          </a>

          <p style="margin-top: 30px; font-size: 0.9em; color: #777;">
            Your site revamp is almost complete — just one more step!
          </p>
          <p style="font-size: 0.8em; color: #999;">
            This email was sent from SimplSEO. If you have any questions, feel free to contact us.
          </p>
        </div>
      `,
      text: `All Your Pages Are Discovered!\n\nHi ${userName || "there"},\n\nCongratulations! All ${totalPages} of your revamped pages now have 10+ impressions in Google Search Console.\n\nYou're ready to choose focus keywords for each page.\n\nContinue: ${appUrl}/revamp`,
    });
    return true;
  } catch (error) {
    console.error("❌ Error sending revamp all-discovered email:", error);
    return false;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const secret =
      searchParams.get("secret") ||
      req.headers.get("authorization")?.replace("Bearer ", "");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all users in revamp waiting state
    const snapshot = await db
      .collection("onboarding")
      .where("revampStatus", "==", "in-progress")
      .where("revampStep", "==", "waiting")
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No users in revamp waiting state",
        usersChecked: 0,
      });
    }

    const results = [];
    for (const userDoc of snapshot.docs) {
      try {
        const result = await checkGscForUser(userDoc.id, userDoc.data());
        results.push(result);

        // Send email notifications (best-effort)
        if (result.checked && (result.newlyDiscovered?.length > 0 || (result.allDiscovered && !result.alreadyNotifiedAll))) {
          try {
            const userRecord = await admin.auth().getUser(userDoc.id);
            const userEmail = userRecord.email;

            if (!userEmail) {
              console.log(`⚠️ No email found for user ${userDoc.id}`);
              continue;
            }

            // Send digest for newly discovered pages
            if (result.newlyDiscovered.length > 0) {
              const digestSent = await sendDiscoveryDigest(userEmail, result);
              if (digestSent) {
                // Track notified pages to prevent duplicates
                const notifiedUrls = result.newlyDiscovered.map((p) => p.url);
                await db.collection("onboarding").doc(userDoc.id).update({
                  revampNotifiedPages: admin.firestore.FieldValue.arrayUnion(...notifiedUrls),
                });
                console.log(`✅ Discovery digest sent to ${userEmail} (${notifiedUrls.length} pages)`);
              }
            }

            // Send milestone email when all pages discovered
            if (result.allDiscovered && !result.alreadyNotifiedAll) {
              const milestoneSent = await sendAllDiscoveredEmail(userEmail, result);
              if (milestoneSent) {
                await db.collection("onboarding").doc(userDoc.id).update({
                  revampAllDiscoveredNotifiedAt: new Date().toISOString(),
                });
                console.log(`✅ All-discovered milestone email sent to ${userEmail}`);
              }
            }
          } catch (emailError) {
            console.error(`❌ Email notification failed for user ${userDoc.id}:`, emailError.message);
          }
        }
      } catch (error) {
        results.push({ userId: userDoc.id, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      usersChecked: results.length,
      results,
    });
  } catch (error) {
    console.error("Revamp GSC cron failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error.message },
      { status: 500 }
    );
  }
}
