/**
 * Load ZoneCell.csv into Neo4j AuraDB
 *
 * Creates ZoneCell nodes from the H3-indexed moku district data and
 * links them to Moku nodes via WITHIN relationships.
 *
 * Run: node load-zone-cells.mjs
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWrite, runQuery, closeDriver } from '../db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZONE_CELL_CSV = path.join(__dirname, 'ZoneCell.csv');
const BATCH_SIZE = 500;

async function load() {
  const startTime = Date.now();

  console.log('=== Loading ZoneCell.csv into Neo4j ===\n');

  // 1. Parse CSV
  console.log('1. Reading ZoneCell.csv...');
  const csvData = readFileSync(ZONE_CELL_CSV, 'utf-8');
  const rows = parse(csvData, { columns: true, skip_empty_lines: true });
  console.log(`   ${rows.length} rows\n`);

  // 2. Create indexes
  console.log('2. Creating indexes...');
  await runWrite('CREATE INDEX zonecell_h3 IF NOT EXISTS FOR (zc:ZoneCell) ON (zc.h3_cell)');
  await runWrite('CREATE INDEX zonecell_moku IF NOT EXISTS FOR (zc:ZoneCell) ON (zc.moku_id)');
  console.log('   [DONE]\n');

  // 3. Batch-create ZoneCell nodes
  console.log('3. Creating ZoneCell nodes...');
  let created = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
      h3_cell: row.h3_index,
      resolution: parseInt(row.resolution, 10),
      moku_id: row.moku_id,
      moku_name: row.moku_name,
      island: row.island,
    }));

    await runWrite(`
      UNWIND $cells AS cell
      MERGE (zc:ZoneCell {h3_cell: cell.h3_cell})
      SET zc.resolution  = cell.resolution,
          zc.moku_id     = cell.moku_id,
          zc.moku_name   = cell.moku_name,
          zc.island       = cell.island,
          zc.updated_at   = datetime()
    `, { cells: batch });

    created += batch.length;
    process.stdout.write(`\r   ${created} / ${rows.length}`);
  }

  console.log(`\r   Created ${created} ZoneCell nodes`);
  console.log('   [DONE]\n');

  // 4. Create WITHIN relationships to Moku nodes (if they exist)
  console.log('4. Linking ZoneCell → Moku (WITHIN)...');
  const mokuCheck = await runQuery('MATCH (m:Moku) RETURN count(m) AS count');
  const mokuCount = mokuCheck[0].get('count');

  if (mokuCount > 0) {
    await runWrite(`
      MATCH (zc:ZoneCell)
      WHERE zc.moku_id IS NOT NULL
      MATCH (m:Moku {moku_id: zc.moku_id})
      MERGE (zc)-[:WITHIN]->(m)
    `);
    console.log(`   Linked to ${mokuCount} existing Moku nodes`);
  } else {
    console.log('   No Moku nodes found — skipping WITHIN relationships');
    console.log('   (Run a Moku node loader first, then re-run this or create relationships later)');
  }
  console.log('   [DONE]\n');

  // 5. Verification
  console.log('5. Verification...');
  const cellCount = await runQuery('MATCH (zc:ZoneCell) RETURN count(zc) AS count');
  console.log(`   ZoneCell nodes:  ${cellCount[0].get('count')}`);

  const byIsland = await runQuery(`
    MATCH (zc:ZoneCell)
    RETURN zc.island AS island, count(zc) AS count
    ORDER BY count DESC
  `);
  console.log('   By island:');
  for (const rec of byIsland) {
    console.log(`     ${rec.get('island')}: ${rec.get('count')}`);
  }

  const withinCount = await runQuery('MATCH (:ZoneCell)-[r:WITHIN]->(:Moku) RETURN count(r) AS count');
  console.log(`   WITHIN relationships: ${withinCount[0].get('count')}`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done (${duration}s) ===`);

  await closeDriver();
}

load().catch(err => {
  console.error('Error:', err.message);
  closeDriver();
  process.exit(1);
});
