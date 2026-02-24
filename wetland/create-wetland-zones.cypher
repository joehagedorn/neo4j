// ============================================================================
// Stage A — Create Zone nodes for NWI Wetlands (Oahu)
//
// Creates 4,974 Zone nodes, one per NWI wetland feature.
// Each zone captures NWI attribute code, wetland type, acreage, and status.
//
// Also creates the "wetland" ZoneType vocabulary node if it doesn't exist.
//
// Prerequisites: None (first stage)
// ============================================================================

// --- Step 1: Create ZoneType vocabulary node ---

MERGE (zt:ZoneType {id: "wetland"})
SET zt.label = "Wetland / Hydrography",
    zt.data_source = "NWI (National Wetlands Inventory)",
    zt.updated_at = datetime();

// --- Step 2: Create Zone nodes from CSV ---
// Run this block separately after Step 1

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/wetland/Wetlands.csv' AS row

WITH row,
     toInteger(row.objectid)          AS oid,
     toInteger(row.fid_hi_wetlands)   AS fid,
     trim(row.attribute)              AS nwi_attribute,
     toFloat(row.acres)               AS acres,
     trim(row.wetland_type)           AS wetland_type,
     trim(row.status)                 AS status

WITH oid, fid, nwi_attribute, acres, wetland_type, status,
     "WET_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name            = wetland_type + " (" + nwi_attribute + ")",
    z.type            = "wetland",
    z.nwi_attribute   = nwi_attribute,
    z.wetland_type    = wetland_type,
    z.fid_hi_wetlands = fid,
    z.acres           = acres,
    z.island          = "oahu",
    z.status          = status,
    z.data_source     = "NWI (National Wetlands Inventory)",
    z.provenance      = "USFWS NWI Hydrography dataset, Oahu extract",
    z.created_at      = coalesce(z.created_at, datetime()),
    z.updated_at      = datetime()

WITH z
MATCH (zt:ZoneType {id: "wetland"})
MERGE (z)-[:USES_TYPE]->(zt);
