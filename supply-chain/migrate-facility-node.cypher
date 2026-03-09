// ============================================================================
// Migrate FacilityNode → dual-label (:FacilityNode:Facility)
//
// Adds the :Facility label to all existing FacilityNode nodes and populates
// the canonical Facility properties (facility_id, facility_type, moku_id,
// status, gs1_gln) from existing FacilityNode data.
//
// The :FacilityNode label is preserved for backwards compatibility with
// legacy queries and the LangGraph food hub workflow.
//
// Safe to re-run (idempotent SET operations).
//
// Prerequisites: Facility constraint must exist:
//   CREATE CONSTRAINT facility_id_unique IF NOT EXISTS
//   FOR (f:Facility) REQUIRE f.facility_id IS UNIQUE
// ============================================================================

// Step 1: Add :Facility label and canonical properties to all FacilityNode nodes
MATCH (fn:FacilityNode)
WHERE NOT fn:Facility
SET fn:Facility,
    fn.facility_id = CASE
      WHEN fn.facility_id IS NOT NULL THEN fn.facility_id
      ELSE 'fac-' + coalesce(fn.district, 'unknown') + '-' +
           toLower(replace(replace(replace(fn.name, ' ', '-'), "'", ''), ',', ''))
    END,
    fn.facility_type = CASE fn.facility_type
      WHEN 'school' THEN 'school'
      WHEN 'community_center' THEN 'community_center'
      WHEN 'farm' THEN 'farm'
      WHEN 'commercial_property' THEN 'commercial_property'
      ELSE 'other'
    END,
    fn.moku_id = coalesce(fn.moku_id, fn.district),
    fn.h3_index = fn.h3_index,
    fn.coordinates_lat = CASE WHEN fn.location IS NOT NULL THEN fn.location.lat ELSE NULL END,
    fn.coordinates_lng = CASE WHEN fn.location IS NOT NULL THEN fn.location.lng ELSE NULL END,
    fn.status = coalesce(fn.status, 'active'),
    fn.gs1_gln = NULL,
    fn.source_system = 'legacy/FacilityNode',
    fn.updated_at = datetime()
RETURN count(fn) AS migrated;
