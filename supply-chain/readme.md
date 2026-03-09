# Supply Chain Transforms

Seeding and migration scripts for supply chain governance nodes in AuraDB.

## Execution Order

1. **seed-supply-chain-governance.cypher** — Seeds lifecycle stages (LOGISTICS, OPERATIONS, MAINTENANCE), STAGE_NEXT chain, constraints, and indexes. Run first.

2. **migrate-facility-node.cypher** — Adds `:Facility` label to existing `:FacilityNode` nodes and populates canonical properties (facility_id, facility_type, moku_id, status). Requires facility_id_unique constraint from step 1.

## Notes

- All scripts are idempotent (MERGE + IF NOT EXISTS)
- FacilityNode label is preserved for backwards compatibility
- `gs1_gln` is set to NULL on migrated nodes — must be populated separately
- Run in AuraDB Browser or via `db.mjs` in the transforms root
