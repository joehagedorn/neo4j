// ============================================================================
// Stage C — Stamp HRS §205-2 state district codes onto res-8 backbone cells
//
// AG12 P4 data dependency (the state axis of the two-axis siting gate; also
// the Wave 1 four-districts layer dependency). Per-cell aggregation from the
// res-8 polyfill of the 906 State Land Use District polygons (statewide):
//   state_land_use_codes — distinct ludcode values covering the cell
//   primary_land_use     — ludcode of the largest-acreage covering feature
//
// MATCH (not MERGE): only existing backbone cells are stamped.
//
// Prerequisites:
//   - Moku ZoneCells loaded (Stage 0)
//   - SLUD_CellCodes_H3.csv pushed to the neo4j CSV-hosting repo
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/state-land-use/SLUD_CellCodes_H3.csv' AS row
CALL {
  WITH row
  WITH trim(row.h3_cell) AS h3,
       split(row.codes, '|') AS codes,
       trim(row.primary_code) AS primary_code
  MATCH (zc:ZoneCell {h3_cell: h3})
  SET zc.state_land_use_codes = codes,
      zc.primary_land_use     = primary_code,
      zc.state_land_use_source = "State Land Use Districts LUC (res-8 polyfill)",
      zc.updated_at           = datetime()
} IN TRANSACTIONS OF 2000 ROWS
