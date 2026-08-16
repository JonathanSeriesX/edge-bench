// The function scenario: a deliberately trivial dynamic route, so what gets
// measured is each platform's Next.js function dispatch, not our code.
// force-dynamic cannot be statically exported — the GitHub Pages build in the
// workflow deletes app/bench before exporting, which is fine because GitHub
// Pages has no functions and sits that scenario out anyway.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      now: Date.now(),
      region:
        process.env.VERCEL_REGION ??
        process.env.AWS_REGION ??
        process.env.CF_PAGES ??
        null,
    },
    {
      headers: {
        'cache-control': 'no-store',
        'timing-allow-origin': '*',
        'access-control-allow-origin': '*',
      },
    }
  );
}
