# edge-bench

An open, continuously-updated latency benchmark of Next.js hosting —
**Vercel, Netlify, Cloudflare (Workers) and GitHub Pages** — measured from real
probes on six continents, entirely on free tiers.

**Dashboard:** https://jonathanseriesx.github.io/edge-bench/

The twist: **the dashboard is the benchmark payload.** This one repo is a small
Next.js app deployed to every platform from the same commit. Probes fetch its
front page to measure static delivery, and its `/bench/now` route to measure
each platform's function dispatch. The page you read the results on is the page
being measured.

## Why most "Vercel vs Netlify" comparisons are worthless

- **They measure the vendors' marketing sites** — five different pages, five
  different frameworks. Tells you nothing about the platforms.
- **They run from one location**, next to whichever vendor's POP the author
  happens to sit near.
- **They run once**, so a cold cache or a bad BGP minute decides the winner.
- **They use different probes per platform**, then report probe variance as
  platform difference.

## How this one works

**Same app, same commit, every platform.** Each platform hosts this repo
through its native Next.js pipeline: Vercel builds it natively, Netlify through
its Next runtime, Cloudflare through [OpenNext](https://opennext.js.org/cloudflare)
on Workers, GitHub Pages serves the static export (and sits out the function
scenario — it has no functions). That is the comparison people actually want:
*deploy the same Next.js app everywhere; who serves it faster?*

**Identical probes.** [Globalping](https://globalping.io) lets a measurement
re-use the exact probe set of a previous one. The first measurement of a round
fixes the probes; every platform is then measured from those same machines, on
the same networks, within the same few seconds.

**Percentiles over many rounds.** Rounds run every 6 hours (plus on every
deploy) via a public GitHub Actions schedule. The dashboard reports
p50/p75/p95/p99 over a rolling 7-day window, and only clean HTTP 200s count —
a fast redirect or error page is not a fast platform.

**DNS reported separately.** The headline metric is TCP + TLS + server
response. A real visitor's resolver has DNS cached; folding it in mostly
measures whose nameserver was cold.

**Scenarios**

| Scenario | Path | What it measures |
|---|---|---|
| Static | `/` | The prerendered dashboard page — CDN/edge delivery |
| Function | `/bench/now` | A trivial `force-dynamic` route handler — function dispatch, Node runtime where the platform has one |

## Honesty section

- Platforms build the app themselves, so responses are *equivalent*, not
  byte-identical — each adapter renders the same prerendered HTML but may
  differ in headers and minor framing. Same commit, same code, same routes.
- Probes sit in datacenters with excellent transit. These numbers are a floor;
  real users on mobile networks see more.
- Free tiers are measured. Paid plans change routing and caching on some
  platforms.
- Cloudflare runs Next.js on workerd (`nodejs_compat`), not Node itself —
  that *is* their platform offering, so that is what gets measured.
- Latency is one axis. Build times, DX, pricing and lock-in are not measured
  here and matter more for most decisions.

## Layout

| Path | What it is |
|---|---|
| `app/`, `lib/` | The Next.js app: dashboard page + `/bench/now` route |
| `targets.json` | Platforms, probe locations, scenarios |
| `collector/` | Runs rounds against the Globalping API, aggregates NDJSON |
| [`edge-bench-data`](https://github.com/JonathanSeriesX/edge-bench-data) | Separate repo: raw measurements + the rollup, one commit per round — kept apart so rounds never trigger app deploys |
| `rum/` | Optional real-user measurement layer (not yet deployed) |

## Running it yourself

```bash
pnpm install
```

```bash
pnpm round
```

```bash
pnpm dev
```

`pnpm round` runs one collection round (Globalping is free: 250 tests/hour
unauthenticated, 500 with a token via `GLOBALPING_TOKEN`) and rebuilds the
summary. The GitHub workflow does the same on schedule and commits the results.

Deploy targets are configured in `targets.json`. GitHub Pages builds with
`STATIC_EXPORT=1 BASE_PATH=/edge-bench` (see the workflow); the other platforms
build the repo as a normal Next.js app with zero special configuration.

Not affiliated with any platform shown.
