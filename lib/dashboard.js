// The dashboard's chart code, unchanged from its vanilla origins: it builds
// SVG into the server-rendered shell after mount. Kept framework-free on
// purpose — the page stays simple and the charts have zero dependencies.
export async function initDashboard() {

const $ = (id) => document.getElementById(id);
const tip = $('tip');

const showTip = (evt, html) => {
  tip.innerHTML = html;
  tip.style.opacity = '1';
  const pad = 14, r = tip.getBoundingClientRect();
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
};
const hideTip = () => { tip.style.opacity = '0'; };

const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  return el;
};

const PHASES = [
  { key: 'dns',       label: 'DNS',    color: 'var(--phase-1)' },
  { key: 'tcp',       label: 'TCP',    color: 'var(--phase-2)' },
  { key: 'tls',       label: 'TLS',    color: 'var(--phase-3)' },
  { key: 'firstByte', label: 'Server', color: 'var(--phase-4)' },
];
const CONTINENTS = { NA: 'N. America', SA: 'S. America', EU: 'Europe', AS: 'Asia', OC: 'Oceania', AF: 'Africa' };

let data, scenario;

const color = (id) => `var(--s-${id})`;

// Axis max that divides into four clean ticks, so gridline labels stay round.
function nice(max) {
  const raw = (max || 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return step * 4;
}

function legend(node, items) {
  node.replaceChildren(...items.map(({ label, color: c }) => {
    const s = document.createElement('span');
    s.innerHTML = `<i class="swatch" style="background:${c}"></i>${label}`;
    return s;
  }));
}

/* ---- headline: p50 bar with a p95 tick ---- */
function drawMain(rows) {
  const svg = $('chart-main');
  svg.replaceChildren();
  const W = 900, rowH = 44, padL = 128, padR = 96, top = 24;
  const H = top + rows.length * rowH + 28;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Scale to the medians, not to p95. One platform with a fat tail would
  // otherwise stretch the axis until every other bar is a sliver. Whiskers
  // that run past the edge get clipped and flagged; the label keeps the
  // true number either way.
  const maxP50 = Math.max(...rows.map((r) => r.p50 ?? 0), 1);
  const maxP95 = Math.max(...rows.map((r) => r.p95 ?? 0), 1);
  const max = nice(Math.min(maxP95, maxP50 * 1.5) * 1.08);
  const x = (v) => padL + (Math.min(v, max) / max) * (W - padL - padR);

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(svgEl('line', { class: 'grid-line', x1: x(v), x2: x(v), y1: top - 8, y2: H - 26 }));
    const t = svgEl('text', { class: 'axis-text', x: x(v), y: H - 10, 'text-anchor': 'middle' });
    t.textContent = `${Math.round(v)} ms`;
    svg.append(t);
  }

  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const label = svgEl('text', { class: 'row-label', x: padL - 14, y: y + 20, 'text-anchor': 'end' });
    label.textContent = r.label;
    svg.append(label);

    if (r.p50 == null) {
      const t = svgEl('text', { class: 'val-sub', x: padL, y: y + 20 });
      t.textContent = 'no data';
      svg.append(t);
      return;
    }

    // 4px rounded data-end, anchored to the baseline.
    const w = Math.max(x(r.p50) - padL, 4);
    svg.append(svgEl('rect', { x: padL, y: y + 6, width: w, height: 22, rx: 4, fill: color(r.id) }));

    // p95 whisker — secondary encoding, so the spread reads without color alone.
    const clipped = r.p95 != null && r.p95 > max;
    if (r.p95 != null) {
      svg.append(svgEl('line', {
        x1: x(r.p50), x2: x(r.p95), y1: y + 17, y2: y + 17,
        stroke: 'var(--border-strong)', 'stroke-width': 2,
      }));
      svg.append(svgEl(clipped ? 'path' : 'line', clipped
        ? { d: `M${x(max) - 7},${y + 11}L${x(max)},${y + 17}L${x(max) - 7},${y + 23}`,
            fill: 'none', stroke: 'var(--border-strong)', 'stroke-width': 2, 'stroke-linecap': 'round' }
        : { x1: x(r.p95), x2: x(r.p95), y1: y + 10, y2: y + 24,
            stroke: 'var(--border-strong)', 'stroke-width': 2 }));
    }

    // Direct labels: required relief for the light-mode contrast warning.
    const labelX = x(r.p95 ?? r.p50) + 10;
    const v = svgEl('text', { class: 'val-label', x: labelX, y: y + 16 });
    v.textContent = `${r.p50} ms`;
    svg.append(v);
    const s = svgEl('text', { class: 'val-sub', x: labelX, y: y + 28 });
    s.textContent = `p95 ${r.p95 ?? '–'}`;
    svg.append(s);

    const hit = svgEl('rect', { class: 'hit', x: 0, y, width: W, height: rowH });
    hit.addEventListener('mousemove', (e) => showTip(e,
      `<b>${r.label}</b><br>p50 ${r.p50} ms · p75 ${r.p75} ms<br>p95 ${r.p95} ms · p99 ${r.p99} ms<br>${r.n} samples`));
    hit.addEventListener('mouseleave', hideTip);
    svg.append(hit);
  });
}

