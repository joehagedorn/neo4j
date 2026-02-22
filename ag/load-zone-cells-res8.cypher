// ============================================================================
// Stage B — Resolution 8: Create ZoneCells and link to IAL Zones + Moku
//
// Creates new ZoneCell nodes at resolution 8 (~183 acres/cell),
// links them to IAL Zone nodes via IN_ZONE,
// and attaches them to Moku nodes via WITHIN.
//
// Prerequisites:
//   - IAL Zone nodes created via Stage A (Minimal_Cypher_to_create_IAL_Zones)
//   - Moku nodes must exist with an `id` property
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/ag/IAL_Zones_H3_res8.csv' AS row

WITH row,
     trim(row.zone_id)         AS zone_id,
     row.h3_cell                AS h3,
     toInteger(row.resolution)  AS res,
     toLower(row.moku_id)       AS moku_id,
     trim(row.version)          AS version,
     row.data_source            AS data_source,
     row.provenance             AS provenance

// 1) Create or update ZoneCell at resolution 8
MERGE (zc:ZoneCell {h3_cell: h3})
SET zc.resolution  = res,
    zc.source      = "ial_res8_polyfill_2026",
    zc.created_at  = coalesce(zc.created_at, datetime()),
    zc.updated_at  = datetime()

// 2) Link to IAL Zone
WITH zc, zone_id, moku_id, version, data_source, provenance
MATCH (z:Zone {id: zone_id})
SET z.version     = coalesce(version, z.version),
    z.data_source = coalesce(data_source, z.data_source),
    z.provenance  = coalesce(provenance, z.provenance),
    z.updated_at  = datetime()
MERGE (zc)-[:IN_ZONE]->(z)

// 3) Attach to Moku via WITHIN
WITH zc, moku_id
WHERE moku_id IS NOT NULL AND moku_id <> ""
MATCH (m:Moku {id: moku_id})
MERGE (zc)-[:WITHIN]->(m);