import { $, color, CONTINENTS } from './util';

/* ---- region heatmap: sequential blue, one hue, light means fast ---- */
// The trailing Spread column (max − min across continents) turns "distance to
// the function's home region" from an assertion into a number: single-region
// platforms show a big spread on the function tab, edge networks a small one.
export function drawHeat(platforms, byContinent, mountId) {
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

  const spread = (p) => {
    const vals = present.map((c) => byContinent[`${p.id}|${c}`]?.p50).filter((v) => v != null);
    return vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : null;
  };

  const table = document.createElement('table');
  table.innerHTML =
    `<thead><tr><th>Platform</th>${present.map((c) => `<th>${CONTINENTS[c]}</th>`).join('')}` +
    `<th title="max − min of the continent medians. Small = equally fast everywhere.">Spread</th></tr></thead>` +
    `<tbody>${platforms.map((p) => `<tr><td><span class="name"><i class="swatch" style="background:${color(p.id)}"></i>${p.label}</span></td>` +
      present.map((c) => {
        const s = byContinent[`${p.id}|${c}`];
        if (!s || s.p50 == null) return `<td><span class="heat muted">–</span></td>`;
        return `<td><span class="heat s${step(s.p50)}" title="${s.n} samples">${s.p50}</span></td>`;
      }).join('') +
      `<td><span class="heat muted">${spread(p) == null ? '–' : '±' + spread(p)}</span></td></tr>`).join('')}</tbody>`;

  const scale = document.createElement('p');
  scale.className = 'scale';
  scale.innerHTML = `<span>${lo} ms — faster</span>` +
    Array.from({ length: STEPS }, (_, i) => `<i class="s${i}"></i>`).join('') +
    `<span>slower — ${hi} ms</span>`;
  $(mountId).replaceChildren(table, scale);
}
