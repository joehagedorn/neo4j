// ============================================================================
// Stage A — Create Zone:LandCluster nodes for Community Land Clusters
//
// Creates dual-labeled (:Zone:LandCluster) nodes. Each cluster represents a
// community-defined spatial grouping of monitoring sites, agricultural plots,
// or conservation areas. Unlike IAL, clusters are not legally designated —
// they are self-declared by community stewards and research contributors.
//
// The :Zone label ensures standard backbone traversal (IN_ZONE, USES_TYPE).
// The :LandCluster label enables governance queries specific to clusters.
//
// Prerequisites: None (first stage)
// ============================================================================

LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/joehagedorn/neo4j/main/land-cluster/LandCluster_Zones.csv' AS row

WITH row,
     trim(row.cluster_id)    AS cluster_id,
     trim(row.name)          AS name,
     trim(row.cluster_scope) AS cluster_scope,
     trim(row.governance)    AS governance,
     trim(row.steward_id)    AS steward_id,
     trim(row.status)        AS status,
     trim(row.island)        AS island,
     trim(row.moku_id)       AS moku_id,
     trim(row.description)   AS description,
     row.data_source         AS data_source,
     row.provenance          AS provenance

// 1) Create dual-labeled Zone:LandCluster node
MERGE (z:Zone {id: cluster_id})
SET z:LandCluster,
    z.name           = name,
    z.type           = "land_cluster",
    z.cluster_scope  = cluster_scope,
    z.governance     = governance,
    z.status         = status,
    z.island         = island,
    z.moku_id        = moku_id,
    z.description    = description,
    z.data_source    = data_source,
    z.provenance     = provenance,
    z.created_at     = coalesce(z.created_at, datetime()),
    z.updated_at     = datetime()

// 2) Set steward_id only when provided
WITH z, steward_id
WHERE steward_id IS NOT NULL AND steward_id <> ""
SET z.steward_id = steward_id

// 3) Link to ZoneType vocabulary
WITH z
MERGE (zt:ZoneType {id: "land_cluster"})
ON CREATE SET zt.label = "Community Land Cluster"
MERGE (z)-[:USES_TYPE]->(zt);
