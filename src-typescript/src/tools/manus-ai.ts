// Manus AI Tools — The "Spire" of the Cathedral Framework
// Contextual intelligence: route optimization, earnings projections, challenge strategy

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, OneCommerceApiError, truncateResponse } from "../services/api-client.js";
import type { ManusInsight, EarningsProjection } from "../types.js";

export function registerManusAiTools(server: McpServer): void {
  // ── Get Contextual Insights ──────────────────────────────────
  server.registerTool(
    "oc_manus_insights",
    {
      title: "Manus AI — Get Contextual Insights",
      description: `Retrieve AI-generated insights for a store or operator. Manus AI reads the specific business context — shift logs, tax data, earnings history — to provide mathematically grounded recommendations without context-switching fatigue.

Args:
  - store_id (string): Store context for the insights.
  - insight_types (string[], optional): Filter by type — route, earnings, challenge, tax, trend.
  - period (string, optional): Time period — today, this_week, this_month, last_30_days (default last_30_days).
  - limit (number, optional): Max insights to return (default 10).

Returns: Array of insight objects with type, title, summary, confidence score, and supporting data.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID for contextual scoping"),
        insight_types: z.array(z.enum(["route", "earnings", "challenge", "tax", "trend"])).optional()
          .describe("Filter insight types"),
        period: z.enum(["today", "this_week", "this_month", "last_30_days"]).default("last_30_days")
          .describe("Analysis time period"),
        limit: z.number().int().min(1).max(50).default(10).describe("Max insights to return"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<ManusInsight[]>(`manus/insights`, {
          params: {
            store_id: params.store_id,
            types: params.insight_types?.join(","),
            period: params.period,
            limit: params.limit,
          },
        });
        return { content: [{ type: "text", text: truncateResponse(JSON.stringify(res, null, 2)) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Earnings Projection ──────────────────────────────────────
  server.registerTool(
    "oc_manus_earnings_projection",
    {
      title: "Manus AI — Earnings Projection",
      description: `Generate an earnings projection based on real shift logs, order history, and platform fee structures. Returns projected gross, net, and tax amounts with a per-platform breakdown.

Args:
  - store_id (string): Store/operator context.
  - projection_period (string): next_week, next_month, next_quarter.
  - include_platforms (string[], optional): Limit projection to specific platforms.

Returns: Projection object with gross/net/tax amounts, platform breakdown, and confidence score.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store or operator ID"),
        projection_period: z.enum(["next_week", "next_month", "next_quarter"]).describe("Forecast time horizon"),
        include_platforms: z.array(z.string()).optional().describe("Limit projection to these platforms"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<EarningsProjection>(`manus/earnings-projection`, {
          params: {
            store_id: params.store_id,
            period: params.projection_period,
            platforms: params.include_platforms?.join(","),
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Route Intelligence ───────────────────────────────────────
  server.registerTool(
    "oc_manus_route_intelligence",
    {
      title: "Manus AI — Route Intelligence",
      description: `Analyze gig-economy route performance using actual shift log data. Identifies underperforming routes, optimal time slots, and platform-specific earnings density.

Args:
  - store_id (string): Operator store context.
  - day_of_week (string, optional): Filter analysis to a specific day.
  - platform (string, optional): Filter to a specific gig platform.

Returns: Route analysis with per-route earnings, time efficiency scores, and optimization suggestions.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Operator store ID"),
        day_of_week: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
          .optional().describe("Filter to a specific weekday"),
        platform: z.string().optional().describe("Filter to a specific gig platform"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Record<string, unknown>>(`manus/route-intelligence`, {
          params: {
            store_id: params.store_id,
            day: params.day_of_week,
            platform: params.platform,
          },
        });
        return { content: [{ type: "text", text: truncateResponse(JSON.stringify(res, null, 2)) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Challenge Strategy ───────────────────────────────────────
  server.registerTool(
    "oc_manus_challenge_strategy",
    {
      title: "Manus AI — Challenge Strategy",
      description: `Get optimal completion paths for active platform challenges. Manus AI monitors active challenges and suggests the best route/timing combinations based on real-time location and historical earnings data.

Args:
  - store_id (string): Operator context.
  - challenge_id (string, optional): Specific challenge to analyze. Omit for all active challenges.

Returns: Challenge details with suggested completion strategy, estimated earnings impact, and time-to-complete.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Operator store ID"),
        challenge_id: z.string().optional().describe("Specific challenge ID (omit for all active)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const client = getClient();
        const path = params.challenge_id
          ? `manus/challenges/${params.challenge_id}/strategy`
          : `manus/challenges/strategy`;
        const res = await client.request<Record<string, unknown>>(path, {
          params: { store_id: params.store_id },
        });
        return { content: [{ type: "text", text: truncateResponse(JSON.stringify(res, null, 2)) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );
}
