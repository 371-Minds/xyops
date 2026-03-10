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
