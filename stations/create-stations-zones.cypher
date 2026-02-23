// ============================================================================
// Stage A — Create TransitCorridor, Station Zones, and STOP_ON for HART Rail
//
// Creates a single TransitCorridor node for the Honolulu Rail Transit line,
// one Zone per station from STA_Stations.csv, and ordered STOP_ON
// relationships capturing the route sequence (station 1 → 21).
//
// Prerequisites: None (first stage)
// ============================================================================

// 1) Create the TransitCorridor node
MERGE (tc:TransitCorridor {id: "HART_RAIL"})
SET tc.name       = "Honolulu Rail Transit (HART)",
    tc.island     = "oahu",
    tc.stations   = 21,
    tc.status     = "under construction",
    tc.updated_at = datetime();

// ============================================================================
// 2) Create Station Zone nodes and STOP_ON relationships
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/stations/STA_Stations.csv' AS row

WITH row,
     trim(row.zone_id)              AS zone_id,
     toInteger(row.station_number)  AS station_number,
     trim(row.station_name)         AS station_name,
     trim(row.feis_name)            AS feis_name,
     trim(row.global_id)            AS global_id

MERGE (z:Zone {id: zone_id})
SET z.name           = station_name,
    z.type           = "station",
    z.station_number = station_number,
    z.feis_name      = feis_name,
    z.global_id      = global_id,
    z.island         = "oahu",
    z.data_source    = "HART Rail Transit Stations",
    z.provenance     = "Honolulu Authority for Rapid Transportation, public station locations",
    z.created_at     = coalesce(z.created_at, datetime()),
    z.updated_at     = datetime()

WITH z
MERGE (zt:ZoneType {id: "station"})
ON CREATE SET zt.label = "Transit Station"
MERGE (z)-[:USES_TYPE]->(zt)

WITH z
MATCH (tc:TransitCorridor {id: "HART_RAIL"})
MERGE (z)-[s:STOP_ON]->(tc)
SET s.sequence = z.station_number;
