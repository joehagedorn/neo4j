// ============================================================================
// Stage A — Create Zone nodes for Hawaii Opportunity Zones
//
// Creates 25 Zone nodes, one per federal opportunity zone tract.
// Each zone captures tract number, name, rationale, and area metrics.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/opportunity/Opportunity_Zones.csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     row.tract_no                     AS tract_no,
     row.tract_name                   AS tract_name,
     row.rationale                    AS rationale,
     toFloat(row.st_areashape)        AS area_m2,
     toFloat(row.st_perimetershape)   AS perimeter_m

WITH oid, tract_no, tract_name, rationale, area_m2, perimeter_m,
     "OZ_" + toString(oid)            AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name        = tract_name + " (Tract " + tract_no + ")",
    z.type        = "opportunity",
    z.tract_no    = tract_no,
    z.rationale   = rationale,
    z.acres       = area_m2 / 4046.86,
    z.area_m2     = area_m2,
    z.perimeter_m = perimeter_m,
    z.data_source = "Hawaii Opportunity Zones",
    z.provenance  = "Federal Opportunity Zone designation, Hawaii DBEDT",
    z.created_at  = coalesce(z.created_at, datetime()),
    z.updated_at  = datetime();
