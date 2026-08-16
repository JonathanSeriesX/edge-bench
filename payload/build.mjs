#!/usr/bin/env node
// Generates the byte-identical test payload that every platform serves.
// Run this once and commit the output so all five deployments are provably
// the same bytes — a size difference of even a few KB would skew download time.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const TARGET_BYTES = 12_288;

// Plain text, not .html: Cloudflare Pages force-redirects "/x.html" to "/x"
// (pretty URLs, not disableable), and a 308 would poison the comparison on
// platforms that don't follow it. Every platform serves .txt verbatim.
const head = `edge-bench fixed-size payload. Do not edit by hand; regenerate with payload/build.mjs.
`;
const tail = `\n`;

// Deterministic filler so the file is identical on every machine and every run.
let filler = '';
let i = 0;
while (head.length + filler.length + tail.length < TARGET_BYTES) {
  filler += createHash('sha256').update(String(i++)).digest('hex');
}
filler = filler.slice(0, TARGET_BYTES - head.length - tail.length);

const body = head + filler + tail;
const out = join(here, 'public', 'bench', 'static.txt');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, body);

console.log(`wrote ${out} — ${Buffer.byteLength(body)} bytes, sha256=${createHash('sha256').update(body).digest('hex').slice(0, 16)}`);
