/**
 * Generate multi-resolution H3 polyfills for IAL zones
 *
 * Produces three CSVs forming a resolution continuum:
 *   - IAL_Zones_H3_res8.csv  — all IAL zones at resolution 8 (~183 acres/cell)
 *   - IAL_Zones_H3_res9.csv  — small zones only at resolution 9 (~26 acres/cell)
 *
 * The res-8 layer bridges res-7 (moku backbone) and res-9 (fine detail),
 * ensuring every IAL zone has at least some H3 coverage.
 *
 * Run: node ag/generate-ial-h3-multires.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { polygonToCells } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'Important_Agricultural_Lands_(IAL).geojson');
const VERSION = '2026.01';

function convertToH3Format(polygon) {
  return polygon.map(ring => ring.map(([lng, lat]) => [lat, lng]));
}

function getH3CellsForGeometry(geometry, resolution) {
  const allCells = new Set();
  if (geometry.type === 'Polygon') {
    try {
      const h3Coords = convertToH3Format(geometry.coordinates);
      polygonToCells(h3Coords, resolution).forEach(c => allCells.add(c));
    } catch (e) { /* skip */ }
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      try {
        const h3Coords = convertToH3Format(poly);
        polygonToCells(h3Coords, resolution).forEach(c => allCells.add(c));
      } catch (e) { /* skip */ }
    }
  }
  return Array.from(allCells);
}

function writeCsv(filename, rows, resolution) {
  const header = 'zone_id,h3_cell,resolution,version,data_source,provenance';
  const csv = [header, ...rows].join('\n') + '\n';
  const outPath = path.join(__dirname, filename);
  writeFileSync(outPath, csv, 'utf-8');
  console.log(`  Wrote ${rows.length} rows to ${filename}\n`);
}

// --- Main ---

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

console.log('=== IAL Multi-Resolution H3 Polyfill ===\n');

// Track which zones had 0 cells at res 7
const RES7_ZERO_DOCKETS = new Set(['DR10-42', 'DR13-50', 'DR18-61', 'DR18-63']);

// --- Resolution 8: all zones ---
console.log('--- Resolution 8 (all zones, ~183 acres/cell) ---\n');
const res8Rows = [];
for (const feature of geojson.features) {
  const docket = feature.properties.docket_no;
  const zoneId = 'IAL_' + docket.replace(/ /g, '_');
  const cells = getH3CellsForGeometry(feature.geometry, 8);
  const provenance = `Polyfill res8 from IAL ${docket} polygon`;
  for (const h3 of cells) {
    res8Rows.push(`${zoneId},${h3},8,${VERSION},IAL polyfill 2026,${provenance}`);
  }
  console.log(`  ${zoneId} (${feature.properties.acres.toFixed(0)} acres): ${cells.length} cells`);
}
writeCsv('IAL_Zones_H3_res8.csv', res8Rows, 8);

// --- Resolution 9: small zones only ---
console.log('--- Resolution 9 (small zones only, ~26 acres/cell) ---\n');
const res9Rows = [];
for (const feature of geojson.features) {
  const docket = feature.properties.docket_no;
  if (!RES7_ZERO_DOCKETS.has(docket)) continue;

  const zoneId = 'IAL_' + docket.replace(/ /g, '_');
  const cells = getH3CellsForGeometry(feature.geometry, 9);
  const provenance = `Polyfill res9 from IAL ${docket} polygon`;
  for (const h3 of cells) {
    res9Rows.push(`${zoneId},${h3},9,${VERSION},IAL polyfill 2026,${provenance}`);
  }
  console.log(`  ${zoneId} (${feature.properties.acres.toFixed(0)} acres): ${cells.length} cells`);
}
writeCsv('IAL_Zones_H3_res9.csv', res9Rows, 9);

console.log('=== Done ===');
