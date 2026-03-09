#!/usr/bin/env node

// xyOps MCP Server Launcher
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const { createServerFromEnv } = require('../lib/mcp/server');

try {
	createServerFromEnv().start(process.stdin, process.stdout);
}
catch (err) {
	console.error("[xyops-mcp] " + err.message);
	process.exit(1);
}
