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
    <h3>How a round works</h3>
    <ul>
      <li>This page is the payload: the same Next.js app, deployed to every platform from the
          same commit. Probes fetch <code>/</code> for static delivery and <code>/bench/now</code>
          for function dispatch.</li>
      <li>Probes come from <a href="https://globalping.io">Globalping</a> — ten countries, six
          continents. The first measurement of a round fixes the probe set and every platform is
          measured from those exact machines, seconds apart.</li>
      <li>Rounds run every 6 hours plus on every deploy. Charts show percentiles over a rolling
          7-day window, DNS excluded, and only clean HTTP 200s count.</li>
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
            : ''} — so probes far from the US pay a transcontinental round trip. That is the stock free-tier deployment,
          not a misconfiguration; both sell multi-region execution on paid tiers.</li>
      <li><b>Cloudflare</b> is a different architecture, not a different setting: the same route
          runs at <b>every edge</b> location${cfColo && cfColo !== '?'
            ? ` — the one that just answered <i>your</i> browser is <b>${cfColo}</b>`
            : ''}, so its function latency barely depends on
          where the probe is. There is no region to pick.</li>
      <li><b>GitHub Pages</b> has no functions at all — it only appears in the static scenario.</li>
      <li>The <b>Spread</b> column in the by-region table quantifies this: max − min of the
          continent medians. Single-region platforms spread wide on the function tab; edge
          networks stay tight.</li>
    </ul>

    <h3>What this does not tell you</h3>
    <ul>
      <li>Probes sit in datacenters with excellent transit — real users on mobile networks see more.
          (A real-user layer measures exactly that from visitors of this page — a fraction of page
          views quietly re-fetches each platform and reports timing, no identifiers attached.)</li>
      <li>Free tiers are measured; paid plans change routing and caching on some platforms.</li>
      <li>Latency is one axis. Build times, DX, pricing and lock-in matter more for most decisions.</li>
    </ul>`;
}
