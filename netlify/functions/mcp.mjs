// 1Commerce MCP Server — Netlify Function
// 18 tools across the Cathedral Framework
// Endpoints: GET /health, POST /mcp

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { EventEmitter } from "events";

const API_BASE_URL = process.env.ONECOMMERCE_API_URL || "https://1commerce.online/api";
const API_KEY = process.env.ONECOMMERCE_API_KEY || "";
const MCP_API_KEY = process.env.MCP_API_KEY || "";
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

  // Phase I: Foundation — Stores & Tenants
  s.registerTool("listStores", { title: "List Stores", description: "List stores in a tenant vault. Filters: tenant_id, status, platform.", inputSchema: { tenant_id: z.string().optional(), status: z.enum(["active", "paused", "onboarding"]).optional(), platform: z.enum(PLATFORMS).optional(), ...pageSchema }, annotations: RO },
    wrap(async (p) => txt(await api("stores", { params: p }))));

  s.registerTool("getTenantInfo", { title: "Get Tenant Info", description: "Get tenant details by ID — each tenant is a schema-isolated vault.", inputSchema: { tenantId: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`tenants/${p.tenantId}`))));

  // Phase II: Walls — Products, Orders, Customers
  s.registerTool("listProducts", { title: "List Products", description: "List products with filters: status, search, low_inventory.", inputSchema: { tenantId: z.string().optional(), limit: z.number().int().min(1).max(MAX).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("products", { params: { tenant_id: p.tenantId, limit: p.limit } }))));

  s.registerTool("getProduct", { title: "Get Product", description: "Get product by ID with full details: variants, inventory, cross-platform IDs.", inputSchema: { productId: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`products/${p.productId}`))));

  s.registerTool("searchProducts", { title: "Search Products", description: "Search products by keyword across name and description.", inputSchema: { query: z.string().min(1).max(200), tenantId: z.string().optional() }, annotations: RO },
    wrap(async (p) => txt(await api("products/search", { params: { q: p.query, tenant_id: p.tenantId } }))));

  s.registerTool("listOrders", { title: "List Orders", description: "List orders with filters: status, platform, date range, customer.", inputSchema: { tenantId: z.string().optional(), limit: z.number().int().min(1).max(MAX).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("orders", { params: { tenant_id: p.tenantId, limit: p.limit } }))));

  s.registerTool("getOrder", { title: "Get Order", description: "Get order with line items, customer info, and fulfillment timeline.", inputSchema: { orderId: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`orders/${p.orderId}`))));

  s.registerTool("listCustomers", { title: "List Customers", description: "List customers with optional tenant filtering.", inputSchema: { tenantId: z.string().optional(), limit: z.number().int().min(1).max(MAX).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("customers", { params: { tenant_id: p.tenantId, limit: p.limit } }))));

  s.registerTool("getCustomer", { title: "Get Customer", description: "Get customer by ID with order history and contact info.", inputSchema: { customerId: z.string().min(1) }, annotations: RO },
    wrap(async (p) => txt(await api(`customers/${p.customerId}`))));

  s.registerTool("getInventory", { title: "Get Inventory", description: "Get inventory levels across all products, optionally filtered by tenant.", inputSchema: { tenantId: z.string().optional() }, annotations: RO },
    wrap(async (p) => txt(await api("inventory", { params: { tenant_id: p.tenantId } }))));

  s.registerTool("getLowStockProducts", { title: "Get Low Stock Products", description: "Get products below their inventory threshold. Default threshold: 10.", inputSchema: { threshold: z.number().int().min(0).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("products/low-stock", { params: { threshold: p.threshold ?? 10 } }))));

  s.registerTool("getAnalyticsSummary", { title: "Get Analytics Summary", description: "Get revenue, order count, and customer summary for a tenant or platform-wide.", inputSchema: { tenantId: z.string().optional() }, annotations: RO },
    wrap(async (p) => txt(await api("analytics/summary", { params: { tenant_id: p.tenantId } }))));

  s.registerTool("getRevenueByDay", { title: "Get Revenue By Day", description: "Get daily revenue breakdown, optionally filtered by tenant.", inputSchema: { tenantId: z.string().optional() }, annotations: RO },
    wrap(async (p) => txt(await api("analytics/revenue-by-day", { params: { tenant_id: p.tenantId } }))));

  s.registerTool("getTopProducts", { title: "Get Top Products", description: "Get top products by revenue. Default limit: 10.", inputSchema: { limit: z.number().int().min(1).max(50).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("analytics/top-products", { params: { limit: p.limit ?? 10 } }))));

  // Phase III: Vaults — Webhooks, Notifications, Categories
  s.registerTool("getWebhookEvents", { title: "Get Webhook Events", description: "Get recent webhook event logs with optional limit.", inputSchema: { limit: z.number().int().min(1).max(MAX).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("webhooks/events", { params: { limit: p.limit ?? 20 } }))));

  s.registerTool("getNotifications", { title: "Get Notifications", description: "Get platform notifications for alerts, automations, and system events.", inputSchema: { limit: z.number().int().min(1).max(MAX).optional() }, annotations: RO },
    wrap(async (p) => txt(await api("notifications", { params: { limit: p.limit ?? 20 } }))));

  s.registerTool("getCategories", { title: "Get Categories", description: "Get product categories, optionally filtered by tenant.", inputSchema: { tenantId: z.string().optional() }, annotations: RO },
    wrap(async (p) => txt(await api("categories", { params: { tenant_id: p.tenantId } }))));

  // Phase IV: Spire — Platform Intelligence
  s.registerTool("getPlatformStats", { title: "Get Platform Stats", description: "Get aggregated platform-wide statistics: tenant count, revenue, orders, customers.", inputSchema: {}, annotations: RO },
    wrap(async () => txt(await api("analytics/platform-stats"))));

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

  // Health check endpoint (no auth required)
  if (request.method === "GET") {
    return Response.json({ 
      status: "ok", 
      service: "onecommerce-mcp-server", 
      version: "1.0.0", 
      tools: 18, 
      timestamp: new Date().toISOString() 
    }, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (request.method === "POST") {
    // Validate MCP_API_KEY if configured
    if (MCP_API_KEY) {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== MCP_API_KEY) {
        return Response.json({ 
          jsonrpc: "2.0", 
          error: { code: -32000, message: "Unauthorized: Invalid or missing MCP_API_KEY" }, 
          id: null 
        }, { status: 401, headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

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
