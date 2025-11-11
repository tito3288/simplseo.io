"use server";

import crypto from "crypto";
import { getBigQueryClient } from "./bigqueryClient";

const datasetId = process.env.BIGQUERY_DATASET;
const tableId = process.env.BIGQUERY_TABLE;

const isLoggingEnabled =
  Boolean(datasetId && tableId) &&
  Boolean(
    process.env.BIGQUERY_PROJECT_ID &&
      process.env.BIGQUERY_CLIENT_EMAIL &&
      process.env.BIGQUERY_PRIVATE_KEY
  );

const hashIdentifier = (value) => {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
};

export const logTrainingEvent = async ({
  userId,
  eventType,
  businessType,
  businessLocation,
  payload,
}) => {
  if (!isLoggingEnabled) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Skipping BigQuery training log - BigQuery environment variables are not fully configured."
      );
    }
    return;
  }

  try {
    const client = await getBigQueryClient();
    const table = client.dataset(datasetId).table(tableId);

    const row = {
      event_timestamp: new Date().toISOString(),
      event_type: eventType,
      hashed_user_id: hashIdentifier(userId),
      business_type: businessType || null,
      business_location: businessLocation || null,
      payload_json: JSON.stringify(payload ?? {}),
    };

    await table.insert([row]);
  } catch (error) {
    console.error("❌ Failed to log training event to BigQuery:", error);
  }
};

const limitArray = (items, keys, limit = 5) => {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  return items.slice(0, limit).map((item) => {
    if (!item || typeof item !== "object") return item;
    return keys.reduce((acc, key) => {
      if (item[key] !== undefined) {
        acc[key] = item[key];
      }
      return acc;
    }, {});
  });
};

export const summarizeSeoContext = async (context = {}) => {
  if (!context || typeof context !== "object") {
    return {};
  }

  return {
    aiTipsCount: Array.isArray(context.aiTips) ? context.aiTips.length : 0,
    gscKeywordsSample: limitArray(context.gscKeywords, ["keyword", "clicks", "impressions", "position", "ctr"], 5),
    easyWinsSample: limitArray(context.easyWins, ["keyword", "position", "clicks", "impressions", "ctr"], 5),
    lowCtrPagesSample: limitArray(context.lowCtrPages, ["page", "clicks", "impressions", "ctr"], 5),
    topPagesSample: limitArray(context.topPages, ["page", "clicks"], 5),
    dateRange: context.dateRange,
  };
};

