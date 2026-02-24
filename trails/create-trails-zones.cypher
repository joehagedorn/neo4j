// ============================================================================
// Stage A — Create Zone nodes for Hawaii Trails
//
// Creates 45 Zone nodes, one per trail feature.
// Each zone captures trail number, name, district, length, elevation,
// access type, features, amenities, and hazard information.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/trails/Parks_Recreation_3282175220581128208.csv' AS row

WITH row,
     toInteger(row.OBJECTID_1)        AS oid,
     trim(row.trail_num)              AS trail_num,
     row.trailname                    AS trail_name,
     row.island                       AS island,
     row.district                     AS district,
     toFloat(row.length_mi)           AS length_mi,
     toFloat(row.elev_range)          AS elev_range,
     row.st_access                    AS access_type,
     row.start_pt                     AS start_pt,
     row.end_pt                       AS end_pt,
     row.climate                      AS climate,
     row.tspt_type                    AS transport_type,
     row.features                     AS features,
     row.amenities                    AS amenities,
     row.use_rest                     AS use_restrictions,
     row.hazards                      AS hazards,
     row.nah                          AS na_heritage

WITH oid, trail_num, trail_name, island, district, length_mi, elev_range,
     access_type, start_pt, end_pt, climate, transport_type, features,
     amenities, use_restrictions, hazards, na_heritage,
     "TRL_" + toString(oid)           AS zone_id

MERGE (z:Zone {id: zone_id})
SET z.name              = trail_name,
    z.type              = "trail",
    z.trail_num         = trail_num,
    z.island            = island,
    z.district          = district,
    z.length_mi         = length_mi,
    z.elev_range        = elev_range,
    z.access_type       = access_type,
    z.start_pt          = start_pt,
    z.end_pt            = end_pt,
    z.climate           = climate,
    z.transport_type    = transport_type,
    z.features          = features,
    z.amenities         = amenities,
    z.use_restrictions  = use_restrictions,
    z.hazards           = hazards,
    z.na_heritage       = na_heritage,
    z.data_source       = "DLNR Parks & Recreation Trails",
    z.provenance        = "Hawaii DLNR Division of Forestry and Wildlife trail system",
    z.created_at        = coalesce(z.created_at, datetime()),
    z.updated_at        = datetime();
