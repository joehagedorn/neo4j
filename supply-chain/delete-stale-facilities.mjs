/**
 * Delete stale Facility nodes seeded from static farm-web-seed.ts data.
 * These 9 nodes need to be replaced by live Data Connect producers.
 *
 * Run from transforms/ directory: node supply-chain/delete-stale-facilities.mjs
 */

import { runWrite, runQuery, closeDriver } from '../db.mjs';

async function main() {
  console.log('=== Delete Stale Facility Nodes ===\n');

  // 1. Show current Facility nodes
  console.log('Current Facility nodes:');
  const current = await runQuery(`
    MATCH (f:Facility)
    RETURN f.facility_id AS id, f.name AS name, f.source_system AS source
    ORDER BY f.facility_id
  `);
  for (const rec of current) {
    console.log(`  ${rec.get('id')} — ${rec.get('name')} [${rec.get('source')}]`);
  }
  console.log(`  Total: ${current.length}\n`);

  // 2. Delete all Facility nodes and their relationships
  console.log('Deleting all Facility nodes and relationships...');
  const deleted = await runWrite(`
    MATCH (f:Facility)
    DETACH DELETE f
    RETURN count(f) AS deleted
  `);
  const deletedCount = deleted[0]?.get('deleted') ?? 0;
  console.log(`  ✓ Deleted ${deletedCount} Facility node(s)\n`);

  // 3. Verify
  const remaining = await runQuery(`
    MATCH (f:Facility)
    RETURN count(f) AS count
  `);
  console.log(`Remaining Facility nodes: ${remaining[0]?.get('count') ?? 0}`);

  console.log('\n=== Done ===');
  await closeDriver();
}

main().catch(err => {
  console.error('Failed:', err);
  closeDriver().then(() => process.exit(1));
});
