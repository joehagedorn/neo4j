/**
 * Seed NWI Wetland zones into AuraDB
 *
 * Stage A: Creates ZoneType "wetland" + 4,974 Zone nodes + USES_TYPE
 * Stage B: Links Zones to res-8 backbone ZoneCells via IN_ZONE
 *
 * Reads local CSVs (no GitHub dependency).
 *
 * Run: node wetland/seed-wetlands.mjs
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWrite, runQuery, closeDriver } from '../db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WETLANDS_CSV = path.join(__dirname, 'Wetlands.csv');
const H3_CSV = path.join(__dirname, 'WET_Zones_H3.csv');
const BATCH_SIZE = 500;

async function seed() {
  const startTime = Date.now();

  console.log('=== Seeding NWI Wetlands into AuraDB ===\n');

  // 0. Parse CSVs
  console.log('0. Reading CSVs...');
  const wetlandRows = parse(readFileSync(WETLANDS_CSV, 'utf-8'), { columns: true, skip_empty_lines: true });
  const h3Rows = parse(readFileSync(H3_CSV, 'utf-8'), { columns: true, skip_empty_lines: true });
  console.log(`   Wetlands.csv: ${wetlandRows.length} rows`);
  console.log(`   WET_Zones_H3.csv: ${h3Rows.length} rows\n`);

  // 1. Create ZoneType
  console.log('1. Creating ZoneType "wetland"...');
  await runWrite(`
    MERGE (zt:ZoneType {id: "wetland"})
    SET zt.label = "Wetland / Hydrography",
        zt.data_source = "NWI (National Wetlands Inventory)",
        zt.updated_at = datetime()
  `);
  console.log('   [DONE]\n');

  // 2. Create Zone index
  console.log('2. Ensuring Zone index...');
  await runWrite('CREATE INDEX zone_id IF NOT EXISTS FOR (z:Zone) ON (z.id)');
  console.log('   [DONE]\n');

  // 3. Stage A — Create Zone nodes in batches
  console.log('3. Stage A — Creating Zone nodes...');
  let created = 0;
  for (let i = 0; i < wetlandRows.length; i += BATCH_SIZE) {
    const batch = wetlandRows.slice(i, i + BATCH_SIZE).map(row => ({
      zone_id: `WET_${row.objectid}`,
      name: `${row.wetland_type} (${row.attribute})`,
      nwi_attribute: row.attribute,
      wetland_type: row.wetland_type,
      fid_hi_wetlands: parseInt(row.fid_hi_wetlands, 10),
      acres: parseFloat(row.acres),
      status: row.status,
    }));

    await runWrite(`
      UNWIND $batch AS b
      MERGE (z:Zone {id: b.zone_id})
      SET z.name            = b.name,
          z.type            = "wetland",
          z.nwi_attribute   = b.nwi_attribute,
          z.wetland_type    = b.wetland_type,
          z.fid_hi_wetlands = b.fid_hi_wetlands,
          z.acres           = b.acres,
          z.island          = "oahu",
          z.status          = b.status,
          z.data_source     = "NWI (National Wetlands Inventory)",
          z.provenance      = "USFWS NWI Hydrography dataset, Oahu extract",
          z.created_at      = coalesce(z.created_at, datetime()),
          z.updated_at      = datetime()
      WITH z
      MATCH (zt:ZoneType {id: "wetland"})
      MERGE (z)-[:USES_TYPE]->(zt)
    `, { batch });

    created += batch.length;
    process.stdout.write(`   ${created} / ${wetlandRows.length}\r`);
  }
  console.log(`   ${created} Zone nodes created/merged\n`);

  // 4. Stage B — Link Zones to backbone ZoneCells via IN_ZONE
  console.log('4. Stage B — Linking to res-8 backbone...');
  let linked = 0;
  let missed = 0;
  for (let i = 0; i < h3Rows.length; i += BATCH_SIZE) {
    const batch = h3Rows.slice(i, i + BATCH_SIZE).map(row => ({
      zone_id: row.zone_id,
      h3_cell: row.h3_cell,
      version: row.version,
      data_source: row.data_source,
      provenance: row.provenance,
    }));

    const records = await runWrite(`
      UNWIND $batch AS b
      MATCH (z:Zone {id: b.zone_id})
      SET z.version     = b.version,
          z.data_source = b.data_source,
          z.provenance  = b.provenance,
          z.updated_at  = datetime()
      WITH z, b.h3_cell AS h3
      OPTIONAL MATCH (zc:ZoneCell {h3_cell: h3})
      WITH z, zc
      WHERE zc IS NOT NULL
      MERGE (zc)-[:IN_ZONE]->(z)
      RETURN count(zc) AS linked_count
    `, { batch });

    const batchLinked = records[0]?.get('linked_count') || 0;
    linked += batchLinked;
    process.stdout.write(`   ${Math.min(i + BATCH_SIZE, h3Rows.length)} / ${h3Rows.length}\r`);
  }
  console.log(`   ${linked} IN_ZONE relationships created/merged\n`);

  // 5. Verify
  console.log('5. Verification...');
  const zoneCount = await runQuery('MATCH (z:Zone {type: "wetland"}) RETURN count(z) AS c');
  const relCount = await runQuery('MATCH (:ZoneCell)-[:IN_ZONE]->(z:Zone {type: "wetland"}) RETURN count(*) AS c');
  const typeCount = await runQuery('MATCH (zt:ZoneType {id: "wetland"}) RETURN count(zt) AS c');
  const uniqueCells = await runQuery('MATCH (zc:ZoneCell)-[:IN_ZONE]->(z:Zone {type: "wetland"}) RETURN count(DISTINCT zc) AS c');

  console.log(`   ZoneType "wetland": ${typeCount[0].get('c')}`);
  console.log(`   Wetland Zones: ${zoneCount[0].get('c')}`);
  console.log(`   IN_ZONE relationships: ${relCount[0].get('c')}`);
  console.log(`   Unique backbone cells: ${uniqueCells[0].get('c')}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);

  await closeDriver();
}

seed().catch(err => {
  console.error('FATAL:', err);
  closeDriver();
  process.exit(1);
});
