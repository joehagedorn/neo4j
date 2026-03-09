/**
 * Attach ContractIDS to the HKA Product Development Planning contract.
 *
 * MERGEs the ContractIDS node with planning-contract specifications
 * (IfcSite + IfcTask, Pset_SiteGovernance + Pset_TaskAssignment + Pset_GS1Identification)
 * and creates the HAS_CONTRACT_IDS edge.
 *
 * Run from transforms/ directory: node supply-chain/attach-contract-ids.mjs
 */

import { runWrite, runQuery, closeDriver } from '../db.mjs';

const CONTRACT_ID = 'ctr-koolaupoko-hka-product-dev-2026';
const IDS_ID = `cids-${CONTRACT_ID}-1`;

// Planning contract specs (from CONTRACT_TYPE_SPEC_MAP in contract-ids.ts)
const REQUIRED_ENTITY_TYPES = ['IfcSite', 'IfcTask'];
const REQUIRED_PROPERTY_SETS = [
  'Pset_SiteGovernance',
  'Pset_TaskAssignment',
  'Pset_GS1Identification',
];

async function main() {
  console.log('=== Attach ContractIDS ===\n');

  // MERGE ContractIDS node + HAS_CONTRACT_IDS edge
  console.log('Creating ContractIDS node...');
  const result = await runWrite(`
    MATCH (c:Contract {contract_id: $contractId})
    MERGE (ids:ContractIDS {ids_id: $idsId})
    ON CREATE SET
      ids.contract_id = $contractId,
      ids.version = '1',
      ids.ifc_version = 'IFC4',
      ids.required_entity_types = $requiredEntityTypes,
      ids.required_property_sets = $requiredPropertySets,
      ids.specification_count = 2,
      ids.generated_at = datetime(),
      ids.created_at = datetime(),
      ids.updated_at = datetime()
    ON MATCH SET
      ids.updated_at = datetime()
    MERGE (c)-[r:HAS_CONTRACT_IDS]->(ids)
    SET r.synced_at = datetime()
    RETURN ids.ids_id AS id, ids.specification_count AS specs
  `, {
    contractId: CONTRACT_ID,
    idsId: IDS_ID,
    requiredEntityTypes: REQUIRED_ENTITY_TYPES,
    requiredPropertySets: REQUIRED_PROPERTY_SETS,
  });

  const row = result[0];
  console.log(`  ✓ ContractIDS: ${row?.get('id')}`);
  console.log(`  ✓ Specifications: ${row?.get('specs')}`);
  console.log(`  ✓ Entity types: ${REQUIRED_ENTITY_TYPES.join(', ')}`);
  console.log(`  ✓ Property sets: ${REQUIRED_PROPERTY_SETS.join(', ')}`);

  // Verify the complete contract subgraph
  console.log('\nVerification — full contract subgraph:');
  const verify = await runQuery(`
    MATCH (c:Contract {contract_id: $contractId})
    OPTIONAL MATCH (c)-[:HAS_CONTRACT_IDS]->(ids:ContractIDS)
    OPTIONAL MATCH (c)-[:AT_LIFECYCLE_STAGE]->(ls:LifecycleStage)
    OPTIONAL MATCH (c)-[:LOCATED_IN]->(m:Moku)
    OPTIONAL MATCH (c)-[:ALLOWS_FACILITY]->(f:Facility)
    OPTIONAL MATCH (issuer:Facility)-[:ISSUES_CONTRACT]->(c)
    OPTIONAL MATCH (p:Project)-[:BOUND_BY_CONTRACT]->(c)
    OPTIONAL MATCH (p)-[:TARGETS_SDG]->(sdg:SDGGoal)
    RETURN c.contract_id AS contract,
           c.status AS status,
           c.contract_type AS type,
           ls.id AS stage,
           m.name AS moku,
           ids.ids_id AS ids,
           ids.specification_count AS spec_count,
           ids.required_entity_types AS entity_types,
           ids.required_property_sets AS property_sets,
           collect(DISTINCT f.facility_id) AS facilities,
           issuer.facility_id AS issuer,
           p.project_id AS project,
           collect(DISTINCT sdg.id) AS sdg_targets
  `, { contractId: CONTRACT_ID });

  const v = verify[0];
  console.log(`  Contract:       ${v.get('contract')} (${v.get('type')}, ${v.get('status')})`);
  console.log(`  Stage:          ${v.get('stage')}`);
  console.log(`  Moku:           ${v.get('moku')}`);
  console.log(`  ContractIDS:    ${v.get('ids')} (${v.get('spec_count')} specs)`);
  console.log(`  Entity types:   ${v.get('entity_types')}`);
  console.log(`  Property sets:  ${v.get('property_sets')}`);
  console.log(`  Issuer:         ${v.get('issuer')}`);
  console.log(`  Facilities:     ${v.get('facilities')}`);
  console.log(`  Project:        ${v.get('project')}`);
  console.log(`  SDG targets:    ${v.get('sdg_targets')}`);

  console.log('\n=== ContractIDS attached ===');
  await closeDriver();
}

main().catch(err => {
  console.error('Failed:', err);
  closeDriver().then(() => process.exit(1));
});