/* ---- stacked phase breakdown ---- */
function drawPhases(platforms, phases) {
  const svg = $('chart-phase');
  svg.replaceChildren();
  const W = 900, rowH = 36, padL = 128, padR = 70, top = 18;
  const H = top + platforms.length * rowH + 28;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const totals = platforms.map((p) => PHASES.reduce((a, ph) => a + (phases[p.id]?.[ph.key] ?? 0), 0));
  const max = nice(Math.max(...totals, 1) * 1.08);
  const x = (v) => (v / max) * (W - padL - padR);

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(svgEl('line', { class: 'grid-line', x1: padL + x(v), x2: padL + x(v), y1: top - 6, y2: H - 26 }));
    const t = svgEl('text', { class: 'axis-text', x: padL + x(v), y: H - 10, 'text-anchor': 'middle' });
    t.textContent = `${Math.round(v)} ms`;
    svg.append(t);
  }

  platforms.forEach((p, i) => {
    const y = top + i * rowH;
    const label = svgEl('text', { class: 'row-label', x: padL - 14, y: y + 18, 'text-anchor': 'end' });
    label.textContent = p.label;
    svg.append(label);

    let cursor = 0;
    for (const ph of PHASES) {
      const v = phases[p.id]?.[ph.key];
      if (!v) continue;
      const w = x(v);
      // 2px surface gap between segments keeps adjacent fills legible.
      svg.append(svgEl('rect', {
        x: padL + x(cursor), y: y + 4, width: Math.max(w - 2, 1), height: 20, rx: 3, fill: ph.color,
      }));
      const seg = svgEl('rect', { class: 'hit', x: padL + x(cursor), y: y + 4, width: Math.max(w, 2), height: 20 });
      seg.addEventListener('mousemove', (e) => showTip(e, `<b>${p.label}</b><br>${ph.label} ${v} ms`));
      seg.addEventListener('mouseleave', hideTip);
      svg.append(seg);
      cursor += v;
    }
    const t = svgEl('text', { class: 'val-label', x: padL + x(cursor) + 10, y: y + 19 });
    t.textContent = `${Math.round(cursor)} ms`;
    svg.append(t);
  });
}

