/**
 * Generate res-8 H3 cell mapping for LandCluster zones
 *
 * A LandCluster's spatial footprint is derived bottom-up from its constituent
 * monitoring sites. Each site's lat/lng is mapped to its parent res-8 backbone
 * cell. The unique set of res-8 cells becomes the cluster's coverage.
 *
 * Input:  LandCluster_Sites.csv (cluster_id, site_zone_id, lat, lng)
 *         LandCluster_Zones.csv  (cluster_id, moku_id)
 * Output: LandCluster_Zones_H3.csv (cluster_id, h3_cell, resolution, moku_id)
 *
 * Run: node land-cluster/generate-land-cluster-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { latLngToCell } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_FILE = path.join(__dirname, 'LandCluster_Sites.csv');
const ZONES_FILE = path.join(__dirname, 'LandCluster_Zones.csv');
const OUTPUT_FILE = path.join(__dirname, 'LandCluster_Zones_H3.csv');
const RESOLUTION = 8;
const VERSION = '2026.03';
const DATA_SOURCE = 'LandCluster site-derived coverage';

// --- Load cluster metadata for moku_id lookup ---

const zonesCsv = readFileSync(ZONES_FILE, 'utf-8');
const zones = parse(zonesCsv, { columns: true, skip_empty_lines: true });

const clusterMoku = new Map();
for (const z of zones) {
  clusterMoku.set(z.cluster_id.trim(), z.moku_id.trim());
}

// --- Load sites and derive res-8 cells ---

const sitesCsv = readFileSync(SITES_FILE, 'utf-8');
const sites = parse(sitesCsv, { columns: true, skip_empty_lines: true });

console.log('=== LandCluster — Res-8 H3 Cell Derivation ===\n');
console.log(`Input sites: ${sites.length}\n`);

// Map: cluster_id → Set of unique res-8 cells
const clusterCells = new Map();
let skipped = 0;

for (const site of sites) {
  const clusterId = site.cluster_id?.trim();
  const lat = parseFloat(site.latitude);
  const lng = parseFloat(site.longitude);

  if (!clusterId) {
    console.warn(`  SKIP: missing cluster_id`);
    skipped++;
    continue;
  }

  if (isNaN(lat) || isNaN(lng)) {
    console.warn(`  SKIP ${site.site_zone_id}: missing coordinates`);
    skipped++;
    continue;
  }

  // Validate Hawaii coordinate bounds
  if (lat < 18 || lat > 23 || lng < -161 || lng > -154) {
    console.warn(`  SKIP ${site.site_zone_id}: coordinates outside Hawaii bounds (${lat}, ${lng})`);
    skipped++;
    continue;
  }

  const h3Cell = latLngToCell(lat, lng, RESOLUTION);

  if (!clusterCells.has(clusterId)) {
    clusterCells.set(clusterId, new Set());
  }
  clusterCells.get(clusterId).add(h3Cell);

  console.log(`  ${site.site_zone_id} (${site.site_name}) -> ${h3Cell}`);
}

// --- Write output CSV ---

const rows = [];
for (const [clusterId, cells] of clusterCells) {
  const mokuId = clusterMoku.get(clusterId) || '';
  for (const h3Cell of cells) {
    rows.push(`${clusterId},${h3Cell},${RESOLUTION},${mokuId},${VERSION},${DATA_SOURCE}`);
  }
}

const header = 'cluster_id,h3_cell,resolution,moku_id,version,data_source';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`\nWrote ${rows.length} unique res-8 cells across ${clusterCells.size} clusters`);
if (skipped > 0) console.log(`Skipped ${skipped} sites (missing data or invalid coordinates)`);

// Summary per cluster
for (const [clusterId, cells] of clusterCells) {
  console.log(`  ${clusterId}: ${cells.size} res-8 cells`);
}

console.log('\n=== Done ===');
