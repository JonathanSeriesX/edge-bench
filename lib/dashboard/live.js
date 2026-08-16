// The "your connection" dashboard: the visitor's own browser measures every
// platform via the Resource Timing API and the chart renders right here —
// no sampling, no storage, no waiting. The datacenter probes report a floor;
// this is what *you* actually get, on your network, right now.
//
// Each platform gets one fresh-connection fetch (full DNS/TCP/TLS/server
// breakdown) and two repeats on the now-open connection (the "warm" number —
// roughly one RTT + server think time). Platforms are shuffled so no one
// systematically enjoys a settled radio. The same samples are also beaconed
// to the Analytics Engine collector (rum/worker.js) — nothing identifying, and
// the page never depends on it.
import { $, svgEl, nice, color, PHASES } from './util';
import { showTip, hideTip } from './tooltip';

const ENDPOINT = 'https://edge-bench-rum.jonathan-world.workers.dev/beacon';
const WARM_PASSES = 2;

export function initLive(platforms) {
  const start = () => setTimeout(run, 800, platforms);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

async function run(platforms) {
  // The default Resource Timing buffer (250 entries) is easily full by the
  // time we run — a page's own assets count against it, and a full buffer
  // silently drops our entries. Make room and start clean.
  performance.setResourceTimingBufferSize(2000);
  performance.clearResourceTimings();

  const status = $('live-status');
  const targets = platforms
    .map((p) => ({ ...p, url: `https://${p.host}${p.pathPrefix ?? ''}/` }))
    .sort(() => Math.random() - 0.5);

  const rows = [];
  for (const t of targets) {
    status.textContent = `Measuring ${t.label}…`;
    rows.push(await measurePlatform(t));
    draw(rows);
  }

  status.textContent = 'Done. Cold = fresh connection (stacked phases); warm = repeat request on the open connection. Reload to measure again.';
  beacon(rows);
}

async function measurePlatform(t) {
  const cold = await measureOnce(t.url);
  if (!cold) return { ...t, failed: true };

  const warms = [];
  for (let i = 0; i < WARM_PASSES; i++) {
    const w = await measureOnce(t.url);
    if (w && !w.opaque) warms.push(w.server);
  }
  warms.sort((a, b) => a - b);
  const warm = warms.length ? warms[Math.floor((warms.length - 1) / 2)] : null;
  return { ...t, ...cold, warm };
}

async function measureOnce(url) {
  // Unique query string per fetch so we measure the network, not disk cache.
  const bust = `${url}?live=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await fetch(bust, { cache: 'no-store', mode: 'cors' });
    // fetch() resolves at headers; the timing entry only lands once the body
    // is done. Drain it, then give the entry a beat to be queued.
    await res.arrayBuffer();
  } catch {
    return null; // no CORS from this origin (GitHub Pages measured cross-origin)
  }

  let entry = null;
  for (let i = 0; i < 20 && !entry; i++) {
    entry = performance.getEntriesByName(bust).at(-1);
    if (!entry) await new Promise((r) => setTimeout(r, 100));
  }
  if (!entry) return null;

  // secureConnectionStart is 0 on reused connections; a reused first fetch
  // (browser preconnect) simply reports its phases as 0 and the row leans on
  // the server segment — still an honest number.
  const tls = entry.secureConnectionStart ? entry.connectEnd - entry.secureConnectionStart : 0;
  const tcp = entry.secureConnectionStart
    ? entry.secureConnectionStart - entry.connectStart
    : entry.connectEnd - entry.connectStart;

  const sample = {
    dns: ms(entry.domainLookupEnd - entry.domainLookupStart),
    tcp: ms(tcp),
    tls: ms(tls),
    server: ms(entry.responseStart - entry.requestStart),
    download: ms(entry.responseEnd - entry.responseStart),
    total: ms(entry.duration),
    protocol: entry.nextHopProtocol || null,
    reused: entry.connectEnd === entry.connectStart,
  };
  // Missing Timing-Allow-Origin collapses every cross-origin phase to 0.
  sample.opaque = sample.server === 0 && sample.total > 0;
  return sample;
}

const ms = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/* Stacked cold-connection bar per platform, warm repeat as the sub-label.
   The headline number is TCP + TLS + server — same metric as the probe
   dashboards — with DNS drawn as its own leading segment but kept out of the
   number, since your resolver usually has it cached. */
function draw(rows) {
  const svg = $('chart-live');
  svg.replaceChildren();
  const W = 900, rowH = 44, padL = 128, padR = 110, top = 12;
  const H = top + rows.length * rowH + 28;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const usable = rows.filter((r) => !r.failed && !r.opaque);
  const totals = usable.map((r) => r.dns + r.tcp + r.tls + r.server);
  const max = nice(Math.max(...totals, 1) * 1.08);
  const x = (v) => (v / max) * (W - padL - padR);

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(svgEl('line', { class: 'grid-line', x1: padL + x(v), x2: padL + x(v), y1: top, y2: H - 26 }));
    const t = svgEl('text', { class: 'axis-text', x: padL + x(v), y: H - 10, 'text-anchor': 'middle' });
    t.textContent = `${Math.round(v)} ms`;
    svg.append(t);
  }

  const sorted = [...rows].sort((a, b) => {
    const ka = a.failed || a.opaque ? Infinity : a.tcp + a.tls + a.server;
    const kb = b.failed || b.opaque ? Infinity : b.tcp + b.tls + b.server;
    return ka - kb;
  });

  sorted.forEach((r, i) => {
    const y = top + i * rowH;
    const label = svgEl('text', { class: 'row-label', x: padL - 14, y: y + 20, 'text-anchor': 'end' });
    label.textContent = r.label;
    svg.append(label);

    if (r.failed) {
      const t = svgEl('text', { class: 'val-sub', x: padL, y: y + 20 });
      t.textContent = 'unreachable from this origin (no CORS header)';
      svg.append(t);
      return;
    }

    // No Timing-Allow-Origin: phases are hidden but the wall-clock total is
    // real — draw it as one muted bar rather than pretending we know nothing.
    if (r.opaque) {
      svg.append(svgEl('rect', {
        x: padL, y: y + 6, width: Math.max(x(Math.min(r.total, max)), 4), height: 22, rx: 4,
        fill: 'var(--border-strong)',
      }));
      const v = svgEl('text', { class: 'val-label', x: padL + x(Math.min(r.total, max)) + 10, y: y + 16 });
      v.textContent = `${r.total} ms`;
      svg.append(v);
      const s = svgEl('text', { class: 'val-sub', x: padL + x(Math.min(r.total, max)) + 10, y: y + 28 });
      s.textContent = 'total only — phases hidden (no Timing-Allow-Origin)';
      svg.append(s);
      return;
    }

    let cursor = 0;
    for (const ph of PHASES) {
      const v = ph.key === 'firstByte' ? r.server : r[ph.key];
      if (!v) continue;
      svg.append(svgEl('rect', {
        x: padL + x(cursor), y: y + 6, width: Math.max(x(v) - 2, 1), height: 22, rx: 3,
        fill: ph.color, opacity: ph.key === 'dns' ? 0.45 : null,
      }));
      cursor += v;
    }

    const headline = r.tcp + r.tls + r.server;
    const labelX = padL + x(cursor) + 10;
    const v = svgEl('text', { class: 'val-label', x: labelX, y: y + 16 });
    v.textContent = `${headline} ms`;
    svg.append(v);
    const s = svgEl('text', { class: 'val-sub', x: labelX, y: y + 28 });
    s.textContent = r.warm != null ? `warm ${r.warm} ms` : (r.reused ? 'connection was pre-warmed' : '');
    svg.append(s);

    const hit = svgEl('rect', { class: 'hit', x: 0, y, width: W, height: rowH });
    hit.addEventListener('mousemove', (e) => showTip(e,
      `<b>${r.label}</b><br>DNS ${r.dns} · TCP ${r.tcp} · TLS ${r.tls} · server ${r.server} ms` +
      `<br>connect + server <b>${headline} ms</b>${r.warm != null ? ` · warm repeat <b>${r.warm} ms</b>` : ''}` +
      `${r.protocol ? `<br>${r.protocol}` : ''}`));
    hit.addEventListener('mouseleave', hideTip);
    svg.append(hit);
  });
}

// Same shape rum/worker.js accepts; it drops reused/opaque rows itself.
// Fire-and-forget — the live view never waits on this.
function beacon(rows) {
  const samples = rows
    .filter((r) => !r.failed)
    .map((r) => ({
      platform: r.id,
      dns: r.dns, tcp: r.tcp, tls: r.tls,
      firstByte: r.server, download: r.download, total: r.total,
      protocol: r.protocol, reused: r.reused, opaque: r.opaque || undefined,
    }));
  if (!samples.length || navigator.connection?.saveData === true) return;

  const payload = JSON.stringify({
    samples,
    effectiveType: navigator.connection?.effectiveType ?? null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, payload);
  else fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
}
