/** @type {import('next').NextConfig} */
const nextConfig = {
  // The same app builds two ways:
  //  - server mode (default) on Vercel / Netlify / Cloudflare, where
  //    app/bench/now runs as a real function
  //  - static export for GitHub Pages (STATIC_EXPORT=1 in the workflow, which
  //    also removes app/bench — force-dynamic routes cannot be exported)
  output: process.env.STATIC_EXPORT ? 'export' : undefined,
  // GitHub project Pages serve under /<repo>; everything else serves at root.
  basePath: process.env.BASE_PATH || undefined,
  // The RUM layer fetches every deployment cross-origin from visitors'
  // browsers. Without Timing-Allow-Origin the Resource Timing API zeroes out
  // every phase; without Access-Control-Allow-Origin the fetch fails outright.
  // Ignored by the static export — GitHub Pages cannot set headers, so its
  // samples only come from visitors of the Pages deployment itself.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Timing-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
