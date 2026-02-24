/**
 * Extract NWI Wetland properties from GeoJSON to CSV for LOAD CSV
 *
 * Produces a flat CSV suitable for Neo4j LOAD CSV (Stage A).
 * Excludes the acres_1 field (Oahu boundary join artifact).
 *
 * Run: node wetland/extract-wetland-csv.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'Hydrography_-2481727552189753624.geojson');
const OUTPUT_FILE = path.join(__dirname, 'Wetlands.csv');

const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

console.log('=== NWI Wetlands — CSV Extraction ===\n');
console.log(`Features: ${geojson.features.length}\n`);

const header = 'objectid,fid_hi_wetlands,attribute,acres,wetland_type,status';
const rows = [];

for (const feature of geojson.features) {
  const p = feature.properties;
  // Escape wetland_type in case of commas (none expected but safe)
  const wetlandType = `"${(p.wetland_type || '').replace(/"/g, '""')}"`;
  rows.push([
    p.objectid,
    p.fid_hi_wetlands,
    p.attribute,
    p.acres,
    wetlandType,
    p.status,
  ].join(','));
}

const csv = [header, ...rows].join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv, 'utf-8');

console.log(`Wrote ${rows.length} rows to Wetlands.csv`);
console.log('\n=== Done ===');
