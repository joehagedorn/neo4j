/**
 * Generate SLUD_CellCodes_H3.csv — per-cell HRS §205-2 state district codes
 *
 * Polyfills each of the 906 State Land Use District polygons at H3 res-8 and
 * aggregates per cell:
 *   - codes:        distinct ludcode values covering the cell ('|'-joined)
 *   - primary_code: ludcode of the largest-acreage feature covering the cell
 *
 * Statewide (all islands). Features smaller than a res-8 cell get a
 * centroid-cell fallback. Cells outside the moku backbone are dropped at the
 * Cypher stage (MATCH-only), not here.
 *
 * Output columns: h3_cell, codes, primary_code, version, data_source, provenance
 *
 * Run: node state-land-use/generate-slud-cell-codes.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { polygonToCells, latLngToCell } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const H3_RESOLUTION = 8;
const INPUT_FILE = path.join(__dirname, 'State_Land_Use_Districts.geojson');
const OUTPUT_FILE = path.join(__dirname, 'SLUD_CellCodes_H3.csv');

const VERSION = '2026.01';
const DATA_SOURCE = 'State Land Use Districts (LUC, res-8 polyfill)';
const PROVENANCE = 'Hawaii Statewide GIS ParcelsZoning/20, downloaded 2026-08-11; per-cell aggregation AG12 P4';

function convertToH3Format(polygon) {
  return polygon.map(ring => ring.map(([lng, lat]) => [lat, lng]));
}

function computeCentroid(geometry) {
  const points = [];
  const rings = geometry.type === 'Polygon'
    ? [geometry.coordinates[0]]
    : geometry.coordinates.map(p => p[0]);
  for (const ring of rings) {
    for (const [lng, lat] of ring) points.push([lat, lng]);
  }
  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [lat, lng];
}

function getCellsForGeometry(geometry) {
  const cells = new Set();
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
  for (const polygonCoords of polygons) {
    try {
      polygonToCells(convertToH3Format(polygonCoords), H3_RESOLUTION)
        .forEach(c => cells.add(c));
    } catch {
      // skip invalid sub-polygons; centroid fallback below
    }
  }
  if (cells.size === 0) {
    const centroid = computeCentroid(geometry);
    if (centroid) cells.add(latLngToCell(centroid[0], centroid[1], H3_RESOLUTION));
  }
  return Array.from(cells);
}

console.log('Reading State Land Use Districts GeoJSON…');
const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf8'));
console.log(`  ${geojson.features.length} features`);

/** h3_cell -> Map<code, totalAcres> */
const cellCodes = new Map();
let skipped = 0;

for (const feature of geojson.features) {
  const code = (feature.properties.ludcode || '').trim();
  if (!code || !feature.geometry) { skipped++; continue; }
  const acres = Number(feature.properties.acres) || 0;

  for (const cell of getCellsForGeometry(feature.geometry)) {
    if (!cellCodes.has(cell)) cellCodes.set(cell, new Map());
    const byCode = cellCodes.get(cell);
    byCode.set(code, (byCode.get(code) || 0) + acres);
  }
}

const rows = [['h3_cell', 'codes', 'primary_code', 'version', 'data_source', 'provenance']];
for (const [cell, byCode] of [...cellCodes.entries()].sort()) {
  const codes = [...byCode.keys()].sort().join('|');
  const primary = [...byCode.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  rows.push([cell, codes, primary, VERSION, DATA_SOURCE, PROVENANCE]);
}

const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv);

console.log(`  ${skipped} features skipped (blank code / null geometry)`);
console.log(`Wrote ${rows.length - 1} cell rows → ${path.basename(OUTPUT_FILE)}`);

const counts = { A: 0, C: 0, R: 0, U: 0 };
for (const [, byCode] of cellCodes) {
  for (const c of byCode.keys()) if (counts[c] !== undefined) counts[c]++;
}
console.log('cell counts by code:', counts);
