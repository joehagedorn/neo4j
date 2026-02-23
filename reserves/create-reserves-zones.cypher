// ============================================================================
// Stage A — Create Zone nodes for Hawaii Reserves
//
// Creates 376 Zone nodes, one per reserve feature.
// Each zone captures reserve type, managing agency, acreage, and web links.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/reserves/Reserves.csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     trim(row.type)                   AS reserve_type,
     row.name                         AS reserve_name,
     row.managedby                    AS managed_by,
     row.island                       AS island,
     toFloat(row.gis_acre)            AS acres,
     row.type_defin                   AS type_definition,
     row.uid                          AS reserve_uid,
     row.tlabel                       AS label_name,
     toFloat(row.st_areashape)        AS area_m2,
     toFloat(row.st_perimetershape)   AS perimeter_m

WITH oid, reserve_type, reserve_name, managed_by, island, acres,
     type_definition, reserve_uid, label_name, area_m2, perimeter_m,
     "RES_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name            = reserve_name,
    z.type            = "reserve",
    z.reserve_type    = reserve_type,
    z.type_definition = type_definition,
    z.reserve_uid     = reserve_uid,
    z.label_name      = label_name,
    z.managed_by      = managed_by,
    z.island          = island,
    z.acres           = acres,
    z.area_m2         = area_m2,
    z.perimeter_m     = perimeter_m,
    z.data_source     = "DLNR Hawaii Reserves",
    z.provenance      = "Hawaii DLNR statewide reserves dataset",
    z.created_at      = coalesce(z.created_at, datetime()),
    z.updated_at      = datetime();
