/**
 * Seed First Contract: HKA Product Development Planning
 *
 * Creates a planning contract governing product development activities
 * at Waimanalo Farm Supply, issued by bGood Farms Hub.
 *
 * Graph created:
 *   (fac-bgood-farms-hub)-[:ISSUES_CONTRACT]->(Contract)
 *   (Contract)-[:AT_LIFECYCLE_STAGE]->(LifecycleStage:PLANNING)
 *   (Contract)-[:LOCATED_IN]->(Moku:Ko'olaupoko)
 *   (Contract)-[:ALLOWS_FACILITY]->(fac-waimanalo-farm-supply)
 *   (fac-waimanalo-farm-supply)-[:BOUND_BY_CONTRACT]->(Contract)
 *   (Project:supply_chain)-[:BOUND_BY_CONTRACT]->(Contract)
 *   (Project)-[:TARGETS_SDG]->(SDGGoal:sdg2)
 *   (Project)-[:TARGETS_SDG]->(SDGGoal:sdg8)
 *
 * Run from transforms/ directory: node supply-chain/seed-first-contract.mjs
 */

import { runWrite, runQuery, closeDriver } from '../db.mjs';

const CONTRACT_ID = 'ctr-koolaupoko-hka-product-dev-2026';
const PROJECT_ID = 'prj-sdg2-koolaupoko-oahu-hka-product-dev-2026';
const HUB_FACILITY = 'fac-bgood-farms-hub';
const BOUND_FACILITY = 'fac-waimanalo-farm-supply';
const MOKU = "Ko'olaupoko";

