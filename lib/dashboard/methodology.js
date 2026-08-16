import { $, shortRegion } from './util';

// `liveRegions` maps platform id -> the region its /bench/now just reported.
// When live data is in, the text says so — the region shown is read from the
// platform, not asserted by us.
export function methodology(platforms, liveRegions = {}) {
  const region = (id) => {
    const p = platforms.find((x) => x.id === id);
    return `<b>${liveRegions[id] ?? shortRegion(p?.functionRegion) ?? '?'}</b>`;
  };
  const anyLive = Boolean(liveRegions.vercel || liveRegions.netlify);
  // Cloudflare reports "edge:<colo>" — the colo is whichever edge answered the
  // viewer's browser, a nice proof of the architecture rather than a region.
  const cfColo = liveRegions.cloudflare?.split(':')[1];

  $('method').innerHTML = `
    <h3>Two kinds of measurement</h3>
    <ul>
      <li>Dashboards badged <b>Globalping probes</b> are fed by
          <a href="https://globalping.io">Globalping</a> datacenter probes in ten countries on
          six continents. The first measurement of a round fixes the probe set and every
          platform is measured from those exact machines, seconds apart. Rounds run every
          6 hours plus on every deploy; charts show percentiles over a rolling 7-day window,
          DNS excluded, and only clean HTTP 200s count. Datacenter transit is excellent —
          these numbers are a floor.</li>
      <li>The dashboard badged <b>your browser</b> was measured by this very page, from your
          device and your network, seconds ago. Nothing is aggregated or waited for — you are
          the probe. Fresh-connection fetches show the full DNS/TCP/TLS/server breakdown;
          warm repeats show what the platform costs once the connection is up. The same
          numbers are also beaconed (country-level geography only, no identifiers) for
          possible future aggregates.</li>
      <li>This page is the payload: the same Next.js app, deployed to every platform from the
          same commit. Probes and browsers fetch <code>/</code> for static delivery and
          <code>/bench/now</code> for function dispatch.</li>
      <li>Platforms run on their defaults, with one disclosed exception: OpenNext's default
          Cloudflare setup re-renders the prerendered page inside the Worker on every request.
          We enable its static-assets cache and cache interception
          (<code>open-next.config.ts</code>, public in the repo) so <code>/</code> is served as
          the prerendered asset it is — without it the static scenario measures Worker SSR, not
          CDN delivery.</li>
    </ul>

    <h3>The function-region caveat</h3>
    <ul>
      <li><b>Vercel</b> and <b>Netlify</b> deploy the function to a single region <i>by
          default</i> — currently ${region('vercel')} and ${region('netlify')}${anyLive
            ? ' <i>(read live from each platform’s <code>/bench/now</code> just now)</i>'
            : ''} — so probes far from the US pay a transcontinental round trip. That is the
          stock free-tier deployment, not a misconfiguration; both sell multi-region execution
          on paid tiers.</li>
      <li><b>Cloudflare</b> is a different architecture, not a different setting: the same route
          runs at <b>every edge</b> location${cfColo && cfColo !== '?'
            ? ` — the one that just answered <i>your</i> browser is <b>${cfColo}</b>`
            : ''}, so its function latency barely depends on
          where the probe is. There is no region to pick.</li>
      <li><b>GitHub Pages</b> has no functions at all, so it has no row in the serverless
          dashboard.</li>
      <li>The <b>Spread</b> column in the by-region tables quantifies the distance effect:
          max − min of the continent medians. Single-region platforms spread wide on the
          serverless dashboard; edge networks stay tight.</li>
    </ul>

    <h3>What this does not tell you</h3>
    <ul>
      <li>GitHub Pages sets no CORS/timing headers, so the your-browser dashboard can only
          measure it when you are reading this page on GitHub Pages itself.</li>
      <li>Free tiers are measured; paid plans change routing and caching on some platforms.</li>
      <li>Latency is one axis. Build times, DX, pricing and lock-in matter more for most decisions.</li>
    </ul>`;
}
