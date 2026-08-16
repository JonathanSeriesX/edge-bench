// Optional real-user layer: measures the same payload from whatever network the
// visitor is actually on. Datacenter probes have great transit and report a
// floor; this reports what people get. Drop it on any page:
//
//   <script type="module" src="https://your-site/rum.js"></script>
//
// The endpoints must send `Timing-Allow-Origin: *` or the browser zeroes out
// every phase but the total — payload/_headers already does.

const ENDPOINT = 'https://edge-bench-rum.YOUR-SUBDOMAIN.workers.dev/beacon';
const SAMPLE_RATE = 0.25; // fraction of page views that measure at all
const TARGETS = {
  vercel: 'https://edge-bench-sobachenka.vercel.app/bench/static.txt',
  netlify: 'https://REPLACE-ME.netlify.app/bench/static.txt',
  cloudflare: 'https://edge-bench.pages.dev/bench/static.txt',
  github: 'https://jonathanseriesx.github.io/edge-bench-payload/bench/static.txt',
};

if (Math.random() < SAMPLE_RATE && navigator.connection?.saveData !== true) {
  // Wait for the host page to finish loading — a benchmark that slows down the
  // page it lives on is measuring itself.
  if (document.readyState === 'complete') queueMicrotask(run);
  else addEventListener('load', () => setTimeout(run, 2000), { once: true });
}

async function run() {
  const samples = [];

  // Shuffle: a fixed order would systematically hand the last platform a warm
  // radio and a settled DNS cache, and the first one all the setup cost.
  const order = Object.entries(TARGETS).sort(() => Math.random() - 0.5);

  for (const [platform, url] of order) {
    const sample = await measure(platform, url);
    if (sample) samples.push(sample);
  }
  if (!samples.length) return;

  const payload = JSON.stringify({
    samples,
    effectiveType: navigator.connection?.effectiveType ?? null,
    // Coarse timezone only. The Worker adds a country from the request itself;
    // nothing here identifies a visitor.
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, payload);
  else fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
}

async function measure(platform, url) {
  // Unique query string per run so we measure the CDN edge, not the disk cache.
  const bust = `${url}?rum=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    await fetch(bust, { cache: 'no-store', mode: 'cors' });
  } catch {
    return { platform, error: true };
  }

  const entry = performance.getEntriesByName(bust).at(-1);
  if (!entry) return null;

  // secureConnectionStart is 0 on plain HTTP and on reused connections.
  const tls = entry.secureConnectionStart ? entry.connectEnd - entry.secureConnectionStart : 0;
  const tcp = entry.secureConnectionStart
    ? entry.secureConnectionStart - entry.connectStart
    : entry.connectEnd - entry.connectStart;

  const sample = {
    platform,
    dns: round(entry.domainLookupEnd - entry.domainLookupStart),
    tcp: round(tcp),
    tls: round(tls),
    firstByte: round(entry.responseStart - entry.requestStart),
    download: round(entry.responseEnd - entry.responseStart),
    total: round(entry.duration),
    protocol: entry.nextHopProtocol || null,
    // A reused connection reports 0 for connect and makes the platform look
    // faster than it is; flag it so the aggregate can exclude those.
    reused: entry.connectEnd === entry.connectStart,
  };

  // Timing-Allow-Origin missing: every cross-origin phase collapses to 0.
  if (sample.firstByte === 0 && sample.total > 0) sample.opaque = true;
  return sample;
}

const round = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
