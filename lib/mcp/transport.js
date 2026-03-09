// xyOps MCP HTTP Transport
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const http = require('http');
const https = require('https');

function validateURL(raw) {
	var url = new URL(raw);
	if (!url.protocol.match(/^https?\:$/)) throw new Error("Unsupported URL protocol: " + url.protocol);
	return url;
}

function defaultTransport(request) {
	return new Promise(function(resolve, reject) {
		var url = validateURL(request.url);
		var body = request.body ? JSON.stringify(request.body) : '';
		var headers = Object.assign({
			'Accept': 'application/json'
		}, request.headers || {});
		
		if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
		if (body) headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
		
		var opts = {
			protocol: url.protocol,
			hostname: url.hostname,
			port: url.port || ((url.protocol == 'https:') ? 443 : 80),
			path: url.pathname + url.search,
			method: request.method || 'GET',
			headers,
			timeout: (request.timeoutSec || 30) * 1000
		};
		
		var lib = (url.protocol == 'https:') ? https : http;
		var req = lib.request(opts, function(res) {
			var chunks = [];
			res.on('data', function(chunk) { chunks.push(chunk); });
			res.on('end', function() {
				var raw = Buffer.concat(chunks).toString('utf8');
				var data = null;
				
				if (raw.length) {
					try { data = JSON.parse(raw); }
					catch (err) {
						err.message = "Failed to parse JSON response from " + request.url + ": " + err.message;
						return reject(err);
					}
				}
				
				resolve({
					statusCode: res.statusCode || 0,
					headers: res.headers || {},
					data: data,
					raw: raw
				});
			});
		});
		
		req.on('timeout', function() {
			req.destroy(new Error("Request timed out: " + request.url));
		});
		req.on('error', reject);
		
		if (body) req.write(body);
		req.end();
	});
}

module.exports = {
	defaultTransport,
	validateURL
};
