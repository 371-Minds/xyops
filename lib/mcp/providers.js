// xyOps MCP Providers
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const PROVIDERS = [
	{
		id: 'conway-tech',
		title: 'Conway.tech',
		backend: 'block-goose',
		description: 'Conway.tech infrastructure operations via the Block Goose agent backend.',
		aliases: ['conway.tech', 'conway tech', 'conway-tech'],
		path: '/providers/conway-tech',
		capabilities: ['inventory', 'provision', 'rebuild', 'destroy']
	},
	{
		id: 'racknerd',
		title: 'RackNerd',
		backend: 'block-goose',
		description: 'RackNerd infrastructure operations via the Block Goose agent backend.',
		aliases: ['racknerd', 'rack nerd'],
		path: '/providers/racknerd',
		capabilities: ['inventory', 'provision', 'reboot', 'destroy']
	},
	{
		id: 'akash',
		title: 'Akash',
		backend: 'block-goose',
		description: 'Akash deployment operations via the Block Goose agent backend.',
		aliases: ['akash'],
		path: '/providers/akash',
		capabilities: ['inventory', 'deploy', 'lease', 'destroy']
	},
	{
		id: 'io-cloud',
		title: 'IO Cloud',
		backend: 'block-goose',
		description: 'IO Cloud infrastructure operations via the Block Goose agent backend.',
		aliases: ['io cloud', 'iocloud', 'io-cloud'],
		path: '/providers/io-cloud',
		capabilities: ['inventory', 'provision', 'power', 'destroy']
	}
];

function getProviderCatalog() {
	return PROVIDERS.map(function(provider) {
		return {
			id: provider.id,
			title: provider.title,
			backend: provider.backend,
			description: provider.description,
			capabilities: provider.capabilities.slice(0)
		};
	});
}

function normalizeProviderId(raw) {
	var input = String(raw || '').trim().toLowerCase();
	if (!input) return '';
	
	for (var idx = 0, len = PROVIDERS.length; idx < len; idx++) {
		var provider = PROVIDERS[idx];
		if (provider.id === input) return provider.id;
		if ((provider.aliases || []).indexOf(input) >= 0) return provider.id;
	}
	
	return input.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
}

function getProvider(providerId) {
	var normalized = normalizeProviderId(providerId);
	for (var idx = 0, len = PROVIDERS.length; idx < len; idx++) {
		if (PROVIDERS[idx].id === normalized) return Object.assign({}, PROVIDERS[idx]);
	}
	return null;
}

module.exports = {
	PROVIDERS,
	getProviderCatalog,
	getProvider,
	normalizeProviderId
};
