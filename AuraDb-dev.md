# AuraDB Development — Current State

## Connection

- **Instance**: `neo4j+s://a5fd2afe.databases.neo4j.io`
- **Driver config**: `db.mjs` in `/transforms` (reads `.env`, singleton pattern)
- **CSVs hosted**: `https://raw.githubusercontent.com/joehagedorn/neo4j/main/`

---

## Graph Ontology

### Spatial Layer

```
(:Moku)                              ← governance region (33 nodes)
  ↑ :WITHIN
(:ZoneCell {h3_cell, resolution})    ← H3 spatial backbone (3,697 cells)
  ↑ :IN_ZONE
(:Zone {id, type, ...})              ← overlay layers (34,613 zones)
  ↓ :USES_TYPE
(:ZoneType {id, label})              ← classification vocabulary (7 types)
```

### Career Pathways Layer

```
(:CareerPathway)                     ← career cluster (13 nodes)
  ↓ :INCLUDES_PROGRAM
(:ProgramOfStudy)                    ← high school program (47 nodes)
  ↓ :PREPARES_FOR {stage}
(:Occupation {soc_code})             ← SOC-coded job (280 nodes)

(:ProgramOfStudy)-[:HAS_TRAINING {stage}]->(:TrainingProgram)         (366 nodes)
(:ProgramOfStudy)-[:RECOMMENDS_CREDENTIAL {stage}]->(:Credential)     (47 nodes)

(:CareerPathway {id:"AFNR"})-[:ALIGNS_WITH_ZONE_TYPE]->(:ZoneType {id:"ag"})
```

### Node Counts

| Label | Count | Description |
|-------|-------|-------------|
| **Moku** | 33 | Hawaiian governance regions |
| **MokuDistrict** | 33 | Planning polygons (1:1 with Moku) |
| **ZoneCell** | 3,697 | H3 cells — 2,769 res-7 + 646 res-8 + 48 res-9 + 234 res-10 |
| **Zone** | 34,613 | Spatial overlay zones across 7 types |
| **ZoneType** | 7 | Vocabulary hub nodes |
| **CareerPathway** | 13 | Career clusters from Hawaii Career Pathways |
| **ProgramOfStudy** | 47 | Programs of study within clusters |
| **Occupation** | 280 | SOC-coded occupations |
| **TrainingProgram** | 366 | Education/training options (CC, university, short-term) |
| **Credential** | 47 | Professional certifications |
| **HARTStation** | 21 | HART rail stations (Oahu) |

### Relationship Types

| Relationship | Count | Pattern |
|-------------|-------|---------|
| `USES_TYPE` | 34,613 | `(:Zone)-[:USES_TYPE]->(:ZoneType)` |
| `IN_ZONE` | 30,757 | `(:ZoneCell)-[:IN_ZONE]->(:Zone)` |
| `WITHIN` | 3,583 | `(:ZoneCell)-[:WITHIN]->(:Moku)` |
| `HAS_TRAINING` | 653 | `(:ProgramOfStudy)-[:HAS_TRAINING {stage}]->(:TrainingProgram)` |
| `PREPARES_FOR` | 524 | `(:ProgramOfStudy)-[:PREPARES_FOR {stage}]->(:Occupation)` |
| `RECOMMENDS_CREDENTIAL` | 104 | `(:ProgramOfStudy)-[:RECOMMENDS_CREDENTIAL {stage}]->(:Credential)` |
| `INCLUDES_PROGRAM` | 47 | `(:CareerPathway)-[:INCLUDES_PROGRAM]->(:ProgramOfStudy)` |
| `NEXT_STATION` | 40 | `(:HARTStation)-[:NEXT_STATION]->(:HARTStation)` |
| `REPRESENTS_MOKU` | 33 | `(:MokuDistrict)-[:REPRESENTS_MOKU]->(:Moku)` |
| `ALIGNS_WITH_ZONE_TYPE` | 1 | `(:CareerPathway)-[:ALIGNS_WITH_ZONE_TYPE]->(:ZoneType)` |

### ZoneType Vocabulary

| id | label | Zone count |
|----|-------|-----------|
| `ag` | Agricultural Planning Zone | 5,039 |
| `steward` | Government Land Ownership | 25,129 |
| `highway` | Highway Segment | 2,075 |
| `zoning` | Zoning District | 1,965 |
| `reserve` | Reserve / Conservation Area | 376 |
| `opportunity` | Federal Opportunity Zone | 25 |
| `transit` | Transit Corridor | 4 |

### Labels

| Label | Applied to | Purpose |
|-------|-----------|---------|
| `:IAL` | 694 ZoneCells (res-8/9 only) | Visual filter for IAL-dedicated polyfill cells |

---

## Spatial Seeding Layers

All spatial overlays follow a 2-stage pattern:
- **Stage A**: Create Zone nodes (LOAD CSV from GitHub)
- **Stage B**: Link Zone → ZoneCell via `IN_ZONE` (centroid, polyfill, or line-sample)

### Stage 0: Moku Backbone (`moku/`)

Res-7 H3 polyfill of 33 moku district polygons → 2,769 ZoneCells.

### IAL Overlay (`ag/`)

