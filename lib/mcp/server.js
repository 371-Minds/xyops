// xyOps MCP Server
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const Path = require('path');
const pkg = require('../../package.json');
const { XYOpsAPIClient, normalizeXYOpsAPIBase } = require('./xyops-client');
const { BlockGooseClient } = require('./block-goose');
const { getProviderCatalog, getProvider } = require('./providers');

class MCPError extends Error {
	constructor(code, message, data) {
		super(message);
		this.code = code;
		this.data = data;
	}
}

class XYOpsMCPServer {
	constructor(opts) {
		opts = opts || {};
		this.xyopsClient = opts.xyopsClient;
		this.blockGooseClient = opts.blockGooseClient;
		this.backend = opts.backend || 'block-goose';
	}
	
	getTools() {
		return [
			{
				name: 'xyops_ping',
				description: 'Check xyOps API connectivity.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_servers',
				description: 'List servers currently registered in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_events',
				description: 'List events in xyOps, optionally filtered by category or plugin.',
				inputSchema: {
					type: 'object',
					properties: {
						category: { type: 'string' },
						plugin: { type: 'string' }
					},
					additionalProperties: false
				}
			},
			{
				name: 'xyops_list_jobs',
				description: 'Search jobs in xyOps.',
				inputSchema: {
					type: 'object',
					properties: {
						offset: { type: 'integer', minimum: 0 },
						limit: { type: 'integer', minimum: 1, maximum: 1000 },
						query: { type: 'string' }
					},
					additionalProperties: false
				}
			},
			{
				name: 'xyops_run_event',
				description: 'Run a xyOps event immediately.',
				inputSchema: {
					type: 'object',
					required: ['id'],
					properties: {
						id: { type: 'string' },
						target: { type: 'string' },
						params: { type: 'object' },
						input: { type: 'object' }
					},
					additionalProperties: false
				}
			},
			{
				name: 'xyops_list_plugins',
				description: 'List plugins available to xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_categories',
				description: 'List event and workflow categories in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_channels',
				description: 'List notification channels in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_tags',
				description: 'List tags defined in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_buckets',
				description: 'List data buckets in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_secrets',
				description: 'List secrets in xyOps (metadata only; values are never returned).',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_groups',
				description: 'List server groups in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_monitors',
				description: 'List monitors defined in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_alerts',
				description: 'List alert definitions in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_search_tickets',
				description: 'Search tickets in xyOps.',
				inputSchema: {
					type: 'object',
					properties: {
						query: { type: 'string' },
						offset: { type: 'integer', minimum: 0 },
						limit: { type: 'integer', minimum: 1, maximum: 1000 }
					},
					additionalProperties: false
				}
			},
			{
				name: 'xyops_create_ticket',
				description: 'Create a new ticket in xyOps.',
				inputSchema: {
					type: 'object',
					required: ['title'],
					properties: {
						title: { type: 'string' },
						body: { type: 'string' },
						tags: { type: 'array', items: { type: 'string' } }
					},
					additionalProperties: false
				}
			},
			{
				name: 'xyops_list_web_hooks',
				description: 'List web hooks configured in xyOps.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_list_integrations',
				description: 'List provider integrations exposed through the Block Goose backend.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false }
			},
			{
				name: 'xyops_call_integration',
				description: 'Invoke a Conway.tech, RackNerd, Akash, or IO Cloud integration via Block Goose.',
				inputSchema: {
					type: 'object',
					required: ['provider', 'operation'],
					properties: {
						provider: { type: 'string' },
						operation: { type: 'string' },
						input: { type: 'object' }
					},
					additionalProperties: false
				}
			}
		];
	}
	
