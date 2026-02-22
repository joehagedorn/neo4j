# 3 Stage A – Ingest IAL “zone” definitions from this CSV
First, we turn each IAL docket into a Zone (type "ag") and/or an IAL-specific node.
## 3.1 Suggested Zone ID and naming convention
For each row:

zone_id → IAL_<docket_no> (e.g., IAL_DR08-37)
zone_name → something like IAL DR08-37
zone_type → "ag" (aligns with your ZoneType vocabulary)

You can enrich later with version, data_source, and provenance.

## 3.2 Minimal Cypher to create IAL Zones
```
LOAD CSV WITH HEADERS FROM 'file:///Important_Agricultural_Lands_(IAL).csv' AS row

WITH row,
     trim(row.docket_no) AS docket_no,
     toFloat(row.acres)  AS acres,
     toFloat(row.st_areashape) AS area_m2,
     toFloat(row.st_perimetershape) AS perimeter_m,
     "IAL_" + replace(docket_no, " ", "_") AS zone_id

// 1 Create Zone for each IAL docket
MERGE (z:Zone {id: zone_id})
SET z.name        = "IAL " + docket_no,
    z.type        = "ag",               // uses existing ZoneType 'ag'
    z.ial         = true,               // flag: this is Important Agricultural Land
    z.docket_no   = docket_no,
    z.acres       = acres,
    z.area_m2     = area_m2,
    z.perimeter_m = perimeter_m,
    z.data_source = "IAL shapefile / docket registry",
    z.provenance  = "IAL docket-based designation; see docket_no",
    z.created_at  = coalesce(z.created_at, datetime()),
    z.updated_at  = datetime();
``
```
This does not yet attach to H3, but it:

Instantiates each IAL docket as a Zone of type "ag".
Preserves legal & planning context (docket, acreage).
Sets you up nicely for district-level governance and for later H3 linking.

## 3.3 Optional: explicit IAL concept node

```
MERGE (ial:IALDesignation {docket_no: docket_no})
SET ial.acres       = acres,
    ial.area_m2     = area_m2,
    ial.perimeter_m = perimeter_m;

MERGE (z)-[:IS_IAL]->(ial);
```
This lets you separate:

Zone = operational overlay (H3-linked, used in scenarios, incentives).
IALDesignation = legal/administrative concept.



## 4 Stage B – Attach H3 cells once you have polyfills

You’ll compute H3 polyfills externally from the IAL polygons (e.g., at resolution 9 or 10). Then you generate a CSV something like:
```
zone_id,h3_cell,version,data_source,provenance
IAL_DR08-37,892a04d23a3ffff,2026.01,"IAL polyfill 2026","Polyfill res9 from IAL DR08-37 polygon"
IAL_DR08-37,892a04d23a7ffff,2026.01,"IAL polyfill 2026","Polyfill res9 from IAL DR08-37 polygon"
IAL_DR09-38,892a04d2731ffff,2026.01,"IAL polyfill 2026","Polyfill res9 from IAL DR09-38 polygon"
...
```
Important: zone_id must match what we used above (IAL_<docket_no>).
## 4.1 IAL H3 attach Cypher (using your existing pattern)

```
LOAD CSV WITH HEADERS FROM 'file:///IAL_Zones_H3.csv' AS row

WITH row,
     trim(row.zone_id)   AS zone_id,
     row.h3_cell         AS h3,
     trim(row.version)   AS version,
     row.data_source     AS data_source,
     row.provenance      AS provenance

// 1 Update Zone provenance/version if present
MATCH (z:Zone {id: zone_id})
SET z.version     = coalesce(version, z.version),
    z.data_source = coalesce(data_source, z.data_source),
    z.provenance  = coalesce(provenance, z.provenance),
    z.updated_at  = datetime()

// 2 Attach ZoneCells by H3
WITH z, h3
MATCH (zc:ZoneCell {h3_cell: h3})
MERGE (zc)-[:IN_ZONE]->(z);
...
```
