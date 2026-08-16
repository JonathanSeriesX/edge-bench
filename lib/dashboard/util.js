// Shared helpers for the chart modules. The dashboard stays framework-free on
// purpose — it builds SVG into the server-rendered shell after mount, with
// zero chart dependencies.
export const $ = (id) => document.getElementById(id);

export const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  return el;
};

export const color = (id) => `var(--s-${id})`;

export const PHASES = [
  { key: 'dns',       label: 'DNS',    color: 'var(--phase-1)' },
  { key: 'tcp',       label: 'TCP',    color: 'var(--phase-2)' },
  { key: 'tls',       label: 'TLS',    color: 'var(--phase-3)' },
  { key: 'firstByte', label: 'Server', color: 'var(--phase-4)' },
];

export const CONTINENTS = { NA: 'N. America', SA: 'S. America', EU: 'Europe', AS: 'Asia', OC: 'Oceania', AF: 'Africa' };

// Axis max that divides into four clean ticks, so gridline labels stay round.
export function nice(max) {
  const raw = (max || 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return step * 4;
}

export function legend(node, items) {
  node.replaceChildren(...items.map(({ label, color: c }) => {
    const s = document.createElement('span');
    s.innerHTML = `<i class="swatch" style="background:${c}"></i>${label}`;
    return s;
  }));
}

// "iad1 (Washington DC)" -> "iad1", "every edge location" -> "every edge".
// Badges get the code; the methodology spells out the rest.
export function shortRegion(region) {
  if (!region) return null;
  if (region.startsWith('every edge')) return 'every edge';
  return region.split(' (')[0];
}
