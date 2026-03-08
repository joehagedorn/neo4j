# Land Cluster Zone Overlay — Seeding Guide

This folder implements the **3-stage pattern** for creating community-defined
land clusters and linking them to the H3 spatial backbone.

## What is a LandCluster?

A LandCluster is a community-declared spatial grouping of related sites —
monitoring networks, cooperative farms, conservation areas, or remediation
projects. Unlike IAL (which is state-governed and legally restrictive),
LandClusters are self-declared and flexible:

| | IAL | LandCluster |
|---|---|---|
| **Authority** | State/County legal designation | Community/project self-declared |
| **Boundary** | Official docket shapefiles | Derived from constituent sites |
| **Mutability** | Fixed (legal process to change) | Fluid (sites added/removed) |
| **Purpose** | Protect agricultural land | Organize community activity |

## Architecture

```
(:ZoneCell)-[:WITHIN]->(:Moku)                        <- res-8 backbone (Stage 0, moku/)
(:ZoneCell)-[:IN_ZONE]->(:Zone:LandCluster)            <- overlay link  (Stage B)
(:Zone:LandCluster {type: "land_cluster"})             <- cluster node  (Stage A)
(:Zone:LandCluster)-[:CONTAINS_SITE]->(:Zone {type: "environment"})  <- site link (Stage C)
(:Zone:LandCluster)-[:USES_TYPE]->(:ZoneType {id: "land_cluster"})   <- vocabulary (Stage A)
```

The dual label `:Zone:LandCluster` follows the IAL precedent — standard
backbone traversal via `:Zone`, governance-specific queries via `:LandCluster`.

## Seeding Pattern — 3 Stages

### Stage A — Create LandCluster zone nodes

One dual-labeled `(:Zone:LandCluster)` per cluster. Each captures scope,
governance model, steward, and provenance.

**Naming convention**: `LC_{moku}_{shortname}` (e.g., `LC_ewa_keehi-lagoon`)

### Stage B — Link clusters to res-8 ZoneCells via IN_ZONE

Coverage is **derived bottom-up** from constituent site coordinates.
The H3 generator maps each site to its parent res-8 backbone cell.
No new ZoneCells are created — only existing backbone cells are linked.

### Stage C — Link clusters to environment site zones via CONTAINS_SITE

This is the first transform that creates **inter-zone relationships**.
`CONTAINS_SITE` declares governance membership: "these monitoring sites
are managed together as a cluster."

## H3 Strategy

LandCluster coverage uses the **site-centroid approach**:

1. Each constituent site's lat/lng is mapped to its parent res-8 cell
2. Duplicate cells are removed (multiple sites in one cell = one link)
3. The unique set of res-8 cells = the cluster's spatial footprint
4. Coverage grows organically as new sites are added

## Files

| File | Purpose |
|------|---------|
| `LandCluster_Zones.csv` | Source: cluster definitions |
| `LandCluster_Sites.csv` | Source: cluster-to-site membership with coordinates |
| `LandCluster_Zones_H3.csv` | Generated: res-8 cell coverage (run generator first) |
| `create-land-cluster-zones.cypher` | Stage A — create Zone:LandCluster nodes |
| `load-land-cluster-zone-cells.cypher` | Stage B — link to backbone ZoneCells |
| `link-cluster-sites.cypher` | Stage C — create CONTAINS_SITE edges |
| `generate-land-cluster-h3.mjs` | Generates res-8 coverage from site coordinates |

## Execution Order

1. Run `node land-cluster/generate-land-cluster-h3.mjs` to produce `LandCluster_Zones_H3.csv`
2. Stage A: `create-land-cluster-zones.cypher`
3. Stage B: `load-land-cluster-zone-cells.cypher`
4. Stage C: `link-cluster-sites.cypher`

**Prerequisites**: Moku backbone (moku/) and environment zones (environment/) must be loaded first.

## Cluster Scope Values

| Scope | Description |
|-------|-------------|
| `monitoring` | Environmental sample collection network |
| `agricultural` | Community farm, cooperative, or garden cluster |
| `remediation` | Soil/water cleanup project area |
| `conservation` | Habitat or species protection zone |
| `mixed` | Multiple activities in same area |

## Governance Values

| Governance | Description |
|------------|-------------|
| `community` | Managed by community steward(s) |
| `cooperative` | Formal cooperative structure |
| `institutional` | University, agency, or NGO managed |
| `partner` | External partner organization |

## Adding New Clusters

1. Add rows to `LandCluster_Zones.csv` (one per cluster)
2. Add rows to `LandCluster_Sites.csv` (one per site within a cluster)
3. Re-run the H3 generator
4. Re-run Stages A, B, C (all use MERGE — safe to re-run)
