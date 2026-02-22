/**
 * Generate ZoneCell.csv from Moku District GeoJSON boundaries
 *
 * Reads moku_districts_rows.csv (which contains embedded GeoJSON geometry per row),
 * converts each moku polygon to H3 resolution-7 cells, and writes a ZoneCell.csv
 * with one row per H3 cell mapped to its moku district.
 *
 * Run: node generate-zone-cells.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { polygonToCells } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const H3_RESOLUTION = 7;
const INPUT_FILE = path.join(__dirname, 'moku_districts_rows.csv');
const OUTPUT_FILE = path.join(__dirname, 'ZoneCell.csv');

/**
 * Convert GeoJSON [lng, lat] rings to H3 [lat, lng] format
 * (same pattern as mokulearner-node/tests/populate-zone-cells.mjs)
 */
function convertToH3Format(polygon) {
  return polygon.map(ring => ring.map(([lng, lat]) => [lat, lng]));
}

/**
 * Get H3 cells covering a GeoJSON geometry (Polygon or MultiPolygon)
 */
function getH3CellsForGeometry(geometry) {
  const allCells = new Set();

  if (geometry.type === 'Polygon') {
    try {
      const h3Coords = convertToH3Format(geometry.coordinates);
      const cells = polygonToCells(h3Coords, H3_RESOLUTION);
      cells.forEach(c => allCells.add(c));
    } catch (e) {
      console.warn(`  Warning: Failed to convert Polygon: ${e.message}`);
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygonCoords of geometry.coordinates) {
      try {
        const h3Coords = convertToH3Format(polygonCoords);
        const cells = polygonToCells(h3Coords, H3_RESOLUTION);
        cells.forEach(c => allCells.add(c));
      } catch (e) {
        // Skip invalid sub-polygons
      }
    }
  }

  return Array.from(allCells);
}

// --- Main ---

console.log('=== Moku District → H3 ZoneCell Transform ===\n');
console.log(`H3 Resolution: ${H3_RESOLUTION} (~5.16 km² per cell)\n`);

// 1. Parse CSV
console.log(`Reading ${INPUT_FILE}...`);
const csvData = readFileSync(INPUT_FILE, 'utf-8');
const rows = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});
console.log(`  Found ${rows.length} moku district rows\n`);

// 2. Process each moku district
const outputRows = [];
let totalCells = 0;

for (const row of rows) {
  const { moku_id, name, island, geojson: geojsonStr } = row;

  if (!geojsonStr) {
    console.warn(`  Skipping ${moku_id}: no geojson data`);
    continue;
  }

  let geometry;
  try {
    geometry = JSON.parse(geojsonStr);
  } catch (e) {
    console.warn(`  Skipping ${moku_id}: invalid geojson — ${e.message}`);
    continue;
  }

  const h3Cells = getH3CellsForGeometry(geometry);
  totalCells += h3Cells.length;

  for (const h3Index of h3Cells) {
    outputRows.push(`${h3Index},${H3_RESOLUTION},${moku_id},${name},${island}`);
  }

  console.log(`  ${moku_id} (${name}, ${island}): ${h3Cells.length} cells`);
}

// 3. Write output CSV
console.log(`\nTotal H3 cells: ${totalCells}`);
console.log(`Writing ${OUTPUT_FILE}...`);

const header = 'h3_index,resolution,moku_id,moku_name,island';
const csvOutput = [header, ...outputRows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csvOutput, 'utf-8');

console.log(`\n=== Done. Wrote ${outputRows.length} rows to ZoneCell.csv ===`);
