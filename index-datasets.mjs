#!/usr/bin/env node
/**
 * Dataset Inventory Reporter
 *
 * Reads all dataset.json manifests and prints a summary table showing
 * provenance, staleness, and local file presence for each dataset.
 *
 * Usage:
 *   node index-datasets.mjs              # Print table to stdout
 *   node index-datasets.mjs --markdown   # Print as GitHub-flavored markdown
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const markdown = process.argv.includes('--markdown');

function findDatasetFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const manifest = path.join(full, 'dataset.json');
      if (fs.existsSync(manifest)) {
        results.push(manifest);
      }
      // Check one level deeper (e.g., ag/baseline/)
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        if (sub.isDirectory()) {
          const subManifest = path.join(full, sub.name, 'dataset.json');
          if (fs.existsSync(subManifest)) {
            results.push(subManifest);
          }
        }
      }
    }
  }
  return results.sort();
}

function checkSourcePresent(manifestDir, files) {
  if (!files?.source?.file) return { present: false, size: null };
  const sourcePath = path.join(manifestDir, files.source.file);
  if (!fs.existsSync(sourcePath)) return { present: false, size: null };
  const stat = fs.statSync(sourcePath);
  const mb = stat.size / (1024 * 1024);
  return { present: true, size: mb < 1 ? `${(mb * 1024).toFixed(0)}KB` : `${mb.toFixed(1)}MB` };
}

const manifests = findDatasetFiles(__dirname);

if (manifests.length === 0) {
  console.log('No dataset.json files found.');
  process.exit(1);
}

const rows = manifests.map(manifestPath => {
  const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const dir = path.dirname(manifestPath);
  const source = checkSourcePresent(dir, data.files);

  return {
    id: data.id,
    zoneType: data.zone_type || '--',
    features: data.feature_count ?? '--',
    sourcePresent: source.present ? `yes (${source.size})` : 'no',
    tracked: data.files?.source?.tracked ? 'yes' : 'no',
    stale: data.stale ? 'STALE' : 'ok',
    frequency: data.authority?.update_frequency || '--',
    downloaded: data.downloaded_at || '--',
    lastChecked: data.last_checked || '--',
  };
});

// Column widths
const cols = {
  id: Math.max(2, ...rows.map(r => r.id.length)),
  zoneType: Math.max(4, ...rows.map(r => r.zoneType.length)),
  features: Math.max(8, ...rows.map(r => String(r.features).length)),
  sourcePresent: Math.max(14, ...rows.map(r => r.sourcePresent.length)),
  tracked: 7,
  stale: 5,
  frequency: Math.max(9, ...rows.map(r => r.frequency.length)),
  downloaded: 10,
  lastChecked: 12,
};

function pad(str, len) { return String(str).padEnd(len); }

if (markdown) {
  console.log('# Dataset Inventory\n');
  console.log(`Generated: ${new Date().toISOString().split('T')[0]}\n`);
  console.log(`| ID | Zone Type | Features | Source Present | Tracked | Stale | Frequency | Downloaded | Last Checked |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  for (const r of rows) {
    console.log(`| ${r.id} | ${r.zoneType} | ${r.features} | ${r.sourcePresent} | ${r.tracked} | ${r.stale} | ${r.frequency} | ${r.downloaded} | ${r.lastChecked} |`);
  }
} else {
  const header = [
    pad('ID', cols.id),
    pad('Type', cols.zoneType),
    pad('Features', cols.features),
    pad('Source Present', cols.sourcePresent),
    pad('Tracked', cols.tracked),
    pad('Stale', cols.stale),
    pad('Frequency', cols.frequency),
    pad('Downloaded', cols.downloaded),
    pad('Last Checked', cols.lastChecked),
  ].join('  ');

  const separator = '-'.repeat(header.length);

  console.log(`\nDataset Inventory (${rows.length} datasets)\n`);
  console.log(header);
  console.log(separator);

  for (const r of rows) {
    const line = [
      pad(r.id, cols.id),
      pad(r.zoneType, cols.zoneType),
      pad(r.features, cols.features),
      pad(r.sourcePresent, cols.sourcePresent),
      pad(r.tracked, cols.tracked),
      pad(r.stale === 'STALE' ? '\x1b[31mSTALE\x1b[0m' : r.stale, cols.stale),
      pad(r.frequency, cols.frequency),
      pad(r.downloaded, cols.downloaded),
      pad(r.lastChecked, cols.lastChecked),
    ].join('  ');
    console.log(line);
  }

  // Warnings
  const missing = rows.filter(r => r.sourcePresent === 'no');
  const stale = rows.filter(r => r.stale === 'STALE');

  if (missing.length > 0) {
    console.log(`\n⚠ ${missing.length} dataset(s) missing source files: ${missing.map(r => r.id).join(', ')}`);
    console.log('  Run: node refresh-dataset.mjs <id> to download');
  }
  if (stale.length > 0) {
    console.log(`\n⚠ ${stale.length} dataset(s) marked stale: ${stale.map(r => r.id).join(', ')}`);
  }
}
