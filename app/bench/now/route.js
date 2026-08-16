// The function scenario: a deliberately trivial dynamic route, so what gets
// measured is each platform's Next.js function dispatch, not our code.
// force-dynamic cannot be statically exported — the GitHub Pages build in the
// workflow deletes app/bench before exporting, which is fine because GitHub
// Pages has no functions and sits that scenario out anyway.
export const dynamic = 'force-dynamic';

export async function GET() {
  // The dashboard reads this live so a platform quietly changing its default
  // region gets caught instead of going stale in targets.json. workerd has no
  // region — it identifies itself via navigator.userAgent, and the browser
  // learns the answering colo from the exposed cf-ray response header.
  const region =
    process.env.VERCEL_REGION ?? // Vercel, e.g. "iad1"
    process.env.AWS_REGION ??    // Netlify (AWS under the hood), e.g. "us-east-2"
    (globalThis.navigator?.userAgent === 'Cloudflare-Workers' ? 'edge' : null);

  return Response.json(
    { now: Date.now(), region },
    {
      headers: {
        'cache-control': 'no-store',
        'timing-allow-origin': '*',
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'cf-ray',
      },
    }
  );
}
