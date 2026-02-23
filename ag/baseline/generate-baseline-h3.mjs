/**
 * Generate centroid-based H3 resolution-8 mapping for Agricultural Land Use 2015 Baseline
 *
 * Each of the 5,024 features is mapped to a single res-8 H3 cell via its
 * polygon centroid, linking it to the existing moku backbone.
 *
 * Run: node ag/baseline/generate-baseline-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'Agricultural_Land_Use_-_2015_Baseline.geojson');
const OUTPUT_FILE = path.join(__dirname, 'ALU_Zones_H3.csv');
const VERSION = '2026.01';

const ISLAND_MAP = {
  'big island': 'hawaii',
  'kauai': 'kauai',
  'maui': 'maui',
  'oahu': 'oahu',
  'molokai': 'molokai',
  'lanai': 'lanai',
};

/**
 * Compute the centroid of a GeoJSON geometry (Polygon or MultiPolygon)
 * by averaging all exterior ring coordinates.
 */
function computeCentroid(geometry) {
  const points = [];

  if (geometry.type === 'Polygon') {
    // Exterior ring is coordinates[0]
    for (const [lng, lat] of geometry.coordinates[0]) {
      points.push([lat, lng]);
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const [lng, lat] of polygon[0]) {
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

console.log('=== Agricultural Land Use 2015 Baseline — Centroid H3 Mapping ===\n');
console.log(`Features: ${geojson.features.length}\n`);

const rows = [];
let skipped = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const oid = props.objectid;
  const crop = props.cropcatego;
  const island = props.island;
  const zoneId = `ALU_${oid}`;
  const islandNorm = ISLAND_MAP[island.toLowerCase()] || island.toLowerCase();

  const centroid = computeCentroid(feature.geometry);
  if (!centroid) {
    console.warn(`  SKIP objectid ${oid}: no valid centroid`);
    skipped++;
    continue;
  }

  const [lat, lng] = centroid;
  const h3Cell = latLngToCell(lat, lng, 8);
  const provenance = `Centroid res8 from ALU objectid ${oid} polygon`;

  rows.push(`${zoneId},${h3Cell},8,${islandNorm},${VERSION},ALU centroid 2026,${provenance}`);
}

// Write CSV
const header = 'zone_id,h3_cell,resolution,island,version,data_source,provenance';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`Wrote ${rows.length} rows to ALU_Zones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} features (no centroid)`);

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

// Unique H3 cells
const uniqueCells = new Set(rows.map(r => r.split(',')[1]));
console.log(`\nUnique res-8 cells used: ${uniqueCells.size}`);

console.log('\n=== Done ===');
