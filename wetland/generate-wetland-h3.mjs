/**
 * Generate centroid-based H3 resolution-8 mapping for NWI Wetlands (Oahu)
 *
 * Each of the 4,974 wetland features is mapped to a single res-8 H3 cell
 * via its polygon centroid, linking to the existing moku backbone.
 *
 * Run: node wetland/generate-wetland-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'Hydrography_-2481727552189753624.geojson');
const OUTPUT_FILE = path.join(__dirname, 'WET_Zones_H3.csv');
const VERSION = '2026.02';

/**
 * Compute the centroid of a GeoJSON Polygon geometry
 * by averaging all exterior ring coordinates.
 */
function computeCentroid(geometry) {
  const points = [];

  if (geometry.type === 'Polygon') {
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

console.log('=== NWI Wetlands (Oahu) — Centroid H3 Mapping ===\n');
console.log(`Features: ${geojson.features.length}\n`);

const rows = [];
let skipped = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const oid = props.objectid;
  const zoneId = `WET_${oid}`;

  if (!feature.geometry) {
    console.warn(`  SKIP objectid ${oid}: null geometry`);
    skipped++;
    continue;
  }

  const centroid = computeCentroid(feature.geometry);
  if (!centroid) {
    console.warn(`  SKIP objectid ${oid}: no valid centroid`);
    skipped++;
    continue;
  }

  const [lat, lng] = centroid;
  const h3Cell = latLngToCell(lat, lng, 8);
  const provenance = `Centroid res8 from NWI wetland objectid ${oid} polygon`;

  rows.push(`${zoneId},${h3Cell},8,oahu,${VERSION},NWI wetland centroid 2026,${provenance}`);
}

// Write CSV
const header = 'zone_id,h3_cell,resolution,island,version,data_source,provenance';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`Wrote ${rows.length} rows to WET_Zones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} features (null/invalid geometry)`);

// Unique H3 cells
const uniqueCells = new Set(rows.map(r => r.split(',')[1]));
console.log(`\nUnique res-8 cells used: ${uniqueCells.size}`);

// Wetland type summary
const byType = {};
for (const feature of geojson.features) {
  const wt = feature.properties.wetland_type || 'Unknown';
  byType[wt] = (byType[wt] || 0) + 1;
}
console.log('\nBy wetland type:');
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

console.log('\n=== Done ===');
