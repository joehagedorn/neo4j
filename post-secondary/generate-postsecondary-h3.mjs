/**
 * Generate point-based H3 resolution-14 mapping for Hawaii Post-Secondary Institutions
 *
 * The source data has multiple rows per institution (one per accreditation record)
 * and multiple campuses per institution. This script deduplicates to one Zone per
 * campus, keyed on (inst_id, camp_id).
 *
 * Each campus is mapped to a res-14 H3 cell (~6.3 m²) for high-fidelity
 * IntraZone spatial anchoring.
 *
 * Outputs:
 *   - UNI_Campuses.csv       — deduplicated campus metadata for Stage A
 *   - UNI_IntraZones_H3.csv  — res-14 H3 cell mapping for Stage B (IntraZone)
 *
 * Run: node post-secondary/generate-postsecondary-h3.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { latLngToCell, cellToParent } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'PostSecondary_Institutions.geojson');
const CAMPUS_FILE = path.join(__dirname, 'UNI_Campuses.csv');
const H3_FILE = path.join(__dirname, 'UNI_IntraZones_H3.csv');
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

console.log('=== Hawaii Post-Secondary Institutions — IntraZone H3 Mapping (res-14) ===\n');
console.log(`Raw features: ${geojson.features.length}\n`);

// Deduplicate: keep first occurrence per (inst_id, camp_id)
const seen = new Map();
let dupes = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const instId = props.inst_id;
  const campId = props.camp_id;
  const key = `${instId}_${campId}`;

  if (seen.has(key)) {
    dupes++;
    continue;
  }

  seen.set(key, { feature, props });
}

console.log(`Unique campuses: ${seen.size} (${dupes} duplicate accreditation rows skipped)\n`);

const campusRows = [];
const h3Rows = [];
let skipped = 0;

for (const [key, { feature, props }] of seen) {
  const instId = props.inst_id;
  const campId = props.camp_id;
  const instName = props.inst_name;

  // Zone ID: UNI_<inst_id> for main campus, UNI_<inst_id>_<camp_id> for branch
  const zoneId = campId === 0 ? `UNI_${instId}` : `UNI_${instId}_${campId}`;

  // Name: use campus name for branches, institution name for main
  const campName = (props.camp_name || '').trim();
  const name = campId !== 0 && campName ? campName : instName;

  // Address: use campus address for branches, institution address for main
  const address = campId !== 0 && (props.camp_addr || '').trim()
    ? (props.camp_addr || '').trim()
    : (props.inst_addr || '').trim();
  const city = campId !== 0 && (props.camp_city || '').trim()
    ? (props.camp_city || '').trim()
    : (props.inst_city || '').trim();
  const state = campId !== 0 && (props.camp_st || '').trim()
    ? (props.camp_st || '').trim()
    : (props.inst_st || '').trim();
  const zip = campId !== 0 && (props.camp_zip || '').trim()
    ? (props.camp_zip || '').trim()
    : (props.inst_zip || '').trim();

  if (!feature.geometry || feature.geometry.type !== 'Point') {
    console.warn(`  SKIP ${zoneId}: null/non-point geometry`);
    skipped++;
    continue;
  }

  const [lng, lat] = feature.geometry.coordinates;
  const h3Cell = latLngToCell(lat, lng, RESOLUTION);
  const parentH3 = cellToParent(h3Cell, 8);
  const provenance = `Point res${RESOLUTION} from post-secondary campus ${zoneId} (${name})`;

  // Campus CSV row
  campusRows.push([
    csvEscape(zoneId),
    instId,
    csvEscape(instName),
    props.inst_opeid || '',
    props.inst_ipeds || '',
    csvEscape(props.inst_url || ''),
    csvEscape(props.inst_ph || ''),
    campId,
    csvEscape(campName),
    csvEscape(address),
    csvEscape(city),
    csvEscape(state),
    csvEscape(zip),
  ].join(','));

  // H3 CSV row
  h3Rows.push(`${zoneId},${h3Cell},${RESOLUTION},${parentH3},${VERSION},PostSecondary intrazone 2026,${provenance}`);

  console.log(`  ${zoneId}: ${name} -> ${h3Cell}`);
}

// Write Campus CSV
const campusHeader = 'zone_id,inst_id,inst_name,inst_opeid,inst_ipeds,inst_url,inst_ph,camp_id,camp_name,address,city,state,zip';
const campusCsv = [campusHeader, ...campusRows].join('\n') + '\n';
writeFileSync(CAMPUS_FILE, campusCsv, 'utf-8');

// Write H3 CSV
const h3Header = 'zone_id,h3_cell,resolution,parent_h3_8,version,data_source,provenance';
const h3Csv = [h3Header, ...h3Rows].join('\n') + '\n';
writeFileSync(H3_FILE, h3Csv, 'utf-8');

console.log(`\nWrote ${campusRows.length} rows to UNI_Campuses.csv`);
console.log(`Wrote ${h3Rows.length} rows to UNI_IntraZones_H3.csv`);
if (skipped > 0) console.log(`Skipped ${skipped} features (null/invalid geometry)`);

// Summary: main vs branch campuses
let mainCount = 0;
let branchCount = 0;
for (const [key] of seen) {
  const campId = parseInt(key.split('_')[1], 10);
  if (campId === 0) mainCount++;
  else branchCount++;
}
console.log(`\nMain campuses: ${mainCount}, Branch campuses: ${branchCount}`);

// Unique H3 cells
const uniqueCells = new Set(h3Rows.map(r => r.split(',')[1]));
console.log(`Unique res-14 cells used: ${uniqueCells.size}`);

console.log('\n=== Done ===');
