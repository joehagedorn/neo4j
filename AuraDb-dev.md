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
(:ZoneCell {h3_cell, resolution})    ← H3 spatial backbone (19,720 cells)
  ↑ :IN_ZONE                           centroid/midpoint overlays
(:Zone {id, type, ...})              ← overlay layers (35,011 zones)
  ↓ :USES_TYPE
(:ZoneType {id, label})              ← classification vocabulary (10 types)
```

### IntraZone Layer (Point Features)

```
(:IntraZone {h3_cell, resolution})   ← res-14 point anchor (389 nodes)
  ↓ :ANCHORS
(:Zone {type: "school"|"postsecondary"|"station"})
  ↑ :WITHIN_CELL
(:ZoneCell {resolution: 8})          ← backbone bridge for Moku traversal
```

Point features (schools, post-secondary campuses, rail stations) use a
dedicated IntraZone node at res-14 (~6.3 m²) instead of centroid-to-backbone
IN_ZONE. Each IntraZone anchors exactly one Zone and optionally links to its
parent res-8 backbone ZoneCell for Moku traversal.

### Transit Corridor

```
(:TransitCorridor {id: "HART_RAIL"})
  ↑ :STOP_ON {sequence}
(:Zone {type: "station"})            ← 21 ordered rail stations
```

The HART rail line is modeled as a first-class TransitCorridor entity with
ordered STOP_ON relationships (sequence 1–21) from East Kapolei to Ala Moana.
Each station also has an IntraZone anchor for spatial positioning.

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
| **ZoneCell** | 19,720 | H3 cells — 19,438 res-8 + 48 res-9 + 234 res-10 |
| **Zone** | 35,011 | Spatial overlay zones across 10 types |
| **ZoneType** | 10 | Vocabulary hub nodes |
| **IntraZone** | 389 | Res-14 point-feature anchors (schools, post-secondary, stations) |
| **TransitCorridor** | 1 | HART Rail line (Oahu) |
| **CareerPathway** | 13 | Career clusters from Hawaii Career Pathways |
| **ProgramOfStudy** | 47 | Programs of study within clusters |
| **Occupation** | 280 | SOC-coded occupations |
| **TrainingProgram** | 366 | Education/training options (CC, university, short-term) |
| **Credential** | 47 | Professional certifications |
| **HARTStation** | 21 | Legacy HART station nodes (pre-IntraZone pattern) |

### Relationship Types

| Relationship | Count | Pattern |
|-------------|-------|---------|
| `USES_TYPE` | 35,011 | `(:Zone)-[:USES_TYPE]->(:ZoneType)` |
| `IN_ZONE` | 32,055 | `(:ZoneCell)-[:IN_ZONE]->(:Zone)` |
| `WITHIN` | 19,440 | `(:ZoneCell)-[:WITHIN]->(:Moku)` |
| `ANCHORS` | 398 | `(:IntraZone)-[:ANCHORS]->(:Zone)` |
| `WITHIN_CELL` | 378 | `(:IntraZone)-[:WITHIN_CELL]->(:ZoneCell)` |
| `HAS_TRAINING` | 653 | `(:ProgramOfStudy)-[:HAS_TRAINING {stage}]->(:TrainingProgram)` |
| `PREPARES_FOR` | 524 | `(:ProgramOfStudy)-[:PREPARES_FOR {stage}]->(:Occupation)` |
| `RECOMMENDS_CREDENTIAL` | 104 | `(:ProgramOfStudy)-[:RECOMMENDS_CREDENTIAL {stage}]->(:Credential)` |
| `INCLUDES_PROGRAM` | 47 | `(:CareerPathway)-[:INCLUDES_PROGRAM]->(:ProgramOfStudy)` |
| `NEXT_STATION` | 40 | `(:HARTStation)-[:NEXT_STATION]->(:HARTStation)` (legacy) |
| `STOP_ON` | 21 | `(:Zone {type:"station"})-[:STOP_ON {sequence}]->(:TransitCorridor)` |
| `REPRESENTS_MOKU` | 33 | `(:MokuDistrict)-[:REPRESENTS_MOKU]->(:Moku)` |
| `ALIGNS_WITH_ZONE_TYPE` | 1 | `(:CareerPathway)-[:ALIGNS_WITH_ZONE_TYPE]->(:ZoneType)` |

### ZoneType Vocabulary

| id | label | Zone count |
|----|-------|-----------|
| `ag` | Agricultural Planning Zone | 5,039 |
| `highway` | Highway Segment | 2,075 |
| `opportunity` | Federal Opportunity Zone | 25 |
| `postsecondary` | Post-Secondary Institution | 85 |
| `reserve` | Reserve / Conservation Area | 376 |
| `school` | Public School | 292 |
| `station` | Transit Station | 21 |
| `steward` | Government Land Ownership | 25,129 |
| `transit` | Transit Corridor | 4 |
| `zoning` | Zoning District | 1,965 |

### Labels

| Label | Applied to | Purpose |
|-------|-----------|---------|
| `:IAL` | 694 ZoneCells (res-8/9 only) | Visual filter for IAL-dedicated polyfill cells |

---

## Spatial Seeding Layers

All spatial overlays follow a 2-stage pattern:
- **Stage A**: Create Zone nodes (LOAD CSV from GitHub)
- **Stage B**: Link Zone → ZoneCell via `IN_ZONE` (centroid/polyfill overlays) or create IntraZone anchors (point features)

### Stage 0: Moku Backbone (`moku/`)

Res-8 H3 polyfill of 33 moku district polygons → 19,438 ZoneCells (~183 ac per cell).

Each ZoneCell carries `moku_id`, `moku_name`, `island` and links to its Moku node via `WITHIN`.

### IAL Overlay (`ag/`)

15 IAL Zone nodes. Multi-resolution polyfill (res-8 backbone + dedicated res-8/9 cells with `:IAL` label). 694 IAL-labeled cells.

### Agricultural Baseline (`ag/baseline/`)

5,039 zones (type `ag`, prefix `ALU_`). Centroid to res-8. 1,826 unique backbone cells linked.

### Honolulu Zoning (`planning/`)

1,965 zones (type `zoning`, prefix `HNL_`). Centroid to res-8. Oahu only. 559 unique backbone cells linked.

### Reserves (`reserves/`)

376 zones (type `reserve`, prefix `RES_`). Centroid to res-8. All islands. 310 unique backbone cells linked.

### Opportunity Zones (`opportunity/`)

25 zones (type `opportunity`, prefix `OZ_`). Centroid to res-8. 22 unique backbone cells linked.

### HART Rail Corridor (`rail/`)

4 zones (type `transit`, prefix `RAIL_`). Line-sample at res-10. 234 ZoneCells created at res-10.

### HPMS Highways (`highways/`)

2,075 zones (type `highway`, prefix `HWY_`). Midpoint to res-8. 835 unique backbone cells linked.

### Government Land Ownership (`stewards/`)

25,129 zones (type `steward`, prefix `GOV_`). Centroid to res-8. 3,297 unique backbone cells linked.

### Public Schools (`schools/`)

292 zones (type `school`, prefix `SCH_`). **IntraZone pattern** — each school's Point coordinate is mapped to a res-14 H3 cell (~6.3 m²), creating an IntraZone anchor with ANCHORS→Zone and WITHIN_CELL→ZoneCell (res-8 parent).

- 291 IntraZone nodes (1 school has no geometry)
- 240 linked to res-8 backbone via WITHIN_CELL

### Post-Secondary Institutions (`post-secondary/`)

85 zones (type `postsecondary`, prefix `UNI_`). **IntraZone pattern**. Deduplicated by (inst_id, camp_id) — one Zone per campus. Main campus: `UNI_<inst_id>`, branch: `UNI_<inst_id>_<camp_id>`.

- 77 IntraZone nodes (8 campuses share coordinates)
- 59 linked to res-8 backbone via WITHIN_CELL

### HART Rail Stations (`stations/`)

21 zones (type `station`, prefix `STA_`). **IntraZone pattern** + **TransitCorridor model**. Each station is a Zone with IntraZone anchor, plus STOP_ON→TransitCorridor with sequence number encoding the route order (East Kapolei → Ala Moana).

- 21 IntraZone nodes
- 18 linked to res-8 backbone via WITHIN_CELL
- 1 TransitCorridor node (`HART_RAIL`)
- 21 STOP_ON relationships (sequence 1–21)

---

## Career Pathways Knowledge Graph (`workforce/`)

Driver-based import from `programs.json` (not LOAD CSV). Creates a career taxonomy connected to the spatial graph via ZoneType.

- **Source**: Hawaii Career Pathways — 47 programs across 13 clusters
- **Script**: `workforce/load-pathways.mjs`
- **Bridge**: `(:CareerPathway {id:"AFNR"})-[:ALIGNS_WITH_ZONE_TYPE]->(:ZoneType {id:"ag"})`
- **Stage property**: Relationships carry `{stage: "entry"|"cc"|"university"}` for career ladder tracking

### Traversal Examples

```
# Career pathway → spatial zones via ZoneType bridge
CareerPathway (AFNR)
  → ProgramOfStudy (AFP, ANS, FS, NRM)
    → Occupation (45-2092, 35-2021, ...)        via PREPARES_FOR {stage}
    → TrainingProgram (Leeward CC, UH Manoa...) via HAS_TRAINING {stage}
    → Credential (ServSafe, OSHA 10...)         via RECOMMENDS_CREDENTIAL {stage}
  → ZoneType (ag)                               via ALIGNS_WITH_ZONE_TYPE
    → Zone (IAL, Baseline parcels...)           via USES_TYPE (reverse)
      → ZoneCell → Moku                        via IN_ZONE, WITHIN

