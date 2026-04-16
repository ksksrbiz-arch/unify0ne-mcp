# onecommerce-mcp-server

Production MCP (Model Context Protocol) server for the **1Commerce / UnifyOne** multi-tenant commerce platform. Deploys to Netlify as a serverless function at `/mcp`.

**UnifyOne Platform Integration** — 18 tools across 4 tiers:

| Tier | Category | Tools | Count |
|------|----------|-------|-------|
| I — Foundation | Stores & Tenants | `listStores`, `getTenantInfo` | 2 |
| II — Walls | Products & Inventory | `listProducts`, `getProduct`, `searchProducts`, `getInventory`, `getLowStockProducts` | 5 |
| II — Walls | Orders & Customers | `listOrders`, `getOrder`, `listCustomers`, `getCustomer` | 4 |
| III — Vaults | Analytics & Data | `getAnalyticsSummary`, `getRevenueByDay`, `getTopProducts`, `getWebhookEvents`, `getNotifications`, `getCategories` | 6 |
| IV — Spire | Platform Intelligence | `getPlatformStats` | 1 |

## Repo Layout

```
/
├── netlify/functions/mcp.mjs    # Self-contained serverless MCP server (deployed to Netlify)
├── netlify.toml                 # Netlify build config + routing
├── public/index.html            # Landing page
├── package.json                 # MCP SDK + Zod deps
├── src-typescript/              # Original TypeScript source for local/stdio use
│   ├── src/                     # Modular tools split by domain
│   ├── tsconfig.json
│   ├── package.json
│   ├── stress-test.mjs          # Load test script
│   └── README.md
└── .env.example
```

## Deploy

Netlify auto-deploys this repo on every push to `main`. Configure these environment variables in the Netlify dashboard:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ONECOMMERCE_API_URL` | No | `https://1commerce.online/api` | Backend API URL |
| `ONECOMMERCE_API_KEY` | Yes | — | API key for backend authentication |
| `MCP_API_KEY` | Recommended | — | API key for inbound MCP requests |

## Platform Integration

This MCP server is designed to integrate with the **UnifyOne Platform** (`unifyone-netlify-supabase`). The platform uses this server as its external MCP worker.

### Platform Configuration

In the UnifyOne platform's environment variables (Netlify dashboard or `.env`), set:

```bash
# Point to this MCP server's deployment URL
MCP_WORKER_URL=https://1commerce.online

# OR for Netlify branch deploys:
MCP_WORKER_URL=https://[your-site-name].netlify.app

# Set the MCP API key (must match MCP_API_KEY in this repo)
MCP_API_KEY=your_generated_api_key_here
```

### Generating an API Key

Generate a secure random API key and set it in **both** repositories:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

1. **In this repo** (`unify0ne-mcp`): Set `MCP_API_KEY` in Netlify environment variables
2. **In the platform** (`unifyone-netlify-supabase`): Set the same value as `MCP_API_KEY`

The platform will send this key in the `Authorization: Bearer` header on every request.

### Tool Mapping

This server exposes **18 tools** matching the platform's expected interface:

| Category | Tools |
|----------|-------|
| Foundation | `listStores`, `getTenantInfo` |
| Products & Inventory | `listProducts`, `getProduct`, `searchProducts`, `getInventory`, `getLowStockProducts` |
| Orders & Customers | `listOrders`, `getOrder`, `listCustomers`, `getCustomer` |
| Analytics | `getAnalyticsSummary`, `getRevenueByDay`, `getTopProducts` |
| Platform Data | `getWebhookEvents`, `getNotifications`, `getCategories`, `getPlatformStats` |

### Health Check

Test the connection from the platform:

```bash
curl https://1commerce.online/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "onecommerce-mcp-server",
  "version": "1.0.0",
  "tools": 18,
  "timestamp": "2026-04-16T13:01:32.803Z"
}
```

## Usage

**Claude Desktop / Claude Code:**

```json
{
  "mcpServers": {
    "onecommerce": {
      "url": "https://1commerce.online/mcp"
    }
  }
}
```

**curl test:**

```bash
curl -X POST https://1commerce.online/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## Local Development (stdio)

For Claude Desktop with a local subprocess instead of HTTP:

```bash
cd src-typescript
npm install
npm run build
node dist/index.js    # runs in stdio mode
```

**Note:** The TypeScript source in `src-typescript/` uses the original `oc_*` tool naming convention and is provided for local development and testing. The production Netlify function (`netlify/functions/mcp.mjs`) has been updated with the platform-compatible tool names (`listStores`, `getProduct`, etc.) and is what the UnifyOne platform uses.

## Stress Test Results

| Scenario | Requests | RPS | p95 | Errors |
|----------|----------|-----|-----|--------|
| Health endpoint | 20 | — | 85.6ms | 0 |
| Concurrency ramp (1→100) | 955 | — | 993ms@100 | 0 |
| Sustained load (50 conc) | 1,000 | 101 | 595ms | 0 |
| Rapid fire (100 conc) | 1,000 | 101 | 1,023ms | 0 |
| **Total** | **3,003** | — | — | **0 (0.00%)** |

## License

MIT © PNW Enterprises
