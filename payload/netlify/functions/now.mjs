// Netlify function — same trivial body as the other platforms.
export default async () =>
  new Response(
    JSON.stringify({
      platform: 'netlify',
      region: process.env.AWS_REGION ?? null,
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