# Career pathway → school via IntraZone backbone bridge
CareerPathway → ZoneType → Zone (ag)
  → ZoneCell (backbone, res-8) → Moku
  → ZoneCell (backbone, res-8) ← WITHIN_CELL ← IntraZone → ANCHORS → Zone (school)

# Transit corridor traversal
TransitCorridor (HART_RAIL)
  ← STOP_ON {sequence: 1} ← Zone (STA_1 "Kualakaʻi Station")
    ← ANCHORS ← IntraZone → WITHIN_CELL → ZoneCell → WITHIN → Moku
  ← STOP_ON {sequence: 2} ← Zone (STA_2 "Keoneʻae Station")
  ...
  ← STOP_ON {sequence: 21} ← Zone (STA_21 "Kālia Station")
```

---

## H3 Strategy Decision Guide

| Feature characteristic | Approach | Creates new ZoneCells? | Example |
|----------------------|----------|----------------------|---------|
| Polygon larger than cell area | Polyfill (`polygonToCells`) | Yes, at target resolution | IAL dockets |
| Polygon smaller than cell area | Centroid (`latLngToCell`) at res-8 | No, links to backbone | Ag baseline, reserves, stewards |
| LineString features | Line-sample (walk coordinates) | Yes, at target resolution | HART rail guideway |
| Point features | IntraZone at res-14 + parent res-8 | No, links IntraZone to backbone | Schools, post-secondary, stations |

Resolution reference: res-8 ~183 ac, res-9 ~26 ac, res-10 ~3.7 ac, res-14 ~6.3 m²

### Point Feature Pattern (IntraZone)

Point features (schools, campuses, stations) use a dedicated pattern:

1. **Generate script**: `latLngToCell(lat, lng, 14)` for the IntraZone cell, `cellToParent(h3Cell, 8)` for the backbone parent
2. **Stage A cypher**: MERGE Zone nodes + ZoneType + USES_TYPE
3. **Stage B cypher**: MERGE IntraZone + ANCHORS→Zone + optional WITHIN_CELL→ZoneCell (parent res-8)

This provides ~6.3 m² spatial precision while maintaining Moku traversal via the backbone bridge.

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
-- Zone counts by type
MATCH (z:Zone) RETURN z.type, count(z) ORDER BY count(z) DESC;

-- ZoneType hub view (good starting point in browser)
MATCH (zt:ZoneType) RETURN zt;

-- IAL dedicated cells
MATCH (n:IAL) RETURN n LIMIT 25;

-- Unlinked zones (centroid/midpoint overlays)
MATCH (z:Zone)
WHERE z.type IN ['ag','steward','highway','zoning','reserve','opportunity']
AND NOT EXISTS { (:ZoneCell)-[:IN_ZONE]->(z) }
RETURN z.type, count(z) ORDER BY count(z) DESC;

-- Full spatial traversal: Moku → ZoneCell → Zone
MATCH (zc:ZoneCell)-[:IN_ZONE]->(z:Zone), (zc)-[:WITHIN]->(m:Moku)
RETURN m.id, z.type, count(DISTINCT z) ORDER BY m.id;

-- IntraZone coverage: which point-feature zones link to backbone?
MATCH (iz:IntraZone)-[:ANCHORS]->(z:Zone)
OPTIONAL MATCH (iz)-[:WITHIN_CELL]->(zc:ZoneCell)
RETURN z.type, count(DISTINCT iz) AS intrazones, count(DISTINCT zc) AS backbone_linked;

-- Moku → School via IntraZone backbone bridge
MATCH (m:Moku)<-[:WITHIN]-(zc:ZoneCell)<-[:WITHIN_CELL]-(iz:IntraZone)-[:ANCHORS]->(z:Zone)
WHERE z.type = 'school'
RETURN m.name AS moku, count(DISTINCT z) AS schools
ORDER BY schools DESC;

-- HART rail route in order
MATCH (z:Zone)-[s:STOP_ON]->(tc:TransitCorridor {id: 'HART_RAIL'})
RETURN s.sequence AS seq, z.name AS station, z.feis_name AS feis
ORDER BY s.sequence;

-- Career pathway → occupations
MATCH (cp:CareerPathway)-[:INCLUDES_PROGRAM]->(ps)-[:PREPARES_FOR]->(o:Occupation)
RETURN cp.name, ps.name, collect(DISTINCT o.soc_code) LIMIT 10;

-- Career pathway → spatial bridge
MATCH (cp:CareerPathway)-[:ALIGNS_WITH_ZONE_TYPE]->(zt:ZoneType)<-[:USES_TYPE]-(z:Zone)
RETURN cp.name, zt.id, count(z) AS zones;

-- Training programs for a cluster
MATCH (cp:CareerPathway {id:"AFNR"})-[:INCLUDES_PROGRAM]->(ps)-[:HAS_TRAINING]->(tp:TrainingProgram)
RETURN ps.name, tp.name, tp.category, tp.track_level;

-- Credentials by program
MATCH (ps:ProgramOfStudy)-[:RECOMMENDS_CREDENTIAL]->(c:Credential)
RETURN ps.name, collect(c.name);
```

