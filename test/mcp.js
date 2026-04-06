const assert = require('node:assert/strict');

const { getProviderCatalog, getProvider, normalizeProviderId } = require('../lib/mcp/providers');
const { XYOpsMCPServer, buildRuntimeConfig, normalizeXYOpsAPIBase } = require('../lib/mcp/server');

exports.tests = [
	async function test_provider_catalog_contains_requested_integrations(test) {
		let providers = getProviderCatalog();
		assert.equal( providers.length, 4, 'expected four provider integrations' );
		assert.deepEqual( providers.map(function(provider) { return provider.id; }).sort(), ['akash', 'conway-tech', 'io-cloud', 'racknerd'], 'expected provider ids' );
		providers.forEach( function(provider) {
			assert.equal( provider.backend, 'block-goose', 'expected block-goose backend' );
		} );
	},
	
	async function test_provider_aliases_normalize_correctly(test) {
		assert.equal( normalizeProviderId('conway.tech'), 'conway-tech', 'normalize conway.tech' );
		assert.equal( normalizeProviderId('Rack Nerd'), 'racknerd', 'normalize rack nerd' );
		assert.equal( normalizeProviderId('IO Cloud'), 'io-cloud', 'normalize io cloud' );
		assert.equal( getProvider('iocloud').title, 'IO Cloud', 'alias lookup resolves provider' );
	},
	
	async function test_normalize_xyops_api_base(test) {
		assert.equal( normalizeXYOpsAPIBase('http://localhost:5522'), 'http://localhost:5522/api/app', 'append api path' );
		assert.equal( normalizeXYOpsAPIBase('http://localhost:5522/api/app/'), 'http://localhost:5522/api/app', 'trim slash from api path' );
		assert.equal( normalizeXYOpsAPIBase('http://localhost:5522/api/app/get_events/v1'), 'http://localhost:5522/api/app', 'collapse endpoint into api path' );
	},
	
	async function test_server_routes_xyops_and_block_goose_calls(test) {
		let xyopsCalls = [];
		let blockCalls = [];
		
		let server = new XYOpsMCPServer({
			xyopsClient: {
				request: async function(name, params, options) {
					xyopsCalls.push({ name, params, options });
					return { code: 0, name, params };
				}
			},
			blockGooseClient: {
				call: async function(provider, operation, input) {
					blockCalls.push({ provider, operation, input });
					return { code: 0, provider: provider.id, operation, input };
				}
			}
		});
		
		let eventResult = await server.callTool('xyops_list_events', { category: 'general', plugin: 'shell' });
		assert.equal( xyopsCalls[0].name, 'get_events', 'expected get_events api' );
		assert.equal( xyopsCalls[0].options.method, 'GET', 'expected get_events GET request' );
		assert.equal( eventResult.structuredContent.code, 0, 'expected success payload' );
		
		let integrationResult = await server.callTool('xyops_call_integration', {
			provider: 'conway.tech',
			operation: 'inventory',
			input: { region: 'us-east' }
		});
		assert.equal( blockCalls[0].provider.id, 'conway-tech', 'expected provider normalization' );
		assert.equal( blockCalls[0].operation, 'inventory', 'expected provider operation' );
		assert.deepEqual( integrationResult.structuredContent.input, { region: 'us-east' }, 'expected forwarded integration input' );
	},
	
	async function test_new_component_tools_route_to_correct_apis(test) {
		let xyopsCalls = [];
		
		let server = new XYOpsMCPServer({
			xyopsClient: {
				request: async function(name, params, options) {
					xyopsCalls.push({ name, params, options });
					return { code: 0, rows: [], list: { length: 0 } };
				}
			},
			blockGooseClient: {}
		});
		
		let componentTools = [
			{ tool: 'xyops_list_categories', api: 'get_categories', method: 'GET' },
			{ tool: 'xyops_list_channels',   api: 'get_channels',   method: 'GET' },
			{ tool: 'xyops_list_tags',        api: 'get_tags',       method: 'GET' },
			{ tool: 'xyops_list_buckets',     api: 'get_buckets',    method: 'GET' },
			{ tool: 'xyops_list_secrets',     api: 'get_secrets',    method: 'GET' },
			{ tool: 'xyops_list_groups',      api: 'get_groups',     method: 'GET' },
			{ tool: 'xyops_list_monitors',    api: 'get_monitors',   method: 'GET' },
			{ tool: 'xyops_list_alerts',      api: 'get_alerts',     method: 'GET' },
			{ tool: 'xyops_list_web_hooks',   api: 'get_web_hooks',  method: 'GET' }
		];
		
		for (let entry of componentTools) {
			xyopsCalls.length = 0;
			await server.callTool(entry.tool, {});
			assert.equal( xyopsCalls[0].name, entry.api, 'expected api for ' + entry.tool );
			assert.equal( xyopsCalls[0].options.method, entry.method, 'expected method for ' + entry.tool );
		}
	},
	
	async function test_search_tickets_passes_query_params(test) {
		let xyopsCalls = [];
		
		let server = new XYOpsMCPServer({
			xyopsClient: {
				request: async function(name, params, options) {
					xyopsCalls.push({ name, params, options });
					return { code: 0, rows: [], list: { length: 0 } };
				}
			},
			blockGooseClient: {}
		});
		
		await server.callTool('xyops_search_tickets', { query: 'deploy', offset: 5, limit: 20 });
		assert.equal( xyopsCalls[0].name, 'search_tickets', 'expected search_tickets api' );
		assert.equal( xyopsCalls[0].options.method, 'POST', 'expected POST request' );
		assert.equal( xyopsCalls[0].params.query, 'deploy', 'expected forwarded query' );
		assert.equal( xyopsCalls[0].params.offset, 5, 'expected forwarded offset' );
		assert.equal( xyopsCalls[0].params.limit, 20, 'expected forwarded limit' );
	},
	
	async function test_search_tickets_defaults_to_wildcard_query(test) {
		let xyopsCalls = [];
		
		let server = new XYOpsMCPServer({
			xyopsClient: {
				request: async function(name, params, options) {
					xyopsCalls.push({ name, params, options });
					return { code: 0, rows: [], list: { length: 0 } };
				}
			},
			blockGooseClient: {}
		});
		
		await server.callTool('xyops_search_tickets', {});
		assert.equal( xyopsCalls[0].params.query, '*', 'expected wildcard default query' );
	},
	
	async function test_create_ticket_requires_title(test) {
		let server = new XYOpsMCPServer({
			xyopsClient: {
				request: async function() { return { code: 0 }; }
			},
			blockGooseClient: {}
		});
		
		await assert.rejects(
			async function() { await server.callTool('xyops_create_ticket', {}); },
			function(err) {
				assert.ok( err.message.includes('title'), 'expected title error message' );
				return true;
			}
		);
	},
	
	async function test_create_ticket_forwards_fields(test) {
		let xyopsCalls = [];
		
		let server = new XYOpsMCPServer({
			xyopsClient: {
				request: async function(name, params, options) {
					xyopsCalls.push({ name, params, options });
					return { code: 0, ticket: { id: 't123' } };
				}
			},
			blockGooseClient: {}
		});
		
		await server.callTool('xyops_create_ticket', { title: 'Deploy failed', body: 'Details here', tags: ['deploy', 'error'] });
		assert.equal( xyopsCalls[0].name, 'create_ticket', 'expected create_ticket api' );
		assert.equal( xyopsCalls[0].params.title, 'Deploy failed', 'expected forwarded title' );
		assert.equal( xyopsCalls[0].params.body, 'Details here', 'expected forwarded body' );
		assert.deepEqual( xyopsCalls[0].params.tags, ['deploy', 'error'], 'expected forwarded tags' );
	},
	
	async function test_tools_list_includes_all_component_tools(test) {
		let server = new XYOpsMCPServer({
			xyopsClient: { request: async function() { return {}; } },
			blockGooseClient: {}
		});
		
		let tools = server.getTools();
		let names = tools.map(function(t) { return t.name; });
		
		let expected = [
			'xyops_ping', 'xyops_list_servers', 'xyops_list_events', 'xyops_list_jobs',
			'xyops_run_event', 'xyops_list_plugins',
			'xyops_list_categories', 'xyops_list_channels', 'xyops_list_tags',
			'xyops_list_buckets', 'xyops_list_secrets',
			'xyops_list_groups', 'xyops_list_monitors', 'xyops_list_alerts',
			'xyops_search_tickets', 'xyops_create_ticket',
			'xyops_list_web_hooks', 'xyops_list_integrations', 'xyops_call_integration'
		];
		
		expected.forEach(function(name) {
			assert.ok( names.includes(name), 'expected tool ' + name + ' in tools list' );
		});
	},
	
	async function test_runtime_config_reads_provider_env_overrides(test) {
		let config = buildRuntimeConfig({
			cwd: '/tmp',
			env: {
				XYOPS_API_URL: 'https://xyops.example.com',
				XYOPS_API_KEY: 'xyops-key',
				BLOCK_GOOSE_BASE_URL: 'https://block-goose.example.com/api',
				BLOCK_GOOSE_CONWAY_TECH_PATH: '/custom/conway',
				BLOCK_GOOSE_IO_CLOUD_API_KEY: 'io-secret'
			}
		});
		
		assert.equal( config.backend, 'block-goose', 'expected default backend' );
		assert.equal( config.xyops.api_url, 'https://xyops.example.com', 'expected xyops api url override' );
		assert.equal( config.block_goose.providers['conway-tech'].path, '/custom/conway', 'expected conway provider override' );
		assert.equal( config.block_goose.providers['io-cloud'].apiKey, 'io-secret', 'expected io cloud api key override' );
	}
];
