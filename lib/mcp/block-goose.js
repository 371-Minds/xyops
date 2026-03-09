// xyOps MCP Block Goose Client
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const transportModule = require('./transport');

function normalizeBaseURL(raw) {
	var url = String(raw || '').trim().replace(/\/+$/, '');
	if (!url) return '';
	transportModule.validateURL(url);
	return url;
}

class BlockGooseClient {
	constructor(config, transport) {
		config = config || {};
		this.baseUrl = normalizeBaseURL(config.baseUrl || '');
		this.apiKey = String(config.apiKey || '').trim();
		this.timeoutSec = parseInt(config.timeoutSec || 30, 10) || 30;
		this.providers = config.providers || {};
		this.transport = transport || transportModule.defaultTransport;
	}
	
	getProviderConfig(provider) {
		return this.providers[ provider.id ] || {};
	}
	
	buildURL(provider, operation) {
		var providerConfig = this.getProviderConfig(provider);
		var baseUrl = normalizeBaseURL(providerConfig.baseUrl || providerConfig.url || this.baseUrl);
		if (!baseUrl) throw new Error("Missing Block Goose base URL for provider: " + provider.title);
		
		var basePath = providerConfig.path || provider.path || ('/providers/' + provider.id);
		basePath = ('/' + String(basePath || '').replace(/^\/+/, '')).replace(/\/+$/, '');
		var action = String(operation || '').trim().replace(/^\/+/, '');
		if (!action) throw new Error("Missing provider operation");
		
		return baseUrl + basePath + '/' + encodeURIComponent(action);
	}
	
	async call(provider, operation, input) {
		var providerConfig = this.getProviderConfig(provider);
		var apiKey = String(providerConfig.apiKey || this.apiKey || '').trim();
		var headers = {
			'Content-Type': 'application/json',
			'X-Provider-Backend': provider.backend
		};
		if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
		
		var response = await this.transport({
			url: this.buildURL(provider, operation),
			method: 'POST',
			headers,
			body: {
				provider: {
					id: provider.id,
					title: provider.title,
					backend: provider.backend
				},
				operation: operation,
				input: input || {}
			},
			timeoutSec: this.timeoutSec
		});
		
		var data = response.data || {};
		if (response.statusCode >= 400) {
			var err = new Error(data.description || ("Block Goose request failed for provider: " + provider.title));
			err.response = response;
			err.data = data;
			throw err;
		}
		
		return data;
	}
}

module.exports = {
	BlockGooseClient,
	normalizeBaseURL
};
