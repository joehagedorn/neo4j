// ============================================================================
// Stage C — Link LandCluster zones to their constituent environment sites
//
// This is the first transform that creates inter-zone relationships.
// CONTAINS_SITE links a LandCluster to the individual monitoring/observation
// Zone nodes that belong to it. This is a governance relationship, not a
// spatial primitive — it declares "these sites are managed together."
//
// Prerequisites:
//   - LandCluster Zone nodes created (Stage A)
//   - Environment Zone nodes created (environment/load-environment-zones.cypher)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/land-cluster/LandCluster_Sites.csv' AS row

WITH row,
     trim(row.cluster_id)    AS cluster_id,
     trim(row.site_zone_id)  AS site_zone_id,
     trim(row.site_name)     AS site_name,
     toFloat(row.latitude)   AS lat,
     toFloat(row.longitude)  AS lng

// 1) Match the LandCluster
MATCH (lc:Zone:LandCluster {id: cluster_id})

// 2) MERGE the environment site Zone (creates if not yet loaded from environment transforms)
WITH lc, site_zone_id, site_name, lat, lng
MERGE (site:Zone {id: site_zone_id})
ON CREATE SET site.name       = site_name,
              site.type       = "environment",
              site.latitude   = lat,
              site.longitude  = lng,
              site.created_at = datetime()
SET site.updated_at = datetime()

// 3) Create CONTAINS_SITE relationship
MERGE (lc)-[:CONTAINS_SITE]->(site);
