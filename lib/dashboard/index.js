// Dashboard orchestration: fetch the rollup, draw every section, then start
// the live in-browser measurement. No tabs — each scenario is its own
// collapsible dashboard on the page.
import { $, legend, color, PHASES, shortRegion } from './util';
import { drawMain, drawPhases, drawTimeline } from './charts';
import { drawHeat } from './heatmap';
import { drawTable } from './table';
import { methodology } from './methodology';
import { initLive } from './live';

const RAW = 'https://raw.githubusercontent.com/JonathanSeriesX/edge-bench-data/main/summary.json';

let data;
const liveRegions = {};

function regionBadge(p) {
  // Cloudflare's badge stays "every edge" even though its live response names
  // a colo — the colo is just whichever edge answered, not a home region.
  if (p.id === 'cloudflare') return 'every edge';
  return liveRegions[p.id] ?? shortRegion(p.functionRegion);
}

function renderScenario(id) {
  const s = data.byScenario[id];
  if (!s) return;
  // The function dashboard only lists platforms that have functions —
  // a row of "no data" for GitHub Pages explains nothing.
  const pool = id === 'function'
    ? data.platforms.filter((p) => p.functions !== false)
    : data.platforms;

  const rows = pool
    .map((p) => ({
      ...p,
      regionBadge: regionBadge(p),
      ...(s.overall[p.id] ?? { n: 0, p50: null, p75: null, p95: null, p99: null }),
    }))
    .sort((a, b) => (a.p50 ?? Infinity) - (b.p50 ?? Infinity));

  legend($(`legend-main-${id}`), rows.map((r) => ({ label: r.label, color: color(r.id) })));
  legend($(`legend-phase-${id}`), PHASES.map((p) => ({ label: p.label, color: p.color })));

  // Every chart keeps the headline chart's ranking, so a reader's eye can
  // carry one row order down the whole section.
  drawMain(rows, { svg: `chart-main-${id}`, showRegions: id === 'function' });
  drawPhases(rows, s.phases, `chart-phase-${id}`);
  drawHeat(rows, s.byContinent, `heatmap-${id}`);
  drawTable(rows, s.errorRate, `table-${id}`);
}

function renderAll() {
  renderScenario('static');
  renderScenario('function');
  legend($('legend-time'), data.platforms.map((p) => ({ label: p.label, color: color(p.id) })));
  drawTimeline(data.platforms, data.timeline);
  methodology(data.platforms, liveRegions);
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
    renderScenario('function');
  }
}

export async function initDashboard() {
  data = await fetch(RAW, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch(() => fetch('data/summary.json', { cache: 'no-store' }).then((r) => r.json()));

  $('meta').textContent =
    `${data.totalSamples.toLocaleString()} probe samples · ${data.rounds} rounds · ${data.probeCount} probes · ` +
    `last ${data.windowDays} days · updated ${new Date(data.generatedAt).toLocaleString()}`;

  renderAll();
  fetchLiveRegions();
  initLive(data.platforms);
}
