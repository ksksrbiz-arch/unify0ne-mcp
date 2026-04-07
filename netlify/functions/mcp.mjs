// 1Commerce MCP Server — Netlify Function
// 18 tools across the Cathedral Framework
// Endpoints: GET /health, POST /mcp

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { EventEmitter } from "events";

const API_BASE_URL = process.env.ONECOMMERCE_API_URL || "https://api.1commerce.online/v1";
const API_KEY = process.env.ONECOMMERCE_API_KEY || "";
const MAX = 100;
const DEF = 20;
const PLATFORMS = ["shopify", "ebay", "amazon", "doordash", "uber_eats", "instacart", "grubhub"];
const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
const TRIGGERS = ["order_created", "order_fulfilled", "inventory_low", "customer_created", "payment_received", "shift_completed", "route_optimized", "challenge_unlocked"];

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
  toToolResult() {
    const hints = { 401: "Check ONECOMMERCE_API_KEY.", 403: "API key lacks permission.", 404: "Resource not found.", 429: "Rate limited." };
    return { content: [{ type: "text", text: `Error [${this.code}]: ${this.message}${hints[this.status] ? "\n\n" + hints[this.status] : ""}` }] };
  }
}

async function api(path, opts = {}) {
  const { method = "GET", body, params } = opts;
  const url = new URL(`${API_BASE_URL}/${path}`);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const fetchOpts = { method, headers };
  if (body && method !== "GET") fetchOpts.body = JSON.stringify(body);
  try {
    const res = await fetch(url.toString(), fetchOpts);
    if (!res.ok) {
      const text = await res.text();
      let p; try { p = JSON.parse(text); } catch { p = { code: `HTTP_${res.status}`, message: text.slice(0, 200) }; }
      throw new ApiError(res.status, p.code || `HTTP_${res.status}`, p.message || text.slice(0, 200));
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, "NETWORK_ERROR", `Failed to connect to 1Commerce API: ${err.message}`);
  }
}

const wrap = (fn) => async (p) => {
  try { return await fn(p); }
  catch (err) {
    if (err instanceof ApiError) return err.toToolResult();
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
};
const txt = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2).slice(0, 50000) }] });
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const DEL = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const AI = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const pageSchema = { page: z.number().int().min(1).default(1), per_page: z.number().int().min(1).max(MAX).default(DEF) };

