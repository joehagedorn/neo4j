// ============================================================================
// Stage C — Stamp county zoning codes onto Oʻahu res-8 backbone ZoneCells
//
// AG12 P2 (county zoning axis). Per-cell aggregation from the res-8 polyfill
// of the 1,965 Honolulu LUO zoning districts:
//   county_zoning_codes   — distinct zone_class values covering the cell
//   primary_county_zoning — zone_class of the largest-area covering feature
//
// All codes pass through verbatim; the v1 scoring scope (AG-1, AG-2, I-1,
// I-2, I-3, IMX-1, B-1, B-2) is applied in Stage D via ZoningCode nodes.
//
// MATCH (not MERGE): only existing backbone cells are stamped — polyfill
// cells outside the backbone (shoreline slivers) are dropped by design.
//
// Prerequisites:
//   - Moku ZoneCells loaded (Stage 0)
//   - HNL_CellZoning_H3.csv pushed to the neo4j CSV-hosting repo
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/planning/HNL_CellZoning_H3.csv' AS row

WITH row,
     trim(row.h3_cell)      AS h3,
     split(row.codes, '|')  AS codes,
     trim(row.primary_code) AS primary_code

MATCH (zc:ZoneCell {h3_cell: h3})
SET zc.county_zoning_codes   = codes,
    zc.primary_county_zoning = primary_code,
    zc.county_zoning_source  = "City and County of Honolulu Zoning 2024 (res-8 polyfill)",
    zc.updated_at            = datetime();
