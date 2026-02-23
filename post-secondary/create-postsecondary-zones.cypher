// ============================================================================
// Stage A — Create Zone nodes for Hawaii Post-Secondary Institution Campuses
//
// Creates one Zone per campus from deduplicated UNI_Campuses.csv.
// Main campuses use UNI_<inst_id>, branch campuses use UNI_<inst_id>_<camp_id>.
// Each zone captures institution IDs, campus address, and contact info.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/post-secondary/UNI_Campuses.csv' AS row

WITH row,
     trim(row.zone_id)              AS zone_id,
     toInteger(row.inst_id)         AS inst_id,
     trim(row.inst_name)            AS inst_name,
     toInteger(row.inst_opeid)      AS inst_opeid,
     toInteger(row.inst_ipeds)      AS inst_ipeds,
     trim(row.inst_url)             AS inst_url,
     trim(row.inst_ph)              AS inst_ph,
     toInteger(row.camp_id)         AS camp_id,
     trim(row.camp_name)            AS camp_name,
     trim(row.address)              AS address,
     trim(row.city)                 AS city,
     trim(row.state)                AS state,
     trim(row.zip)                  AS zip

MERGE (z:Zone {id: zone_id})
SET z.name         = CASE WHEN camp_id <> 0 AND camp_name <> "" THEN camp_name
                          ELSE inst_name END,
    z.type         = "postsecondary",
    z.inst_id      = inst_id,
    z.inst_name    = inst_name,
    z.inst_opeid   = inst_opeid,
    z.inst_ipeds   = inst_ipeds,
    z.inst_url     = inst_url,
    z.inst_ph      = inst_ph,
    z.camp_id      = camp_id,
    z.camp_name    = camp_name,
    z.address      = address,
    z.city         = city,
    z.state        = state,
    z.zip          = zip,
    z.data_source  = "US Dept of Education Post-Secondary Institutions",
    z.provenance   = "Federal accreditation database, Hawaii campus locations",
    z.created_at   = coalesce(z.created_at, datetime()),
    z.updated_at   = datetime()

WITH z
MERGE (zt:ZoneType {id: "postsecondary"})
ON CREATE SET zt.label = "Post-Secondary Institution"
MERGE (z)-[:USES_TYPE]->(zt);
