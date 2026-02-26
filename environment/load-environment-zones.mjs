/**
 * Load Environmental Monitoring Sites into Neo4j AuraDB
 *
 * Reads ENV_IntraZones_H3.csv and creates:
 *   1. ZoneType node (environment) — idempotent MERGE
 *   2. Zone nodes (one per monitoring site) with USES_TYPE edges
 *   3. IntraZone nodes (res-14 anchors) with ANCHORS edges
 *   4. WITHIN_CELL edges to parent res-8 ZoneCell (backbone bridge)
 *
 * This establishes the SDG spatial bridge:
 *   SDGGoal ← MEASURES_SDG ← ResearchContribution → CONTAINS → ResearchRecord
 *     → OBSERVED_AT → Zone(environment) ← ANCHORS ← IntraZone
 *       → WITHIN_CELL → ZoneCell → WITHIN → Moku
 *
 * Run: node environment/load-environment-zones.mjs
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWrite, runQuery, closeDriver } from '../db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, 'ENV_IntraZones_H3.csv');

async function load() {
  const startTime = Date.now();
  console.log('=== Loading Environment Monitoring Sites into AuraDB ===\n');

  // 1. Parse CSV
  console.log('1. Reading ENV_IntraZones_H3.csv...');
  const csvData = readFileSync(CSV_FILE, 'utf-8');
  const rows = parse(csvData, { columns: true, skip_empty_lines: true });
  console.log(`   ${rows.length} monitoring sites\n`);

  // 2. Ensure ZoneType node exists (idempotent)
  console.log('2. Ensuring ZoneType(environment) exists...');
  await runWrite(`
    MERGE (zt:ZoneType {id: "environment"})
    ON CREATE SET zt.label = "Environmental Monitoring Site",
                  zt.created_at = datetime()
    ON MATCH SET  zt.updated_at = datetime()
    RETURN zt.id AS id
  `);
  console.log('   [DONE]\n');

  // 3. Create Zone nodes + USES_TYPE edges (Stage A)
  console.log('3. Creating Zone nodes (monitoring sites)...');
  let zoneCount = 0;

  for (const row of rows) {
    const result = await runWrite(`
      MERGE (z:Zone {id: $zoneId})
      SET z.name         = $name,
          z.type         = "environment",
          z.matrix       = $matrix,
          z.moku_id      = $moku,
          z.island       = $island,
          z.latitude     = toFloat($lat),
          z.longitude    = toFloat($lng),
          z.version      = $version,
          z.data_source  = $dataSource,
          z.provenance   = $provenance,
          z.created_at   = coalesce(z.created_at, datetime()),
          z.updated_at   = datetime()
      WITH z
      MATCH (zt:ZoneType {id: "environment"})
      MERGE (z)-[:USES_TYPE]->(zt)
      RETURN z.id AS id
    `, {
      zoneId: row.zone_id.trim(),
      name: row.name.trim(),
      matrix: row.matrix.trim(),
      moku: row.moku.trim(),
      island: row.island.trim(),
      lat: row.lat,
      lng: row.lng,
      version: row.version.trim(),
      dataSource: row.data_source,
      provenance: row.provenance,
    });

    const id = result[0]?.get('id');
    console.log(`   ${id}: ${row.name.trim()}`);
    zoneCount++;
  }
  console.log(`   Created ${zoneCount} Zone nodes [DONE]\n`);

  // 4. Create IntraZone anchors + WITHIN_CELL edges (Stage B)
  console.log('4. Creating IntraZone anchors (res-14) + backbone bridge...');
  let intraCount = 0;
  let linkedCount = 0;

  for (const row of rows) {
    // Create IntraZone + ANCHORS
    await runWrite(`
      MATCH (z:Zone {id: $zoneId})
      MERGE (iz:IntraZone {h3_cell: $h3Cell})
      ON CREATE SET iz.resolution = 14,
                    iz.created_at = datetime()
      SET iz.updated_at = datetime()
      MERGE (iz)-[:ANCHORS]->(z)
    `, {
      zoneId: row.zone_id.trim(),
      h3Cell: row.h3_cell,
    });
    intraCount++;

    // Link to parent res-8 ZoneCell (backbone bridge)
    const linkResult = await runWrite(`
      MATCH (iz:IntraZone {h3_cell: $h3Cell})
      MATCH (zc:ZoneCell {h3_cell: $parentH3})
      MERGE (iz)-[:WITHIN_CELL]->(zc)
      RETURN zc.h3_cell AS linked
    `, {
      h3Cell: row.h3_cell,
      parentH3: row.parent_h3_8,
    });

    if (linkResult.length > 0) {
      linkedCount++;
      console.log(`   ${row.zone_id.trim()}: res-14 ${row.h3_cell} → res-8 ${row.parent_h3_8} ✓`);
    } else {
      console.warn(`   ${row.zone_id.trim()}: res-14 ${row.h3_cell} → res-8 ${row.parent_h3_8} (backbone cell not found)`);
    }
  }
  console.log(`   Created ${intraCount} IntraZone nodes, ${linkedCount} WITHIN_CELL edges [DONE]\n`);

  // 5. Verify traversal
  console.log('5. Verifying backbone traversal...');
  const traversal = await runQuery(`
    MATCH (z:Zone {type: 'environment'})<-[:ANCHORS]-(iz:IntraZone)-[:WITHIN_CELL]->(zc:ZoneCell)-[:WITHIN]->(m:Moku)
    RETURN z.id AS zone_id,
           z.name AS name,
           z.matrix AS matrix,
           iz.h3_cell AS h3_res14,
           zc.h3_cell AS h3_res8,
           m.id AS moku_id,
           m.name AS moku_name
    ORDER BY z.name
  `);

  if (traversal.length > 0) {
    console.log('   Full traversal: Zone(environment) ← ANCHORS ← IntraZone → WITHIN_CELL → ZoneCell → WITHIN → Moku\n');
    for (const rec of traversal) {
      console.log(`   ${rec.get('name')} (${rec.get('matrix')}) → ${rec.get('moku_name')} (${rec.get('moku_id')})`);
    }
  } else {
    console.warn('   No traversal paths found — check backbone ZoneCell coverage');
  }

  // 6. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`   ZoneType nodes:    1 (environment)`);
  console.log(`   Zone nodes:        ${zoneCount}`);
  console.log(`   IntraZone nodes:   ${intraCount}`);
  console.log(`   WITHIN_CELL edges: ${linkedCount}`);
  console.log(`   Traversal paths:   ${traversal.length}`);

  await closeDriver();
}

load().catch(err => {
  console.error('Fatal:', err);
  closeDriver().then(() => process.exit(1));
});
