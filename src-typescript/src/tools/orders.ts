// Order Management Tools

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, OneCommerceApiError, truncateResponse } from "../services/api-client.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ORDER_STATUSES, SUPPORTED_PLATFORMS } from "../constants.js";
import type { Order } from "../types.js";

export function registerOrderTools(server: McpServer): void {
  // ── List Orders ──────────────────────────────────────────────
  server.registerTool(
    "oc_list_orders",
    {
      title: "List Orders",
      description: `List orders for a store with filtering by status, platform, date range, and customer.

Args:
  - store_id (string): Store to query.
  - status (string, optional): Filter by order status.
  - platform (string, optional): Filter by originating platform.
  - since (string, optional): ISO 8601 date — only orders created after this date.
  - until (string, optional): ISO 8601 date — only orders created before this date.
  - customer_email (string, optional): Filter by customer email.
  - page / per_page: Pagination controls.

Returns: Array of order objects with line items, totals, and fulfillment status.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        status: z.enum(ORDER_STATUSES).optional().describe("Order status filter"),
        platform: z.enum(SUPPORTED_PLATFORMS).optional().describe("Originating platform filter"),
        since: z.string().optional().describe("ISO 8601 start date filter"),
        until: z.string().optional().describe("ISO 8601 end date filter"),
        customer_email: z.string().email().optional().describe("Filter by customer email"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Order[]>(`stores/${params.store_id}/orders`, {
          params: {
            status: params.status,
            platform: params.platform,
            since: params.since,
            until: params.until,
            customer_email: params.customer_email,
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

  // ── Get Order ────────────────────────────────────────────────
  server.registerTool(
    "oc_get_order",
    {
      title: "Get Order Details",
      description: `Retrieve full order details including line items, customer info, payment status, and fulfillment timeline.

Args:
  - store_id (string): Store ID.
  - order_id (string): Order ID.

Returns: Complete order object.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        order_id: z.string().min(1).describe("Order ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Order>(`stores/${params.store_id}/orders/${params.order_id}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      } catch (err: unknown) {
        if (err instanceof OneCommerceApiError) return err.toToolResult();
        throw err;
      }
    }
  );

  // ── Fulfill Order ────────────────────────────────────────────
  server.registerTool(
    "oc_fulfill_order",
    {
      title: "Fulfill Order",
      description: `Mark an order as fulfilled with optional tracking information. Fires an order_fulfilled event that triggers any connected automation workflows in the Automation Nave.

Args:
  - store_id (string): Store ID.
  - order_id (string): Order ID.
  - tracking_number (string, optional): Carrier tracking number.
  - carrier (string, optional): Shipping carrier name.
  - notify_customer (boolean, optional): Send fulfillment notification (default true).

Returns: Updated order with fulfillment timestamp.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        order_id: z.string().min(1).describe("Order ID"),
        tracking_number: z.string().max(200).optional().describe("Carrier tracking number"),
        carrier: z.string().max(100).optional().describe("Shipping carrier name"),
        notify_customer: z.boolean().default(true).describe("Send fulfillment email to customer"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Order>(
          `stores/${params.store_id}/orders/${params.order_id}/fulfill`,
          {
            method: "POST",
            body: {
              tracking_number: params.tracking_number,
              carrier: params.carrier,
              notify_customer: params.notify_customer,
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

  // ── Cancel Order ─────────────────────────────────────────────
  server.registerTool(
    "oc_cancel_order",
    {
      title: "Cancel Order",
      description: `Cancel a pending or confirmed order. Restocks inventory automatically and fires a cancellation event.

Args:
  - store_id (string): Store ID.
  - order_id (string): Order ID.
  - reason (string): Cancellation reason.
  - restock (boolean, optional): Restock inventory (default true).

Returns: Updated order with cancelled status.`,
      inputSchema: {
        store_id: z.string().min(1).describe("Store ID"),
        order_id: z.string().min(1).describe("Order ID"),
        reason: z.string().min(1).max(500).describe("Cancellation reason"),
        restock: z.boolean().default(true).describe("Restock cancelled items"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const client = getClient();
        const res = await client.request<Order>(
          `stores/${params.store_id}/orders/${params.order_id}/cancel`,
          {
            method: "POST",
            body: { reason: params.reason, restock: params.restock },
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
