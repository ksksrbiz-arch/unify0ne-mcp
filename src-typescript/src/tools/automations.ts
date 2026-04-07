// Automation Nave Tools — Phase III "Installing the Vaults"
// Event-driven workflow management (n8n / Zapier integration layer)

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, OneCommerceApiError, truncateResponse } from "../services/api-client.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, AUTOMATION_TRIGGER_TYPES } from "../constants.js";
import type { Automation } from "../types.js";

export function registerAutomationTools(server: McpServer): void {
  // ── List Automations ─────────────────────────────────────────
  server.registerTool(
    "oc_list_automations",
    {
      title: "List Automations",
      description: `List automation workflows in the Automation Nave. These are real-time event-driven triggers (not polling) connected to the n8n/Zapier layer.

Args:
  - store_id (string): Store to query automations for.
  - status (string, optional): active | paused | draft.
  - trigger_type (string, optional): Filter by trigger event type.
  - page / per_page: Pagination.

Returns: Array of automation objects with trigger config, action chain, execution count, and status.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        status: z.enum(["active", "paused", "draft"]).optional().describe("Automation status filter"),
        trigger_type: z.enum(AUTOMATION_TRIGGER_TYPES).optional().describe("Filter by trigger event type"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Automation[]>(`stores/${params.store_id}/automations`, {
          params: {
            status: params.status,
            trigger_type: params.trigger_type,
            page: params.page,
            per_page: params.per_page,
          },
        });
        return { content: [{ type: "text", text: truncateResponse(JSON.stringify(res, null, 2)) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Create Automation ────────────────────────────────────────
  server.registerTool(
    "oc_create_automation",
    {
      title: "Create Automation",
      description: `Create a new event-driven automation workflow. Workflows fire the instant a commerce event occurs — no scheduled polling. Supports chaining multiple actions.

Args:
  - store_id (string): Store to attach the automation to.
  - name (string): Human-readable workflow name.
  - trigger_type (string): Event type that fires the workflow.
  - trigger_config (object, optional): Trigger-specific config (e.g., threshold values, SKU filters).
  - actions (array): Ordered list of actions, each with type and config.

Returns: Created automation with assigned ID and status (starts as draft).`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        name: z.string().min(1).max(200).describe("Automation display name"),
        trigger_type: z.enum(AUTOMATION_TRIGGER_TYPES).describe("Commerce event that triggers this workflow"),
        trigger_config: z.record(z.unknown()).optional().describe("Trigger-specific configuration"),
        actions: z.array(z.object({
          type: z.string().min(1).describe("Action type — e.g., send_email, webhook, update_inventory, slack_notify"),
          config: z.record(z.unknown()).describe("Action-specific configuration"),
        })).min(1).describe("Ordered list of actions to execute when triggered"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Automation>(`stores/${params.store_id}/automations`, {
          method: "POST",
          body: {
            name: params.name,
            trigger_type: params.trigger_type,
            trigger_config: params.trigger_config || {},
            actions: params.actions.map((a, i) => ({ ...a, order: i + 1 })),
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Toggle Automation ────────────────────────────────────────
  server.registerTool(
    "oc_toggle_automation",
    {
      title: "Toggle Automation Status",
      description: `Activate or pause an automation workflow.

Args:
  - store_id (string): Store ID.
  - automation_id (string): Automation ID.
  - status (string): Target status — active or paused.

Returns: Updated automation object.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        automation_id: z.string().min(1).describe("Automation ID"),
        status: z.enum(["active", "paused"]).describe("Desired automation status"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Automation>(
          `stores/${params.store_id}/automations/${params.automation_id}`,
          { method: "PATCH", body: { status: params.status } }
        );
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Delete Automation ────────────────────────────────────────
  server.registerTool(
    "oc_delete_automation",
    {
      title: "Delete Automation",
      description: `Permanently delete an automation workflow. This action cannot be undone.

Args:
  - store_id (string): Store ID.
  - automation_id (string): Automation ID.

Returns: Confirmation of deletion.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        automation_id: z.string().min(1).describe("Automation ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        await client.request<Record<string, unknown>>(
          `stores/${params.store_id}/automations/${params.automation_id}`,
          { method: "DELETE" }
        );
        return { content: [{ type: "text", text: `Automation ${params.automation_id} deleted successfully.` }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Trigger Test Event ───────────────────────────────────────
  server.registerTool(
    "oc_test_automation",
    {
      title: "Test Automation",
      description: `Fire a synthetic test event to validate an automation workflow without affecting real data. Useful for debugging n8n workflows before going live.

Args:
  - store_id (string): Store ID.
  - automation_id (string): Automation to test.
  - test_payload (object, optional): Custom payload to simulate the trigger event.

Returns: Test execution result with action outcomes and any errors.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        automation_id: z.string().min(1).describe("Automation ID to test"),
        test_payload: z.record(z.unknown()).optional().describe("Custom test payload to simulate the trigger"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Record<string, unknown>>(
          `stores/${params.store_id}/automations/${params.automation_id}/test`,
          { method: "POST", body: { payload: params.test_payload || {} } }
        );
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );
}
