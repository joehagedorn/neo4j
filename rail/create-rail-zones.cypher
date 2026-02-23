// ============================================================================
// Stage A — Create Zone nodes for HART Rail Guideway sections
//
// Creates 4 Zone nodes, one per center alignment section.
// Each zone captures section name and alignment length.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/rail/HART_Guideway_Alignment_Line_PUBLIC_-8255298299262351504.csv' AS row

WITH row,
     toInteger(row.OBJECTID)          AS oid,
     row.Name                         AS section_name,
     row.Description                  AS description,
     toFloat(row.Shape__Length)        AS length_ft

WITH oid, section_name, description, length_ft,
     "RAIL_" + toString(oid)          AS zone_id

WHERE description = "Center Alignment"

MERGE (z:Zone {id: zone_id})
SET z.name        = "HART " + section_name,
    z.type        = "transit",
    z.section     = section_name,
    z.alignment   = description,
    z.length_ft   = length_ft,
    z.length_mi   = length_ft / 5280.0,
    z.island      = "oahu",
    z.data_source = "HART Guideway Alignment Line PUBLIC",
    z.provenance  = "Honolulu Authority for Rapid Transportation, public alignment data",
    z.created_at  = coalesce(z.created_at, datetime()),
    z.updated_at  = datetime();
