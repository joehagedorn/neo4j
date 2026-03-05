#!/usr/bin/env node
/**
 * Dataset Refresh Helper
 *
 * Downloads (or re-downloads) a source file from its authoritative portal
 * and updates the dataset.json manifest with the new download date.
 *
 * Usage:
 *   node refresh-dataset.mjs <dataset-id>
 *   node refresh-dataset.mjs ag-baseline
 *   node refresh-dataset.mjs stewards
 *
 * After refresh, run the generate script manually:
 *   node stewards/generate-stewards-h3.mjs
 *   # Then run Stage A + Stage B Cypher in AuraDB console
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const datasetId = process.argv[2];
if (!datasetId) {
  console.error('Usage: node refresh-dataset.mjs <dataset-id>');
  console.error('  Run "node index-datasets.mjs" to see available dataset IDs.');
  process.exit(1);
}

function findManifest(dir, id) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;

    const manifest = path.join(full, 'dataset.json');
    if (fs.existsSync(manifest)) {
      const data = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
      if (data.id === id) return { path: manifest, dir: full, data };
    }
    // One level deeper
    for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const subManifest = path.join(full, sub.name, 'dataset.json');
      if (fs.existsSync(subManifest)) {
        const data = JSON.parse(fs.readFileSync(subManifest, 'utf-8'));
        if (data.id === id) return { path: subManifest, dir: path.join(full, sub.name), data };
      }
    }
  }
  return null;
}

const found = findManifest(__dirname, datasetId);
if (!found) {
  console.error(`Dataset "${datasetId}" not found. Run "node index-datasets.mjs" for available IDs.`);
  process.exit(1);
}

const { path: manifestPath, dir: manifestDir, data } = found;
const sourceFile = data.files?.source;

if (!sourceFile) {
  console.error(`Dataset "${datasetId}" has no source file defined in dataset.json.`);
  process.exit(1);
}

if (!sourceFile.download_url) {
  console.error(`Dataset "${datasetId}" has no download_url. Open the portal manually:`);
  console.error(`  ${data.authority?.portal_url || '(no portal URL)'}`);
  process.exit(1);
}

const destPath = path.join(manifestDir, sourceFile.file);
console.log(`Downloading: ${data.title}`);
console.log(`  From: ${sourceFile.download_url}`);
console.log(`  To:   ${destPath}`);

try {
  const response = await fetch(sourceFile.download_url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  const sizeMb = buffer.length / (1024 * 1024);
  console.log(`  Size: ${sizeMb < 1 ? `${(sizeMb * 1024).toFixed(0)} KB` : `${sizeMb.toFixed(1)} MB`}`);

  // Count features if GeoJSON
  if (sourceFile.format === 'geojson') {
    try {
      const geojson = JSON.parse(buffer.toString('utf-8'));
      if (geojson.features) {
        console.log(`  Features: ${geojson.features.length}`);
      }
    } catch {
      // Large files may fail JSON parse — that's ok
    }
  }

  // Update manifest
  const today = new Date().toISOString().split('T')[0];
  data.downloaded_at = today;
  data.last_checked = today;
  data.stale = false;
  if (sourceFile.size_mb) {
    data.files.source.size_mb = Math.round(sizeMb * 10) / 10;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n  Updated ${path.basename(manifestPath)}: downloaded_at=${today}, stale=false`);

  // Suggest next steps
  console.log('\nNext steps:');
  if (data.scripts?.generate) {
    console.log(`  1. node ${path.relative(__dirname, path.join(manifestDir, data.scripts.generate))}`);
  }
  if (data.scripts?.stage_a) {
    console.log(`  2. Run ${data.scripts.stage_a} in AuraDB console`);
  }
  if (data.scripts?.stage_b) {
    console.log(`  3. Run ${data.scripts.stage_b} in AuraDB console`);
  }
  if (data.scripts?.loader) {
    console.log(`  (or) node ${path.relative(__dirname, path.join(manifestDir, data.scripts.loader))}`);
  }
} catch (err) {
  console.error(`\nDownload failed: ${err.message}`);
  console.error(`Try opening the portal manually: ${data.authority?.portal_url || sourceFile.download_url}`);
  process.exit(1);
}
