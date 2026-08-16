// Dashboard orchestration: fetch the rollup, wire the tabs, draw everything.
import { $, legend, color, PHASES, shortRegion } from './util';
import { drawMain, drawPhases, drawTimeline } from './charts';
import { drawHeat } from './heatmap';
import { drawTable } from './table';
import { methodology } from './methodology';

const RAW = 'https://raw.githubusercontent.com/JonathanSeriesX/edge-bench-data/main/summary.json';

let data, scenario;
const liveRegions = {};

function regionBadge(p) {
  // Cloudflare's badge stays "every edge" even though its live response names
  // a colo — the colo is just whichever edge answered, not a home region.
  if (p.functions === false) return 'n/a';
  if (p.id === 'cloudflare') return 'every edge';
  return liveRegions[p.id] ?? shortRegion(p.functionRegion);
}

function render() {
  const s = data.byScenario[scenario];
  const rows = data.platforms
    .map((p) => ({
      ...p,
      regionBadge: regionBadge(p),
      ...(s.overall[p.id] ?? { n: 0, p50: null, p75: null, p95: null, p99: null }),
    }))
    .sort((a, b) => (a.p50 ?? Infinity) - (b.p50 ?? Infinity));

  const note = data.scenarios.find((x) => x.id === scenario);
  $('scenario-note').textContent = note?.description ?? '';

  legend($('legend-main'), rows.map((r) => ({ label: r.label, color: color(r.id) })));
  legend($('legend-phase'), PHASES.map((p) => ({ label: p.label, color: p.color })));
  legend($('legend-time'), rows.map((r) => ({ label: r.label, color: color(r.id) })));

  // Every chart keeps the headline chart's ranking, so a reader's eye can
  // carry one row order down the whole page.
  drawMain(rows, { showRegions: scenario === 'function' });
  drawPhases(rows, s.phases);
  drawHeat(rows, s.byContinent);
  drawTimeline(data.platforms, data.timeline);
  drawTable(rows, s.errorRate);
}

// Ask each platform's live function where it runs, so a platform quietly
// changing its default region shows up here instead of going stale in config.
async function fetchLiveRegions() {
  const candidates = (data.platforms ?? []).filter((p) => p.functions && p.host);
  const results = await Promise.allSettled(candidates.map(async (p) => {
    const res = await fetch(`https://${p.host}${p.pathPrefix ?? ''}/bench/now`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    let region = typeof body.region === 'string' && body.region ? body.region : null;
    // Cloudflare has no region to report; the answering colo rides in on the
    // (CORS-exposed) cf-ray response header instead.
    if (region === 'edge') {
      const colo = res.headers.get('cf-ray')?.split('-').pop();
      if (colo) region = `edge:${colo}`;
    }
    if (region) liveRegions[p.id] = region;
  }));
  if (results.some((r) => r.status === 'fulfilled')) {
    methodology(data.platforms, liveRegions);
    if (scenario === 'function') render();
  }
}

export async function initDashboard() {
  data = await fetch(RAW, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch(() => fetch('data/summary.json', { cache: 'no-store' }).then((r) => r.json()));
  scenario = Object.keys(data.byScenario)[0];

  $('meta').textContent =
    `${data.totalSamples.toLocaleString()} samples · ${data.rounds} rounds · ${data.probeCount} probes · ` +
    `last ${data.windowDays} days · updated ${new Date(data.generatedAt).toLocaleString()}`;

  $('tabs').replaceChildren(...data.scenarios
    .filter((s) => data.byScenario[s.id])
    .map((s) => {
      const b = document.createElement('button');
      b.textContent = s.label;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(s.id === scenario));
      b.onclick = () => {
        scenario = s.id;
        for (const el of $('tabs').children) el.setAttribute('aria-selected', String(el === b));
        render();
      };
      return b;
    }));

  methodology(data.platforms, liveRegions);
  render();
  fetchLiveRegions();
}