function createServer() {
  const s = new McpServer({ name: "onecommerce-mcp-server", version: "1.0.0" });

  // Phase I: Foundation
  s.registerTool("oc_list_stores", { title: "List Stores", description: "List stores in a tenant vault. Filters: tenant_id, status, platform.", inputSchema: { tenant_id: z.string().optional(), status: z.enum(["active", "paused", "onboarding"]).optional(), platform: z.enum(PLATFORMS).optional(), ...pageSchema }, annotations: RO },
    wrap(async (p) => txt(await api("stores", { params: p }))));

  s.registerTool("oc_get_store", { title: "Get Store", description: "Retrieve full store details including settings and platform status.", inputSchema: { store_id: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`stores/${p.store_id}`))));

  s.registerTool("oc_create_store", { title: "Create Store", description: "Provision a new store in a tenant vault. Phase I — lays the foundation.", inputSchema: { tenant_id: z.string().min(1), name: z.string().min(1).max(200), platform: z.enum(PLATFORMS), currency: z.string().length(3).default("USD"), timezone: z.string().default("America/Los_Angeles") }, annotations: RW },
    wrap(async (p) => txt(await api("stores", { method: "POST", body: { tenant_id: p.tenant_id, name: p.name, platform: p.platform, settings: { currency: p.currency, timezone: p.timezone } } }))));

  s.registerTool("oc_list_tenants", { title: "List Tenants", description: "List tenant vaults — each is a schema-isolated partition.", inputSchema: pageSchema, annotations: RO },
    wrap(async (p) => txt(await api("tenants", { params: p }))));

  // Phase II: Walls
  s.registerTool("oc_list_products", { title: "List Products", description: "List products. Filters: status, search, low_inventory.", inputSchema: { store_id: z.string().min(1), status: z.enum(["active", "draft", "archived"]).optional(), search: z.string().max(200).optional(), low_inventory: z.boolean().optional(), ...pageSchema }, annotations: RO },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/products`, { params: p }))));

  s.registerTool("oc_get_product", { title: "Get Product", description: "Full product details: variants, cross-platform IDs, inventory.", inputSchema: { store_id: z.string().min(1), product_id: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/products/${p.product_id}`))));

  s.registerTool("oc_create_product", { title: "Create Product", description: "Add a product to a store catalog.", inputSchema: { store_id: z.string().min(1), title: z.string().min(1).max(500), sku: z.string().min(1).max(100), price: z.number().min(0), inventory_quantity: z.number().int().min(0), inventory_threshold: z.number().int().min(0).default(5), status: z.enum(["active", "draft"]).default("draft") }, annotations: RW },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/products`, { method: "POST", body: p }))));

  s.registerTool("oc_update_inventory", { title: "Update Inventory", description: "Adjust inventory. Propagates to spoke storefronts via canonical source pattern.", inputSchema: { store_id: z.string().min(1), product_id: z.string().min(1), adjustment: z.number().int(), reason: z.string().max(500).optional() }, annotations: RW },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/products/${p.product_id}/inventory`, { method: "PATCH", body: { adjustment: p.adjustment, reason: p.reason } }))));

  s.registerTool("oc_sync_inventory", { title: "Sync Inventory", description: "Cross-store inventory sync via canonical source pattern.", inputSchema: { canonical_store_id: z.string().min(1), target_store_ids: z.array(z.string()).optional(), sku_filter: z.array(z.string()).optional() }, annotations: { ...RW, idempotentHint: true } },
    wrap(async (p) => txt(await api(`stores/${p.canonical_store_id}/inventory/sync`, { method: "POST", body: p }))));

  s.registerTool("oc_list_orders", { title: "List Orders", description: "List orders with filters: status, platform, date range, customer.", inputSchema: { store_id: z.string().min(1), status: z.enum(STATUSES).optional(), platform: z.enum(PLATFORMS).optional(), since: z.string().optional(), until: z.string().optional(), customer_email: z.string().email().optional(), ...pageSchema }, annotations: RO },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/orders`, { params: p }))));

  s.registerTool("oc_get_order", { title: "Get Order", description: "Full order details: line items, customer, fulfillment timeline.", inputSchema: { store_id: z.string().min(1), order_id: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/orders/${p.order_id}`))));

  s.registerTool("oc_fulfill_order", { title: "Fulfill Order", description: "Mark order fulfilled with optional tracking. Fires order_fulfilled event.", inputSchema: { store_id: z.string().min(1), order_id: z.string().min(1), tracking_number: z.string().max(200).optional(), carrier: z.string().max(100).optional(), notify_customer: z.boolean().default(true) }, annotations: { ...RW, idempotentHint: true } },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/orders/${p.order_id}/fulfill`, { method: "POST", body: p }))));

  s.registerTool("oc_cancel_order", { title: "Cancel Order", description: "Cancel a pending/confirmed order. Restocks inventory.", inputSchema: { store_id: z.string().min(1), order_id: z.string().min(1), reason: z.string().min(1).max(500), restock: z.boolean().default(true) }, annotations: DEL },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/orders/${p.order_id}/cancel`, { method: "POST", body: { reason: p.reason, restock: p.restock } }))));

  // Phase III: Vaults
  s.registerTool("oc_list_automations", { title: "List Automations", description: "List event-driven workflows in the Automation Nave.", inputSchema: { store_id: z.string().min(1), status: z.enum(["active", "paused", "draft"]).optional(), trigger_type: z.enum(TRIGGERS).optional(), ...pageSchema }, annotations: RO },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/automations`, { params: p }))));

  s.registerTool("oc_create_automation", { title: "Create Automation", description: "Create an event-driven workflow. Fires instantly on commerce events.", inputSchema: { store_id: z.string().min(1), name: z.string().min(1).max(200), trigger_type: z.enum(TRIGGERS), trigger_config: z.record(z.unknown()).optional(), actions: z.array(z.object({ type: z.string().min(1), config: z.record(z.unknown()) })).min(1) }, annotations: RW },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/automations`, { method: "POST", body: { name: p.name, trigger_type: p.trigger_type, trigger_config: p.trigger_config || {}, actions: p.actions.map((a, i) => ({ ...a, order: i + 1 })) } }))));

  s.registerTool("oc_toggle_automation", { title: "Toggle Automation", description: "Activate or pause an automation workflow.", inputSchema: { store_id: z.string().min(1), automation_id: z.string().min(1), status: z.enum(["active", "paused"]) }, annotations: { ...RW, idempotentHint: true } },
    wrap(async (p) => txt(await api(`stores/${p.store_id}/automations/${p.automation_id}`, { method: "PATCH", body: { status: p.status } }))));

  // Phase IV: Spire — Manus AI
  s.registerTool("oc_manus_insights", { title: "Manus AI Insights", description: "AI insights from real shift logs and earnings history. Types: route, earnings, challenge, tax, trend.", inputSchema: { store_id: z.string().min(1), insight_types: z.array(z.enum(["route", "earnings", "challenge", "tax", "trend"])).optional(), period: z.enum(["today", "this_week", "this_month", "last_30_days"]).default("last_30_days"), limit: z.number().int().min(1).max(50).default(10) }, annotations: AI },
    wrap(async (p) => txt(await api("manus/insights", { params: { store_id: p.store_id, types: p.insight_types?.join(","), period: p.period, limit: p.limit } }))));

  s.registerTool("oc_manus_earnings_projection", { title: "Manus Earnings Projection", description: "Projected gross/net/tax from real shift logs.", inputSchema: { store_id: z.string().min(1), projection_period: z.enum(["next_week", "next_month", "next_quarter"]), include_platforms: z.array(z.string()).optional() }, annotations: AI },
    wrap(async (p) => txt(await api("manus/earnings-projection", { params: { store_id: p.store_id, period: p.projection_period, platforms: p.include_platforms?.join(",") } }))));

  s.registerTool("oc_manus_route_intelligence", { title: "Manus Route Intelligence", description: "Analyze gig route performance from shift data. Finds optimal time slots.", inputSchema: { store_id: z.string().min(1), day_of_week: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).optional(), platform: z.string().optional() }, annotations: AI },
    wrap(async (p) => txt(await api("manus/route-intelligence", { params: { store_id: p.store_id, day: p.day_of_week, platform: p.platform } }))));

  s.registerTool("oc_manus_challenge_strategy", { title: "Manus Challenge Strategy", description: "Optimal completion paths for active platform challenges.", inputSchema: { store_id: z.string().min(1), challenge_id: z.string().optional() }, annotations: AI },
    wrap(async (p) => txt(await api(p.challenge_id ? `manus/challenges/${p.challenge_id}/strategy` : "manus/challenges/strategy", { params: { store_id: p.store_id } }))));

  return s;
}

function mockRes() {
  const r = new EventEmitter();
  r._status = 200; r._headers = {}; r._body = "";
  r.writeHead = (s, h) => { r._status = s; if (h) Object.assign(r._headers, h); return r; };
  r.setHeader = (k, v) => { r._headers[k] = v; };
  r.write = (c) => { r._body += typeof c === "string" ? c : c.toString(); };
  r.end = (c) => { if (c) r.write(c); r.emit("finish"); };
  return r;
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
  }
  if (request.method === "GET") {
    return Response.json({ status: "ok", server: "onecommerce-mcp-server", version: "1.0.0", tools: 18, transport: "netlify-functions" }, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      const mockReq = { method: "POST", headers: Object.fromEntries(request.headers.entries()), url: "/mcp" };
      const res = mockRes();
      const done = new Promise((resolve) => res.on("finish", () => resolve({ s: res._status, h: res._headers, b: res._body })));
      await server.connect(transport);
      await transport.handleRequest(mockReq, res, body);
      const r = await done;
      return new Response(r.b, { status: r.s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...r.h } });
    } catch (err) {
      return Response.json({ jsonrpc: "2.0", error: { code: -32603, message: `Internal error: ${err.message}` }, id: null }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }
  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: ["/mcp", "/health"] };