15 IAL Zone nodes. Multi-resolution polyfill (res-7 backbone + res-8/9 new cells with `:IAL` label).

### Agricultural Baseline (`ag/baseline/`)

5,024 zones (type `ag`, prefix `ALU_`). Centroid to res-7. 4,846 linked (96.5%).

### Honolulu Zoning (`planning/`)

1,965 zones (type `zoning`, prefix `HNL_`). Centroid to res-7. Oahu only. 1,707 linked (86.9%).

### Reserves (`reserves/`)

376 zones (type `reserve`, prefix `RES_`). Centroid to res-7. All islands. 308 linked (81.9%).

### Opportunity Zones (`opportunity/`)

25 zones (type `opportunity`, prefix `OZ_`). Centroid to res-7. 22 linked (88%).

### HART Rail (`rail/`)

4 zones (type `transit`, prefix `RAIL_`). Line-sample at res-10. 234 new ZoneCells created. All 4 linked.

### HPMS Highways (`highways/`)

2,075 zones (type `highway`, prefix `HWY_`). Centroid to res-7. 1,822 linked (87.8%).

### Government Land Ownership (`stewards/`)

25,129 zones (type `steward`, prefix `GOV_`). Centroid to res-7. 21,025 linked (83.7%).

---

## Career Pathways Knowledge Graph (`workforce/`)

Driver-based import from `programs.json` (not LOAD CSV). Creates a career taxonomy connected to the spatial graph via ZoneType.

- **Source**: Hawaii Career Pathways — 47 programs across 13 clusters
- **Script**: `workforce/load-pathways.mjs`
- **Bridge**: `(:CareerPathway {id:"AFNR"})-[:ALIGNS_WITH_ZONE_TYPE]->(:ZoneType {id:"ag"})`
- **Stage property**: Relationships carry `{stage: "entry"|"cc"|"university"}` for career ladder tracking

### Traversal Example

```
CareerPathway (AFNR)
  → ProgramOfStudy (AFP, ANS, FS, NRM)
    → Occupation (45-2092, 35-2021, ...)        via PREPARES_FOR {stage}
    → TrainingProgram (Leeward CC, UH Manoa...) via HAS_TRAINING {stage}
    → Credential (ServSafe, OSHA 10...)         via RECOMMENDS_CREDENTIAL {stage}
  → ZoneType (ag)                               via ALIGNS_WITH_ZONE_TYPE
    → Zone (IAL, Baseline parcels...)           via USES_TYPE (reverse)
      → ZoneCell → Moku                        via IN_ZONE, WITHIN
```

---

## H3 Strategy Decision Guide

| Feature characteristic | Approach | Creates new ZoneCells? |
|----------------------|----------|----------------------|
| Polygon larger than cell area | Polyfill (`polygonToCells`) | Yes, at target resolution |
| Polygon smaller than cell area | Centroid (`latLngToCell`) | No, links to backbone |
| LineString features | Line-sample (walk coordinates) | Yes, at target resolution |

Resolution reference: res-7 ~1,275 ac, res-8 ~183 ac, res-9 ~26 ac, res-10 ~3.7 ac

---

## Canonical Moku Identity

```
moku_id = lower(island + "-" + normalized_name)
```

Normalization: remove spaces, okina (ʻ), macrons (ā/ē/ī/ō/ū).
Examples: `hawaii-puna`, `oahu-kona`, `maui-pualikomohana`

---

## Useful Queries

```cypher
// Zone counts by type
MATCH (z:Zone) RETURN z.type, count(z) ORDER BY count(z) DESC;

// ZoneType hub view (good starting point in browser)
MATCH (zt:ZoneType) RETURN zt;

// IAL dedicated cells
MATCH (n:IAL) RETURN n LIMIT 25;

// Unlinked zones (any type)
MATCH (z:Zone)
WHERE NOT EXISTS { (:ZoneCell)-[:IN_ZONE]->(z) }
RETURN z.type, count(z) ORDER BY count(z) DESC;

// Full spatial traversal: Moku → ZoneCell → Zone
MATCH (zc:ZoneCell)-[:IN_ZONE]->(z:Zone), (zc)-[:WITHIN]->(m:Moku)
RETURN m.id, z.type, count(DISTINCT z) ORDER BY m.id;

// Career pathway → occupations
MATCH (cp:CareerPathway)-[:INCLUDES_PROGRAM]->(ps)-[:PREPARES_FOR]->(o:Occupation)
RETURN cp.name, ps.name, collect(DISTINCT o.soc_code) LIMIT 10;

// Career pathway → spatial bridge
MATCH (cp:CareerPathway)-[:ALIGNS_WITH_ZONE_TYPE]->(zt:ZoneType)<-[:USES_TYPE]-(z:Zone)
RETURN cp.name, zt.id, count(z) AS zones;

// Training programs for a cluster
MATCH (cp:CareerPathway {id:"AFNR"})-[:INCLUDES_PROGRAM]->(ps)-[:HAS_TRAINING]->(tp:TrainingProgram)
RETURN ps.name, tp.name, tp.category, tp.track_level;

// Credentials by program
MATCH (ps:ProgramOfStudy)-[:RECOMMENDS_CREDENTIAL]->(c:Credential)
RETURN ps.name, collect(c.name);
```
