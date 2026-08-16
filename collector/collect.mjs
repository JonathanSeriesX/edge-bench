#!/usr/bin/env node
// Runs one benchmark round: every platform x every scenario, measured from an
// identical set of probes, and appends the raw results as NDJSON.
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, wait, RateLimitError } from './globalping.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(root, 'targets.json'), 'utf8'));

const round = randomUUID();
const ts = new Date().toISOString();
const rows = [];

// The first measurement of the round defines the probe set; every later
// measurement reuses it by id so all platforms are judged from the same
// machines, on the same networks, within the same few seconds.
let probeSetRef = config.probeSet.locations;
let remaining = Infinity;

// Until the payload is deployed there is nothing to hit but each vendor's
// front page, so the scenarios would all be the same request. Run just one.
const scenarios = config.controlled ? config.scenarios : config.scenarios.slice(0, 1);
const jobs = config.platforms.flatMap((platform) => {
  if (config.controlled && platform.controlledHost.includes('REPLACE-ME')) {
    console.warn(`  skipping ${platform.id}: controlledHost not configured yet`);
    return [];
  }
  return scenarios
    // Platforms without serverless support (e.g. GitHub Pages) sit out the
    // function scenario instead of being benchmarked on their 404 page.
    .filter((scenario) => scenario.id !== 'function' || platform.functions !== false)
    .map((scenario) => ({ platform, scenario }));
});

console.log(`round ${round} — ${jobs.length} measurements, controlled=${config.controlled}`);

for (const { platform, scenario } of jobs) {
  const target = config.controlled ? platform.controlledHost : platform.host;
  // GitHub project Pages serve under /<repo>/, so the path gets a per-platform prefix.
  const path = config.controlled ? (platform.pathPrefix ?? '') + scenario.path : '/';

  try {
    const { id, remaining: left } = await create({
      target,
      path,
      method: scenario.method,
      locations: probeSetRef,
    });
    if (Number.isFinite(left)) remaining = left;

    const result = await wait(id);
    if (probeSetRef === config.probeSet.locations) probeSetRef = id;

    for (const entry of result.results) rows.push(toRow({ entry, platform, scenario, target, path }));
    console.log(`  ${platform.id}/${scenario.id}: ${result.results.length} probes (${left} tests left this hour)`);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error(`  stopping early: ${err.message}`);
      break;
    }
    console.error(`  ${platform.id}/${scenario.id} failed: ${err.message}`);
  }
}

function toRow({ entry, platform, scenario, target, path }) {
  const { probe, result } = entry;
  const t = result.timings ?? {};
  const captured = {};
  for (const name of config.cacheHeaders) {
    const value = result.headers?.[name];
    if (value !== undefined) captured[name] = String(value).slice(0, 120);
  }

  return {
    ts,
    round,
    platform: platform.id,
    scenario: scenario.id,
    target,
    path,
    controlled: config.controlled,
    probe: {
      city: probe.city,
      country: probe.country,
      continent: probe.continent,
      asn: probe.asn,
      network: probe.network,
    },
    status: result.status,
    statusCode: result.statusCode ?? null,
    timings: {
      dns: t.dns ?? null,
      tcp: t.tcp ?? null,
      tls: t.tls ?? null,
      firstByte: t.firstByte ?? null,
      download: t.download ?? null,
      total: t.total ?? null,
    },
    // Headline metric: connect + server think time, with DNS excluded because a
    // real visitor's resolver caches it and its cost is mostly not the platform's.
    connectTtfb: sum(t.tcp, t.tls, t.firstByte),
    bytes: Number(result.headers?.['content-length'] ?? 0) || null,
    headers: captured,
  };
}

function sum(...values) {
  return values.every((v) => typeof v === 'number') ? values.reduce((a, b) => a + b, 0) : null;
}

const month = ts.slice(0, 7);
const file = join(root, 'data', `raw-${month}.ndjson`);
await mkdir(dirname(file), { recursive: true });
await appendFile(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

console.log(`wrote ${rows.length} rows to data/raw-${month}.ndjson`);
if (Number.isFinite(remaining)) console.log(`${remaining} tests remaining this hour`);
