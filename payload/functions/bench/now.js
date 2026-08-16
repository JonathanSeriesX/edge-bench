// Cloudflare Pages Function. File path maps directly to the /bench/now route.
export function onRequest(context) {
  return new Response(
    JSON.stringify({
      platform: 'cloudflare',
      region: context.request.cf?.colo ?? null,
      now: Date.now(),
    }),
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'timing-allow-origin': '*',
        'access-control-allow-origin': '*',
      },
    }
  );
}
