// ============================================================================
// Stage A — Create Zone nodes for Environmental Monitoring Sites
//
// Creates Zone nodes for each unique monitoring site (fishponds, stream
// outlets, intake pools, etc.). Each zone captures site name, matrix type,
// moku context, and precise coordinates for the SDG spatial bridge.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/environment/ENV_IntraZones_H3.csv' AS row

WITH row,
     trim(row.zone_id)         AS zone_id,
     trim(row.name)            AS site_name,
     trim(row.matrix)          AS matrix,
     trim(row.moku)            AS moku,
     trim(row.island)          AS island,
     toFloat(row.lat)          AS lat,
     toFloat(row.lng)          AS lng,
     trim(row.version)         AS version,
     row.data_source           AS data_source,
     row.provenance            AS provenance

MERGE (z:Zone {id: zone_id})
SET z.name         = site_name,
    z.type         = "environment",
    z.matrix       = matrix,
    z.moku_id      = moku,
    z.island       = island,
    z.latitude     = lat,
    z.longitude    = lng,
    z.version      = version,
    z.data_source  = data_source,
    z.provenance   = provenance,
    z.created_at   = coalesce(z.created_at, datetime()),
    z.updated_at   = datetime()

WITH z
MERGE (zt:ZoneType {id: "environment"})
ON CREATE SET zt.label = "Environmental Monitoring Site"
MERGE (z)-[:USES_TYPE]->(zt);
