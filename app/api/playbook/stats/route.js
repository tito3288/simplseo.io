import { NextResponse } from "next/server";
import { getPlaybookStats, getPlaybookConfig } from "../../../lib/playbookConfig";

// GET - Get playbook statistics for all business types
export async function GET(req) {
  try {
    const config = await getPlaybookConfig();
    const stats = await getPlaybookStats();

    return NextResponse.json({
      success: true,
      config: {
        enabled: config.enabled,
        thresholds: {
          minStrategiesPerBusinessType: config.minStrategiesPerBusinessType,
          minSuccessRate: config.minSuccessRate,
          minDaysOld: config.minDaysOld,
          minBusinessesPerType: config.minBusinessesPerType,
        },
        enabledBusinessTypes: config.enabledBusinessTypes || [],
      },
      stats: stats,
      summary: {
        totalBusinessTypes: stats.length,
        readyBusinessTypes: stats.filter((s) => s.ready).length,
        totalStrategies: stats.reduce((sum, s) => sum + s.totalStrategies, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching playbook stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch playbook stats",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

