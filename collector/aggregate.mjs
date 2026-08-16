#!/usr/bin/env node
// Rolls the raw NDJSON up into the summary the static site reads.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(root, 'targets.json'), 'utf8'));

const WINDOW_DAYS = Number(process.env.WINDOW_DAYS ?? 7);
const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;

const files = (await readdir(join(root, 'data'))).filter((f) => f.endsWith('.ndjson')).sort();
const rows = [];
for (const file of files) {
  const text = await readFile(join(root, 'data', file), 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (Date.parse(row.ts) >= cutoff && row.status === 'finished') rows.push(row);
  }
}

// percentile over a sorted array, linear interpolation
function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: pct(sorted, 0.5),
    p75: pct(sorted, 0.75),
    p95: pct(sorted, 0.95),
    p99: pct(sorted, 0.99),
  };
}

// Timing stats trust only clean 200s. A redirect or error page answers fast
// precisely because it isn't doing the work being measured.
const ok = (r) => r.statusCode === 200 && r.connectTtfb !== null;

// Group into buckets keyed however the caller wants, then reduce to stats.
function rollup(subset, keyFn, valueFn = (r) => r.connectTtfb) {
  const buckets = new Map();
  for (const row of subset) {
    if (!ok(row)) continue;
    const key = keyFn(row);
    if (!buckets.has(key)) buckets.set(key, []);
    const v = valueFn(row);
    if (typeof v === 'number') buckets.get(key).push(v);
  }
  return Object.fromEntries([...buckets].map(([k, v]) => [k, stats(v)]));
}

const summary = {
  generatedAt: new Date().toISOString(),
  windowDays: WINDOW_DAYS,
  controlled: rows.length ? rows.every((r) => r.controlled) : config.controlled,
  totalSamples: rows.length,
  rounds: new Set(rows.map((r) => r.round)).size,
  platforms: config.platforms.map(({ id, label, color, colorDark, functionRegion }) => ({ id, label, color, colorDark, functionRegion })),
  scenarios: config.scenarios.map(({ id, label, description }) => ({ id, label, description })),
  byScenario: {},
  timeline: [],
  probeCount: new Set(rows.map((r) => `${r.probe.city}/${r.probe.asn}`)).size,
};

for (const scenario of config.scenarios) {
  const subset = rows.filter((r) => r.scenario === scenario.id);
  summary.byScenario[scenario.id] = {
    overall: rollup(subset, (r) => r.platform),
    byContinent: rollup(subset, (r) => `${r.platform}|${r.probe.continent}`),
    byCountry: rollup(subset, (r) => `${r.platform}|${r.probe.country}`),
    // Phase medians let the site show where the time actually goes.
    phases: Object.fromEntries(
      config.platforms.map((p) => {
        const forPlatform = subset.filter((r) => r.platform === p.id && ok(r));
        const median = (field) => {
          const vals = forPlatform.map((r) => r.timings[field]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
          return pct(vals, 0.5);
        };
        return [p.id, { dns: median('dns'), tcp: median('tcp'), tls: median('tls'), firstByte: median('firstByte'), download: median('download') }];
      })
    ),
    errorRate: Object.fromEntries(
      config.platforms.map((p) => {
        const forPlatform = subset.filter((r) => r.platform === p.id);
        // Anything but a 200 is an error for our purposes: a redirect means
        // the platform is not serving the payload at that URL.
        const bad = forPlatform.filter((r) => r.statusCode !== 200).length;
        return [p.id, forPlatform.length ? +(bad / forPlatform.length * 100).toFixed(2) : null];
      })
    ),
  };
}

// Hourly timeline of p50 per platform, static scenario.
const hourly = new Map();
for (const row of rows.filter((r) => r.scenario === config.scenarios[0].id && ok(r))) {
  const hour = row.ts.slice(0, 13) + ':00:00Z';
  const key = `${hour}|${row.platform}`;
  if (!hourly.has(key)) hourly.set(key, []);
  hourly.get(key).push(row.connectTtfb);
}
const hours = [...new Set([...hourly.keys()].map((k) => k.split('|')[0]))].sort();
summary.timeline = hours.map((hour) => ({
  hour,
  ...Object.fromEntries(
    config.platforms.map((p) => {
      const vals = (hourly.get(`${hour}|${p.id}`) ?? []).sort((a, b) => a - b);
      return [p.id, pct(vals, 0.5)];
    })
  ),
}));

await mkdir(join(root, 'public', 'data'), { recursive: true });
await writeFile(join(root, 'public', 'data', 'summary.json'), JSON.stringify(summary, null, 1));
console.log(`aggregated ${rows.length} samples from ${summary.rounds} rounds -> public/data/summary.json`);