	async callTool(name, args) {
		args = args || {};
		
		switch (name) {
			case 'xyops_ping':
				return this.wrapResult(await this.xyopsClient.request('ping', {}, { method: 'GET' }));
			
			case 'xyops_list_servers':
				return this.wrapResult(await this.xyopsClient.request('get_servers', {}, { method: 'GET' }));
			
			case 'xyops_list_events':
				return this.wrapResult(await this.xyopsClient.request('get_events', cleanObject({
					category: args.category,
					plugin: args.plugin
				}), { method: 'GET' }));
			
			case 'xyops_list_jobs':
				return this.wrapResult(await this.xyopsClient.request('get_jobs', cleanObject({
					offset: args.offset,
					limit: args.limit,
					query: args.query || '*'
				}), { method: 'POST' }));
			
			case 'xyops_run_event':
				if (!args.id) throw new MCPError(-32602, "The 'id' field is required.");
				return this.wrapResult(await this.xyopsClient.request('run_event', cleanObject({
					id: args.id,
					target: args.target,
					params: args.params,
					input: args.input
				}), { method: 'POST' }));
			
			case 'xyops_list_plugins':
				return this.wrapResult(await this.xyopsClient.request('get_plugins', {}, { method: 'GET' }));
			
			case 'xyops_list_categories':
				return this.wrapResult(await this.xyopsClient.request('get_categories', {}, { method: 'GET' }));
			
			case 'xyops_list_channels':
				return this.wrapResult(await this.xyopsClient.request('get_channels', {}, { method: 'GET' }));
			
			case 'xyops_list_tags':
				return this.wrapResult(await this.xyopsClient.request('get_tags', {}, { method: 'GET' }));
			
			case 'xyops_list_buckets':
				return this.wrapResult(await this.xyopsClient.request('get_buckets', {}, { method: 'GET' }));
			
			case 'xyops_list_secrets':
				return this.wrapResult(await this.xyopsClient.request('get_secrets', {}, { method: 'GET' }));
			
			case 'xyops_list_groups':
				return this.wrapResult(await this.xyopsClient.request('get_groups', {}, { method: 'GET' }));
			
			case 'xyops_list_monitors':
				return this.wrapResult(await this.xyopsClient.request('get_monitors', {}, { method: 'GET' }));
			
			case 'xyops_list_alerts':
				return this.wrapResult(await this.xyopsClient.request('get_alerts', {}, { method: 'GET' }));
			
			case 'xyops_search_tickets':
				return this.wrapResult(await this.xyopsClient.request('search_tickets', cleanObject({
					query: args.query || '*',
					offset: args.offset,
					limit: args.limit
				}), { method: 'POST' }));
			
			case 'xyops_create_ticket':
				if (!args.title) throw new MCPError(-32602, "The 'title' field is required.");
				return this.wrapResult(await this.xyopsClient.request('create_ticket', cleanObject({
					title: args.title,
					body: args.body,
					tags: args.tags
				}), { method: 'POST' }));
			
			case 'xyops_list_web_hooks':
				return this.wrapResult(await this.xyopsClient.request('get_web_hooks', {}, { method: 'GET' }));
			
			case 'xyops_list_integrations':
				return this.wrapResult({
					code: 0,
					backend: this.backend,
					providers: getProviderCatalog()
				});
			
			case 'xyops_call_integration':
				if (!args.provider) throw new MCPError(-32602, "The 'provider' field is required.");
				if (!args.operation) throw new MCPError(-32602, "The 'operation' field is required.");
				
				var provider = getProvider(args.provider);
				if (!provider) throw new MCPError(-32602, "Unsupported provider: " + args.provider);
				if (provider.backend !== this.backend) throw new MCPError(-32602, "Provider backend mismatch: " + provider.backend);
				
				return this.wrapResult(await this.blockGooseClient.call(provider, args.operation, args.input));
			
			default:
				throw new MCPError(-32601, "Tool not found: " + name);
		}
	}
	
	wrapResult(result) {
		return {
			content: [
				{ type: 'text', text: JSON.stringify(result, null, "\t") }
			],
			structuredContent: result
		};
	}
	
	async handleMessage(message) {
		if (!message || (message.jsonrpc !== '2.0')) throw new MCPError(-32600, "Invalid JSON-RPC request.");
		
		switch (message.method) {
			case 'initialize':
				return {
					protocolVersion: '2024-11-05',
					capabilities: {
						tools: {}
					},
					serverInfo: {
						name: 'xyops-mcp',
						version: pkg.version
					}
				};
			
			case 'notifications/initialized':
				return null;
			
			case 'ping':
				return {};
			
			case 'tools/list':
				return { tools: this.getTools() };
			
			case 'tools/call':
				return await this.callTool(message.params.name, message.params.arguments || {});
			
			default:
				throw new MCPError(-32601, "Method not found: " + message.method);
		}
	}
	
	start(input, output) {
		var self = this;
		input = input || process.stdin;
		output = output || process.stdout;
		var buffer = Buffer.alloc(0);
		
		input.on('data', function(chunk) {
			buffer = Buffer.concat([buffer, chunk]);
			self.processBuffer(output, function(remaining) {
				buffer = remaining;
			}, buffer);
		});
	}
	
	processBuffer(output, setBuffer, buffer) {
		var self = this;
		while (buffer.length) {
			var headerEnd = buffer.indexOf('\r\n\r\n');
			if (headerEnd === -1) break;
			
			var headers = buffer.slice(0, headerEnd).toString('utf8');
			var match = headers.match(/Content-Length:\s*(\d+)/i);
			if (!match) throw new Error("Missing Content-Length header");
			
			var contentLength = parseInt(match[1], 10);
			var bodyStart = headerEnd + 4;
			var bodyEnd = bodyStart + contentLength;
			if (buffer.length < bodyEnd) break;
			
			var body = buffer.slice(bodyStart, bodyEnd).toString('utf8');
			buffer = buffer.slice(bodyEnd);
			setBuffer(buffer);
			
			var message = JSON.parse(body);
			this.dispatchMessage(message, output).catch(function(err) {
				if (message && (message.id !== undefined)) {
					self.writeMessage(output, {
						jsonrpc: '2.0',
						id: message.id,
						error: {
							code: err.code || -32603,
							message: err.message || "Internal error",
							data: err.data
						}
					});
				}
			});
		}
	}
	
