/**
 * Generate point-based H3 resolution-14 mapping for Hawaii Public Schools
 *
 * Each school is mapped to a single res-14 H3 cell (~6.3 m²) via its Point
 * coordinate, creating a high-fidelity IntraZone spatial anchor.
 *
 * Run: node schools/generate-schools-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell, cellToParent } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'Public_Schools.geojson');
const OUTPUT_FILE = path.join(__dirname, 'SCH_IntraZones_H3.csv');
const RESOLUTION = 14;
const VERSION = '2026.02';

// --- Main ---

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

console.log('=== Hawaii Public Schools — IntraZone H3 Mapping (res-14) ===\n');
console.log(`Features: ${geojson.features.length}\n`);

const rows = [];
let skipped = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const oid = props.objectid;
  const schoolName = props.sch_name;
  const island = (props.island || '').toLowerCase();
  const zoneId = `SCH_${oid}`;

  if (!feature.geometry || feature.geometry.type !== 'Point') {
    console.warn(`  SKIP objectid ${oid}: null/non-point geometry`);
    skipped++;
    continue;
  }

  const [lng, lat] = feature.geometry.coordinates;
  const h3Cell = latLngToCell(lat, lng, RESOLUTION);
  const parentH3 = cellToParent(h3Cell, 7);
  const provenance = `Point res${RESOLUTION} from school objectid ${oid} (${schoolName})`;

  rows.push(`${zoneId},${h3Cell},${RESOLUTION},${parentH3},${island},${VERSION},Schools intrazone 2026,${provenance}`);
  console.log(`  ${zoneId}: ${schoolName} (${island}) -> ${h3Cell}`);
}

// Write CSV
const header = 'zone_id,h3_cell,resolution,parent_h3_7,island,version,data_source,provenance';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`\nWrote ${rows.length} rows to SCH_IntraZones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} features (null/invalid geometry)`);

// Summary by island
const byIsland = {};
for (const row of rows) {
  const island = row.split(',')[4];
  byIsland[island] = (byIsland[island] || 0) + 1;
}
console.log('\nBy island:');
for (const [island, count] of Object.entries(byIsland).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${island}: ${count}`);
}

// Unique H3 cells
const uniqueCells = new Set(rows.map(r => r.split(',')[1]));
console.log(`\nUnique res-14 cells used: ${uniqueCells.size}`);

console.log('\n=== Done ===');