async function main() {
  console.log('=== Seed First Contract: HKA Product Development Planning ===\n');

  // -----------------------------------------------------------------------
  // Stage 1: Create supply_chain Project node
  // -----------------------------------------------------------------------
  console.log('Stage 1: Creating supply_chain Project node...');

  await runWrite(`
    MERGE (p:Project {project_id: $projectId})
    ON CREATE SET
      p.name = 'HKA Product Development Planning',
      p.project_type = 'supply_chain',
      p.status = 'active',
      p.description = 'HKA product development planning — concept through production stage tracking for value-added agricultural products. Workforce development and career pathways component (SDG 8). Sample testing with GS1 traceability for evidence-based product development.',
      p.moku_id = $moku,
      p.lifecycle_stage = 'PLANNING',
      p.source_system = 'manual',
      p.created_at = datetime(),
      p.updated_at = datetime()
    ON MATCH SET
      p.updated_at = datetime()
    RETURN p.project_id AS id
  `, { projectId: PROJECT_ID, moku: MOKU })
    .then(r => console.log(`  ✓ Project: ${r[0]?.get('id')}`));

  // Link Project → Moku
  await runWrite(`
    MATCH (p:Project {project_id: $projectId})
    MATCH (m:Moku {name: $moku})
    MERGE (p)-[r:LOCATED_IN]->(m)
    SET r.primary = true, r.synced_at = datetime()
    RETURN count(r) AS c
  `, { projectId: PROJECT_ID, moku: MOKU })
    .then(r => console.log(`  ✓ LOCATED_IN → Moku (${r[0]?.get('c')})`));

  // Link Project → LifecycleStage:PLANNING
  await runWrite(`
    MATCH (p:Project {project_id: $projectId})
    MATCH (ls:LifecycleStage {id: 'PLANNING'})
    MERGE (p)-[r:AT_LIFECYCLE_STAGE]->(ls)
    SET r.synced_at = datetime()
    RETURN count(r) AS c
  `, { projectId: PROJECT_ID })
    .then(r => console.log(`  ✓ AT_LIFECYCLE_STAGE → PLANNING (${r[0]?.get('c')})`));

  // Link Project → SDGGoal:sdg2 + SDGGoal:sdg8
  for (const sdg of ['sdg2', 'sdg8']) {
    await runWrite(`
      MATCH (p:Project {project_id: $projectId})
      MATCH (s:SDGGoal {id: $sdg})
      MERGE (p)-[r:TARGETS_SDG]->(s)
      SET r.synced_at = datetime()
      RETURN count(r) AS c
    `, { projectId: PROJECT_ID, sdg })
      .then(r => console.log(`  ✓ TARGETS_SDG → ${sdg} (${r[0]?.get('c')})`));
  }

  // -----------------------------------------------------------------------
  // Stage 2: Create Contract node
  // -----------------------------------------------------------------------
  console.log('\nStage 2: Creating Contract node...');

  await runWrite(`
    MERGE (c:Contract {contract_id: $contractId})
    ON CREATE SET
      c.name = 'HKA Product Development Planning',
      c.contract_type = 'planning',
      c.status = 'draft',
      c.moku_id = $moku,
      c.issuing_facility_id = $hubFacility,
      c.description = 'Planning contract governing product development activities — concept, prototype, testing, production stages — at Waimanalo Farm Supply under bGood Farms Hub oversight. Includes sample testing evidence requirements, GS1 labeling for product traceability, and workforce development career pathways.',
      c.created_at = datetime(),
      c.updated_at = datetime()
    ON MATCH SET
      c.updated_at = datetime()
    RETURN c.contract_id AS id
  `, { contractId: CONTRACT_ID, moku: MOKU, hubFacility: HUB_FACILITY })
    .then(r => console.log(`  ✓ Contract: ${r[0]?.get('id')}`));

  // Contract → LifecycleStage:PLANNING
  await runWrite(`
    MATCH (c:Contract {contract_id: $contractId})
    MATCH (ls:LifecycleStage {id: 'PLANNING'})
    MERGE (c)-[r:AT_LIFECYCLE_STAGE]->(ls)
    SET r.synced_at = datetime()
    RETURN count(r) AS c
  `, { contractId: CONTRACT_ID })
    .then(r => console.log(`  ✓ AT_LIFECYCLE_STAGE → PLANNING (${r[0]?.get('c')})`));

  // Contract → Moku
  await runWrite(`
    MATCH (c:Contract {contract_id: $contractId})
    MATCH (m:Moku {name: $moku})
    MERGE (c)-[r:LOCATED_IN]->(m)
    SET r.synced_at = datetime()
    RETURN count(r) AS c
  `, { contractId: CONTRACT_ID, moku: MOKU })
    .then(r => console.log(`  ✓ LOCATED_IN → Moku (${r[0]?.get('c')})`));

  // -----------------------------------------------------------------------
  // Stage 3: Link facilities
  // -----------------------------------------------------------------------
  console.log('\nStage 3: Linking facilities...');

  // Hub issues contract
  await runWrite(`
    MATCH (f:Facility {facility_id: $hubFacility})
    MATCH (c:Contract {contract_id: $contractId})
    MERGE (f)-[r:ISSUES_CONTRACT]->(c)
    SET r.synced_at = datetime()
    RETURN count(r) AS c
  `, { hubFacility: HUB_FACILITY, contractId: CONTRACT_ID })
    .then(r => console.log(`  ✓ ${HUB_FACILITY} -[:ISSUES_CONTRACT]-> Contract (${r[0]?.get('c')})`));

  // Contract allows + binds Waimanalo
  await runWrite(`
    MATCH (c:Contract {contract_id: $contractId})
    MATCH (f:Facility {facility_id: $boundFacility})
    MERGE (c)-[a:ALLOWS_FACILITY]->(f)
    SET a.synced_at = datetime()
    MERGE (f)-[b:BOUND_BY_CONTRACT]->(c)
    SET b.synced_at = datetime()
    RETURN count(a) AS allows, count(b) AS bound
  `, { contractId: CONTRACT_ID, boundFacility: BOUND_FACILITY })
    .then(r => console.log(`  ✓ Contract -[:ALLOWS_FACILITY]-> ${BOUND_FACILITY} (${r[0]?.get('allows')})`))
    .then(() => console.log(`  ✓ ${BOUND_FACILITY} -[:BOUND_BY_CONTRACT]-> Contract`));

  // -----------------------------------------------------------------------
  // Stage 4: Link project to contract
  // -----------------------------------------------------------------------
  console.log('\nStage 4: Linking project to contract...');

  await runWrite(`
    MATCH (p:Project {project_id: $projectId})
    MATCH (c:Contract {contract_id: $contractId})
    MERGE (p)-[r:BOUND_BY_CONTRACT]->(c)
    SET r.synced_at = datetime()
    RETURN count(r) AS c
  `, { projectId: PROJECT_ID, contractId: CONTRACT_ID })
    .then(r => console.log(`  ✓ Project -[:BOUND_BY_CONTRACT]-> Contract (${r[0]?.get('c')})`));

  // -----------------------------------------------------------------------
  // Stage 5: Verify full subgraph
  // -----------------------------------------------------------------------
  console.log('\nStage 5: Verification...');

  const verification = await runQuery(`
    MATCH (c:Contract {contract_id: $contractId})
    OPTIONAL MATCH (c)-[:AT_LIFECYCLE_STAGE]->(ls:LifecycleStage)
    OPTIONAL MATCH (c)-[:LOCATED_IN]->(m:Moku)
    OPTIONAL MATCH (c)-[:ALLOWS_FACILITY]->(f:Facility)
    OPTIONAL MATCH (issuer:Facility)-[:ISSUES_CONTRACT]->(c)
    OPTIONAL MATCH (p:Project)-[:BOUND_BY_CONTRACT]->(c)
    OPTIONAL MATCH (p)-[:TARGETS_SDG]->(sdg:SDGGoal)
    RETURN c.contract_id AS contract,
           c.status AS status,
           ls.id AS stage,
           m.name AS moku,
           collect(DISTINCT f.facility_id) AS allowed_facilities,
           issuer.facility_id AS issuer,
           p.project_id AS project,
           collect(DISTINCT sdg.id) AS sdg_targets
  `, { contractId: CONTRACT_ID });

  const v = verification[0];
  console.log(`  Contract:   ${v.get('contract')} (${v.get('status')})`);
  console.log(`  Stage:      ${v.get('stage')}`);
  console.log(`  Moku:       ${v.get('moku')}`);
  console.log(`  Issuer:     ${v.get('issuer')}`);
  console.log(`  Facilities: ${v.get('allowed_facilities')}`);
  console.log(`  Project:    ${v.get('project')}`);
  console.log(`  SDG:        ${v.get('sdg_targets')}`);

  console.log('\n=== Contract seeded successfully ===');
  console.log(`\nNext: Attach ContractIDS via API:`);
  console.log(`  POST /api/contract/${CONTRACT_ID}/ids`);

  await closeDriver();
}

main().catch(err => {
  console.error('Failed:', err);
  closeDriver().then(() => process.exit(1));
});
