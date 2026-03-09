/**
 * Supply Chain Governance Migration Runner
 *
 * Executes the seeding and migration Cypher statements against AuraDB.
 * Run from transforms/ directory: node supply-chain/run-migration.mjs
 */

import { runWrite, closeDriver } from '../db.mjs';

async function main() {
  console.log('=== Supply Chain Governance Migration ===\n');

  // -----------------------------------------------------------------------
  // Stage 1: Seed lifecycle stages
  // -----------------------------------------------------------------------
  console.log('Stage 1: Seeding supply chain lifecycle stages...');

  await runWrite(`
    MERGE (ls:LifecycleStage {id: 'LOGISTICS'})
    ON CREATE SET ls.label = 'Logistics', ls.ordinal = 5,
                  ls.description = 'Supply chain logistics, procurement, distribution',
                  ls.track = 'supply_chain'
    RETURN ls.id AS id, ls.label AS label
  `).then(r => r.forEach(rec => console.log(`  ✓ ${rec.get('id')}: ${rec.get('label')}`)));

  await runWrite(`
    MERGE (ls:LifecycleStage {id: 'OPERATIONS'})
    ON CREATE SET ls.label = 'Operations', ls.ordinal = 6,
                  ls.description = 'Facility operations, production, chain-of-custody',
                  ls.track = 'supply_chain'
    RETURN ls.id AS id, ls.label AS label
  `).then(r => r.forEach(rec => console.log(`  ✓ ${rec.get('id')}: ${rec.get('label')}`)));

  await runWrite(`
    MERGE (ls:LifecycleStage {id: 'MAINTENANCE'})
    ON CREATE SET ls.label = 'Maintenance', ls.ordinal = 7,
                  ls.description = 'Asset maintenance, contract renewal, compliance',
                  ls.track = 'supply_chain'
    RETURN ls.id AS id, ls.label AS label
  `).then(r => r.forEach(rec => console.log(`  ✓ ${rec.get('id')}: ${rec.get('label')}`)));

  // -----------------------------------------------------------------------
  // Stage 2: Create STAGE_NEXT chain
  // -----------------------------------------------------------------------
  console.log('\nStage 2: Creating supply chain STAGE_NEXT chain...');

  for (const [from, to] of [['PLANNING', 'LOGISTICS'], ['LOGISTICS', 'OPERATIONS'], ['OPERATIONS', 'MAINTENANCE']]) {
    await runWrite(`
      MATCH (a:LifecycleStage {id: $from}), (b:LifecycleStage {id: $to})
      MERGE (a)-[r:STAGE_NEXT {track: 'supply_chain'}]->(b)
      RETURN a.id AS from, b.id AS to
    `, { from, to }).then(r => r.forEach(rec => console.log(`  ✓ ${rec.get('from')} → ${rec.get('to')}`)));
  }

  // -----------------------------------------------------------------------
  // Stage 3: Apply constraints
  // -----------------------------------------------------------------------
  console.log('\nStage 3: Applying constraints...');

  const constraints = [
    'CREATE CONSTRAINT contract_id_unique IF NOT EXISTS FOR (c:Contract) REQUIRE c.contract_id IS UNIQUE',
    'CREATE CONSTRAINT contractids_id_unique IF NOT EXISTS FOR (ci:ContractIDS) REQUIRE ci.ids_id IS UNIQUE',
    'CREATE CONSTRAINT facility_id_unique IF NOT EXISTS FOR (f:Facility) REQUIRE f.facility_id IS UNIQUE',
    'CREATE CONSTRAINT supplychainsystem_id_unique IF NOT EXISTS FOR (s:SupplyChainSystem) REQUIRE s.system_id IS UNIQUE',
  ];

  for (const c of constraints) {
    const name = c.match(/CONSTRAINT (\S+)/)?.[1] || c;
    try {
      await runWrite(c);
      console.log(`  ✓ ${name}`);
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`  ○ ${name} (already exists)`);
      } else {
        throw err;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Stage 4: Apply indexes
  // -----------------------------------------------------------------------
  console.log('\nStage 4: Applying indexes...');

  const indexes = [
    'CREATE INDEX contract_type IF NOT EXISTS FOR (c:Contract) ON (c.contract_type)',
    'CREATE INDEX contract_status IF NOT EXISTS FOR (c:Contract) ON (c.status)',
    'CREATE INDEX contract_moku IF NOT EXISTS FOR (c:Contract) ON (c.moku_id)',
    'CREATE INDEX facility_type IF NOT EXISTS FOR (f:Facility) ON (f.facility_type)',
    'CREATE INDEX facility_moku IF NOT EXISTS FOR (f:Facility) ON (f.moku_id)',
    'CREATE INDEX facility_gln IF NOT EXISTS FOR (f:Facility) ON (f.gs1_gln)',
    'CREATE INDEX facility_status IF NOT EXISTS FOR (f:Facility) ON (f.status)',
  ];

  for (const idx of indexes) {
    const name = idx.match(/INDEX (\S+)/)?.[1] || idx;
    try {
      await runWrite(idx);
      console.log(`  ✓ ${name}`);
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`  ○ ${name} (already exists)`);
      } else {
        throw err;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Stage 5: Migrate FacilityNode → Facility (dual-label)
  // -----------------------------------------------------------------------
  console.log('\nStage 5: Migrating FacilityNode → Facility (dual-label)...');

  const migrated = await runWrite(`
    MATCH (fn:FacilityNode)
    WHERE NOT fn:Facility
    SET fn:Facility,
        fn.facility_id = CASE
          WHEN fn.facility_id IS NOT NULL THEN fn.facility_id
          ELSE 'fac-' + coalesce(fn.district, 'unknown') + '-' +
               toLower(replace(replace(replace(fn.name, ' ', '-'), "'", ''), ',', ''))
        END,
        fn.facility_type = CASE fn.facility_type
          WHEN 'school' THEN 'school'
          WHEN 'community_center' THEN 'community_center'
          WHEN 'farm' THEN 'farm'
          WHEN 'commercial_property' THEN 'commercial_property'
          ELSE 'other'
        END,
        fn.moku_id = coalesce(fn.moku_id, fn.district),
        fn.status = coalesce(fn.status, 'active'),
        fn.gs1_gln = NULL,
        fn.source_system = 'legacy/FacilityNode',
        fn.updated_at = datetime()
    RETURN count(fn) AS migrated
  `);

  const migratedCount = migrated[0]?.get('migrated') ?? 0;
  console.log(`  ✓ Migrated ${migratedCount} FacilityNode(s) to dual-label :FacilityNode:Facility`);

  // -----------------------------------------------------------------------
  // Stage 6: Verify
  // -----------------------------------------------------------------------
  console.log('\nStage 6: Verification...');

  const verification = await runWrite(`
    OPTIONAL MATCH (ls:LifecycleStage) WHERE ls.track = 'supply_chain' OR ls.id = 'PLANNING'
    WITH count(ls) AS stageCount
    OPTIONAL MATCH (f:Facility)
    WITH stageCount, count(f) AS facilityCount
    OPTIONAL MATCH (c:Contract)
    WITH stageCount, facilityCount, count(c) AS contractCount
    OPTIONAL MATCH (ci:ContractIDS)
    WITH stageCount, facilityCount, contractCount, count(ci) AS idsCount
    RETURN stageCount, facilityCount, contractCount, idsCount
  `);

  const v = verification[0];
  console.log(`  Lifecycle stages (with PLANNING): ${v.get('stageCount')}`);
  console.log(`  Facility nodes: ${v.get('facilityCount')}`);
  console.log(`  Contract nodes: ${v.get('contractCount')}`);
  console.log(`  ContractIDS nodes: ${v.get('idsCount')}`);

  console.log('\n=== Migration complete ===');

  await closeDriver();
}

main().catch(err => {
  console.error('Migration failed:', err);
  closeDriver().then(() => process.exit(1));
});
