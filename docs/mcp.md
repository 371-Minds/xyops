# MCP Server

## Overview

xyOps ships with a standalone MCP server for AI agents that need to manage a xyOps deployment over the existing REST API.  It runs over STDIO, authenticates to xyOps using an API Key, and also exposes provider integrations for **Conway.tech**, **RackNerd**, **Akash**, and **IO Cloud** through a **Block Goose** backend.

This lets your agent backend connect to one MCP endpoint while keeping xyOps itself unchanged.

## Included Tools

The MCP server exposes the following tools, organized by the component they target.

### Core

- `xyops_ping` — Check API connectivity.
- `xyops_list_servers` — List registered worker servers.
- `xyops_list_events` — List events, optionally filtered by category or plugin.
- `xyops_list_jobs` — Search completed and active jobs.
- `xyops_run_event` — Run an event immediately.
- `xyops_list_plugins` — List available plugins.

### Core Concepts

- `xyops_list_categories` — List event and workflow categories.
- `xyops_list_channels` — List notification channels.
- `xyops_list_tags` — List tags.
- `xyops_list_buckets` — List data buckets.
- `xyops_list_secrets` — List secrets (metadata only; values are never returned).

### Monitoring & Operations

- `xyops_list_groups` — List server groups.
- `xyops_list_monitors` — List monitor definitions.
- `xyops_list_alerts` — List alert definitions.
- `xyops_search_tickets` — Search tickets.
- `xyops_create_ticket` — Create a new ticket.

### Integrations

- `xyops_list_web_hooks` — List configured web hooks.
- `xyops_list_integrations` — List Block Goose provider integrations.
- `xyops_call_integration` — Invoke a provider integration via Block Goose.

The integration tools are pre-wired to these provider IDs:

- `conway-tech`
- `racknerd`
- `akash`
- `io-cloud`

All four providers use the `block-goose` backend identifier so your agent runtime can route them through Block Goose.

## Configuration

Copy `sample_conf/mcp.json` to `conf/mcp.json` and fill in the values:

```json
{
	"backend": "block-goose",
	"xyops": {
		"api_url": "https://xyops.example.com",
		"api_key": "YOUR_XYOPS_API_KEY"
	},
	"block_goose": {
		"base_url": "https://block-goose.example.com/api",
		"api_key": "YOUR_BLOCK_GOOSE_TOKEN"
	}
}
```

You can also configure everything with environment variables:

| Variable | Description |
|----------|-------------|
| `XYOPS_API_URL` | Base xyOps URL (for example `https://xyops.example.com`) |
| `XYOPS_API_KEY` | xyOps API Key used by the MCP server |
| `XYOPS_API_TIMEOUT_SEC` | Optional timeout for xyOps REST API calls |
| `XYOPS_MCP_BACKEND` | Backend identifier, defaults to `block-goose` |
| `BLOCK_GOOSE_BASE_URL` | Base URL for the Block Goose backend |
| `BLOCK_GOOSE_API_KEY` | Shared Block Goose bearer token |
| `BLOCK_GOOSE_TIMEOUT_SEC` | Optional timeout for provider calls |
| `BLOCK_GOOSE_CONWAY_TECH_URL` / `_PATH` / `_API_KEY` | Optional Conway.tech override |
| `BLOCK_GOOSE_RACKNERD_URL` / `_PATH` / `_API_KEY` | Optional RackNerd override |
| `BLOCK_GOOSE_AKASH_URL` / `_PATH` / `_API_KEY` | Optional Akash override |
| `BLOCK_GOOSE_IO_CLOUD_URL` / `_PATH` / `_API_KEY` | Optional IO Cloud override |

## Running the MCP Server

After configuration, start the server with:

```sh
npm run mcp
```

The process speaks standard MCP JSON-RPC over STDIO, so it can be launched directly by agent runtimes and desktop clients that support MCP servers.

## xyOps Authentication

The MCP server uses the xyOps API Key system described in the [REST API](api.md) documentation.  Create a key with only the privileges your agents need.

For example:

- read-only agents can use `xyops_list_*` tools
- automation agents that need to trigger jobs also need permission to run events

## Provider Integration Routing

`xyops_call_integration` forwards requests to Block Goose as JSON:

```json
{
	"provider": {
		"id": "conway-tech",
		"title": "Conway.tech",
		"backend": "block-goose"
	},
	"operation": "inventory",
	"input": {
		"region": "us-east"
	}
}
```

The URL is composed from the configured Block Goose base URL plus the provider path, followed by the requested operation name.  For example:

```text
https://block-goose.example.com/api/providers/conway-tech/inventory
```

This keeps the provider-specific orchestration in Block Goose while xyOps remains the system of record for events, jobs, plugins, and servers.
