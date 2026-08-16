const API = 'https://api.globalping.io/v1/measurements';

const headers = () => {
  const h = { 'content-type': 'application/json', accept: 'application/json' };
  if (process.env.GLOBALPING_TOKEN) h.authorization = `Bearer ${process.env.GLOBALPING_TOKEN}`;
  return h;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Creates a measurement and returns its id.
 * `locations` is either an array of location filters or a previous measurement
 * id — passing an id reuses that measurement's exact probes, which is the only
 * way to compare platforms from identical vantage points.
 */
export async function create({ target, path, method = 'GET', locations }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'http',
      target,
      ...(Array.isArray(locations) ? { locations } : { locations }),
      measurementOptions: {
        protocol: 'HTTPS',
        request: { method, path, headers: { 'user-agent': 'edge-bench (+https://github.com/JonathanSeriesX/edge-bench)' } },
      },
    }),
  });

  if (res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    throw new RateLimitError(`rate limited, resets in ${reset ?? '?'}s`);
  }
  if (!res.ok) throw new Error(`create ${target}${path}: ${res.status} ${await res.text()}`);

  const body = await res.json();
  return { id: body.id, remaining: Number(res.headers.get('x-ratelimit-remaining') ?? NaN) };
}

/** Polls until the measurement finishes. */
export async function wait(id, { timeoutMs = 45_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let delay = 500;
  for (;;) {
    const res = await fetch(`${API}/${id}`, { headers: headers() });
    if (!res.ok) throw new Error(`fetch ${id}: ${res.status}`);
    const body = await res.json();
    if (body.status !== 'in-progress') return body;
    if (Date.now() > deadline) throw new Error(`measurement ${id} timed out`);
    await sleep(delay);
    delay = Math.min(delay * 1.5, 3000);
  }
}

export class RateLimitError extends Error {}
