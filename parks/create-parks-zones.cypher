// ============================================================================
// Stage A — Create Zone nodes for Hawaii State Parks
//
// Creates 70 Zone nodes, one per park feature.
// Each zone captures park type, managing agency, acreage, and geometry metrics.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/parks/State_Parks.csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     trim(row.type)                   AS park_type,
     row.name                         AS park_name,
     row.type_defin                   AS type_definition,
     row.managedby                    AS managed_by,
     row.island                       AS island,
     toFloat(row.gis_acre)            AS acres,
     toFloat(row.st_areashape)        AS area_m2,
     toFloat(row.st_perimetershape)   AS perimeter_m

WITH oid, park_type, park_name, type_definition, managed_by, island,
     acres, area_m2, perimeter_m,
     "PRK_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name            = park_name,
    z.type            = "park",
    z.park_type       = park_type,
    z.type_definition = type_definition,
    z.managed_by      = managed_by,
    z.island          = island,
    z.acres           = acres,
    z.area_m2         = area_m2,
    z.perimeter_m     = perimeter_m,
    z.data_source     = "DLNR Hawaii State Parks",
    z.provenance      = "Hawaii DLNR Division of State Parks dataset",
    z.created_at      = coalesce(z.created_at, datetime()),
    z.updated_at      = datetime();
