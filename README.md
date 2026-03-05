# Mokunet Spatial Transforms

ETL pipeline for the mokunet AuraDB spatial backbone. Transforms GeoJSON and CSV source datasets from Hawaii state GIS portals into H3-indexed Zone overlays in Neo4j.

## Quick Start

```bash
# Install dependencies
npm install

# Copy .env template and configure AuraDB credentials
cp .env.example .env   # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

# View all indexed datasets
node index-datasets.mjs

# Re-download a dataset when portal publishes an update
node refresh-dataset.mjs <dataset-id>
```

## Architecture

Every spatial overlay follows a **two-stage pipeline**:

1. **Stage A** — Create Zone nodes from cleaned CSV (`LOAD CSV` + `MERGE`)
2. **Stage B** — Link Zones to the H3 backbone via `IN_ZONE` (area features) or `ANCHORS`/`WITHIN_CELL` (point features)

Generator scripts (`.mjs`) bridge source GeoJSON to H3 cell indices using [h3-js](https://github.com/uber/h3-js).

```
Source GeoJSON  →  generate-*.mjs  →  *_Zones_H3.csv  →  Stage A Cypher  →  AuraDB
(portal data)      (h3-js polyfill)    (H3 cell index)    (LOAD CSV)         (Zone nodes)
                                                          Stage B Cypher  →  (ZoneCell edges)
```

See [AuraDb-dev.md](AuraDb-dev.md) for the full graph ontology, node counts, relationship types, and query examples.

## Dataset Index

Each subdirectory contains a `dataset.json` manifest tracking provenance, freshness, and file roles.

### Inventory

Run `node index-datasets.mjs` to see the current state of all datasets:

```
ID                         Type           Features  Source Present  Tracked  Stale  Frequency
ag-baseline                ag             5024      yes (49.3MB)    no       ok     static
ag-ial                     ag             15        yes (709KB)     yes      ok     on-change
environment                environment    3         yes (1KB)       yes      ok     on-change
highways                   highway        2075      yes (3.7MB)     no       ok     annual
moku                       backbone       33        yes (4.7MB)     yes      ok     static
opportunity                opportunity    25        yes (782KB)     no       ok     static
parks                      park           70        yes (1.2MB)     yes      ok     on-change
planning                   zoning         1965      yes (36.2MB)    no       ok     on-change
post-secondary             postsecondary  85        yes (140KB)     no       ok     annual
rail                       transit        4         yes (659KB)     no       ok     static
reserves                   reserve        376       yes (7.8MB)     no       ok     on-change
schools                    school         288       yes (175KB)     no       ok     annual
stations                   station        21        yes (2KB)       no       ok     static
stewards                   steward        25129     yes (71.3MB)    no       ok     annual
trails                     trail          45        yes (226KB)     yes      ok     on-change
transportation-not-seeded  transit        0         yes (853KB)     no       ok     on-change
wetland                    wetland        4974      yes (33.7MB)    no       ok     on-change
workforce                  career         13        yes (458KB)     no       ok     annual
```

Use `node index-datasets.mjs --markdown` to generate a GitHub-flavored markdown table.

### Refreshing a Dataset

When a source portal publishes an update:

```bash
# 1. Download the updated source file
node refresh-dataset.mjs stewards

# 2. Regenerate H3 cell indices
node stewards/generate-stewards-h3.mjs

# 3. Run Stage A + Stage B Cypher in AuraDB console
#    (or use the driver-based loader if available)
```

The refresh script updates `downloaded_at`, `last_checked`, and `stale` fields in `dataset.json` automatically.

To flag a dataset as stale before refreshing, edit its `dataset.json`:
```json
{ "stale": true }
```

### dataset.json Schema

Each manifest follows the schema defined in [dataset-schema.json](dataset-schema.json). Key fields:

| Field | Description |
|---|---|
| `id` | Unique dataset identifier (matches directory name) |
| `authority.portal_url` | Source portal page for manual verification |
| `authority.update_frequency` | `static`, `annual`, `quarterly`, or `on-change` |
| `downloaded_at` | Date the source file was last downloaded |
| `stale` | `true` when a newer version is known to exist |
| `files.source.download_url` | Direct download URL for re-fetch |
| `files.source.tracked` | Whether the source file is tracked in git |
| `h3_strategy` | `centroid`, `polyfill`, `line-sample`, `point-anchor`, or `none` |

## Directory Structure

```
transforms/
├── dataset-schema.json       # JSON Schema for dataset.json (IDE validation)
├── index-datasets.mjs        # Inventory reporter
├── refresh-dataset.mjs       # Source file download helper
├── db.mjs                    # Neo4j AuraDB connection module
├── AuraDb-dev.md             # Full graph ontology and query reference
│
├── moku/                     # Stage 0: H3 res-8 backbone (33 moku, 19,720 cells)
├── ag/                       # IAL docket designations
│   └── baseline/             # 2015 agricultural land use (5,024 features)
├── environment/              # Monitoring sites (water, soil, air)
├── highways/                 # HPMS road segments (2,075)
├── opportunity/              # Federal Opportunity Zones (25)
├── parks/                    # State parks (70)
├── planning/                 # Honolulu zoning districts (1,965)
├── post-secondary/           # Higher education campuses (85)
├── rail/                     # HART guideway alignment (4 sections)
├── reserves/                 # Conservation reserves (376)
├── schools/                  # Public schools (288)
├── stations/                 # HART rail stations (21)
├── stewards/                 # Government land parcels (25,129)
├── trails/                   # Recreation trails (45)
├── wetland/                  # NWI wetlands - Oahu (4,974)
├── workforce/                # Career pathways (13 clusters, driver-based)
└── transportation_not_seeded/  # Bus stops + bike facilities (not yet integrated)
```

Each data directory contains:
- `dataset.json` — Provenance manifest
- Source data files (`.geojson`, `.csv`, `.json`)
- `generate-*.mjs` — H3 cell generator script
- `*_Zones_H3.csv` — Generated H3 cell indices
- Stage A Cypher — `create-*-zones.cypher`
- Stage B Cypher — `load-*-zone-cells.cypher`

## H3 Resolution Reference

| Resolution | Cell Area | Usage |
|---|---|---|
| res-8 | ~0.74 km² (~183 ac) | Backbone cells, community-level grain |
| res-9 | ~0.10 km² (~26 ac) | Small IAL dockets |
| res-10 | ~0.015 km² (~3.7 ac) | Rail corridor tracing |
| res-14 | ~6.3 m² | Point-feature anchors (schools, stations, campuses, monitoring sites) |

## Git Strategy

- **Tracked**: Cleaned CSVs, H3 CSVs, Cypher scripts, generator scripts, `dataset.json` manifests
- **Not tracked**: Large GeoJSON source files (>5MB), Windows Zone.Identifier artifacts
- **No Git LFS**: Source files are local-only inputs; `dataset.json` records `download_url` for re-fetch

Small GeoJSON files (<5MB) that were previously committed remain tracked for convenience.

## Dependencies

- [h3-js](https://github.com/uber/h3-js) — H3 hexagonal indexing
- [csv-parse](https://csv.js.org/parse/) — CSV parsing
- [neo4j-driver](https://github.com/neo4j/neo4j-javascript-driver) — AuraDB connection
- [dotenv](https://github.com/motdotla/dotenv) — Environment configuration