---

## Session Log: 2026-02-23 — Res-8 Backbone Migration + New Overlays

### Actions taken

1. **Res-8 backbone migration** — Replaced the entire res-7 moku backbone (2,769 cells) with res-8 (19,438 cells, ~183 ac per cell). This provides 7× spatial density matching the IAL resolution.

2. **Overlay migration** — All 6 centroid/midpoint overlay types updated from res-7 to res-8:
   - Updated `latLngToCell(lat, lng, 7)` → `8` in all generate scripts
   - Regenerated all H3 CSVs
   - Deleted 30,757 old res-7 IN_ZONE relationships
   - Re-ran all Stage B cyphers → 32,055 new res-8 IN_ZONE relationships

3. **Schools overlay** (new) — 292 public school Zones with IntraZone pattern:
   - ZoneType: `school` ("Public School")
   - IntraZone at res-14 with ANCHORS + WITHIN_CELL to res-8 backbone
   - 291 IntraZone nodes, 240 backbone-linked

4. **Post-secondary overlay** (new) — 85 campus Zones with IntraZone pattern:
   - ZoneType: `postsecondary` ("Post-Secondary Institution")
   - Deduplicated by (inst_id, camp_id) from accreditation data
   - 77 IntraZone nodes, 59 backbone-linked

5. **HART rail stations** (new) — 21 station Zones with TransitCorridor model:
   - ZoneType: `station` ("Transit Station")
   - TransitCorridor node `HART_RAIL` with ordered STOP_ON relationships
   - IntraZone at res-14, 18 backbone-linked
   - Route: East Kapolei (STA_1) → Ala Moana Center (STA_21)

6. **IntraZone parent migration** — Updated `cellToParent(h3Cell, 7)` → `8` in schools and post-secondary generate scripts. CSV column renamed `parent_h3_7` → `parent_h3_8`. WITHIN_CELL improved from 330 to 378 links.

7. **Res-7 cleanup** — Deleted all 2,769 orphaned res-7 ZoneCells (only had WITHIN→Moku, no remaining IN_ZONE or WITHIN_CELL refs).
