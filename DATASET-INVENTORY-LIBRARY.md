# Mokunet Spatial Transforms — Dataset Inventory Library

Complete provenance, pipeline, and graph-relation reference for every inventoried dataset in the transforms workspace. Designed to support automated agent-based periodical update checks and notification systems.

**Generated**: 2026-03-05
**Total datasets**: 18 (17 active + 1 not seeded)
**Graph totals**: ~40,103 Zone nodes, 19,720 ZoneCells, 392 IntraZones, 14 ZoneTypes

---

## Table of Contents

1. [Pipeline Architecture](#pipeline-architecture)
2. [H3 Strategy Reference](#h3-strategy-reference)
3. [Dataset Quick Reference](#dataset-quick-reference)
4. [Stage 0: moku — H3 Backbone](#stage-0-moku--h3-backbone)
5. [ag-ial — Important Agricultural Lands](#ag-ial--important-agricultural-lands)
6. [ag-baseline — Agricultural Land Use 2015](#ag-baseline--agricultural-land-use-2015)
7. [planning — Honolulu Zoning](#planning--honolulu-zoning)
8. [reserves — Conservation Reserves](#reserves--conservation-reserves)
9. [opportunity — Federal Opportunity Zones](#opportunity--federal-opportunity-zones)
10. [parks — State Parks](#parks--state-parks)
11. [highways — HPMS Road Segments](#highways--hpms-road-segments)
12. [stewards — Government Land Ownership](#stewards--government-land-ownership)
13. [wetland — NWI Wetlands (Oahu)](#wetland--nwi-wetlands-oahu)
14. [trails — Recreation Trails](#trails--recreation-trails)
15. [rail — HART Guideway Alignment](#rail--hart-guideway-alignment)
16. [schools — Public Schools](#schools--public-schools)
17. [post-secondary — Higher Education Campuses](#post-secondary--higher-education-campuses)
18. [stations — HART Rail Stations](#stations--hart-rail-stations)
19. [environment — Monitoring Sites](#environment--monitoring-sites)
20. [workforce — Career Pathways](#workforce--career-pathways)
21. [transportation-not-seeded — Bus/Bike (Pending)](#transportation-not-seeded--busbike-pending)
22. [Agent Update Check Protocol](#agent-update-check-protocol)

---

## Pipeline Architecture

Every spatial overlay follows a **two-stage pipeline** with an optional H3 generator:

```
Source Data  →  generate-*.mjs  →  *_Zones_H3.csv  →  Stage A Cypher  →  AuraDB
(GeoJSON/CSV)   (h3-js indexing)    (H3 cell index)    (MERGE Zone nodes)
                                                        Stage B Cypher  →  (Zone↔ZoneCell edges)
```

- **Stage A**: Creates `Zone` nodes with domain properties via `LOAD CSV` + `MERGE`
- **Stage B**: Links Zones to the H3 backbone via relationships (`IN_ZONE`, `ANCHORS`, `WITHIN_CELL`)
- **All writes are idempotent** — `MERGE` on `Zone.id` means re-running updates rather than duplicates
- **CSVs hosted at**: `https://raw.githubusercontent.com/joehagedorn/neo4j/main/`

---

## H3 Strategy Reference

| Strategy                | Resolution                      | Creates New Cells?     | Edge Pattern                                               | Used By                                                                                  |
| ----------------------- | ------------------------------- | ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **polyfill**            | res-8 (backbone), res-8/9 (IAL) | Yes                    | `ZoneCell→IN_ZONE→Zone`, `ZoneCell→WITHIN→Moku`            | moku, ag-ial                                                                             |
| **centroid**            | res-8                           | No (links to backbone) | `ZoneCell→IN_ZONE→Zone`                                    | ag-baseline, planning, reserves, opportunity, parks, highways, stewards, wetland, trails |
| **line-sample**         | res-10                          | Yes                    | `ZoneCell→IN_ZONE→Zone`, `ZoneCell→WITHIN→Moku`            | rail                                                                                     |
| **point-anchor**        | res-14                          | No (creates IntraZone) | `IntraZone→ANCHORS→Zone`, `IntraZone→WITHIN_CELL→ZoneCell` | schools, post-secondary, stations, environment                                           |
| **none** (driver-based) | N/A                             | No                     | Semantic edges only (knowledge graph)                      | workforce                                                                                |

Resolution reference: res-8 ~183 ac, res-9 ~26 ac, res-10 ~3.7 ac, res-14 ~6.3 m²

---

## Dataset Quick Reference

| ID                        | ZoneType      | Features | H3 Strategy  | Frequency | Coverage    | Prefix  | Graph Nodes                                                                                 |
| ------------------------- | ------------- | -------- | ------------ | --------- | ----------- | ------- | ------------------------------------------------------------------------------------------- |
| moku                      | backbone      | 33       | polyfill     | static    | statewide   | —       | 33 Moku + 19,720 ZoneCell                                                                   |
| ag-ial                    | ag            | 15       | polyfill     | on-change | statewide   | `IAL_`  | 15 Zone + 694 :IAL ZoneCell                                                                 |
| ag-baseline               | ag            | 5,024    | centroid     | static    | statewide   | `ALU_`  | 5,039 Zone                                                                                  |
| planning                  | zoning        | 1,965    | centroid     | on-change | oahu-only   | `HNL_`  | 1,965 Zone                                                                                  |
| reserves                  | reserve       | 376      | centroid     | on-change | statewide   | `RES_`  | 376 Zone                                                                                    |
| opportunity               | opportunity   | 25       | centroid     | static    | statewide   | `OZ_`   | 25 Zone                                                                                     |
| parks                     | park          | 70       | centroid     | on-change | statewide   | `PRK_`  | 70 Zone                                                                                     |
| highways                  | highway       | 2,075    | centroid     | annual    | statewide   | `HWY_`  | 2,075 Zone                                                                                  |
| stewards                  | steward       | 25,129   | centroid     | annual    | statewide   | `GOV_`  | 25,129 Zone                                                                                 |
| wetland                   | wetland       | 4,974    | centroid     | on-change | oahu-only   | `WET_`  | 4,974 Zone                                                                                  |
| trails                    | trail         | 45       | centroid     | on-change | statewide   | `TRL_`  | 45 Zone                                                                                     |
| rail                      | transit       | 4        | line-sample  | static    | oahu-only   | `RAIL_` | 4 Zone + 234 ZoneCell(res-10)                                                               |
| schools                   | school        | 288      | point-anchor | annual    | statewide   | `SCH_`  | 292 :Zone:PublicSchool + 291 IntraZone                                                      |
| post-secondary            | postsecondary | 85       | point-anchor | annual    | statewide   | `UNI_`  | 85 Zone + 77 IntraZone                                                                      |
| stations                  | station       | 21       | point-anchor | static    | oahu-only   | `STA_`  | 21 Zone + 21 IntraZone + 1 TransitCorridor                                                  |
| environment               | environment   | 3        | point-anchor | on-change | moku-scoped | `ENV_`  | 3 Zone + 3 IntraZone                                                                        |
| workforce                 | career        | 13       | none         | annual    | statewide   | —       | 13 CareerPathway + 47 ProgramOfStudy + 280 Occupation + 366 TrainingProgram + 47 Credential |
| transportation-not-seeded | transit       | 0        | none         | on-change | oahu-only   | —       | Not integrated                                                                              |

---

## Stage 0: moku — H3 Backbone

### Source & Provenance

| Field                | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| **Authority**        | Office of Hawaiian Affairs / Hawaii Statewide GIS Program |
| **Portal**           | `geoportal.hawaii.gov/datasets/moku-districts`            |
| **License**          | public-domain                                             |
| **Source vintage**   | 2024                                                      |
| **Downloaded**       | 2026-02-21                                                |
| **Update frequency** | static                                                    |
| **Coverage**         | Statewide — 7 islands, 33 moku                            |

### Description

The foundational spatial layer. 33 traditional Hawaiian moku governance regions are polyfilled to **19,720 H3 res-8 ZoneCells** (~183 acres per cell). Every other dataset in the graph attaches to this backbone.

### Pipeline

| Step     | File                           | Purpose                                        |
| -------- | ------------------------------ | ---------------------------------------------- |
| Generate | `moku/generate-zone-cells.mjs` | Polyfills 33 moku polygons into res-8 H3 cells |
| Stage B  | `moku/load-zone-cells.cypher`  | Creates `ZoneCell` nodes + `WITHIN→Moku` edges |
| Loader   | `moku/load-zone-cells.mjs`     | Driver-based alternative to LOAD CSV           |

### Graph Relations

```
(:Moku {id, name, island})
  ↑ :WITHIN
(:ZoneCell {h3_cell, resolution: 8, source: "zonecell_csv_seed_2026"})
```

### Zone Node Properties

```
Moku: { id: "oahu-kona", name: "Kona", island: "oahu" }
ZoneCell: { h3_cell: "8828a10061fffff", resolution: 8, source, created_at, updated_at }
```

### Key Files

| File                      | Format | Rows   | Git Tracked |
| ------------------------- | ------ | ------ | ----------- |
| `moku_districts_rows.csv` | CSV    | 33     | yes         |
| `moku.csv`                | CSV    | 33     | yes         |
| `ZoneCell.csv`            | CSV    | 19,720 | yes         |

---

## ag-ial — Important Agricultural Lands

### Source & Provenance

| Field                | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| **Authority**        | Hawaii Land Use Commission                                   |
| **Portal**           | `geoportal.hawaii.gov/datasets/important-agricultural-lands` |
| **License**          | public-domain                                                |
| **Source vintage**   | 2024                                                         |
| **Downloaded**       | 2026-02-22                                                   |
| **Update frequency** | on-change                                                    |
| **Coverage**         | Statewide — Hawai'i, Kaua'i, Maui, O'ahu, Moloka'i           |

### Description

15 IAL docket designations — large agricultural parcels protected under Hawaii Act 183. Uses **polyfill strategy** at res-8, creating new ZoneCells with the `:IAL` label. This is the only dataset that creates dual-labeled cells, enabling `MATCH (n:IAL)` queries.

### Pipeline

| Step     | File                                           | Purpose                                                           |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Generate | `ag/generate-ial-h3-multires.mjs`              | Polyfills IAL docket polygons at res-8 (+ legacy res-9)           |
| Stage A  | `ag/Minimal_Cypher_to_create_IAL_Zones.cypher` | Creates 15 Zone nodes (`IAL_{docket_no}`) with `ial: true` flag   |
| Stage B  | `ag/load-zone-cells-res8.cypher`               | Creates `:IAL`-labeled ZoneCells + `IN_ZONE→Zone` + `WITHIN→Moku` |

### Graph Relations

```
(:Zone {id: "IAL_A05-786", type: "ag", ial: true})
  ↑ :IN_ZONE
(:ZoneCell:IAL {h3_cell, resolution: 8, source: "ial_res8_polyfill_2026"})
  ↓ :WITHIN
(:Moku)
```

**Unique behavior**: Stage B creates **new** ZoneCells (not just linking to backbone) and stamps them with the `:IAL` label. 694 IAL-labeled cells across the state.

### Zone Node Properties

```cypher
Zone: {
  id: "IAL_A05-786",
  name: "IAL A05-786",
  type: "ag",
  ial: true,
  docket_no: "A05-786",
  acres: Float,
  area_m2: Float,
  perimeter_m: Float,
  data_source: "IAL shapefile / docket registry",
  provenance: "IAL docket-based designation; see docket_no"
}
```

### Key Files

| File                                         | Format  | Rows | Git Tracked |
| -------------------------------------------- | ------- | ---- | ----------- |
| `Important_Agricultural_Lands_(IAL).geojson` | GeoJSON | 15   | yes         |
| `Important_Agricultural_Lands_(IAL).csv`     | CSV     | 15   | yes         |
| `IAL_Zones_H3_res8.csv`                      | CSV     | 694  | yes         |

---

## ag-baseline — Agricultural Land Use 2015

### Source & Provenance

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **Authority**        | Hawaii Department of Agriculture                                       |
| **Portal**           | `geoportal.hawaii.gov/datasets/agricultural-land-use-2015-baseline`    |
| **License**          | public-domain                                                          |
| **Source vintage**   | 2015                                                                   |
| **Downloaded**       | 2026-01-15                                                             |
| **Update frequency** | static                                                                 |
| **Coverage**         | Statewide — 6 islands (Hawai'i, Kaua'i, Maui, O'ahu, Moloka'i, Lana'i) |

### Description

5,024 crop features from the 2015 HDOA agricultural land use baseline survey covering 15 crop categories with acreage, area, and perimeter data per feature.

### Pipeline

| Step     | File                                          | Purpose                                                                  |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Generate | `ag/baseline/generate-baseline-h3.mjs`        | Computes polygon centroid, maps to res-8 via `latLngToCell(lat, lng, 8)` |
| Stage A  | `ag/baseline/create-baseline-zones.cypher`    | Creates 5,024 Zone nodes (`ALU_{objectid}`)                              |
| Stage B  | `ag/baseline/load-baseline-zone-cells.cypher` | Links existing backbone ZoneCells to Zones via `IN_ZONE`                 |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "ag", id: "ALU_*"})
```

No new ZoneCells created — centroid links to existing res-8 backbone. ~1,826 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "ALU_1234",
  name: "Sugarcane (oahu #1234)",
  type: "ag",
  crop_category: "Sugarcane",
  island: "oahu",
  acres: Float,
  area_m2: Float,
  perimeter_m: Float,
  data_source: "Agricultural Land Use 2015 Baseline",
  provenance: "Hawaii Statewide GIS, 2015 baseline survey"
}
```

### Key Files

| File                                            | Format  | Rows  | Git Tracked |
| ----------------------------------------------- | ------- | ----- | ----------- |
| `Agricultural_Land_Use_-_2015_Baseline.geojson` | GeoJSON | 5,024 | no (50MB)   |
| `Agricultural_Land_Use_-_2015_Baseline.csv`     | CSV     | 5,024 | yes         |
| `ALU_Zones_H3.csv`                              | CSV     | 5,024 | yes         |

---

## planning — Honolulu Zoning

### Source & Provenance

| Field                | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| **Authority**        | City and County of Honolulu - Dept of Planning and Permitting      |
| **Portal**           | `geoportal.hawaii.gov/datasets/zoning-city-and-county-of-honolulu` |
| **License**          | public-domain                                                      |
| **Source vintage**   | 2024                                                               |
| **Downloaded**       | 2026-02-22                                                         |
| **Update frequency** | on-change                                                          |
| **Coverage**         | Oahu only                                                          |

### Description

1,965 zoning district polygons for Oahu. Zone classes (residential, commercial, industrial, agricultural, etc.) with area metrics.

### Pipeline

| Step     | File                                     | Purpose                                     |
| -------- | ---------------------------------------- | ------------------------------------------- |
| Generate | `planning/generate-zoning-h3.mjs`        | Centroid to res-8                           |
| Stage A  | `planning/create-zoning-zones.cypher`    | Creates 1,965 Zone nodes (`HNL_{objectid}`) |
| Stage B  | `planning/load-zoning-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`      |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "zoning", id: "HNL_*"})
```

559 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "HNL_42",
  name: "Residential (#42)",
  type: "zoning",
  zone_class: "R-5",
  island: "oahu",
  area_m2: Float,
  perimeter_m: Float,
  data_source: "City and County of Honolulu Zoning 2023"
}
```

### Key Files

| File                                           | Format  | Rows  | Git Tracked |
| ---------------------------------------------- | ------- | ----- | ----------- |
| `Zoning_(City_and_County_of_Honolulu).geojson` | GeoJSON | 1,965 | no (37MB)   |
| `Zoning_(City_and_County_of_Honolulu).csv`     | CSV     | 1,965 | yes         |
| `HNL_Zones_H3.csv`                             | CSV     | 1,965 | yes         |

---

## reserves — Conservation Reserves

### Source & Provenance

| Field                | Value                                     |
| -------------------- | ----------------------------------------- |
| **Authority**        | Hawaii Dept of Land and Natural Resources |
| **Portal**           | `geoportal.hawaii.gov/datasets/reserves`  |
| **License**          | public-domain                             |
| **Source vintage**   | 2024                                      |
| **Downloaded**       | 2026-02-22                                |
| **Update frequency** | on-change                                 |
| **Coverage**         | Statewide — 6 islands                     |

### Description

376 conservation reserves, natural area reserves, wildlife refuges, and forest reserves. Captures reserve type, managing agency, acreage, and UID.

### Pipeline

| Step     | File                                       | Purpose                                   |
| -------- | ------------------------------------------ | ----------------------------------------- |
| Generate | `reserves/generate-reserves-h3.mjs`        | Centroid to res-8                         |
| Stage A  | `reserves/create-reserves-zones.cypher`    | Creates 376 Zone nodes (`RES_{objectid}`) |
| Stage B  | `reserves/load-reserves-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`    |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "reserve", id: "RES_*"})
```

310 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "RES_55",
  name: "Kaena Point Natural Area Reserve",
  type: "reserve",
  reserve_type: "Natural Area Reserve",
  type_definition: String,
  reserve_uid: String,
  managed_by: "DLNR",
  island: "oahu",
  acres: Float,
  area_m2: Float,
  perimeter_m: Float,
  data_source: "DLNR Hawaii Reserves"
}
```

### Key Files

| File               | Format  | Rows | Git Tracked |
| ------------------ | ------- | ---- | ----------- |
| `Reserves.geojson` | GeoJSON | 376  | no (7.9MB)  |
| `Reserves.csv`     | CSV     | 376  | no          |
| `RES_Zones_H3.csv` | CSV     | 376  | yes         |

---

## opportunity — Federal Opportunity Zones

### Source & Provenance

| Field                | Value                                             |
| -------------------- | ------------------------------------------------- |
| **Authority**        | U.S. Dept of the Treasury / CDFI Fund             |
| **Portal**           | `geoportal.hawaii.gov/datasets/opportunity-zones` |
| **License**          | public-domain                                     |
| **Source vintage**   | 2018                                              |
| **Downloaded**       | 2026-02-22                                        |
| **Update frequency** | static                                            |
| **Coverage**         | Statewide — Hawai'i, Kaua'i, Maui, O'ahu          |

### Description

25 designated federal Opportunity Zone census tracts. Captures tract number, name, rationale, and area metrics. Acres are derived from `area_m2 / 4046.86`.

### Pipeline

| Step     | File                                             | Purpose                                 |
| -------- | ------------------------------------------------ | --------------------------------------- |
| Generate | `opportunity/generate-opportunity-h3.mjs`        | Centroid to res-8                       |
| Stage A  | `opportunity/create-opportunity-zones.cypher`    | Creates 25 Zone nodes (`OZ_{objectid}`) |
| Stage B  | `opportunity/load-opportunity-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`  |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "opportunity", id: "OZ_*"})
```

22 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "OZ_3",
  name: "Kalihi (Tract 15008004200)",
  type: "opportunity",
  tract_no: "15008004200",
  rationale: String,
  acres: Float,
  area_m2: Float,
  perimeter_m: Float,
  data_source: "Hawaii Opportunity Zones"
}
```

### Key Files

| File                        | Format  | Rows | Git Tracked |
| --------------------------- | ------- | ---- | ----------- |
| `Opportunity_Zones.geojson` | GeoJSON | 25   | no          |
| `Opportunity_Zones.csv`     | CSV     | 25   | yes         |
| `OZ_Zones_H3.csv`           | CSV     | 25   | yes         |

---

## parks — State Parks

### Source & Provenance

| Field                | Value                                       |
| -------------------- | ------------------------------------------- |
| **Authority**        | Hawaii Dept of Land and Natural Resources   |
| **Portal**           | `geoportal.hawaii.gov/datasets/state-parks` |
| **License**          | public-domain                               |
| **Source vintage**   | 2024                                        |
| **Downloaded**       | 2026-02-23                                  |
| **Update frequency** | on-change                                   |
| **Coverage**         | Statewide — 6 islands                       |

### Description

70 state park features including natural area reserves, historic sites, recreation areas, and monuments. Captures park type, managing agency, and acreage.

### Pipeline

| Step     | File                                 | Purpose                                  |
| -------- | ------------------------------------ | ---------------------------------------- |
| Generate | `parks/generate-parks-h3.mjs`        | Centroid to res-8                        |
| Stage A  | `parks/create-parks-zones.cypher`    | Creates 70 Zone nodes (`PRK_{objectid}`) |
| Stage B  | `parks/load-parks-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`   |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "park", id: "PRK_*"})
```

### Zone Node Properties

```cypher
Zone: {
  id: "PRK_12",
  name: "Diamond Head State Monument",
  type: "park",
  park_type: "Monument",
  type_definition: String,
  managed_by: "DLNR",
  island: "oahu",
  acres: Float,
  area_m2: Float,
  perimeter_m: Float,
  data_source: "DLNR Hawaii State Parks"
}
```

### Key Files

| File                  | Format  | Rows | Git Tracked |
| --------------------- | ------- | ---- | ----------- |
| `State_Parks.geojson` | GeoJSON | 70   | yes (1.2MB) |
| `State_Parks.csv`     | CSV     | 70   | yes         |
| `PRK_Zones_H3.csv`    | CSV     | 70   | yes         |

---

## highways — HPMS Road Segments

### Source & Provenance

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Authority**        | Hawaii Dept of Transportation                                                          |
| **Portal**           | `geoportal.hawaii.gov/datasets/highway-performance-monitoring-system-roads-for-hawaii` |
| **License**          | public-domain                                                                          |
| **Source vintage**   | 2023                                                                                   |
| **Downloaded**       | 2026-02-22                                                                             |
| **Update frequency** | annual                                                                                 |
| **Coverage**         | Statewide — 6 islands                                                                  |

### Description

2,075 road segments with AADT traffic counts, functional system classification, facility type, ownership, lane count, and segment length. Uses **midpoint** (centroid of LineString) for H3 mapping.

### Pipeline

| Step     | File                                       | Purpose                                     |
| -------- | ------------------------------------------ | ------------------------------------------- |
| Generate | `highways/generate-highways-h3.mjs`        | Midpoint of LineString to res-8             |
| Stage A  | `highways/create-highways-zones.cypher`    | Creates 2,075 Zone nodes (`HWY_{objectid}`) |
| Stage B  | `highways/load-highways-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`      |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "highway", id: "HWY_*"})
```

835 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "HWY_101",
  name: "Kamehameha Hwy (MP 12.5-13.1)",
  type: "highway",
  route_name: "Kamehameha Hwy",
  route_id: Integer,
  island: "oahu",
  bmp: Float,       // begin milepost
  emp: Float,       // end milepost
  functional_system: "Minor Arterial",
  facility_type: "Two-Lane Highway",
  ownership: "State",
  aadt: 15000,      // annual average daily traffic
  through_lanes: 2,
  length_m: Float,
  data_source: "HPMS Roads for Hawaii 2024"
}
```

### Key Files

| File                                                                    | Format  | Rows  | Git Tracked |
| ----------------------------------------------------------------------- | ------- | ----- | ----------- |
| `Highway_Performance_Monitoring_System_Roads_for_Hawaii_(HPMS).geojson` | GeoJSON | 2,075 | no (3.7MB)  |
| `Highway_Performance_Monitoring_System_Roads_for_Hawaii_(HPMS).csv`     | CSV     | 2,075 | yes         |
| `HWY_Zones_H3.csv`                                                      | CSV     | 2,075 | yes         |

---

## stewards — Government Land Ownership

### Source & Provenance

| Field                | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| **Authority**        | Hawaii Office of Planning and Sustainable Development              |
| **Portal**           | `geoportal.hawaii.gov/datasets/government-land-ownership-detailed` |
| **License**          | public-domain                                                      |
| **Source vintage**   | 2024                                                               |
| **Downloaded**       | 2026-02-22                                                         |
| **Update frequency** | annual                                                             |
| **Coverage**         | Statewide — 6 islands                                              |

### Description

25,129 government-owned land parcels — the **largest overlay** by feature count. Captures TMK, owner, ownership type, major owner, and acreage. Critical for land tenure governance and stewardship tracking.

### Pipeline

| Step     | File                                       | Purpose                                      |
| -------- | ------------------------------------------ | -------------------------------------------- |
| Generate | `stewards/generate-stewards-h3.mjs`        | Centroid to res-8                            |
| Stage A  | `stewards/create-stewards-zones.cypher`    | Creates 25,129 Zone nodes (`GOV_{objectid}`) |
| Stage B  | `stewards/load-stewards-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`       |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "steward", id: "GOV_*"})
```

3,297 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "GOV_8001",
  name: "State of Hawaii (TMK 1-2-003:045)",
  type: "steward",
  tmk: "1-2-003:045",
  island: "oahu",
  owner: "State of Hawaii",
  owned_by: "Department of Education",
  major_owner: "State",
  ownership_type: "Fee Simple",
  acres: Float,
  area_m2: Float,
  perimeter_m: Float,
  data_source: "Government Land Ownership - Detailed"
}
```

### Key Files

| File                                           | Format  | Rows   | Git Tracked |
| ---------------------------------------------- | ------- | ------ | ----------- |
| `Government_Land_Ownership_-_Detailed.geojson` | GeoJSON | 25,129 | no (72MB)   |
| `Government_Land_Ownership_-_Detailed.csv`     | CSV     | 25,129 | no          |
| `GOV_Zones_H3.csv`                             | CSV     | 25,129 | yes         |

---

## wetland — NWI Wetlands (Oahu)

### Source & Provenance

| Field                | Value                                    |
| -------------------- | ---------------------------------------- |
| **Authority**        | U.S. Fish and Wildlife Service           |
| **Portal**           | `geoportal.hawaii.gov/datasets/wetlands` |
| **License**          | public-domain                            |
| **Source vintage**   | 2024                                     |
| **Downloaded**       | 2026-01-25                               |
| **Update frequency** | on-change                                |
| **Coverage**         | Oahu only                                |

### Description

4,974 wetland features from the National Wetlands Inventory. 7 wetland types: Estuarine/Marine Wetland (1,340), Riverine (1,057), Freshwater Emergent (875), Freshwater Pond (707), Freshwater Forested/Shrub (687), Estuarine/Marine Deepwater (298), Lake (10).

**Unique pipeline detail**: Has an additional `extract-wetland-csv.mjs` script that extracts clean CSV from the source GeoJSON before H3 generation. Also has a driver-based `seed-wetlands.mjs` loader.

### Pipeline

| Step     | File                                     | Purpose                                                                           |
| -------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Extract  | `wetland/extract-wetland-csv.mjs`        | GeoJSON → clean CSV                                                               |
| Generate | `wetland/generate-wetland-h3.mjs`        | Centroid to res-8                                                                 |
| Stage A  | `wetland/create-wetland-zones.cypher`    | Creates ZoneType `wetland` + 4,974 Zone nodes (`WET_{objectid}`) with `USES_TYPE` |
| Stage B  | `wetland/load-wetland-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`                                            |
| Loader   | `wetland/seed-wetlands.mjs`              | Driver-based alternative                                                          |

### Graph Relations

```
(:ZoneType {id: "wetland", label: "Wetland / Hydrography"})
  ↑ :USES_TYPE
(:Zone {type: "wetland", id: "WET_*"})
  ↑ :IN_ZONE
(:ZoneCell) → :WITHIN → (:Moku)
```

1,206 unique backbone cells linked.

### Zone Node Properties

```cypher
Zone: {
  id: "WET_500",
  name: "Freshwater Pond (PUBHh)",
  type: "wetland",
  nwi_attribute: "PUBHh",
  wetland_type: "Freshwater Pond",
  fid_hi_wetlands: Integer,
  acres: Float,
  island: "oahu",
  status: String,
  data_source: "NWI (National Wetlands Inventory)"
}
```

### Key Files

| File                                       | Format  | Rows  | Git Tracked |
| ------------------------------------------ | ------- | ----- | ----------- |
| `Hydrography_-2481727552189753624.geojson` | GeoJSON | 4,974 | no (34MB)   |
| `Wetlands.csv`                             | CSV     | 4,974 | yes         |
| `WET_Zones_H3.csv`                         | CSV     | 4,974 | yes         |

---

## trails — Recreation Trails

### Source & Provenance

| Field                | Value                                            |
| -------------------- | ------------------------------------------------ |
| **Authority**        | Hawaii DLNR - Na Ala Hele                        |
| **Portal**           | `geoportal.hawaii.gov/datasets/parks-recreation` |
| **License**          | public-domain                                    |
| **Source vintage**   | 2024                                             |
| **Downloaded**       | 2026-02-23                                       |
| **Update frequency** | on-change                                        |
| **Coverage**         | Statewide — Hawai'i, Kaua'i, Maui, O'ahu         |

### Description

45 hiking and recreation trails with distance, elevation range, access type, climate, amenities, hazard, and cultural heritage data. Uses midpoint of LineString for centroid mapping.

### Pipeline

| Step     | File                                   | Purpose                                  |
| -------- | -------------------------------------- | ---------------------------------------- |
| Generate | `trails/generate-trails-h3.mjs`        | Midpoint to res-8                        |
| Stage A  | `trails/create-trails-zones.cypher`    | Creates 45 Zone nodes (`TRL_{objectid}`) |
| Stage B  | `trails/load-trails-zone-cells.cypher` | Links backbone ZoneCells via `IN_ZONE`   |

### Graph Relations

```
(:Moku) ← :WITHIN ← (:ZoneCell) -[:IN_ZONE]-> (:Zone {type: "trail", id: "TRL_*"})
```

### Zone Node Properties

```cypher
Zone: {
  id: "TRL_7",
  name: "Aiea Loop Trail",
  type: "trail",
  trail_num: "T-12",
  island: "oahu",
  district: "Kona",
  length_mi: 4.8,
  elev_range: 1200.0,
  access_type: "Unrestricted",
  start_pt: "Aiea Heights Dr",
  end_pt: "Same (loop)",
  climate: "Tropical/Moderate",
  transport_type: "Hiking",
  features: "Native forest, views",
  amenities: "Parking, restroom",
  use_restrictions: String,
  hazards: "Steep dropoffs",
  na_heritage: String,
  data_source: "DLNR Parks & Recreation Trails"
}
```

### Key Files

| File                                            | Format  | Rows | Git Tracked |
| ----------------------------------------------- | ------- | ---- | ----------- |
| `Parks_Recreation_-4303987071572082682.geojson` | GeoJSON | 45   | yes (226KB) |
| `Parks_Recreation_3282175220581128208.csv`      | CSV     | 45   | yes         |
| `TRL_Zones_H3.csv`                              | CSV     | 45   | yes         |

---

## rail — HART Guideway Alignment

### Source & Provenance

| Field                | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| **Authority**        | Honolulu Authority for Rapid Transportation (HART)           |
| **Portal**           | `geoportal.hawaii.gov/datasets/hart-guideway-alignment-line` |
| **License**          | public-domain                                                |
| **Source vintage**   | 2024                                                         |
| **Downloaded**       | 2026-02-22                                                   |
| **Update frequency** | static                                                       |
| **Coverage**         | Oahu only — 20-mile elevated corridor                        |

### Description

4 HART rail guideway center alignment sections. The **only dataset using line-sample strategy** — walks LineString coordinates at res-10 (~3.7 acres) to trace the rail corridor with high spatial fidelity. Creates **new ZoneCells** at res-10 (not just linking to backbone).

### Pipeline

| Step     | File                               | Purpose                                                                 |
| -------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Generate | `rail/generate-rail-h3.mjs`        | Line-samples LineString coordinates at res-10                           |
| Stage A  | `rail/create-rail-zones.cypher`    | Creates 4 Zone nodes (`RAIL_{objectid}`) filtered to "Center Alignment" |
| Stage B  | `rail/load-rail-zone-cells.cypher` | Creates 234 res-10 ZoneCells + `IN_ZONE→Zone` + `WITHIN→Moku`           |

### Graph Relations

```
(:Zone {type: "transit", id: "RAIL_*"})
  ↑ :IN_ZONE
(:ZoneCell {resolution: 10, source: "hart_rail_res10_linesample_2026"})
  ↓ :WITHIN
(:Moku)
```

234 res-10 ZoneCells created tracing the corridor.

### Zone Node Properties

```cypher
Zone: {
  id: "RAIL_1",
  name: "HART Section A",
  type: "transit",
  section: "Section A",
  alignment: "Center Alignment",
  length_ft: Float,
  length_mi: Float,
  island: "oahu",
  data_source: "HART Guideway Alignment Line PUBLIC"
}
```

### Key Files

| File                                            | Format  | Rows | Git Tracked |
| ----------------------------------------------- | ------- | ---- | ----------- |
| `HART_Guideway_Alignment_Line_PUBLIC_*.geojson` | GeoJSON | 4    | no          |
| `HART_Guideway_Alignment_Line_PUBLIC_*.csv`     | CSV     | 4    | yes         |
| `RAIL_Zones_H3.csv`                             | CSV     | 234  | yes         |

---

## schools — Public Schools

### Source & Provenance

| Field                | Value                                          |
| -------------------- | ---------------------------------------------- |
| **Authority**        | Hawaii Dept of Education                       |
| **Portal**           | `geoportal.hawaii.gov/datasets/public-schools` |
| **License**          | public-domain                                  |
| **Source vintage**   | 2024                                           |
| **Downloaded**       | 2026-02-23                                     |
| **Update frequency** | annual                                         |
| **Coverage**         | Statewide — 6 islands                          |

### Description

~288 public schools as dual-labeled `(:Zone:PublicSchool)` nodes. Each school is a potential food hub facility for facilities planning. Uses the **IntraZone point-anchor pattern** — each school's Point coordinate maps to a res-14 H3 cell (~6.3 m²), then bridges to the res-8 backbone via `WITHIN_CELL`. The `:PublicSchool` label enables typed queries, vector search (768-dim VertexAI embeddings), and supply-chain integration (`DISTRIBUTES_TO`, `HOSTS_AT`).

**Dual-label pattern**: Follows the same structural pattern as `(:ZoneCell:IAL)` and `(:Zone:LandCluster)` — standard backbone traversal via `:Zone`, typed queries via `:PublicSchool`.

### Pipeline

| Step      | File                                               | Purpose                                                                                    |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Generate  | `schools/generate-schools-h3.mjs`                  | `latLngToCell(lat, lng, 14)` + `cellToParent(h3, 8)`                                      |
| Stage A   | `schools/create-schools-zones.cypher`               | Creates 292 dual-labeled `Zone:PublicSchool` nodes (`SCH_{objectid}`) + ZoneType `school`  |
| Stage B   | `schools/load-schools-zone-cells.cypher`            | Creates 291 IntraZone nodes + `ANCHORS→Zone` + `WITHIN_CELL→ZoneCell`                     |
| Migration | `schools/migrate-publicschool-to-dual-label.cypher` | Merges legacy standalone PublicSchool embeddings/coords onto Zone nodes (one-time)          |

### Graph Relations

```
(:ZoneType {id: "school", label: "Public School"})
  ↑ :USES_TYPE
(:Zone:PublicSchool {type: "school", id: "SCH_*"})
  ↑ :ANCHORS
(:IntraZone {h3_cell, resolution: 14})
  ↓ :WITHIN_CELL
(:ZoneCell {resolution: 8}) → :WITHIN → (:Moku)

Supply chain edges (future):
(:FoodHub) -[:DISTRIBUTES_TO]→ (:Zone:PublicSchool)
(:WorkforceProgram) -[:HOSTS_AT]→ (:Zone:PublicSchool)
```

291 IntraZone nodes, 240 linked to res-8 backbone via `WITHIN_CELL`.

### Zone:PublicSchool Node Properties

```cypher
Zone:PublicSchool: {
  // Zone identity
  id: "SCH_45",
  name: "Kailua High School",
  type: "school",
  // School-specific (from DOE CSV)
  sch_code: 355,
  sch_type: "High",
  category: "high",
  grade_range: "9-12",
  grade_from: "9",
  grade_to: "12",
  address: "451 Ulumanu Drive",
  city: "Kailua",
  zip: "96734",
  phone: "(808) 266-7800",
  principal: String,
  website: String,
  complex: "Kailua",
  complex_area: "Kailua-Kalaheo",
  district: "Windward",
  island: "Oahu",
  charter: false,
  // Coordinates (from ingestion merge)
  lat: 21.3942,
  lng: -157.7431,
  h3_resolution8: String,
  h3_resolution9: String,
  // VertexAI embedding (from ingestion merge)
  embedding: [768-dim float array],
  embedding_model: "text-embedding-005",
  embedding_generated_at: String,
  embedding_source_text: String,
  // Provenance
  legacy_id: "school-355",
  data_source: "Hawaii DOE Public Schools",
  provenance: String
}
```

### Key Files

| File                                            | Format  | Rows | Git Tracked |
| ----------------------------------------------- | ------- | ---- | ----------- |
| `Public_Schools.geojson`                        | GeoJSON | 288  | no          |
| `Public_Schools.csv`                            | CSV     | 288  | yes         |
| `SCH_IntraZones_H3.csv`                        | CSV     | 288  | yes         |
| `migrate-publicschool-to-dual-label.cypher`     | Cypher  | —    | yes         |

---

## post-secondary — Higher Education Campuses

### Source & Provenance

| Field                | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| **Authority**        | National Center for Education Statistics (NCES)                |
| **Portal**           | `geoportal.hawaii.gov/datasets/postsecondary-institutions`     |
| **License**          | public-domain                                                  |
| **Source vintage**   | 2024                                                           |
| **Downloaded**       | 2026-02-23                                                     |
| **Update frequency** | annual                                                         |
| **Coverage**         | Statewide — 5 islands (Hawai'i, Kaua'i, Maui, O'ahu, Moloka'i) |

### Description

85 higher education campuses (UH system, community colleges, private). **Deduplicated** by `(inst_id, camp_id)` — one Zone per unique campus. Main campus: `UNI_{inst_id}`, branch campus: `UNI_{inst_id}_{camp_id}`. Carries federal accreditation IDs (OPEID, IPEDS).

### Pipeline

| Step     | File                                                  | Purpose                                                              |
| -------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Generate | `post-secondary/generate-postsecondary-h3.mjs`        | Point-anchor at res-14 + parent res-8                                |
| Stage A  | `post-secondary/create-postsecondary-zones.cypher`    | Creates 85 Zone nodes + ZoneType `postsecondary` + `USES_TYPE`       |
| Stage B  | `post-secondary/load-postsecondary-zone-cells.cypher` | Creates 77 IntraZone nodes + `ANCHORS→Zone` + `WITHIN_CELL→ZoneCell` |

### Graph Relations

```
(:ZoneType {id: "postsecondary", label: "Post-Secondary Institution"})
  ↑ :USES_TYPE
(:Zone {type: "postsecondary", id: "UNI_*"})
  ↑ :ANCHORS
(:IntraZone {resolution: 14})
  ↓ :WITHIN_CELL
(:ZoneCell {resolution: 8}) → :WITHIN → (:Moku)
```

77 IntraZone nodes (8 campuses share coordinates), 59 linked to backbone.

### Zone Node Properties

```cypher
Zone: {
  id: "UNI_141644",
  name: "University of Hawaii at Manoa",
  type: "postsecondary",
  inst_id: 141644,
  inst_name: "University of Hawaii at Manoa",
  inst_opeid: 141851,
  inst_ipeds: 141644,
  inst_url: "https://manoa.hawaii.edu",
  inst_ph: "(808) 956-8111",
  camp_id: 0,
  camp_name: "",
  address: "2500 Campus Road",
  city: "Honolulu",
  state: "HI",
  zip: "96822",
  data_source: "US Dept of Education Post-Secondary Institutions"
}
```

### Key Files

| File                                 | Format  | Rows | Git Tracked |
| ------------------------------------ | ------- | ---- | ----------- |
| `PostSecondary_Institutions.geojson` | GeoJSON | 85   | no          |
| `UNI_Campuses.csv`                   | CSV     | 85   | yes         |
| `UNI_IntraZones_H3.csv`              | CSV     | 85   | yes         |

---

## stations — HART Rail Stations

### Source & Provenance

| Field                | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| **Authority**        | Honolulu Authority for Rapid Transportation (HART)    |
| **Portal**           | `geoportal.hawaii.gov/datasets/hart-transit-stations` |
| **License**          | public-domain                                         |
| **Source vintage**   | 2024                                                  |
| **Downloaded**       | 2026-02-23                                            |
| **Update frequency** | static                                                |
| **Coverage**         | Oahu only — East Kapolei to Ala Moana                 |

### Description

21 HART rail stations. The **most complex pipeline** — combines three patterns:
1. **IntraZone point-anchor** (res-14 spatial precision)
2. **TransitCorridor entity** with ordered `STOP_ON` relationships (sequence 1-21)
3. **ZoneType vocabulary** (`station`)

### Pipeline

| Step     | File                                       | Purpose                                                                                                           |
| -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Generate | `stations/generate-stations-h3.mjs`        | Point-anchor at res-14 + parent res-8                                                                             |
| Stage A  | `stations/create-stations-zones.cypher`    | Creates TransitCorridor `HART_RAIL` + 21 Zone nodes (`STA_{station_number}`) + ZoneType + `STOP_ON` with sequence |
| Stage B  | `stations/load-stations-zone-cells.cypher` | Creates 21 IntraZone nodes + `ANCHORS→Zone` + `WITHIN_CELL→ZoneCell`                                              |

### Graph Relations

```
(:TransitCorridor {id: "HART_RAIL", name: "Honolulu Rail Transit (HART)", stations: 21})
  ↑ :STOP_ON {sequence: 1..21}
(:Zone {type: "station", id: "STA_*"})
  ↑ :USES_TYPE → (:ZoneType {id: "station"})
  ↑ :ANCHORS
(:IntraZone {resolution: 14})
  ↓ :WITHIN_CELL
(:ZoneCell {resolution: 8}) → :WITHIN → (:Moku)
```

21 IntraZone nodes, 18 linked to backbone. Route order: East Kapolei (STA_1) → Ala Moana Center (STA_21).

### Zone Node Properties

```cypher
Zone: {
  id: "STA_1",
  name: "Kualakai Station",
  type: "station",
  station_number: 1,
  feis_name: "East Kapolei",
  global_id: String,
  island: "oahu",
  data_source: "HART Rail Transit Stations"
}
```

### Key Files

| File                                 | Format | Rows | Git Tracked |
| ------------------------------------ | ------ | ---- | ----------- |
| `HART_Transit_Stations_PUBLIC_*.csv` | CSV    | 21   | no          |
| `STA_Stations.csv`                   | CSV    | 21   | yes         |
| `STA_IntraZones_H3.csv`              | CSV    | 21   | yes         |

---

## environment — Monitoring Sites

### Source & Provenance

| Field                | Value                                              |
| -------------------- | -------------------------------------------------- |
| **Authority**        | Mokunet Research Commons                           |
| **Portal**           | `github.com/Aina-Design-Corp/mokulearner-research` |
| **License**          | CC-BY-4.0                                          |
| **Source vintage**   | 2025                                               |
| **Downloaded**       | 2026-02-26                                         |
| **Update frequency** | on-change (PR-based)                               |
| **Coverage**         | Moku-scoped — `oahu-koolaupoko`                    |

### Description

Water quality, soil, and air monitoring sites from community research contributions. Currently 3 sites (seed data). **The only dataset sourced from the mokulearner-research repo** rather than Hawaii GIS portals.

Uses point-anchor pattern. Deduplicates by `site_id` — multiple observations at the same site share one IntraZone node (temporal data flows through `ResearchRecord`, not the Zone).

Completes the **SDG spatial bridge**: `SDGGoal ← MEASURES_SDG ← ResearchContribution → CONTAINS → ResearchRecord → OBSERVED_AT → Zone(environment) ← ANCHORS ← IntraZone → WITHIN_CELL → ZoneCell → WITHIN → Moku`

### Pipeline

| Step     | File                                             | Purpose                                                                                              |
| -------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Generate | `environment/generate-environment-h3.mjs`        | Point-anchor at res-14 + parent res-8; deduplicates by `site_id`; validates Hawaii coordinate bounds |
| Stage A  | `environment/load-environment-zones.cypher`      | Creates Zone nodes (`ENV_{site_id}`) + ZoneType `environment` + `USES_TYPE`                          |
| Stage B  | `environment/load-environment-zone-cells.cypher` | Creates IntraZone nodes + `ANCHORS→Zone` + `WITHIN_CELL→ZoneCell`                                    |
| Loader   | `environment/load-environment-zones.mjs`         | Driver-based alternative                                                                             |

### Graph Relations

```
(:ZoneType {id: "environment", label: "Environmental Monitoring Site"})
  ↑ :USES_TYPE
(:Zone {type: "environment", id: "ENV_*"})
  ↑ :ANCHORS
(:IntraZone {resolution: 14})
  ↓ :WITHIN_CELL
(:ZoneCell {resolution: 8}) → :WITHIN → (:Moku)

// SDG spatial bridge (via application layer)
(:Zone {type: "environment"}) ← :OBSERVED_AT ← (:ResearchRecord)
  ← :CONTAINS ← (:ResearchContribution) -[:MEASURES_SDG]-> (:SDGGoal)
```

### Zone Node Properties

```cypher
Zone: {
  id: "ENV_kailua-pond-1",
  name: "Kailua Fishpond Site A",
  type: "environment",
  matrix: "water",
  moku_id: "koolaupoko",
  island: "oahu",
  latitude: 21.3942,
  longitude: -157.7405,
  data_source: "Environment monitoring sites 2026"
}
```

### Key Files

| File                                        | Format | Rows | Git Tracked |
| ------------------------------------------- | ------ | ---- | ----------- |
| `commons-samples/water-quality-dataset.csv` | CSV    | 3    | yes         |
| `ENV_IntraZones_H3.csv`                     | CSV    | 3    | yes         |

---

## workforce — Career Pathways

### Source & Provenance

| Field                | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| **Authority**        | Hawaii Dept of Education - Career and Technical Education |
| **Portal**           | `hawaiicareerpathways.org`                                |
| **License**          | public-domain                                             |
| **Source vintage**   | 2025                                                      |
| **Downloaded**       | 2026-02-19                                                |
| **Update frequency** | annual                                                    |
| **Coverage**         | Statewide                                                 |

### Description

The **only non-spatial dataset** — a knowledge graph of 13 career pathway clusters with 47 programs of study, 280 SOC-coded occupations, 366 training programs, and 47 professional credentials. Uses a **driver-based import** (`load-pathways.mjs`) instead of LOAD CSV, parsing structured JSON.

Connected to the spatial graph via a single bridge edge: `(:CareerPathway {id: "AFNR"}) -[:ALIGNS_WITH_ZONE_TYPE]-> (:ZoneType {id: "ag"})`.

### Pipeline

| Step   | File                          | Purpose                                                                       |
| ------ | ----------------------------- | ----------------------------------------------------------------------------- |
| Loader | `workforce/load-pathways.mjs` | Driver-based Neo4j import from `programs.json` — creates full career taxonomy |

**No Stage A/B Cypher** — everything is handled by the driver script.

### Graph Relations

```
(:CareerPathway {id, name})
  ↓ :INCLUDES_PROGRAM
(:ProgramOfStudy {id, name})
  ↓ :PREPARES_FOR {stage: "entry"|"cc"|"university"}
(:Occupation {soc_code, name})

(:ProgramOfStudy) -[:HAS_TRAINING {stage}]-> (:TrainingProgram {name, category, track_level})
(:ProgramOfStudy) -[:RECOMMENDS_CREDENTIAL {stage}]-> (:Credential {name})

// Spatial bridge
(:CareerPathway {id: "AFNR"}) -[:ALIGNS_WITH_ZONE_TYPE]-> (:ZoneType {id: "ag"})
```

### Graph Node Counts

| Label           | Count |
| --------------- | ----- |
| CareerPathway   | 13    |
| ProgramOfStudy  | 47    |
| Occupation      | 280   |
| TrainingProgram | 366   |
| Credential      | 47    |

### Key Files

| File                | Format | Size  | Git Tracked |
| ------------------- | ------ | ----- | ----------- |
| `programs.json`     | JSON   | 460KB | no          |
| `load-pathways.mjs` | JS     | —     | yes         |

---

## transportation-not-seeded — Bus/Bike (Pending)

### Source & Provenance

| Field                | Value                             |
| -------------------- | --------------------------------- |
| **Authority**        | City and County of Honolulu - DTS |
| **Portal**           | `geoportal.hawaii.gov`            |
| **License**          | public-domain                     |
| **Source vintage**   | 2024                              |
| **Downloaded**       | 2026-01-17                        |
| **Update frequency** | on-change                         |
| **Coverage**         | Oahu only                         |

### Description

Bus stops and bike facilities downloaded but **not yet integrated** into the Zone/ZoneCell backbone. Candidate for future IntraZone (bus stops) or transit network modeling (bike facilities).

### Status

- **H3 strategy**: none
- **Feature count**: 0 (no pipeline executed)
- **Scripts**: none
- **Graph nodes**: none

### Key Files

| File                    | Format  | Size  | Git Tracked |
| ----------------------- | ------- | ----- | ----------- |
| `THE_BUS_Stops.geojson` | GeoJSON | 853KB | no          |

---

## Agent Update Check Protocol

This section defines the check logic for an automated agent to periodically verify dataset freshness and trigger notifications.

### Update Frequency Categories

| Frequency   | Check Interval      | Action                            |
| ----------- | ------------------- | --------------------------------- |
| `static`    | Never (manual only) | No automated checks needed        |
| `annual`    | Quarterly           | Check portal for new vintage year |
| `on-change` | Monthly             | Check portal `last_modified` date |

### Datasets by Frequency

**Static (no checks needed):**
- `moku`, `ag-baseline`, `opportunity`, `rail`, `stations`

**Annual (check quarterly):**
- `highways` (source: Hawaii DOT HPMS)
- `stewards` (source: Hawaii OPSD government land)
- `schools` (source: Hawaii DOE)
- `post-secondary` (source: NCES)
- `workforce` (source: Hawaii CTE)

**On-change (check monthly):**
- `ag-ial` (source: Land Use Commission)
- `planning` (source: Honolulu DPP)
- `reserves` (source: DLNR)
- `parks` (source: DLNR)
- `wetland` (source: USFWS NWI)
- `trails` (source: DLNR Na Ala Hele)
- `environment` (source: mokulearner-research PRs)
- `transportation-not-seeded` (future)

### Check Protocol Per Dataset

For each dataset requiring a check:

1. **Read `dataset.json`** — get `authority.portal_url`, `downloaded_at`, `last_checked`, `stale`
2. **Query portal** — check the source portal's `last_modified` or vintage date
3. **Compare dates** — if portal source is newer than `downloaded_at`, flag as stale
4. **Update manifest** — set `last_checked` to today; set `stale: true` if newer version found
5. **Notification** — if stale, notify with:
   - Dataset ID and title
   - Current `downloaded_at` vs portal date
   - `authority.portal_url` for manual review
   - Refresh command: `node refresh-dataset.mjs <dataset-id>`

### Refresh Workflow (after notification)

```bash
# 1. Download updated source
node refresh-dataset.mjs <dataset-id>

# 2. Regenerate H3 indices
node <dataset-dir>/generate-*.mjs

# 3. Run Stage A + Stage B Cypher in AuraDB
#    (manual via AuraDB console, or driver-based if loader exists)

# 4. Verify: run spatial integrity check
#    GET /api/admin/data-sync?action=spatial-integrity
```

### Portal URLs for Automated Checking

| ID             | Portal URL                                                                             |
| -------------- | -------------------------------------------------------------------------------------- |
| moku           | `geoportal.hawaii.gov/datasets/moku-districts`                                         |
| ag-ial         | `geoportal.hawaii.gov/datasets/important-agricultural-lands`                           |
| ag-baseline    | `geoportal.hawaii.gov/datasets/agricultural-land-use-2015-baseline`                    |
| planning       | `geoportal.hawaii.gov/datasets/zoning-city-and-county-of-honolulu`                     |
| reserves       | `geoportal.hawaii.gov/datasets/reserves`                                               |
| opportunity    | `geoportal.hawaii.gov/datasets/opportunity-zones`                                      |
| parks          | `geoportal.hawaii.gov/datasets/state-parks`                                            |
| highways       | `geoportal.hawaii.gov/datasets/highway-performance-monitoring-system-roads-for-hawaii` |
| stewards       | `geoportal.hawaii.gov/datasets/government-land-ownership-detailed`                     |
| wetland        | `geoportal.hawaii.gov/datasets/wetlands`                                               |
| trails         | `geoportal.hawaii.gov/datasets/parks-recreation`                                       |
| rail           | `geoportal.hawaii.gov/datasets/hart-guideway-alignment-line`                           |
| schools        | `geoportal.hawaii.gov/datasets/public-schools`                                         |
| post-secondary | `geoportal.hawaii.gov/datasets/postsecondary-institutions`                             |
| stations       | `geoportal.hawaii.gov/datasets/hart-transit-stations`                                  |
| environment    | `github.com/Aina-Design-Corp/mokulearner-research`                                     |
| workforce      | `hawaiicareerpathways.org`                                                             |
