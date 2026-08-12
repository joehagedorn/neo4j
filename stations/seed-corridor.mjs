/**
 * Seed the rail-corridor axis — AG12 P3 (corridor activation)
 *
 * For each of the 21 HARTStation nodes (via its WITHIN_CELL res-8 backbone
 * cell):
 *
 *   1. IN_CORRIDOR edges — H3 k-ring k≤2 around the station cell
 *      (k=1 ≈ ½-mi TOD walkshed; k=2 = strategic corridor band):
 *        (:ZoneCell)-[:IN_CORRIDOR {ring_distance: 0|1|2}]->(:HARTStation)
 *      MATCH-only on existing backbone cells — ocean/off-backbone ring
 *      cells are dropped by design. A cell near two stations gets one
 *      edge per station, each with its own ring_distance.
 *
 *   2. TODProfile node + (:HARTStation)-[:HAS_TOD_PROFILE]->(:TODProfile).
 *      Classification is derived from the county-zoning mix (AG12 P2 data)
 *      across the station's k≤2 band:
 *        - rural_agricultural  — AG-1/AG-2 on ≥ half the zoned band cells
 *        - urban_dense         — dense urban codes (B/BMX/I/IMX/A/AMX/
 *                                Kak/R-3.5/R-5) on ≥ half the zoned band cells
 *        - transitional        — everything else / thin coverage
 *
 * Idempotent (MERGE throughout). Run: node stations/seed-corridor.mjs
 */

import { gridDisk, gridDistance } from 'h3-js';
import { runQuery, closeDriver } from '../db.mjs';

const K = 2;
const DATA_SOURCE = 'AG12 P3 corridor seeding (k=2 res-8 ring around HART station cells)';

const AG_CODES = new Set(['AG-1', 'AG-2']);
const URBAN_DENSE_CODES = new Set([
  'B-1', 'B-2', 'BMX-3', 'BMX-4', 'I-1', 'I-2', 'I-3', 'IMX-1',
  'A-1', 'A-2', 'A-3', 'AMX-1', 'AMX-2', 'AMX-3', 'Kak', 'R-3.5', 'R-5',
]);

const stations = (await runQuery(
  `MATCH (s:HARTStation)-[:WITHIN_CELL]->(zc:ZoneCell)
   RETURN s.id AS id, s.name AS name, zc.h3_cell AS cell ORDER BY s.id`
)).map(r => ({ id: r.get('id'), name: r.get('name'), cell: r.get('cell') }));

console.log(`${stations.length} stations`);

let totalEdges = 0;
const corridorCells = new Set();

for (const station of stations) {
  // Ring cells with their distance from the station cell
  const ring = gridDisk(station.cell, K).map(c => ({
    h3: c,
    ring_distance: gridDistance(station.cell, c),
  }));

  // 1) IN_CORRIDOR edges (existing backbone cells only)
  const res = await runQuery(
    `UNWIND $ring AS r
     MATCH (zc:ZoneCell {h3_cell: r.h3})
     MATCH (s:HARTStation {id: $stationId})
     MERGE (zc)-[e:IN_CORRIDOR]->(s)
     SET e.ring_distance = r.ring_distance,
         e.data_source = $dataSource
     RETURN zc.h3_cell AS cell, r.ring_distance AS d,
            zc.county_zoning_codes AS codes`,
    { ring, stationId: station.id, dataSource: DATA_SOURCE }
  );

  const bandCells = res.map(r => ({
    cell: r.get('cell'),
    codes: r.get('codes') || [],
  }));
  bandCells.forEach(c => corridorCells.add(c.cell));
  totalEdges += bandCells.length;

  // 2) Classification from the band's county-zoning mix
  const zoned = bandCells.filter(c => c.codes.length > 0);
  const agCount = zoned.filter(c => c.codes.some(x => AG_CODES.has(x))).length;
  const denseCount = zoned.filter(c => c.codes.some(x => URBAN_DENSE_CODES.has(x))).length;

  let classification = 'transitional';
  if (zoned.length >= 3) {
    if (agCount >= zoned.length / 2) classification = 'rural_agricultural';
    else if (denseCount >= zoned.length / 2) classification = 'urban_dense';
  }

  await runQuery(
    `MATCH (s:HARTStation {id: $stationId})
     MERGE (t:TODProfile {id: $todId})
     SET t.classification = $classification,
         t.transit_access = 'high',
         t.station_name = $stationName,
         t.band_cells = $bandCellCount,
         t.band_zoned_cells = $zonedCount,
         t.description = $description,
         t.data_source = $dataSource,
         t.created_at = coalesce(t.created_at, datetime()),
         t.updated_at = datetime()
     MERGE (s)-[:HAS_TOD_PROFILE]->(t)`,
    {
      stationId: station.id,
      todId: `tod-${station.id}`,
      classification,
      stationName: station.name,
      bandCellCount: bandCells.length,
      zonedCount: zoned.length,
      description: `TOD profile for ${station.name} — classification derived from Honolulu LUO mix across its k<=${K} corridor band (${agCount} ag / ${denseCount} dense of ${zoned.length} zoned cells)`,
      dataSource: DATA_SOURCE,
    }
  );

  console.log(`  ${station.id}: ${bandCells.length} band cells (${zoned.length} zoned, ${agCount} ag, ${denseCount} dense) → ${classification}`);
}

console.log(`\nIN_CORRIDOR edges written: ${totalEdges}`);
console.log(`distinct corridor cells: ${corridorCells.size}`);
await closeDriver();