/* ---- region heatmap: sequential blue, one hue, light means fast ---- */
function drawHeat(platforms, byContinent) {
  const present = Object.keys(CONTINENTS).filter((c) =>
    platforms.some((p) => byContinent[`${p.id}|${c}`]?.p50 != null));

  const values = [];
  for (const p of platforms) for (const c of present) {
    const v = byContinent[`${p.id}|${c}`]?.p50;
    if (v != null) values.push(v);
  }
  const lo = Math.min(...values, 0), hi = Math.max(...values, 1);
  const STEPS = 7;
  // JS only picks which step a value lands on; CSS owns what that step looks like.
  const step = (v) => Math.min(STEPS - 1, Math.floor(((v - lo) / (hi - lo || 1)) * STEPS));

  const table = document.createElement('table');
  table.innerHTML =
    `<thead><tr><th>Platform</th>${present.map((c) => `<th>${CONTINENTS[c]}</th>`).join('')}</tr></thead>` +
    `<tbody>${platforms.map((p) => `<tr><td><span class="name"><i class="swatch" style="background:${color(p.id)}"></i>${p.label}</span></td>` +
      present.map((c) => {
        const s = byContinent[`${p.id}|${c}`];
        if (!s || s.p50 == null) return `<td><span class="heat muted">–</span></td>`;
        return `<td><span class="heat s${step(s.p50)}" title="${s.n} samples">${s.p50}</span></td>`;
      }).join('') + '</tr>').join('')}</tbody>`;

  const scale = document.createElement('p');
  scale.className = 'scale';
  scale.innerHTML = `<span>${lo} ms — faster</span>` +
    Array.from({ length: STEPS }, (_, i) => `<i class="s${i}"></i>`).join('') +
    `<span>slower — ${hi} ms</span>`;
  $('heatmap').replaceChildren(table, scale);
}

