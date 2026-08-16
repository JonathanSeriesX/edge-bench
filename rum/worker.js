// Collector for the real-user layer (see wrangler.jsonc next to this file).
// Writes to Workers Analytics Engine, which is free-tier friendly and made for
// exactly this shape of data. Deploy: npx wrangler deploy -c rum/wrangler.jsonc

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: CORS });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('bad json', { status: 400, headers: CORS });
    }
    if (!Array.isArray(body.samples) || body.samples.length > 12) {
      return new Response('bad payload', { status: 400, headers: CORS });
    }

    // Geography comes from the request, never from the client — a self-reported
    // country is trivially spoofable and would poison the regional breakdown.
    const cf = request.cf ?? {};

    for (const s of body.samples) {
      if (typeof s?.platform !== 'string' || s.error || s.opaque || s.reused) continue;
      const ttfb = num(s.tcp) + num(s.tls) + num(s.firstByte);
      if (ttfb <= 0 || ttfb > 60_000) continue; // drop garbage from suspended tabs

      env.RUM.writeDataPoint({
        blobs: [
          s.platform.slice(0, 32),
          cf.country ?? 'XX',
          cf.continent ?? 'XX',
          cf.asOrganization?.slice(0, 64) ?? '',
          s.protocol?.slice(0, 12) ?? '',
          body.effectiveType?.slice(0, 8) ?? '',
        ],
        doubles: [ttfb, num(s.dns), num(s.tcp), num(s.tls), num(s.firstByte), num(s.download)],
        indexes: [s.platform.slice(0, 32)],
      });
    }

    return new Response(null, { status: 204, headers: CORS });
  },
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
