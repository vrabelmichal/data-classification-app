#!/usr/bin/env node

/*
Dump all Convex tables to JSON files.
Usage:
  node scripts/dump_convex.js --out ./backup --env .env.local

Options:
  --out, -o   Output directory (required)
  --env, -e   Path to .env file to load (optional)

add this to package.json scripts section:
    "dump:convex": "node scripts/dump_convex.js --out ./backup --env .env.local",

*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const outIdx = Math.max(args.indexOf('--out'), args.indexOf('-o'));
  const envIdx = Math.max(args.indexOf('--env'), args.indexOf('-e'));
  const opts = {};
  if (outIdx !== -1) opts.out = args[outIdx + 1];
  if (envIdx !== -1) opts.env = args[envIdx + 1];
  return opts;
}

async function loadEnv(envPath) {
  if (!envPath) return;
  const dotenvModule = await import('dotenv');
  dotenvModule.config({ path: envPath });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getConvexUrl() {
  // Support both server and vite-style var
  return process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
}

async function callConvexFunction(convexUrl, functionName, args = {}) {
  const url = `${convexUrl.replace(/\/$/, '')}/api/functions/${functionName}`;
  console.log(`Calling Convex function ${functionName} at ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args, format: 'json' })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Convex error: ${json.error}`);
  return json.value;
}

async function main() {
  const { out, env } = parseArgs();
  if (!out) {
    console.error('Missing --out <dir>');
    process.exit(1);
  }
  if (env) await loadEnv(env);

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    console.error('Missing CONVEX_URL or VITE_CONVEX_URL in environment.');
    process.exit(1);
  }

  const outputDir = path.resolve(out);
  ensureDir(outputDir);

  const tables = [
    'galaxies',
    'userProfiles',
    'userPreferences',
    'classifications',
    'skippedGalaxies',
    'galaxySequences',
    'systemSettings',
    'users',
  ];

  console.log(`Dumping tables to ${outputDir}`);

  for (const table of tables) {
    process.stdout.write(`- ${table} ... `);
    try {
      const rows = await callConvexFunction(convexUrl, 'export_database:exportTable', { table });
      const outPath = path.join(outputDir, `${table}.json`);
      fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
      console.log(`ok (${rows.length} rows)`);
    } catch (err) {
      console.log('failed');
      console.error(`  Error exporting ${table}:`, err.message);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
