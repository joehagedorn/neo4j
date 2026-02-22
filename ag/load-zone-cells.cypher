LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/ag/IAL_Zones_H3.csv' AS row

WITH row,
     trim(row.zone_id)   AS zone_id,
     row.h3_cell         AS h3,
     trim(row.version)   AS version,
     row.data_source     AS data_source,
     row.provenance      AS provenance

// 1) Update Zone provenance/version if present
MATCH (z:Zone {id: zone_id})
SET z.version     = coalesce(version, z.version),
    z.data_source = coalesce(data_source, z.data_source),
    z.provenance  = coalesce(provenance, z.provenance),
    z.updated_at  = datetime()

// 2) Attach ZoneCells by H3
WITH z, h3
MATCH (zc:ZoneCell {h3_cell: h3})
MERGE (zc)-[:IN_ZONE]->(z);