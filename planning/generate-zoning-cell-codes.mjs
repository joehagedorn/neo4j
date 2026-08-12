/**
 * Generate HNL_CellZoning_H3.csv — per-cell county zoning codes (AG12 P2)
 *
 * Polyfills each Honolulu LUO zoning polygon at H3 resolution 8 and aggregates
 * per backbone cell:
 *   - codes:        distinct zone_class values covering the cell ('|'-joined)
 *   - primary_code: zone_class of the largest-area feature covering the cell
 *
 * All codes pass through verbatim (v1 scoring scope is AG-1, AG-2, I-1, I-2,
 * I-3, IMX-1, B-1, B-2 — enforced downstream in Stage D, not here).
 *
 * Features smaller than a res-8 cell get a centroid-cell fallback so no
 * zoning district disappears from the aggregation.
 *
 * Output columns: h3_cell, codes, primary_code, version, data_source, provenance
 *
 * Run: node planning/generate-zoning-cell-codes.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { polygonToCells, latLngToCell } from 'h3-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const H3_RESOLUTION = 8;
const INPUT_FILE = path.join(__dirname, 'Zoning_(City_and_County_of_Honolulu).geojson');
const OUTPUT_FILE = path.join(__dirname, 'HNL_CellZoning_H3.csv');

const VERSION = '2026.02';
const DATA_SOURCE = 'City and County of Honolulu Zoning 2024 (res-8 polyfill)';
const PROVENANCE = 'Honolulu DPP LUO zoning districts, downloaded 2026-02-22; per-cell aggregation AG12 P2';

/** Convert GeoJSON [lng, lat] rings to H3 [lat, lng] format */
function convertToH3Format(polygon) {
  return polygon.map(ring => ring.map(([lng, lat]) => [lat, lng]));
}

/** Average of exterior-ring coordinates — cheap centroid for the fallback */
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

/** Res-8 cells covering a geometry, centroid fallback when polyfill is empty */
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
      // Skip invalid sub-polygons; centroid fallback below still applies
    }
  }

  if (cells.size === 0) {
    const centroid = computeCentroid(geometry);
    if (centroid) cells.add(latLngToCell(centroid[0], centroid[1], H3_RESOLUTION));
  }

  return Array.from(cells);
}

console.log('Reading zoning GeoJSON…');
const geojson = JSON.parse(readFileSync(INPUT_FILE, 'utf8'));
console.log(`  ${geojson.features.length} features`);

/** h3_cell -> Map<code, totalArea> */
const cellCodes = new Map();
let skippedBlank = 0;
let centroidFallbacks = 0;

for (const feature of geojson.features) {
  const code = (feature.properties.zone_class || '').trim();
  if (!code || !feature.geometry) { skippedBlank++; continue; }
  const area = Number(feature.properties.st_areashape) || 0;

  const cells = getCellsForGeometry(feature.geometry);
  if (cells.length === 1 && Number(feature.properties.st_areashape) > 0) {
    // (may still be a genuine one-cell polyfill; counter is indicative only)
    centroidFallbacks++;
  }

  for (const cell of cells) {
    if (!cellCodes.has(cell)) cellCodes.set(cell, new Map());
    const byCode = cellCodes.get(cell);
    byCode.set(code, (byCode.get(code) || 0) + area);
  }
}

const rows = [['h3_cell', 'codes', 'primary_code', 'version', 'data_source', 'provenance']];
for (const [cell, byCode] of [...cellCodes.entries()].sort()) {
  const codes = [...byCode.keys()].sort().join('|');
  const primary = [...byCode.entries()].sort((a, b) => b[1] - a[1])[0][0];
  rows.push([cell, codes, primary, VERSION, DATA_SOURCE, PROVENANCE]);
}

const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
writeFileSync(OUTPUT_FILE, csv);

console.log(`  ${skippedBlank} features skipped (blank zone_class)`);
console.log(`  ~${centroidFallbacks} single-cell features (incl. centroid fallbacks)`);
console.log(`Wrote ${rows.length - 1} cell rows → ${path.basename(OUTPUT_FILE)}`);

// Quick v1-scope summary
const V1 = ['AG-1', 'AG-2', 'I-1', 'I-2', 'I-3', 'IMX-1', 'B-1', 'B-2'];
const counts = Object.fromEntries(V1.map(c => [c, 0]));
for (const [, byCode] of cellCodes) {
  for (const c of byCode.keys()) if (counts[c] !== undefined) counts[c]++;
}
console.log('v1-scope cell counts:', counts);
