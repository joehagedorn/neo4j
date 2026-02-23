/**
 * Generate line-sampled H3 resolution-10 mapping for HART Rail Guideway
 *
 * Walks each LineString coordinate and maps it to a res-10 H3 cell,
 * deduplicating per feature. Uses only Center Alignment features (4 sections).
 * Creates new ZoneCells at res-10 and resolves moku via res-7 parent.
 *
 * Run: node rail/generate-rail-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell, cellToParent } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'HART_Guideway_Alignment_Line_PUBLIC_-8924040952061775621.geojson');
const OUTPUT_FILE = path.join(__dirname, 'RAIL_Zones_H3.csv');
const VERSION = '2026.01';

// Build res-7 H3 → moku_id lookup from moku ZoneCell.csv
const zoneCellCsv = readFileSync(path.join(__dirname, '..', 'moku', 'ZoneCell.csv'), 'utf-8');
const h3ToMoku = new Map();
for (const line of zoneCellCsv.split('\n').slice(1)) {
  if (!line.trim()) continue;
  const [h3_index, , moku_id] = line.split(',');
  h3ToMoku.set(h3_index, moku_id);
}

function getMokuId(h3Cell) {
  const parent7 = cellToParent(h3Cell, 7);
  return h3ToMoku.get(parent7) || '';
}

function getLineCoords(geometry) {
  if (geometry.type === 'LineString') {
    return [geometry.coordinates];
  } else if (geometry.type === 'MultiLineString') {
    return geometry.coordinates;
  }
  return [];
}

// --- Main ---

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

// Filter to center alignments only
const centerFeatures = geojson.features.filter(
  f => f.properties.feature_desc === 'Center Alignment'
);

console.log('=== HART Rail Guideway — Line-Sampled H3 Res-10 Mapping ===\n');
console.log(`Center alignment features: ${centerFeatures.length}\n`);

const rows = [];

for (const feature of centerFeatures) {
  const props = feature.properties;
  const oid = props.OBJECTID;
  const sectionName = props.feature_name;
  const zoneId = `RAIL_${oid}`;
  const cells = new Set();

  for (const line of getLineCoords(feature.geometry)) {
    for (const [lng, lat] of line) {
      const h3Cell = latLngToCell(lat, lng, 10);
      cells.add(h3Cell);
    }
  }

  const provenance = `Line sample res10 from HART ${sectionName} center alignment`;
  for (const h3 of cells) {
    const mokuId = getMokuId(h3);
    rows.push(`${zoneId},${h3},10,${mokuId},${VERSION},HART rail line sample 2026,${provenance}`);
  }

  console.log(`  ${zoneId}: ${sectionName} -> ${cells.size} unique cells`);
}

// Write CSV
const header = 'zone_id,h3_cell,resolution,moku_id,version,data_source,provenance';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

const uniqueCells = new Set(rows.map(r => r.split(',')[1]));
console.log(`\nWrote ${rows.length} rows to RAIL_Zones_H3.csv`);
console.log(`Total unique res-10 cells: ${uniqueCells.size}`);

const withMoku = rows.filter(r => r.split(',')[3] !== '').length;
console.log(`Cells with moku linkage: ${withMoku} / ${rows.length}`);

console.log('\n=== Done ===');
