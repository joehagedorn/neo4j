/**
 * Generate point-based H3 resolution-14 mapping for Environmental Monitoring Sites
 *
 * Each unique monitoring site (by site_id) is mapped to a single res-14
 * H3 cell (~6.3 m²) via its lat/lng coordinate, creating a high-fidelity
 * IntraZone spatial anchor. Multiple observations at the same site share one
 * IntraZone node — temporal data flows through ResearchRecord, not the Zone.
 *
 * Input:  commons-samples/water-quality-dataset.csv
 * Output: ENV_IntraZones_H3.csv
 *
 * Run: node environment/generate-environment-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { latLngToCell, cellToParent } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'commons-samples', 'water-quality-dataset.csv');
const OUTPUT_FILE = path.join(__dirname, 'ENV_IntraZones_H3.csv');
const RESOLUTION = 14;
const VERSION = '2026.02';
const DATA_SOURCE = 'Environment monitoring sites 2026';

// --- Main ---

const csvText = readFileSync(INPUT_FILE, 'utf-8');
const records = parse(csvText, { columns: true, skip_empty_lines: true });

console.log('=== Environmental Monitoring Sites — IntraZone H3 Mapping (res-14) ===\n');
console.log(`Input records: ${records.length}\n`);

const rows = [];
const seenSites = new Map();  // site_id → row (deduplicate)
let skipped = 0;

for (const record of records) {
  const locationCode = record.site_id?.trim();
  const locationName = record.location_name?.trim();
  const moku = record.moku?.trim().toLowerCase();
  const lat = parseFloat(record.latitude);
  const lng = parseFloat(record.longitude);
  const matrix = record.matrix?.trim() || 'water';

  if (!locationCode) {
    console.warn(`  SKIP record ${record.record_id}: missing site_id`);
    skipped++;
    continue;
  }

  // Deduplicate: one IntraZone per unique monitoring site
  if (seenSites.has(locationCode)) {
    console.log(`  DUP  ${locationCode}: already mapped (observation ${record.record_id})`);
    continue;
  }

  if (isNaN(lat) || isNaN(lng)) {
    console.warn(`  SKIP ${locationCode}: missing or invalid coordinates`);
    skipped++;
    continue;
  }

  // Validate Hawaii coordinate bounds
  if (lat < 18 || lat > 23 || lng < -161 || lng > -154) {
    console.warn(`  SKIP ${locationCode}: coordinates outside Hawaii bounds (${lat}, ${lng})`);
    skipped++;
    continue;
  }

  const h3Cell = latLngToCell(lat, lng, RESOLUTION);
  const parentH3 = cellToParent(h3Cell, 8);
  const zoneId = `ENV_${locationCode}`;
  const island = 'oahu';  // Derived from moku in production; hardcoded for sample
  const provenance = `Point res${RESOLUTION} from monitoring site ${locationCode} (${locationName})`;

  seenSites.set(locationCode, true);
  rows.push(`${zoneId},${h3Cell},${RESOLUTION},${parentH3},${island},${locationName},${matrix},${moku},${lat},${lng},${VERSION},${DATA_SOURCE},${provenance}`);
  console.log(`  ${zoneId}: ${locationName} (${moku}) -> ${h3Cell}`);
}

// Write CSV
const header = 'zone_id,h3_cell,resolution,parent_h3_8,island,name,matrix,moku,lat,lng,version,data_source,provenance';
const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`\nWrote ${rows.length} unique monitoring sites to ENV_IntraZones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} records (missing data or invalid coordinates)`);

// Summary
console.log(`\nUnique sites:  ${seenSites.size}`);
const uniqueCells = new Set(rows.map(r => r.split(',')[1]));
console.log(`Unique res-14 cells: ${uniqueCells.size}`);
const uniqueParents = new Set(rows.map(r => r.split(',')[3]));
console.log(`Unique res-8 parent cells: ${uniqueParents.size}`);

console.log('\n=== Done ===');
