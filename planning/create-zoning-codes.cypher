// ============================================================================
// Stage D — Seed the v1 ZoningCode vocabulary + HAS_ZONING edges
//
// AG12 P2. Eight ZoningCode nodes — the county-zoning axis the two-axis
// siting gate scores against (Class F: AG-1/AG-2; Class C: I-1/I-2/I-3/
// IMX-1/B-1/B-2). Other LUO codes (R-*, P-*, A-*, BMX, Kak, …) remain on
// ZoneCell.county_zoning_codes as verbatim passthrough, unscored.
//
// HAS_ZONING: (:ZoneCell)-[:HAS_ZONING]->(:ZoningCode) for every backbone
// cell whose county_zoning_codes contains a seeded code.
//
// Prerequisites: Stage C (load-zoning-cell-codes.cypher) has run.
// ============================================================================

UNWIND [
  {code: 'AG-1',  name: 'AG-1 Restricted Agriculture District',        siting_class: 'F',
   permitted_uses: ['agriculture', 'farm_dwelling', 'accessory_processing', 'timber_mill'],
   food_systems_compatibility: true,
   description: 'Honolulu LUO restricted agriculture — high-productivity working lands; HRS 205 ag-district envelope applies'},
  {code: 'AG-2',  name: 'AG-2 General Agriculture District',           siting_class: 'F',
   permitted_uses: ['agriculture', 'farm_dwelling', 'accessory_processing', 'timber_mill', 'agricultural_commercial'],
   food_systems_compatibility: true,
   description: 'Honolulu LUO general agriculture — working lands; HRS 205 ag-district envelope applies'},
  {code: 'B-1',   name: 'B-1 Neighborhood Business District',          siting_class: 'C',
   permitted_uses: ['retail', 'commercial_kitchen', 'food_retail'],
   food_systems_compatibility: true,
   description: 'Neighborhood business — corridor value-added retail scale'},
  {code: 'B-2',   name: 'B-2 Community Business District',             siting_class: 'C',
   permitted_uses: ['retail', 'commercial_kitchen', 'food_hall', 'distribution_light'],
   food_systems_compatibility: true,
   description: 'Community business — corridor value-added and food-hall scale'},
  {code: 'I-1',   name: 'I-1 Limited Industrial District',             siting_class: 'C',
   permitted_uses: ['value_added_processing', 'distribution_center', 'light_industrial'],
   food_systems_compatibility: true,
   description: 'Limited industrial — corridor multi-farm processing and distribution'},
  {code: 'I-2',   name: 'I-2 Intensive Industrial District',           siting_class: 'C',
   permitted_uses: ['value_added_processing', 'distribution_center', 'mass_timber_fabrication', 'heavy_industrial'],
   food_systems_compatibility: true,
   description: 'Intensive industrial — corridor processing, fabrication, and logistics'},
  {code: 'I-3',   name: 'I-3 Waterfront Industrial District',          siting_class: 'C',
   permitted_uses: ['value_added_processing', 'distribution_center', 'maritime_industrial'],
   food_systems_compatibility: true,
   description: 'Waterfront industrial — harbor-adjacent processing and logistics'},
  {code: 'IMX-1', name: 'IMX-1 Industrial-Commercial Mixed Use District', siting_class: 'C',
   permitted_uses: ['value_added_processing', 'commercial_kitchen', 'food_incubator', 'mixed_industrial_commercial'],
   food_systems_compatibility: true,
   description: 'Industrial-commercial mixed use — corridor food-incubator and light-processing scale'}
] AS zc_def

MERGE (k:ZoningCode {code: zc_def.code})
SET k.name                       = zc_def.name,
    k.siting_class               = zc_def.siting_class,
    k.permitted_uses             = zc_def.permitted_uses,
    k.food_systems_compatibility = zc_def.food_systems_compatibility,
    k.description                = zc_def.description,
    k.data_source                = "City and County of Honolulu LUO; v1 scope per AG12-CORRIDOR-SITING §3.2",
    k.created_at                 = coalesce(k.created_at, datetime()),
    k.updated_at                 = datetime();

// ---------------------------------------------------------------------------

MATCH (zc:ZoneCell)
WHERE zc.county_zoning_codes IS NOT NULL
UNWIND zc.county_zoning_codes AS code
MATCH (k:ZoningCode {code: code})
MERGE (zc)-[:HAS_ZONING]->(k);
