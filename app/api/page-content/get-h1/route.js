"use server";

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function POST(request) {
  try {
    const { userId, pageUrl } = await request.json();

    if (!userId || !pageUrl) {
      return NextResponse.json(
        { error: "userId and pageUrl are required" },
        { status: 400 }
      );
    }

    let h1 = null;

    try {
      // Try NEW structure first: pageContentCache/{userId}/pages/{pageUrl}
      const newDocRef = db
        .collection("pageContentCache")
        .doc(userId)
        .collection("pages")
        .doc(encodeURIComponent(pageUrl));
      
      const newDoc = await newDocRef.get();
      
      if (newDoc.exists) {
        const data = newDoc.data();
        // Try multiple formats for H1
        if (data.h1) {
          h1 = data.h1;
        } else if (data.headings && Array.isArray(data.headings) && data.headings.length > 0) {
          // Headings are stored as plain strings in order (h1, h2, h3...)
          // The scrape API stores h1 first, so the first heading is the H1
          const firstHeading = data.headings[0];
          
          if (typeof firstHeading === "string") {
            // Plain string - this is the H1
            h1 = firstHeading.trim();
          } else if (firstHeading && typeof firstHeading === "object") {
            // Object format - check for tag or use text
            if (firstHeading.tag && firstHeading.tag.toLowerCase() === "h1") {
              h1 = firstHeading.text || firstHeading.content || String(firstHeading);
            } else if (firstHeading.text) {
              h1 = firstHeading.text;
            } else if (firstHeading.content) {
              h1 = firstHeading.content;
            }
          }
        }
      } else {
        // Fallback to OLD structure: pageContentCache/{userId}_{pageUrl}
        const oldKey = `${userId}_${encodeURIComponent(pageUrl)}`;
        const oldDocRef = db.collection("pageContentCache").doc(oldKey);
        const oldDoc = await oldDocRef.get();
        
        if (oldDoc.exists) {
          const data = oldDoc.data();
          // Try multiple formats for H1
          if (data.h1) {
            h1 = data.h1;
          } else if (data.headings && Array.isArray(data.headings) && data.headings.length > 0) {
            // Headings are stored as plain strings in order (h1, h2, h3...)
            // The scrape API stores h1 first, so the first heading is the H1
            const firstHeading = data.headings[0];
            
            if (typeof firstHeading === "string") {
              // Plain string - this is the H1
              h1 = firstHeading.trim();
            } else if (firstHeading && typeof firstHeading === "object") {
              // Object format - check for tag or use text
              if (firstHeading.tag && firstHeading.tag.toLowerCase() === "h1") {
                h1 = firstHeading.text || firstHeading.content || String(firstHeading);
              } else if (firstHeading.text) {
                h1 = firstHeading.text;
              } else if (firstHeading.content) {
                h1 = firstHeading.content;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching H1:", error);
    }

    return NextResponse.json({
      h1,
    });
  } catch (error) {
    console.error("Failed to fetch H1:", error);
    return NextResponse.json(
      { error: "Failed to fetch H1" },
      { status: 500 }
    );
  }
}

