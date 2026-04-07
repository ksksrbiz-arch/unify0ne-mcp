# onecommerce-mcp-server

MCP server for the **1Commerce / UnifyOne** multi-tenant commerce platform by PNW Enterprises.

Exposes the full Cathedral Framework to AI agents:

| Phase | Layer | Tools |
|-------|-------|-------|
| I — Foundation | Stores & Tenants | `oc_list_stores`, `oc_get_store`, `oc_create_store`, `oc_list_tenants` |
| II — Walls | Products & Inventory | `oc_list_products`, `oc_get_product`, `oc_create_product`, `oc_update_inventory`, `oc_sync_inventory` |
| II — Walls | Orders & Fulfillment | `oc_list_orders`, `oc_get_order`, `oc_fulfill_order`, `oc_cancel_order` |
| III — Vaults | Automations | `oc_list_automations`, `oc_create_automation`, `oc_toggle_automation`, `oc_delete_automation`, `oc_test_automation` |
| IV — Spire | Manus AI | `oc_manus_insights`, `oc_manus_earnings_projection`, `oc_manus_route_intelligence`, `oc_manus_challenge_strategy` |

## Quick Start

```bash
# Install
npm install

# Build
npm run build

# Run (stdio — for Claude Desktop / Claude Code)
npm start

# Run (HTTP — for remote agents / Cloud Run)
TRANSPORT=http PORT=3001 npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ONECOMMERCE_API_URL` | No | API base URL (default: `https://api.1commerce.online/v1`) |
| `ONECOMMERCE_API_KEY` | Yes | Bearer token for API authentication |
| `TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP port when using HTTP transport (default: `3001`) |

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "onecommerce": {
      "command": "node",
      "args": ["/absolute/path/to/onecommerce-mcp-server/dist/index.js"],
      "env": {
        "ONECOMMERCE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Claude Code Configuration

Add to `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "onecommerce": {
      "command": "node",
      "args": ["./onecommerce-mcp-server/dist/index.js"],
      "env": {
        "ONECOMMERCE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## HTTP / Remote Deployment

For Cloud Run or any remote host:

```bash
TRANSPORT=http PORT=3001 node dist/index.js
```

Health check: `GET /health`  
MCP endpoint: `POST /mcp`

## Development

```bash
# Watch mode (auto-rebuild on change)
npm run dev

# Test with MCP Inspector
npm run inspect
```

## Architecture

```
src/
├── index.ts              # Entry point — transport selection & tool registration
├── constants.ts          # API URL, limits, enums
├── types.ts              # TypeScript interfaces for the 1Commerce domain
├── services/
│   └── api-client.ts     # Shared HTTP client with auth & error handling
└── tools/
    ├── stores.ts         # Store & tenant management (Phase I)
    ├── products.ts       # Product & inventory ops (Phase II)
    ├── orders.ts         # Order management & fulfillment (Phase II)
    ├── automations.ts    # Event-driven automation workflows (Phase III)
    └── manus-ai.ts       # AI insights, route intelligence, earnings (Phase IV)
```

## License

MIT — PNW Enterprises
