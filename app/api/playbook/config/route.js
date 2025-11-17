import { NextResponse } from "next/server";
import {
  getPlaybookConfig,
  updatePlaybookConfig,
  getPlaybookStats,
} from "../../../lib/playbookConfig";

// GET - Get current playbook configuration and stats
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const includeStats = searchParams.get("stats") === "true";

    const config = await getPlaybookConfig();
    const response = { config };

    if (includeStats) {
      const stats = await getPlaybookStats();
      response.stats = stats;
    }

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error("Error fetching playbook config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch playbook config",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST - Update playbook configuration (admin only)
export async function POST(req) {
  try {
    const { secret, ...newConfig } = await req.json();

    // Simple secret check for admin access
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await updatePlaybookConfig(newConfig);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Playbook config updated successfully",
        config: result.config,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to update config",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error updating playbook config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update playbook config",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

