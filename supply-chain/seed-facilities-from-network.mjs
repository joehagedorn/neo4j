/**
 * Seed Facility Nodes from Regional Network Data
 *
 * Onboards the 9 farm-web-seed entities as Facility nodes in AuraDB,
 * linking them to the spatial backbone (Moku, ZoneCell) via H3 resolution-8.
 *
 * Entity role → Facility type mapping:
 *   hub        → district_hub
 *   producer   → food_manufacturing
 *   grower     → farm
 *   distributor → other
 *
 * Run from transforms/ directory: node supply-chain/seed-facilities-from-network.mjs
 */

import { runWrite, closeDriver } from '../db.mjs';
import h3 from 'h3-js';

// ============================================================================
// Seed data — inline from src/data/farm-web-seed.ts
// ============================================================================

const GS1_COMPANY_PREFIX = '8600041124';

function calculateGS1CheckDigit(digits) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

function generateGLN(locationRef) {
  const base = `${GS1_COMPANY_PREFIX}${locationRef}`;
  return `${base}${calculateGS1CheckDigit(base)}`;
}

const ENTITY_ROLE_TO_FACILITY_TYPE = {
  hub: 'district_hub',
  producer: 'food_manufacturing',
  grower: 'farm',
  distributor: 'other',
};

const ENTITIES = [
  { slug: 'bgood-farms-hub', name: 'bGood Farms Hub', lat: 21.3069, lng: -157.8583, island: 'Oahu', county: 'Honolulu', location: 'Honolulu', entityRole: 'hub', supplyChainRole: 'aggregator', gln: generateGLN('00') },
  { slug: 'sunrise-valley-farm', name: 'Sunrise Valley Farm', lat: 21.5756, lng: -158.1312, island: 'Oahu', county: 'Honolulu', location: 'Waialua, Oahu', entityRole: 'grower', supplyChainRole: 'source', gln: generateGLN('01') },
  { slug: 'maui-mountain-orchards', name: 'Maui Mountain Orchards', lat: 20.8380, lng: -156.2920, island: 'Maui', county: 'Maui', location: 'Upcountry Maui', entityRole: 'grower', supplyChainRole: 'source', gln: generateGLN('02') },
  { slug: 'kailani-apiary', name: 'Kailani Apiary', lat: 19.4460, lng: -155.2340, island: 'Hawaii', county: 'Hawaii', location: 'Volcano Village, Big Island', entityRole: 'grower', supplyChainRole: 'source', gln: generateGLN('03') },
  { slug: 'kahana-bay-farm', name: 'Kahana Bay Farm', lat: 21.5500, lng: -157.8790, island: 'Oahu', county: 'Honolulu', location: 'North Shore Oahu', entityRole: 'grower', supplyChainRole: 'source', gln: generateGLN('04') },
  { slug: 'hanalei-valley-rice', name: 'Hanalei Valley Rice Co.', lat: 22.2050, lng: -159.5020, island: 'Kauai', county: 'Kauai', location: 'Hanalei Valley, Kauai', entityRole: 'grower', supplyChainRole: 'source', gln: generateGLN('05') },
  { slug: 'big-island-bean-co', name: 'Big Island Bean Co.', lat: 19.9975, lng: -155.6600, island: 'Hawaii', county: 'Hawaii', location: 'Waimea, Big Island', entityRole: 'grower', supplyChainRole: 'source', gln: generateGLN('06') },
  { slug: 'pacific-fresh-foods', name: 'Pacific Fresh Foods', lat: 20.8893, lng: -156.4729, island: 'Maui', county: 'Maui', location: 'Central Maui', entityRole: 'producer', supplyChainRole: 'processor', gln: generateGLN('07') },
  { slug: 'island-pure-beverages', name: 'Island Pure Beverages', lat: 21.5800, lng: -158.1040, island: 'Oahu', county: 'Honolulu', location: 'North Shore, Oahu', entityRole: 'producer', supplyChainRole: 'processor', gln: generateGLN('08') },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== Seed Facilities from Regional Network Data ===\n');

  let created = 0;
  let linked = 0;

  for (const entity of ENTITIES) {
    const h3Index = h3.latLngToCell(entity.lat, entity.lng, 8);
    const facilityType = ENTITY_ROLE_TO_FACILITY_TYPE[entity.entityRole] || 'other';
    const facilityId = `fac-${entity.slug}`;

    console.log(`\n--- ${entity.name} ---`);
    console.log(`  facility_id: ${facilityId}`);
    console.log(`  facility_type: ${facilityType}`);
    console.log(`  gs1_gln: ${entity.gln}`);
    console.log(`  h3_index: ${h3Index}`);
    console.log(`  coordinates: ${entity.lat}, ${entity.lng}`);

    // Step 1: MERGE Facility node
    const nodeResult = await runWrite(`
      MERGE (f:Facility {facility_id: $facilityId})
      ON CREATE SET
        f.name = $name,
        f.facility_type = $facilityType,
        f.moku_id = $mokuId,
        f.h3_index = $h3Index,
        f.coordinates_lat = $lat,
        f.coordinates_lng = $lng,
        f.address = $location,
        f.status = 'active',
        f.gs1_gln = $gln,
        f.island = $island,
        f.county = $county,
        f.entity_role = $entityRole,
        f.supply_chain_role = $supplyChainRole,
        f.source_system = 'dataconnect/regional-network',
        f.created_at = datetime(),
        f.updated_at = datetime()
      ON MATCH SET
        f.name = $name,
        f.facility_type = $facilityType,
        f.h3_index = $h3Index,
        f.coordinates_lat = $lat,
        f.coordinates_lng = $lng,
        f.gs1_gln = $gln,
        f.island = $island,
        f.county = $county,
        f.entity_role = $entityRole,
        f.supply_chain_role = $supplyChainRole,
        f.updated_at = datetime()
      RETURN f.facility_id AS id, labels(f) AS labels
    `, {
      facilityId,
      name: entity.name,
      facilityType,
      mokuId: entity.slug, // Placeholder — will be resolved by backbone lookup
      h3Index,
      lat: entity.lat,
      lng: entity.lng,
      location: entity.location,
      gln: entity.gln,
      island: entity.island,
      county: entity.county,
      entityRole: entity.entityRole,
      supplyChainRole: entity.supplyChainRole,
    });

    if (nodeResult.length > 0) {
      console.log(`  ✓ Node: ${nodeResult[0].get('id')} [${nodeResult[0].get('labels').join(':')}]`);
      created++;
    }

    // Step 2: Link to ZoneCell via H3 index (if cell exists in backbone)
    const cellResult = await runWrite(`
      MATCH (f:Facility {facility_id: $facilityId})
      MATCH (zc:ZoneCell {h3_cell: $h3Index})
      MERGE (f)-[r:LOCATED_IN_CELL]->(zc)
      SET r.synced_at = datetime()
      WITH f, zc
      MATCH (zc)-[:WITHIN]->(m:Moku)
      MERGE (f)-[rm:LOCATED_IN]->(m)
      SET rm.primary = true, rm.synced_at = datetime()
      SET f.moku_id = m.name
      RETURN m.name AS moku, m.id AS moku_id, zc.h3_cell AS cell
    `, { facilityId, h3Index });

    if (cellResult.length > 0) {
      const moku = cellResult[0].get('moku');
      const mokuId = cellResult[0].get('moku_id');
      console.log(`  ✓ Backbone: ${moku} (${mokuId}) via ${h3Index}`);
      linked++;
    } else {
      console.log(`  ⚠ H3 cell ${h3Index} not found in backbone — spatial link skipped`);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Facilities created/updated: ${created}`);
  console.log(`Backbone links established: ${linked}`);

  // Verification query
  const verification = await runWrite(`
    MATCH (f:Facility)
    WHERE f.source_system = 'dataconnect/regional-network'
    OPTIONAL MATCH (f)-[:LOCATED_IN]->(m:Moku)
    OPTIONAL MATCH (f)-[:LOCATED_IN_CELL]->(zc:ZoneCell)
    RETURN f.facility_id AS id,
           f.name AS name,
           f.facility_type AS type,
           f.gs1_gln AS gln,
           m.name AS moku,
           zc.h3_cell AS cell
    ORDER BY f.name
  `);

  console.log('\n=== Facility Registry ===');
  console.log('ID | Name | Type | GLN | Moku | H3 Cell');
  console.log('---|------|------|-----|------|--------');
  for (const rec of verification) {
    console.log(`${rec.get('id')} | ${rec.get('name')} | ${rec.get('type')} | ${rec.get('gln')} | ${rec.get('moku') || '—'} | ${rec.get('cell') || '—'}`);
  }

  await closeDriver();
}

main().catch(err => {
  console.error('Seeding failed:', err);
  closeDriver().then(() => process.exit(1));
});
