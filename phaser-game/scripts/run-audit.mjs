#!/usr/bin/env node
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.argv[2];
if (!entry) throw new Error('Usage: node scripts/run-audit.mjs <audit.ts>');
const directory = await mkdtemp(path.join(tmpdir(), 'pokemon-korea-audit-'));
const outfile = path.join(directory, 'audit.mjs');
try {
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node16', logLevel: 'silent' });
  await import(`${pathToFileURL(outfile).href}?run=${Date.now()}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
