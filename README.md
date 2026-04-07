# onecommerce-mcp-server

Production MCP (Model Context Protocol) server for the **1Commerce / UnifyOne** multi-tenant commerce platform. Deploys to Netlify as a serverless function at `/mcp`.

**Cathedral Framework** — 18 tools across 4 phases:

| Phase | Layer | Tools | Count |
|-------|-------|-------|-------|
| I — Foundation | Stores & Tenants | `oc_list_stores`, `oc_get_store`, `oc_create_store`, `oc_list_tenants` | 4 |
| II — Walls | Products & Inventory | `oc_list_products`, `oc_get_product`, `oc_create_product`, `oc_update_inventory`, `oc_sync_inventory` | 5 |
| II — Walls | Orders & Fulfillment | `oc_list_orders`, `oc_get_order`, `oc_fulfill_order`, `oc_cancel_order` | 4 |
| III — Vaults | Automations | `oc_list_automations`, `oc_create_automation`, `oc_toggle_automation` | 3 |
| IV — Spire | Manus AI | `oc_manus_insights`, `oc_manus_earnings_projection`, `oc_manus_route_intelligence`, `oc_manus_challenge_strategy` | 4 |

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

| Variable | Required | Default |
|----------|----------|---------|
| `ONECOMMERCE_API_URL` | No | `https://api.1commerce.online/v1` |
| `ONECOMMERCE_API_KEY` | Yes | — |

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
