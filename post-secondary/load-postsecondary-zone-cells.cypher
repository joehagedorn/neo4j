// ============================================================================
// Stage B — Create IntraZone anchors for Post-Secondary Zones (res-14)
//
// Each campus was mapped to a single res-14 H3 cell (~6.3 m²) via its Point
// coordinate. This creates an IntraZone node, links it to the Zone via
// ANCHORS, and links it to the parent res-7 ZoneCell via WITHIN_CELL
// (when that backbone cell exists) for Moku traversal.
//
// Prerequisites:
//   - Moku ZoneCells loaded (Stage 0)
//   - Post-Secondary Zone nodes created (Stage A)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/post-secondary/UNI_IntraZones_H3.csv' AS row

WITH row,
     trim(row.zone_id)         AS zone_id,
     row.h3_cell                AS h3,
     toInteger(row.resolution)  AS resolution,
     row.parent_h3_7            AS parent_h3,
     trim(row.version)          AS version,
     row.data_source            AS data_source,
     row.provenance             AS provenance

// 1) Match the Zone and update metadata
MATCH (z:Zone {id: zone_id})
SET z.version     = coalesce(version, z.version),
    z.data_source = coalesce(data_source, z.data_source),
    z.provenance  = coalesce(provenance, z.provenance),
    z.updated_at  = datetime()

// 2) Create IntraZone and ANCHORS relationship
WITH z, h3, resolution, parent_h3
MERGE (iz:IntraZone {h3_cell: h3})
ON CREATE SET iz.resolution = resolution,
              iz.created_at  = datetime()
SET iz.updated_at = datetime()
MERGE (iz)-[:ANCHORS]->(z)

// 3) Link IntraZone to parent res-7 ZoneCell (when it exists in backbone)
WITH iz, parent_h3
OPTIONAL MATCH (zc:ZoneCell {h3_cell: parent_h3})
FOREACH (_ IN CASE WHEN zc IS NOT NULL THEN [1] ELSE [] END |
  MERGE (iz)-[:WITHIN_CELL]->(zc)
);
