// ============================================================================
// Stage A — Create Zone nodes for City & County of Honolulu Zoning
//
// Creates 1,965 Zone nodes, one per zoning feature.
// Each zone captures zone class, zoning description, and area metrics.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/planning/Zoning_(City_and_County_of_Honolulu).csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     trim(row.zone_class)             AS zone_class,
     row.zoning_des                   AS zoning_des,
     toFloat(row.st_areashape)        AS area_m2,
     toFloat(row.st_perimetershape)   AS perimeter_m

WITH oid, zone_class, zoning_des, area_m2, perimeter_m,
     "HNL_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name        = zoning_des + " (#" + toString(oid) + ")",
    z.type        = "zoning",
    z.zone_class  = zone_class,
    z.island      = "oahu",
    z.area_m2     = area_m2,
    z.perimeter_m = perimeter_m,
    z.data_source = "City and County of Honolulu Zoning 2023",
    z.provenance  = "Honolulu DPP zoning districts, loaded 2023-09-15",
    z.created_at  = coalesce(z.created_at, datetime()),
    z.updated_at  = datetime();
