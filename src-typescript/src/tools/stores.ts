// Store & Tenant Management Tools

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, OneCommerceApiError, truncateResponse } from "../services/api-client.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SUPPORTED_PLATFORMS } from "../constants.js";
import type { Store, Tenant } from "../types.js";

export function registerStoreTools(server: McpServer): void {
  // ── List Stores ──────────────────────────────────────────────
  server.registerTool(
    "oc_list_stores",
    {
      title: "List Stores",
      description: `List all stores in a tenant's vault. Returns store name, platform, status, and sync settings.

Args:
  - tenant_id (string, optional): Filter by tenant. Omit for all accessible stores.
  - status (string, optional): Filter by status — active | paused | onboarding.
  - platform (string, optional): Filter by platform — shopify, ebay, amazon, etc.
  - page (number, optional): Page number (default 1).
  - per_page (number, optional): Results per page, 1-100 (default 20).

Returns: Array of store objects with id, name, platform, status, tenant_id, and settings.`,
      inputSchema: {
        tenant_id: z.string().optional().describe("Tenant vault ID to scope results"),
        status: z.enum(["active", "paused", "onboarding"]).optional().describe("Filter by store status"),
        platform: z.enum(SUPPORTED_PLATFORMS).optional().describe("Filter by commerce platform"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Store[]>("stores", {
          params: {
            tenant_id: params.tenant_id,
            status: params.status,
            platform: params.platform,
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

  // ── Get Store Detail ─────────────────────────────────────────
  server.registerTool(
    "oc_get_store",
    {
      title: "Get Store Details",
      description: `Retrieve full details for a specific store, including settings, sync config, and platform credentials status.

Args:
  - store_id (string): The store's unique ID.

Returns: Complete store object including settings, inventory sync status, and platform metadata.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Unique store identifier"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Store>(`stores/${params.store_id}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Create Store ─────────────────────────────────────────────
  server.registerTool(
    "oc_create_store",
    {
      title: "Create Store",
      description: `Provision a new store inside a tenant vault. Phase I of the Cathedral Framework — lays the foundation with payment rails and store identity.

Args:
  - tenant_id (string): Tenant vault to create the store in.
  - name (string): Human-readable store name.
  - platform (string): Commerce platform — shopify, ebay, amazon, etc.
  - currency (string, optional): ISO 4217 currency code (default USD).
  - timezone (string, optional): IANA timezone (default America/Los_Angeles).

Returns: Newly created store object with ID.`,
      inputSchema: {
        tenant_id: z.string().min(1).describe("Parent tenant vault ID"),
        name: z.string().min(1).max(200).describe("Store display name"),
        platform: z.enum(SUPPORTED_PLATFORMS).describe("Target commerce platform"),
        currency: z.string().length(3).default("USD").describe("ISO 4217 currency code"),
        timezone: z.string().default("America/Los_Angeles").describe("IANA timezone identifier"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Store>("stores", {
          method: "POST",
          body: {
            tenant_id: params.tenant_id,
            name: params.name,
            platform: params.platform,
            settings: { currency: params.currency, timezone: params.timezone },
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── List Tenants ─────────────────────────────────────────────
  server.registerTool(
    "oc_list_tenants",
    {
      title: "List Tenants",
      description: `List all tenant vaults. Each tenant is an isolated schema-level partition per the Cathedral multi-tenant vault strategy.

Args:
  - page (number, optional): Page number (default 1).
  - per_page (number, optional): Results per page (default 20).

Returns: Array of tenant objects with id, name, plan, store count, and isolation level.`,
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Tenant[]>("tenants", {
          params: { page: params.page, per_page: params.per_page },
        });
        return { content: [{ type: "text", text: truncateResponse(JSON.stringify(res, null, 2)) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );
}
