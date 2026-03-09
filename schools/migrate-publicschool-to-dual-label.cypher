// ============================================================================
// Migration — Merge standalone PublicSchool nodes into dual-labeled Zone:PublicSchool
//
// The original ingestion (2026-02-20) created standalone :PublicSchool nodes
// with IDs like "school-{sch_code}" and VertexAI embeddings. The transform
// pipeline (Stage A) creates :Zone nodes with IDs like "SCH_{objectid}".
//
// This migration:
//   1. Copies embedding + coordinate properties from :PublicSchool → :Zone
//      (matched on sch_code)
//   2. Adds the :PublicSchool label to the Zone nodes (dual-label)
//   3. Deletes the old standalone :PublicSchool nodes + their LOCATED_IN edges
//
// Prerequisites:
//   - Stage A (create-schools-zones.cypher) already run
//   - Stage B (load-schools-zone-cells.cypher) already run
//   - Old PublicSchool nodes still in graph
//
// Run order: Stage A → Stage B → this migration (one-time)
// ============================================================================

// Step 1: Copy properties from old PublicSchool → Zone (matched on sch_code)
//         and apply the :PublicSchool label to the Zone node
MATCH (old:PublicSchool)
WHERE NOT old:Zone
MATCH (z:Zone {sch_code: old.code})

// Apply dual label
SET z:PublicSchool,

    // Coordinates (point features)
    z.lat              = old.lat,
    z.lng              = old.lng,
    z.h3_resolution8   = old.h3_resolution8,
    z.h3_resolution9   = old.h3_resolution9,

    // Category derived from ingestion
    z.category         = old.category,
    z.grade_range      = old.grade_range,

    // VertexAI embedding
    z.embedding                = old.embedding,
    z.embedding_model          = old.embedding_model,
    z.embedding_generated_at   = old.embedding_generated_at,
    z.embedding_source_text    = old.embedding_source_text,

    // Preserve the old PublicSchool ID as an alias for cross-reference
    z.legacy_id        = old.id,

    z.updated_at       = datetime()

RETURN count(z) AS merged_count;

// ============================================================================
// Step 2: Verify the merge before deleting old nodes
// ============================================================================
// Run this query to check counts before proceeding to Step 3:
//
//   MATCH (z:Zone:PublicSchool) RETURN count(z) AS dual_labeled;
//   MATCH (old:PublicSchool) WHERE NOT old:Zone RETURN count(old) AS remaining_standalone;
//
// Expected: ~257 dual-labeled, 0 remaining standalone (some Zone schools
// may not have matched if they weren't in the original 257)
// ============================================================================

// Step 3: Delete old standalone PublicSchool nodes and their edges
// IMPORTANT: Only run after verifying Step 1 results
//
// MATCH (old:PublicSchool)
// WHERE NOT old:Zone
// DETACH DELETE old
// RETURN count(old) AS deleted;
