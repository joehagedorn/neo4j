// ============================================================================
// Seed Supply Chain Governance — Lifecycle Stages + Constraints
//
// Seeds the 3 new supply chain lifecycle stages (LOGISTICS, OPERATIONS,
// MAINTENANCE) and creates STAGE_NEXT chain for the supply chain track.
// Also applies constraints and indexes for Contract, ContractIDS, Facility,
// SupplyChainSystem nodes.
//
// PLANNING is shared with the GF track — already seeded (ordinal 1).
// Supply chain STAGE_NEXT: PLANNING → LOGISTICS → OPERATIONS → MAINTENANCE
//
// Safe to re-run (MERGE + IF NOT EXISTS).
// ============================================================================

// Step 1: Seed supply chain lifecycle stages
MERGE (ls:LifecycleStage {id: 'LOGISTICS'})
ON CREATE SET ls.label = 'Logistics', ls.ordinal = 5,
              ls.description = 'Supply chain logistics, procurement, distribution',
              ls.track = 'supply_chain';

MERGE (ls:LifecycleStage {id: 'OPERATIONS'})
ON CREATE SET ls.label = 'Operations', ls.ordinal = 6,
              ls.description = 'Facility operations, production, chain-of-custody',
              ls.track = 'supply_chain';

MERGE (ls:LifecycleStage {id: 'MAINTENANCE'})
ON CREATE SET ls.label = 'Maintenance', ls.ordinal = 7,
              ls.description = 'Asset maintenance, contract renewal, compliance',
              ls.track = 'supply_chain';

// Step 2: Create supply chain STAGE_NEXT chain
// PLANNING → LOGISTICS → OPERATIONS → MAINTENANCE
MATCH (a:LifecycleStage {id: 'PLANNING'}), (b:LifecycleStage {id: 'LOGISTICS'})
MERGE (a)-[:STAGE_NEXT {track: 'supply_chain'}]->(b);

MATCH (a:LifecycleStage {id: 'LOGISTICS'}), (b:LifecycleStage {id: 'OPERATIONS'})
MERGE (a)-[:STAGE_NEXT {track: 'supply_chain'}]->(b);

MATCH (a:LifecycleStage {id: 'OPERATIONS'}), (b:LifecycleStage {id: 'MAINTENANCE'})
MERGE (a)-[:STAGE_NEXT {track: 'supply_chain'}]->(b);

// Step 3: Apply constraints
CREATE CONSTRAINT contract_id_unique IF NOT EXISTS FOR (c:Contract) REQUIRE c.contract_id IS UNIQUE;
CREATE CONSTRAINT contractids_id_unique IF NOT EXISTS FOR (ci:ContractIDS) REQUIRE ci.ids_id IS UNIQUE;
CREATE CONSTRAINT facility_id_unique IF NOT EXISTS FOR (f:Facility) REQUIRE f.facility_id IS UNIQUE;
CREATE CONSTRAINT supplychainsystem_id_unique IF NOT EXISTS FOR (s:SupplyChainSystem) REQUIRE s.system_id IS UNIQUE;

// Step 4: Apply indexes
CREATE INDEX contract_type IF NOT EXISTS FOR (c:Contract) ON (c.contract_type);
CREATE INDEX contract_status IF NOT EXISTS FOR (c:Contract) ON (c.status);
CREATE INDEX contract_moku IF NOT EXISTS FOR (c:Contract) ON (c.moku_id);
CREATE INDEX facility_type IF NOT EXISTS FOR (f:Facility) ON (f.facility_type);
CREATE INDEX facility_moku IF NOT EXISTS FOR (f:Facility) ON (f.moku_id);
CREATE INDEX facility_gln IF NOT EXISTS FOR (f:Facility) ON (f.gs1_gln);
CREATE INDEX facility_status IF NOT EXISTS FOR (f:Facility) ON (f.status);
