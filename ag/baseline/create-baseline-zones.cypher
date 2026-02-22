// ============================================================================
// Stage A — Create Zone nodes for Agricultural Land Use 2015 Baseline
//
// Creates 5,024 Zone nodes, one per agricultural land use feature.
// Each zone captures crop category, island, acreage, and area metrics.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/ag/baseline/Agricultural_Land_Use_-_2015_Baseline.csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     row.cropcatego                   AS crop,
     row.island                       AS island,
     toFloat(row.acreage)             AS acres,
     toFloat(row.st_areashape)        AS area_m2,
     toFloat(row.st_perimetershape)   AS perimeter_m

WITH oid, crop, island, acres, area_m2, perimeter_m,
     "ALU_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name        = crop + " (" + island + " #" + toString(oid) + ")",
    z.type        = "ag",
    z.crop_category = crop,
    z.island      = island,
    z.acres       = acres,
    z.area_m2     = area_m2,
    z.perimeter_m = perimeter_m,
    z.data_source = "Agricultural Land Use 2015 Baseline",
    z.provenance  = "Hawaii Statewide GIS, 2015 baseline survey",
    z.created_at  = coalesce(z.created_at, datetime()),
    z.updated_at  = datetime();
