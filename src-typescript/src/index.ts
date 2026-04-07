#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 1Commerce / UnifyOne MCP Server
// Cathedral Framework: Foundation → Walls → Vaults → Spire
//
// Exposes the full commerce platform to AI agents via MCP:
//   • Stores & Tenants (Foundation)
//   • Products & Inventory (Walls)
//   • Orders & Fulfillment (Walls)
//   • Automations (Vaults / Automation Nave)
//   • Manus AI Insights (Spire)
//
// Transports: stdio (default) or HTTP (set TRANSPORT=http)
// ─────────────────────────────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerStoreTools } from "./tools/stores.js";
import { registerProductTools } from "./tools/products.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerManusAiTools } from "./tools/manus-ai.js";
import { registerAutomationTools } from "./tools/automations.js";

// ── Server Instance ────────────────────────────────────────────

function createServer(): McpServer {
  const server = new McpServer({
    name: "onecommerce-mcp-server",
    version: "1.0.0",
  });

  // Phase I — Foundation
  registerStoreTools(server);

  // Phase II — Raising the Walls
  registerProductTools(server);
  registerOrderTools(server);

  // Phase III — Installing the Vaults
  registerAutomationTools(server);

  // Phase IV — Lighting the Spire
  registerManusAiTools(server);

  return server;
}

// ── stdio Transport ────────────────────────────────────────────

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("1Commerce MCP server running on stdio");
}

// ── HTTP Transport ─────────────────────────────────────────────

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "onecommerce-mcp-server", version: "1.0.0" });
  });

  // MCP endpoint — stateless per-request transport
  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3001", 10);
  app.listen(port, () => {
    console.error(`1Commerce MCP server running on http://localhost:${port}/mcp`);
  });
}

// ── Entry Point ────────────────────────────────────────────────

const transport = process.env.TRANSPORT || "stdio";

if (transport === "http") {
  runHTTP().catch((error: unknown) => {
    console.error("Fatal server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error: unknown) => {
    console.error("Fatal server error:", error);
    process.exit(1);
  });
}
