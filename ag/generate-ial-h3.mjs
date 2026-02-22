/**
 * Generate IAL_Zones_H3.csv — H3 polyfill for Important Agricultural Lands
 *
 * Reads the IAL GeoJSON, converts each docket polygon to H3 resolution-7 cells,
 * and writes a CSV for Stage B Cypher loading.
 *
 * Output columns: zone_id, h3_cell, resolution, version, data_source, provenance
 *
 * Run: node ag/generate-ial-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { polygonToCells } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const H3_RESOLUTION = 7;
const INPUT_FILE = path.join(__dirname, 'Important_Agricultural_Lands_(IAL).geojson');
const OUTPUT_FILE = path.join(__dirname, 'IAL_Zones_H3.csv');

const VERSION = '2026.01';
const DATA_SOURCE = 'IAL polyfill 2026';

/**
 * Convert GeoJSON [lng, lat] rings to H3 [lat, lng] format
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

console.log('=== IAL GeoJSON → H3 Polyfill ===\n');
console.log(`H3 Resolution: ${H3_RESOLUTION}\n`);

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
console.log(`Features: ${geojson.features.length}\n`);

const outputRows = [];
let totalCells = 0;

for (const feature of geojson.features) {
  const docket = feature.properties.docket_no;
  const zoneId = 'IAL_' + docket.replace(/ /g, '_');
  const provenance = `Polyfill res${H3_RESOLUTION} from IAL ${docket} polygon`;

  const h3Cells = getH3CellsForGeometry(feature.geometry);
  totalCells += h3Cells.length;

  for (const h3 of h3Cells) {
    outputRows.push(`${zoneId},${h3},${H3_RESOLUTION},${VERSION},${DATA_SOURCE},${provenance}`);
  }

  console.log(`  ${zoneId} (${feature.properties.acres.toFixed(0)} acres): ${h3Cells.length} cells`);
}

const header = 'zone_id,h3_cell,resolution,version,data_source,provenance';
const csvOutput = [header, ...outputRows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csvOutput, 'utf-8');

console.log(`\nTotal H3 cells: ${totalCells}`);
console.log(`Wrote ${outputRows.length} rows to IAL_Zones_H3.csv`);
