// ============================================================================
// Stage A — Create Zone nodes for Government Land Ownership
//
// Creates 25,129 Zone nodes, one per government land parcel.
// Each zone captures TMK, owner, ownership type, major owner, and acreage.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/stewards/Government_Land_Ownership_-_Detailed.csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     row.tmk_txt                      AS tmk,
     row.island                       AS island,
     row.owner                        AS owner,
     row.ownedby                      AS owned_by,
     row.majorowner                   AS major_owner,
     row.type                         AS ownership_type,
     toFloat(row.gisacres)            AS acres,
     toFloat(row.st_areashape)        AS area_m2,
     toFloat(row.st_perimetershape)   AS perimeter_m

WITH oid, tmk, island, owner, owned_by, major_owner,
     ownership_type, acres, area_m2, perimeter_m,
     "GOV_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name            = owner + " (TMK " + tmk + ")",
    z.type            = "steward",
    z.tmk             = tmk,
    z.island          = island,
    z.owner           = owner,
    z.owned_by        = owned_by,
    z.major_owner     = major_owner,
    z.ownership_type  = ownership_type,
    z.acres           = acres,
    z.area_m2         = area_m2,
    z.perimeter_m     = perimeter_m,
    z.data_source     = "Government Land Ownership - Detailed",
    z.provenance      = "Hawaii Statewide GIS, government land parcels",
    z.created_at      = coalesce(z.created_at, datetime()),
    z.updated_at      = datetime();
