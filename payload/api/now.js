// Vercel serverless function. Kept deliberately trivial: the point is to
// measure the platform's dispatch overhead, not our own code.
export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('timing-allow-origin', '*');
  res.setHeader('access-control-allow-origin', '*');
  res.status(200).json({
    platform: 'vercel',
    region: process.env.VERCEL_REGION ?? null,
    now: Date.now(),
  });
}
