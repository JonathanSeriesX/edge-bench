import { $, svgEl, nice, color, PHASES, shortRegion } from './util';
import { showTip, hideTip } from './tooltip';

/* ---- headline: p50 bar with a p95 tick ---- */
// In the function scenario each row carries a region badge under the platform
// name — where that function actually runs is half the explanation of the bar
// next to it.
export function drawMain(rows, { svg: svgId, showRegions = false }) {
  const svg = $(svgId);
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
    const label = svgEl('text', { class: 'row-label', x: padL - 14, y: y + (showRegions ? 15 : 20), 'text-anchor': 'end' });
    label.textContent = r.label;
    svg.append(label);

    if (showRegions) {
      const badge = svgEl('text', { class: 'val-sub', x: padL - 14, y: y + 29, 'text-anchor': 'end' });
      badge.textContent = r.regionBadge ?? 'n/a';
      svg.append(badge);
    }

    if (r.p50 == null) {
      const t = svgEl('text', { class: 'val-sub', x: padL, y: y + 20 });
      t.textContent = showRegions && r.functions === false ? 'no functions — static only' : 'no data';
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
    const regionLine = showRegions && r.regionBadge ? `<br>runs in: ${r.regionBadge}` : '';
    hit.addEventListener('mousemove', (e) => showTip(e,
      `<b>${r.label}</b><br>p50 ${r.p50} ms · p75 ${r.p75} ms<br>p95 ${r.p95} ms · p99 ${r.p99} ms<br>${r.n} samples${regionLine}`));
    hit.addEventListener('mouseleave', hideTip);
    svg.append(hit);
  });
}

/* ---- stacked phase breakdown ---- */
export function drawPhases(platforms, phases, svgId) {
  const svg = $(svgId);
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

/* ---- timeline ---- */
export function drawTimeline(platforms, timeline) {
  const card = $('timeline');
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
