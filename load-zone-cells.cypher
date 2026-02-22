// ============================================================================
// Load ZoneCell nodes from ZoneCell.csv
//
// Creates H3 resolution-7 ZoneCell nodes for every moku district
// and links each cell to its Moku via a WITHIN relationship.
//
// Prerequisites:
//   - Moku nodes must already exist with an `id` property (e.g. "oahu-kona")
//   - ZoneCell.csv must be accessible at the file:/// path or hosted URL below
//
// Columns expected: h3_index, resolution, moku_id, moku_name, island
// ============================================================================

LOAD CSV WITH HEADERS FROM 'file:///ZoneCell.csv' AS row

WITH row,
     row.h3_index AS h3,
     toInteger(row.resolution) AS res,
     toLower(row.moku_id) AS moku_id

// Create ZoneCell
MERGE (zc:ZoneCell {h3_cell: h3})
SET zc.resolution = res,
    zc.source = "zonecell_csv_seed_2026",
    zc.created_at = coalesce(zc.created_at, datetime()),
    zc.updated_at = datetime()

// Attach to Moku
WITH zc, moku_id
MATCH (m:Moku {id: moku_id})
MERGE (zc)-[:WITHIN]->(m);
