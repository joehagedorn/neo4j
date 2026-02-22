# Agricultural Zone Overlay — Seeding Guide

This folder implements the **2-stage pattern** for attaching agricultural data
to the H3 spatial backbone via Zone and ZoneCell nodes.

## Architecture

```
(:ZoneCell)-[:WITHIN]->(:Moku)          ← res-7 backbone (Stage 0, moku/)
(:ZoneCell)-[:IN_ZONE]->(:Zone)         ← overlay link  (Stage B)
(:Zone {type: "ag"})                    ← zone node      (Stage A)
```

Zone nodes are lightweight metadata containers. ZoneCells are the spatial
backbone. The IN_ZONE relationship is the bridge.

---

## Seeding Pattern — 2 Stages

### Stage A — Create Zone nodes

One Zone per source feature. Each zone captures properties from the source
dataset (acres, crop category, docket number, etc.).

**Naming conventions**:
| Dataset | zone_id pattern | Example |
|---------|----------------|---------|
| IAL dockets | `IAL_<docket_no>` | `IAL_DR08-37` |
| Ag Land Use 2015 Baseline | `ALU_<objectid>` | `ALU_1` |

All zones use `type: "ag"`.

### Stage B — Link Zones to ZoneCells via IN_ZONE

Each zone is linked to one or more existing ZoneCells. The approach depends
on the dataset's feature size relative to H3 cell area:

| Approach | When to use | Cells per feature |
|----------|-------------|-------------------|
| **Polyfill** (`polygonToCells`) | Features larger than an H3 cell | Multiple |
| **Centroid** (`latLngToCell`) | Features smaller than an H3 cell | Exactly 1 |

---

## Datasets

### IAL (Important Agricultural Lands)

15 Zone nodes from 17 CSV rows (3 duplicates on DR14-52).

**H3 strategy**: Multi-resolution polyfill
- Res 7: 95 cells — links to existing backbone ZoneCells (no new nodes)
- Res 8: 646 cells — new ZoneCells created, labeled `:IAL`
- Res 9: 48 cells — new ZoneCells for 4 small dockets, labeled `:IAL`

The `:IAL` label is applied only to res-8/9 cells (dedicated polyfill).
Res-7 backbone cells link via IN_ZONE but keep no extra label.

**Files**:
| File | Purpose |
|------|---------|
| `Minimal_Cypher_to_create_IAL_Zones.cypher` | Stage A — create 15 Zone nodes |
| `load-zone-cells.cypher` | Stage B — link res-7 backbone cells |
| `load-zone-cells-res8.cypher` | Stage B — create + link res-8 cells |
| `load-zone-cells-res9.cypher` | Stage B — create + link res-9 cells |
| `generate-ial-h3.mjs` | Generates res-7 polyfill CSV (95 rows) |
| `generate-ial-h3-multires.mjs` | Generates res-8 (646) + res-9 (48) CSVs |

**Execution order**: Stage A, then Stage B (res-7, res-8, res-9).

### Baseline (Agricultural Land Use 2015)

5,024 Zone nodes — one per land use feature across 6 islands, 15 crop categories.

**H3 strategy**: Centroid-based (median feature is 6.7 acres vs ~1,275 acres/cell at res-7).
Each feature maps to exactly 1 res-7 cell via polygon centroid. No new ZoneCells created.

- 4,846 zones linked (96.5%)
- 178 zones unlinked — centroid falls in coastal/edge cells outside moku backbone
- 670 unique res-7 cells used

**Files** (in `baseline/`):
| File | Purpose |
|------|---------|
| `create-baseline-zones.cypher` | Stage A — create 5,024 Zone nodes |
| `load-baseline-zone-cells.cypher` | Stage B — link to existing res-7 ZoneCells |
| `generate-baseline-h3.mjs` | Centroid → H3 res-7 CSV generation |

**Execution order**: Stage A, then Stage B.

---

## Choosing an H3 Strategy for New Datasets

```
Feature median acreage vs H3 cell area:
  > 1,275 acres (res 7)  →  polyfill at res 7
  > 183 acres  (res 8)   →  polyfill at res 8
  > 26 acres   (res 9)   →  polyfill at res 9
  < 26 acres             →  centroid at res 7
```

Most planning datasets with many small parcels will use the centroid approach.
Large designated zones (IAL, conservation districts, etc.) benefit from polyfill.

---

## Staged Folders

| Folder | Dataset | Status |
|--------|---------|--------|
| `ag/` | IAL dockets | Seeded |
| `ag/baseline/` | Ag Land Use 2015 | Seeded |
| `stewards/` | Government Land Ownership | Staged — not yet implemented |
| `planning/` | Honolulu Zoning | Staged — not yet implemented |