/* ---- timeline ---- */
function drawTimeline(platforms, timeline) {
  const card = $('timeline-card');
  if (timeline.length < 2) { card.style.display = 'none'; return; }
  card.style.display = '';

  const svg = $('chart-time');
  svg.replaceChildren();
  const W = 900, H = 300, padL = 52, padR = 20, padT = 14, padB = 34;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const all = timeline.flatMap((h) => platforms.map((p) => h[p.id]).filter((v) => v != null));
  const max = nice(Math.max(...all, 1) * 1.05);
  const x = (i) => padL + (i / Math.max(timeline.length - 1, 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(svgEl('line', { class: 'grid-line', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
    const t = svgEl('text', { class: 'axis-text', x: padL - 10, y: y(v) + 4, 'text-anchor': 'end' });
    t.textContent = Math.round(v);
    svg.append(t);
  }

  const step = Math.max(1, Math.ceil(timeline.length / 8));
  timeline.forEach((h, i) => {
    if (i % step) return;
    const t = svgEl('text', { class: 'axis-text', x: x(i), y: H - 10, 'text-anchor': 'middle' });
    t.textContent = new Date(h.hour).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' });
    svg.append(t);
  });

  for (const p of platforms) {
    const pts = timeline.map((h, i) => (h[p.id] == null ? null : [x(i), y(h[p.id])])).filter(Boolean);
    if (!pts.length) continue;
    svg.append(svgEl('path', {
      d: 'M' + pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L'),
      fill: 'none', stroke: color(p.id), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
  }

  // Crosshair over the whole plot.
  const cross = svgEl('line', { class: 'grid-line', y1: padT, y2: H - padB, stroke: 'var(--border-strong)', opacity: 0 });
  svg.append(cross);
  const hit = svgEl('rect', { class: 'hit', x: padL, y: padT, width: W - padL - padR, height: H - padT - padB });
  hit.addEventListener('mousemove', (e) => {
    const box = svg.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((rel - padL) / (W - padL - padR)) * (timeline.length - 1));
    const h = timeline[Math.max(0, Math.min(timeline.length - 1, i))];
    if (!h) return;
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
    const lines = platforms
      .filter((p) => h[p.id] != null)
      .sort((a, b) => h[a.id] - h[b.id])
      .map((p) => `<i class="swatch" style="background:${color(p.id)};display:inline-block;vertical-align:-1px;margin-right:6px"></i>${p.label} <b>${h[p.id]} ms</b>`)
      .join('<br>');
    showTip(e, `<b>${new Date(h.hour).toLocaleString()}</b><br>${lines}`);
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); hideTip(); });
  svg.append(hit);
}

function drawTable(rows, errorRate) {
  $('table').innerHTML =
    `<thead><tr><th>Platform</th><th>p50</th><th>p75</th><th>p95</th><th>p99</th><th>Samples</th><th>Errors</th></tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>
      <td><span class="name"><i class="swatch" style="background:${color(r.id)}"></i>${r.label}</span></td>
      <td>${r.p50 ?? '–'}</td><td>${r.p75 ?? '–'}</td><td>${r.p95 ?? '–'}</td><td>${r.p99 ?? '–'}</td>
      <td>${r.n}</td><td>${errorRate[r.id] ?? 0}%</td></tr>`).join('')}</tbody>`;
}

function render() {
  const s = data.byScenario[scenario];
  const rows = data.platforms
    .map((p) => ({ ...p, ...(s.overall[p.id] ?? { n: 0, p50: null, p75: null, p95: null, p99: null }) }))
    .sort((a, b) => (a.p50 ?? Infinity) - (b.p50 ?? Infinity));

  const note = data.scenarios.find((x) => x.id === scenario);
  $('scenario-note').textContent = note?.description ?? '';

  legend($('legend-main'), rows.map((r) => ({ label: r.label, color: color(r.id) })));
  legend($('legend-phase'), PHASES.map((p) => ({ label: p.label, color: p.color })));
  legend($('legend-time'), rows.map((r) => ({ label: r.label, color: color(r.id) })));

  // Every chart keeps the headline chart's ranking, so a reader's eye can
  // carry one row order down the whole page.
  drawMain(rows);
  drawPhases(rows, s.phases);
  drawHeat(rows, s.byContinent);
  drawTimeline(data.platforms, data.timeline);
  drawTable(rows, s.errorRate);
}

function methodology() {
  $('method').innerHTML = `
    <h3>How a round works</h3>
    <ul>
      <li>This page is the payload: the same Next.js app, deployed to every platform from the
          same commit. Probes fetch <code>/</code> for static delivery and <code>/bench/now</code>
          for function dispatch.</li>
      <li>Probes come from <a href="https://globalping.io">Globalping</a> — ten countries, six
          continents. The first measurement of a round fixes the probe set and every platform is
          measured from those exact machines, seconds apart.</li>
      <li>Rounds run every 6 hours plus on every deploy. Charts show percentiles over a rolling
          7-day window, DNS excluded, and only clean HTTP 200s count.</li>
    </ul>

    <h3>The single-region caveat</h3>
    <ul>
      <li><b>Vercel</b> and <b>Netlify</b> run the function in one default region —
          <b>iad1 (Washington DC)</b> and <b>us-east-2 (Ohio)</b> respectively — so probes far
          from the US pay a transcontinental round trip. That is their default deployment, not a
          misconfiguration; both sell multi-region on paid tiers.</li>
      <li><b>Cloudflare</b> runs the same route at every edge location, which is why its function
          numbers barely depend on where the probe is.</li>
      <li><b>GitHub Pages</b> has no functions at all — it only appears in the static scenario.</li>
    </ul>

    <h3>What this does not tell you</h3>
    <ul>
      <li>Probes sit in datacenters with excellent transit — real users on mobile networks see more.</li>
      <li>Free tiers are measured; paid plans change routing and caching on some platforms.</li>
      <li>Latency is one axis. Build times, DX, pricing and lock-in matter more for most decisions.</li>
    </ul>`;
}

const RAW = 'https://raw.githubusercontent.com/JonathanSeriesX/edge-bench-data/main/summary.json';
data = await fetch(RAW, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .catch(() => fetch('data/summary.json', { cache: 'no-store' }).then((r) => r.json()));
scenario = Object.keys(data.byScenario)[0];

$('meta').textContent =
  `${data.totalSamples.toLocaleString()} samples · ${data.rounds} rounds · ${data.probeCount} probes · ` +
  `last ${data.windowDays} days · updated ${new Date(data.generatedAt).toLocaleString()}`;

if (!data.controlled) {
  $('notice').innerHTML = `<div class="notice"><strong>Preview data — not a fair comparison yet.</strong>
    The collector is currently hitting each vendor's own marketing site, which means it is measuring five
    completely different pages. Point <code>targets.json</code> at real deployments of this app
    and set <code>controlled: true</code> to get a like-for-like result.</div>`;
}

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

methodology();
render();

}
