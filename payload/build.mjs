#!/usr/bin/env node
// Generates the byte-identical page every platform serves. It is a normal
// single-page site at "/", padded to exactly TARGET_BYTES with a deterministic
// trailing comment — run it twice and you get the same bytes, so the five
// deployments are provably identical. Root ("/") is measured rather than a
// file path because Cloudflare Pages force-redirects "*.html" URLs, and a
// directory index is served without redirects on every platform.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const TARGET_BYTES = 12_288;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>edge-bench payload</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #f6f5f2; color: #0b0b0b;
         font: 16px/1.6 ui-sans-serif, -apple-system, system-ui, sans-serif; }
  @media (prefers-color-scheme: dark) { body { background: #121211; color: #fff; } }
  main { max-width: 44ch; padding: 32px; }
  h1 { font-size: 22px; letter-spacing: -0.01em; margin: 0 0 8px; }
  p { margin: 0 0 10px; opacity: 0.75; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 0.9em; }
</style>
</head>
<body>
<main>
  <h1>edge-bench payload</h1>
  <p>This page is a fixed-size benchmark target. The same bytes are deployed
     to several static hosting platforms and fetched by probes around the
     world to compare real delivery latency.</p>
  <p>It is intentionally boring: no images, no scripts, no external requests
     — anything else would measure the page, not the platform.</p>
  <p><code>/bench/now</code> is the companion serverless endpoint.</p>
</main>
`;
const tail = `</html>\n`;

// Deterministic filler inside an HTML comment, so the file is identical on
// every machine and every run. Sizes are counted in BYTES — the prose has
// multibyte characters, so string length would land off-target.
let filler = '';
let i = 0;
const overhead = Buffer.byteLength(page) + Buffer.byteLength('<!---->\n') + Buffer.byteLength(tail);
while (overhead + filler.length < TARGET_BYTES) {
  filler += createHash('sha256').update(String(i++)).digest('hex');
}
filler = filler.slice(0, TARGET_BYTES - overhead); // filler is hex, 1 byte per char

const html = `${page}<!--${filler}-->\n${tail}`;
const out = join(here, 'public', 'index.html');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, html);

console.log(`wrote ${out} — ${Buffer.byteLength(html)} bytes, sha256=${createHash('sha256').update(html).digest('hex').slice(0, 16)}`);
