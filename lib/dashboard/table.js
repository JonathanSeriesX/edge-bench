import { $, color } from './util';

export function drawTable(rows, errorRate, tableId) {
  $(tableId).innerHTML =
    `<thead><tr><th>Platform</th><th>p50</th><th>p75</th><th>p95</th><th>p99</th><th>Samples</th><th>Errors</th></tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>
      <td><span class="name"><i class="swatch" style="background:${color(r.id)}"></i>${r.label}</span></td>
      <td>${r.p50 ?? '–'}</td><td>${r.p75 ?? '–'}</td><td>${r.p95 ?? '–'}</td><td>${r.p99 ?? '–'}</td>
      <td>${r.n}</td><td>${errorRate[r.id] ?? 0}%</td></tr>`).join('')}</tbody>`;
}
