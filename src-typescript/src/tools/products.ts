// Product & Inventory Tools — Phase II "Raising the Walls"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, OneCommerceApiError, truncateResponse } from "../services/api-client.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";
import type { Product } from "../types.js";

export function registerProductTools(server: McpServer): void {
  // ── List Products ────────────────────────────────────────────
  server.registerTool(
    "oc_list_products",
    {
      title: "List Products",
      description: `List products in a store's catalog. Supports filtering by status, SKU search, and low-inventory flags.

Args:
  - store_id (string): Store to query.
  - status (string, optional): active | draft | archived.
  - search (string, optional): Search title or SKU.
  - low_inventory (boolean, optional): If true, returns only products at or below their inventory threshold.
  - page / per_page: Pagination controls.

Returns: Array of product objects with inventory quantities, platform IDs, and variant data.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID to list products for"),
        status: z.enum(["active", "draft", "archived"]).optional().describe("Product status filter"),
        search: z.string().max(200).optional().describe("Search by title or SKU"),
        low_inventory: z.boolean().optional().describe("Filter to low-inventory products only"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Product[]>(`stores/${params.store_id}/products`, {
          params: {
            status: params.status,
            search: params.search,
            low_inventory: params.low_inventory,
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

  // ── Get Product ──────────────────────────────────────────────
  server.registerTool(
    "oc_get_product",
    {
      title: "Get Product Details",
      description: `Retrieve full product details including all variants, cross-platform IDs, and inventory levels.

Args:
  - store_id (string): Store the product belongs to.
  - product_id (string): Product ID.

Returns: Full product object with variants, platform mapping, and inventory data.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        product_id: z.string().min(1).describe("Product ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Product>(`stores/${params.store_id}/products/${params.product_id}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Create Product ───────────────────────────────────────────
  server.registerTool(
    "oc_create_product",
    {
      title: "Create Product",
      description: `Add a new product to a store's catalog. The product is created as a load-bearing wall in the Cathedral — native to the platform, not a plugin dependency.

Args:
  - store_id (string): Target store.
  - title (string): Product title.
  - sku (string): Stock-keeping unit.
  - price (number): Price in store currency.
  - inventory_quantity (number): Starting inventory count.
  - inventory_threshold (number, optional): Low-stock alert threshold (default 5).
  - status (string, optional): active | draft (default draft).

Returns: Created product with assigned ID.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store to add the product to"),
        title: z.string().min(1).max(500).describe("Product title"),
        sku: z.string().min(1).max(100).describe("Stock-keeping unit code"),
        price: z.number().min(0).describe("Product price in store currency"),
        inventory_quantity: z.number().int().min(0).describe("Initial inventory count"),
        inventory_threshold: z.number().int().min(0).default(5).describe("Low-stock alert threshold"),
        status: z.enum(["active", "draft"]).default("draft").describe("Initial product status"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Product>(`stores/${params.store_id}/products`, {
          method: "POST",
          body: {
            title: params.title,
            sku: params.sku,
            price: params.price,
            inventory_quantity: params.inventory_quantity,
            inventory_threshold: params.inventory_threshold,
            status: params.status,
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Update Inventory ─────────────────────────────────────────
  server.registerTool(
    "oc_update_inventory",
    {
      title: "Update Inventory",
      description: `Adjust inventory quantity for a product. Uses the canonical source pattern — updates propagate to all connected spoke storefronts in real-time.

Args:
  - store_id (string): Store ID.
  - product_id (string): Product ID.
  - adjustment (number): Positive to add stock, negative to remove.
  - reason (string, optional): Audit reason for the adjustment.

Returns: Updated product with new inventory quantity.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        product_id: z.string().min(1).describe("Product ID"),
        adjustment: z.number().int().describe("Inventory adjustment — positive adds, negative removes"),
        reason: z.string().max(500).optional().describe("Audit reason for the change"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Product>(
          `stores/${params.store_id}/products/${params.product_id}/inventory`,
          {
            method: "PATCH",
            body: { adjustment: params.adjustment, reason: params.reason },
          }
        );
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Sync Inventory Across Stores ─────────────────────────────
  server.registerTool(
    "oc_sync_inventory",
    {
      title: "Sync Inventory Across Stores",
      description: `Trigger a cross-store inventory synchronization using the canonical source pattern. The canonical store propagates SKU quantities to all connected spoke storefronts via the BFF gateway.

Args:
  - canonical_store_id (string): The source-of-truth store.
  - target_store_ids (string[], optional): Specific spoke stores to sync. Omit to sync all connected stores.
  - sku_filter (string[], optional): Limit sync to specific SKUs.

Returns: Sync job status with per-store results.`,
      inputSchema: {
        canonical_store_id: z.string().min(1).describe("Source-of-truth store ID"),
        target_store_ids: z.array(z.string()).optional().describe("Target spoke store IDs (omit for all)"),
        sku_filter: z.array(z.string()).optional().describe("Limit sync to these SKUs"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Record<string, unknown>>(
          `stores/${params.canonical_store_id}/inventory/sync`,
          {
            method: "POST",
            body: {
              target_store_ids: params.target_store_ids,
              sku_filter: params.sku_filter,
            },
          }
        );
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );
}
