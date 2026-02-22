LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/ag/Important_Agricultural_Lands_(IAL).csv' AS row

WITH row,
     trim(row.docket_no) AS docket_no,
     toFloat(row.acres)  AS acres,
     toFloat(row.st_areashape) AS area_m2,
     toFloat(row.st_perimetershape) AS perimeter_m

WITH docket_no, acres, area_m2, perimeter_m,
     "IAL_" + replace(docket_no, " ", "_") AS zone_id

// 1) Create Zone for each IAL docket
MERGE (z:Zone {id: zone_id})
SET z.name        = "IAL " + docket_no,
    z.type        = "ag",               // uses existing ZoneType 'ag'
    z.ial         = true,               // flag: this is Important Agricultural Land
    z.docket_no   = docket_no,
    z.acres       = acres,
    z.area_m2     = area_m2,
    z.perimeter_m = perimeter_m,
    z.data_source = "IAL shapefile / docket registry",
    z.provenance  = "IAL docket-based designation; see docket_no",
    z.created_at  = coalesce(z.created_at, datetime()),
    z.updated_at  = datetime();