/**
 * Generate centroid-based H3 resolution-8 mapping for HPMS Highway segments
 *
 * Each of the 2,075 road segments is mapped to a single res-8 H3 cell
 * via the midpoint of its LineString, linking to the existing moku backbone.
 *
 * Run: node highways/generate-highways-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'Highway_Performance_Monitoring_System_Roads_for_Hawaii_(HPMS).geojson');
const OUTPUT_FILE = path.join(__dirname, 'HWY_Zones_H3.csv');
const VERSION = '2026.01';

const ISLAND_MAP = {
  'big island': 'hawaii',
  'hawaii': 'hawaii',
  'kauai': 'kauai',
  'maui': 'maui',
  'oahu': 'oahu',
  'molokai': 'molokai',
  'lanai': 'lanai',
};

/**
 * Compute the midpoint of a LineString or MultiLineString
 * by averaging all coordinate points.
 */
function computeLineMidpoint(geometry) {
  const points = [];

  if (geometry.type === 'LineString') {
    for (const [lng, lat] of geometry.coordinates) {
      points.push([lat, lng]);
    }
  } else if (geometry.type === 'MultiLineString') {
    for (const line of geometry.coordinates) {
      for (const [lng, lat] of line) {
        points.push([lat, lng]);
      }
    }
  }

  if (points.length === 0) return null;

  const sumLat = points.reduce((s, p) => s + p[0], 0);
  const sumLng = points.reduce((s, p) => s + p[1], 0);
  return [sumLat / points.length, sumLng / points.length];
}

// --- Main ---

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

console.log('=== HPMS Highways — Centroid H3 Mapping ===\n');
console.log(`Features: ${geojson.features.length}\n`);

const rows = [];
let skipped = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const oid = props.objectid;
  const island = props.island;
  const zoneId = `HWY_${oid}`;
  const islandNorm = ISLAND_MAP[island.toLowerCase()] || island.toLowerCase();

  if (!feature.geometry) {
    console.warn(`  SKIP objectid ${oid}: null geometry`);
    skipped++;
    continue;
  }

  const midpoint = computeLineMidpoint(feature.geometry);
  if (!midpoint) {
    console.warn(`  SKIP objectid ${oid}: no valid midpoint`);
    skipped++;
    continue;
  }

  const [lat, lng] = midpoint;
  const h3Cell = latLngToCell(lat, lng, 8);
  const provenance = `Midpoint res8 from HPMS segment objectid ${oid}`;

  rows.push(`${zoneId},${h3Cell},8,${islandNorm},${VERSION},HPMS midpoint 2026,${provenance}`);
}

// Write CSV
const header = 'zone_id,h3_cell,resolution,island,version,data_source,provenance';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`Wrote ${rows.length} rows to HWY_Zones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} features`);

// Summary by island
const byIsland = {};
for (const row of rows) {
  const island = row.split(',')[3];
  byIsland[island] = (byIsland[island] || 0) + 1;
}
console.log('\nBy island:');
for (const [island, count] of Object.entries(byIsland).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${island}: ${count}`);
}

const uniqueCells = new Set(rows.map(r => r.split(',')[1]));
console.log(`\nUnique res-8 cells used: ${uniqueCells.size}`);

console.log('\n=== Done ===');
