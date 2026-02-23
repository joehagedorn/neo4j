// ============================================================================
// Stage A — Create Zone nodes for Hawaii Public Schools
//
// Creates ~288 Zone nodes, one per public school.
// Each zone captures school code, type, grade range, location, and district.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/schools/Public_Schools.csv' AS row

WITH row,
     toInteger(row.objectid)    AS oid,
     toInteger(row.sch_code)    AS sch_code,
     row.sch_name               AS sch_name,
     row.sch_type               AS sch_type,
     row.grade_from             AS grade_from,
     toString(row.grade_to)     AS grade_to,
     row.address                AS address,
     row.city                   AS city,
     toString(row.zip)          AS zip,
     row.phone                  AS phone,
     row.principal              AS principal,
     row.website                AS website,
     row.complex                AS complex,
     row.complex_area           AS complex_area,
     row.district               AS district,
     row.island                 AS island,
     toInteger(row.charter)     AS charter

WITH oid, sch_code, sch_name, sch_type, grade_from, grade_to,
     address, city, zip, phone, principal, website,
     complex, complex_area, district, island, charter,
     "SCH_" + toString(oid)     AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name         = sch_name,
    z.type         = "school",
    z.sch_code     = sch_code,
    z.sch_type     = sch_type,
    z.grade_from   = grade_from,
    z.grade_to     = grade_to,
    z.address      = address,
    z.city         = city,
    z.zip          = zip,
    z.phone        = phone,
    z.principal    = principal,
    z.website      = website,
    z.complex      = complex,
    z.complex_area = complex_area,
    z.district     = district,
    z.island       = island,
    z.charter      = CASE WHEN charter = 1 THEN true ELSE false END,
    z.data_source  = "Hawaii DOE Public Schools",
    z.provenance   = "Hawaii Dept of Education statewide public school locations",
    z.created_at   = coalesce(z.created_at, datetime()),
    z.updated_at   = datetime()

WITH z
MERGE (zt:ZoneType {id: "school"})
ON CREATE SET zt.label = "Public School"
MERGE (z)-[:USES_TYPE]->(zt);