	async dispatchMessage(message, output) {
		var result = await this.handleMessage(message);
		if ((message.id === undefined) || (result === null)) return;
		
		this.writeMessage(output, {
			jsonrpc: '2.0',
			id: message.id,
			result: result
		});
	}
	
	writeMessage(output, payload) {
		var body = JSON.stringify(payload);
		output.write("Content-Length: " + Buffer.byteLength(body, 'utf8') + "\r\nContent-Type: application/json\r\n\r\n" + body);
	}
}

function cleanObject(obj) {
	var result = {};
	for (var key in obj) {
		if (obj[key] !== undefined) result[key] = obj[key];
	}
	return result;
}

function loadJSON(file) {
	if (!file || !fs.existsSync(file)) return {};
	return JSON.parse( fs.readFileSync(file, 'utf8') );
}

function envKeyFromProviderId(providerId) {
	return String(providerId || '').toUpperCase().replace(/[^\w]+/g, '_');
}

function buildRuntimeConfig(opts) {
	opts = opts || {};
	var env = opts.env || process.env;
	var cwd = opts.cwd || process.cwd();
	var configFile = env.XYOPS_MCP_CONFIG || Path.join(cwd, 'conf', 'mcp.json');
	var fileConfig = loadJSON(configFile);
	
	var config = {
		backend: env.XYOPS_MCP_BACKEND || fileConfig.backend || 'block-goose',
		xyops: Object.assign({}, fileConfig.xyops || {}),
		block_goose: Object.assign({}, fileConfig.block_goose || {})
	};
	
	if (env.XYOPS_API_URL) config.xyops.api_url = env.XYOPS_API_URL;
	if (env.XYOPS_API_KEY) config.xyops.api_key = env.XYOPS_API_KEY;
	if (env.XYOPS_API_TIMEOUT_SEC) config.xyops.timeout_sec = env.XYOPS_API_TIMEOUT_SEC;
	
	if (env.BLOCK_GOOSE_BASE_URL) config.block_goose.base_url = env.BLOCK_GOOSE_BASE_URL;
	if (env.BLOCK_GOOSE_API_KEY) config.block_goose.api_key = env.BLOCK_GOOSE_API_KEY;
	if (env.BLOCK_GOOSE_TIMEOUT_SEC) config.block_goose.timeout_sec = env.BLOCK_GOOSE_TIMEOUT_SEC;
	if (!config.block_goose.providers) config.block_goose.providers = {};
	
	getProviderCatalog().forEach(function(provider) {
		var key = envKeyFromProviderId(provider.id);
		var entry = config.block_goose.providers[ provider.id ] || {};
		
		if (env['BLOCK_GOOSE_' + key + '_URL']) entry.url = env['BLOCK_GOOSE_' + key + '_URL'];
		if (env['BLOCK_GOOSE_' + key + '_PATH']) entry.path = env['BLOCK_GOOSE_' + key + '_PATH'];
		if (env['BLOCK_GOOSE_' + key + '_API_KEY']) entry.apiKey = env['BLOCK_GOOSE_' + key + '_API_KEY'];
		
		config.block_goose.providers[ provider.id ] = entry;
	});
	
	return config;
}

function createServerFromConfig(config, transport) {
	config = config || {};
	if (!config.xyops || !config.xyops.api_url) throw new Error("Missing xyOps API URL. Set XYOPS_API_URL or conf/mcp.json.");
	
	return new XYOpsMCPServer({
		backend: config.backend || 'block-goose',
		xyopsClient: new XYOpsAPIClient({
			baseUrl: config.xyops.api_url,
			apiKey: config.xyops.api_key,
			timeoutSec: config.xyops.timeout_sec
		}, transport),
		blockGooseClient: new BlockGooseClient({
			baseUrl: config.block_goose && config.block_goose.base_url,
			apiKey: config.block_goose && config.block_goose.api_key,
			timeoutSec: config.block_goose && config.block_goose.timeout_sec,
			providers: config.block_goose && config.block_goose.providers
		}, transport)
	});
}

function createServerFromEnv(opts, transport) {
	return createServerFromConfig( buildRuntimeConfig(opts), transport );
}

module.exports = {
	MCPError,
	XYOpsMCPServer,
	buildRuntimeConfig,
	createServerFromConfig,
	createServerFromEnv,
	normalizeXYOpsAPIBase
};
