/**
 * Generate point-based H3 resolution-14 mapping for HART Rail Transit Stations
 *
 * Each of the 21 stations is mapped to a single res-14 H3 cell (~6.3 m²) via
 * its Point coordinate, creating a high-fidelity IntraZone spatial anchor.
 *
 * Outputs:
 *   - STA_Stations.csv       — station metadata for Stage A
 *   - STA_IntraZones_H3.csv  — res-14 H3 cell mapping for Stage B (IntraZone)
 *
 * Run: node stations/generate-stations-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell, cellToParent } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'HART_Transit_Stations_PUBLIC_6647349661304363343 (1).geojson');
const STATIONS_FILE = path.join(__dirname, 'STA_Stations.csv');
const H3_FILE = path.join(__dirname, 'STA_IntraZones_H3.csv');
const RESOLUTION = 14;
const VERSION = '2026.02';

/**
 * Escape a value for CSV output (quote if it contains commas or quotes).
 */
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val).trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// --- Main ---

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

console.log('=== HART Rail Transit Stations — IntraZone H3 Mapping (res-14) ===\n');
console.log(`Features: ${geojson.features.length}\n`);

const stationRows = [];
const h3Rows = [];
let skipped = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const oid = props.OBJECTID;
  const stationNum = props.ID;
  const stationName = props.STATION;
  const feisName = props.station_name_FEIS;
  const globalId = props.GlobalID;
  const zoneId = `STA_${stationNum}`;

  if (!feature.geometry || feature.geometry.type !== 'Point') {
    console.warn(`  SKIP station ${stationNum}: null/non-point geometry`);
    skipped++;
    continue;
  }

  const [lng, lat] = feature.geometry.coordinates;
  const h3Cell = latLngToCell(lat, lng, RESOLUTION);
  const parentH3 = cellToParent(h3Cell, 8);
  const provenance = `Point res${RESOLUTION} from HART station ${stationNum} (${stationName})`;

  // Station CSV row
  stationRows.push([
    csvEscape(zoneId),
    stationNum,
    csvEscape(stationName),
    csvEscape(feisName),
    csvEscape(globalId),
  ].join(','));

  // H3 CSV row
  h3Rows.push(`${zoneId},${h3Cell},${RESOLUTION},${parentH3},${VERSION},HART stations intrazone 2026,${provenance}`);

  console.log(`  ${zoneId}: ${stationName} (${feisName}) -> ${h3Cell}`);
}

// Write Station CSV
const stationHeader = 'zone_id,station_number,station_name,feis_name,global_id';
const stationCsv = [stationHeader, ...stationRows].join('\n') + '\n';
writeFileSync(STATIONS_FILE, stationCsv, 'utf-8');

// Write H3 CSV
const h3Header = 'zone_id,h3_cell,resolution,parent_h3_8,version,data_source,provenance';
const h3Csv = [h3Header, ...h3Rows].join('\n') + '\n';
writeFileSync(H3_FILE, h3Csv, 'utf-8');

console.log(`\nWrote ${stationRows.length} rows to STA_Stations.csv`);
console.log(`Wrote ${h3Rows.length} rows to STA_IntraZones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} features`);

// Unique H3 cells
const uniqueCells = new Set(h3Rows.map(r => r.split(',')[1]));
console.log(`\nUnique res-14 cells used: ${uniqueCells.size}`);
const uniqueParents = new Set(h3Rows.map(r => r.split(',')[3]));
console.log(`Unique res-8 parent cells: ${uniqueParents.size}`);

console.log('\n=== Done ===');
