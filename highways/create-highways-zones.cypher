// ============================================================================
// Stage A — Create Zone nodes for HPMS Highway segments
//
// Creates 2,075 Zone nodes, one per road segment.
// Each zone captures route name, functional system, AADT traffic counts,
// ownership, lanes, and segment length.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/highways/Highway_Performance_Monitoring_System_Roads_for_Hawaii_(HPMS).csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     row.route_name                   AS route_name,
     row.island                       AS island,
     toInteger(row.route_id)          AS route_id,
     toFloat(row.bmp)                 AS bmp,
     toFloat(row.emp)                 AS emp,
     row.f_system_t                   AS functional_system,
     row.facility_type_t              AS facility_type,
     row.ownership_t                  AS ownership,
     toInteger(row.aadt)              AS aadt,
     toInteger(row.through_lanes)     AS lanes,
     toFloat(row.st_lengthshape)      AS length_m

WITH oid, route_name, island, route_id, bmp, emp,
     functional_system, facility_type, ownership,
     aadt, lanes, length_m,
     "HWY_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name              = route_name + " (MP " + toString(bmp) + "-" + toString(emp) + ")",
    z.type              = "highway",
    z.route_name        = route_name,
    z.route_id          = route_id,
    z.island            = island,
    z.bmp               = bmp,
    z.emp               = emp,
    z.functional_system = functional_system,
    z.facility_type     = facility_type,
    z.ownership         = ownership,
    z.aadt              = aadt,
    z.through_lanes     = lanes,
    z.length_m          = length_m,
    z.data_source       = "HPMS Roads for Hawaii 2024",
    z.provenance        = "Federal Highway Performance Monitoring System, Hawaii DOT",
    z.created_at        = coalesce(z.created_at, datetime()),
    z.updated_at        = datetime();
