// xyOps MCP API Client
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const querystring = require('querystring');
const transportModule = require('./transport');

function normalizeXYOpsAPIBase(raw) {
	var url = String(raw || '').trim();
	if (!url) throw new Error("Missing xyOps API URL");
	url = url.replace(/\/+$/, '');
	
	if (url.match(/\/api\/app$/)) return url;
	if (url.match(/\/api\/app\/[^\/]+\/v1$/)) return url.replace(/\/[^\/]+\/v1$/, '');
	
	return url + '/api/app';
}

class XYOpsAPIClient {
	constructor(config, transport) {
		config = config || {};
		this.baseUrl = normalizeXYOpsAPIBase(config.baseUrl || config.apiUrl || '');
		this.apiKey = String(config.apiKey || '').trim();
		this.timeoutSec = parseInt(config.timeoutSec || 30, 10) || 30;
		this.transport = transport || transportModule.defaultTransport;
	}
	
	async request(apiName, params, options) {
		options = options || {};
		params = params || {};
		
		var method = String(options.method || 'POST').toUpperCase();
		var url = this.baseUrl + '/' + apiName + '/v1';
		var headers = {};
		
		if (this.apiKey) headers['X-API-Key'] = this.apiKey;
		
		var request = {
			url,
			method,
			headers,
			timeoutSec: this.timeoutSec
		};
		
		if (method == 'GET') {
			var query = querystring.stringify(params);
			if (query) request.url += '?' + query;
		}
		else {
			request.body = params;
		}
		
		var response = await this.transport(request);
		var data = response.data || {};
		
		if ((response.statusCode >= 400) || (data.code && (data.code !== 0))) {
			var message = data.description || ("xyOps API request failed: " + apiName);
			var err = new Error(message);
			err.response = response;
			err.data = data;
			throw err;
		}
		
		return data;
	}
}

module.exports = {
	XYOpsAPIClient,
	normalizeXYOpsAPIBase
};
