// Disallow indexing by search engines for all content
const LEGACY_ROBOTS_DOT_TXT = `User-agent: *
Disallow: /
`;

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		console.log(url.hostname);
		if (url.hostname === 'legacy.seasketch.org' && url.pathname === '/robots.txt') {
			return new Response(LEGACY_ROBOTS_DOT_TXT, {
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
				},
			});
		} else if (url.pathname === '/sitemap.xml') {
			return await fetch('https://api.seasket.ch/sitemap.xml');
		} else {
			return new Response('Not found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
