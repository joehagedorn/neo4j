# Interpreting Career Progrom JSON Structure
For each key like:

"Ag Food Production Business (AFP)"
"Animal Systems (ANS)"
"Food Systems (FS)"
"Natural Resources Management (NRM)"

…the value is an array of “rows”, each with:

``cypher
{
  "TITLE": "...",         // cluster name, or OVERRIDE
  "LEVEL": 0 | 1 | 2 | 3, // HS, entry, CC, university tracks
  "LEVEL_TYPE": "...",    // CUSTOM, COURSE, TRAINING, JOB_TITLE, etc.
  "LEVEL_INFO": "...",    // e.g. PATHWAY_TITLE, SOC, RECOMMENDED EDUCATION
  "LEVEL_DATA": "..."     // text, SOC codes, URLs, etc.
}

Semantics:

LEVEL = 0 → Program-of-study metadata (title, description, early college URL, intro text).
LEVEL = 1 → Entry-level track (short-term training, entry occupations).
LEVEL = 2 → Community college track (2-year).
LEVEL = 3 → University track (4-year).

Key payloads:

Pathway title & description

LEVEL_TYPE="CUSTOM" / LEVEL_INFO="PATHWAY_TITLE"
LEVEL_TYPE="CUSTOM" / LEVEL_INFO="PATHWAY_DESCRIPTION"


SOC occupations

LEVEL_TYPE="JOB_TITLE" + LEVEL_INFO="RELATED OCCUPATIONS"
LEVEL_DATA is a comma-separated list of SOC codes, e.g. "19-4012,35-2021,45-2092".


Training options

LEVEL_TYPE="TRAINING" with different LEVEL_INFO:

"SHORT-TERM TRAINING OPTIONS: CREDITED"
"SHORT-TERM TRAINING OPTIONS: NON-CREDIT"
"RECOMMENDED EDUCATION"
"RECOMMENDED CERTIFICATIONS"


LEVEL_DATA = "Leeward Community College: Sustainable Agriculture", "ServSafe", etc.



So we can think of each top-level key (AFP, ANS, FS, NRM) as a high‑school Program of Study within the AFNR Career Pathway.

## 2. Neo4j Schema: CareerPathway → ProgramOfStudy → Training / Credential → Occupation
Here’s a schema tailored exactly to this data, still aligned with the type system we designed.
2.1 Node Labels & Key Properties
1️⃣ CareerPathway
Cluster like Agriculture, Food and Natural Resources (AFNR).

``cypher
Label: :CareerPathway

Properties:
- id          // e.g. "AFNR"
- name        // "Agriculture, Food and Natural Resources"
- description // high-level pathway description (optional)
- source      // e.g., "HawaiiCareerPathways"
- created_at, updated_at

You already have the cluster name "Agriculture Food and Natural Resources" in TITLE at multiple rows.

We will attach this CareerPathway to ZoneType {id:"ag"} so AFNR is explicitly aligned with agricultural planning / IAL zoning. [topics | Txt]


ProgramOfStudy
The specific high school program: AFP, ANS, FS, NRM.

``cypher
Label: :ProgramOfStudy

Properties:
- id              // e.g. "AFNR_AFP", "AFNR_ANS"
- name            // "Ag Food Production Business (AFP)"
- description     // PATHWAY_DESCRIPTION
- cluster_id      // e.g. "AFNR"
- early_college_url // from LEVEL_TYPE="EARLYCOLLEGE"
- start_info      // from LEVEL_TYPE="START_INFORMATION"
- source
- created_at, updated_at
Each top-level key becomes one ProgramOfStudy.

## 3 TrainingProgram
Each training/education option (CC certificate, UH degree, non-credit training) becomes a TrainingProgram node.

Label: :TrainingProgram

Properties:
- id           // derived stable ID, e.g., "LeewardCC:SustainableAgriculture"
- name         // text from LEVEL_DATA
- modality     // maybe "credited", "non-credit" from LEVEL_INFO
- track_level  // "entry", "cc", "university" (from LEVEL)
- category     // "short_term", "recommended_education", "other"
- source       // "programs.json"
- created_at, updated_at

## 4 Credential
Items under "RECOMMENDED CERTIFICATIONS" (and similar) are best modeled as Credentials.
Label: :Credential

Properties:
- id          // slug of name, e.g. "BLS", "ServSafe", "OSHA10_AG"
- name        // "Basic Life Support (BLS) Certification"
- type        // "Certification"
- issuer      // optional (e.g., "OSHA", "ServSafe", “DOH”)
- source      // "programs.json"
- created_at, updated_at

## 5 Occupation
SOC-code-based jobs.
Label: :Occupation

Properties:
- soc_code    // e.g. "45-2092"
- title       // optional label or looked up externally later
- source      // "programs.json" or SOC data source later
- created_at, updated_at

We will treat LEVEL as the “rung” on the ladder:

LEVEL 1 → stage = "entry"
LEVEL 2 → stage = "cc"
LEVEL 3 → stage = "university"

…and tag relationships accordingly.

### Relationships
At a high level:

(CareerPathway)-[:INCLUDES_PROGRAM]->(ProgramOfStudy)
(ProgramOfStudy)-[:HAS_TRAINING]->(TrainingProgram)
(ProgramOfStudy)-[:PREPARES_FOR {stage}]->(Occupation)
(TrainingProgram)-[:PREPARES_FOR {stage}]->(Occupation)
(TrainingProgram)-[:LEADS_TO_CREDENTIAL]->(Credential)

(CareerPathway)-[:ALIGNS_WITH_ZONE_TYPE]->(ZoneType {id:"ag"})

Training program providers are now spatially connected via the IntraZone pattern:
post-secondary institutions (85 campuses) are mapped at res-14 with IntraZone → ANCHORS → Zone,
bridged to the res-8 moku backbone via WITHIN_CELL → ZoneCell → WITHIN → Moku.

Constraints for Type Safety

``cypher
CREATE CONSTRAINT careerpathway_id_unique IF NOT EXISTS
FOR (cp:CareerPathway)
REQUIRE cp.id IS UNIQUE;

CREATE CONSTRAINT programofstudy_id_unique IF NOT EXISTS
FOR (ps:ProgramOfStudy)
REQUIRE ps.id IS UNIQUE;

CREATE CONSTRAINT trainingprogram_id_unique IF NOT EXISTS
FOR (tp:TrainingProgram)
REQUIRE tp.id IS UNIQUE;

CREATE CONSTRAINT credential_id_unique IF NOT EXISTS
FOR (c:Credential)
REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT occupation_soc_unique IF NOT EXISTS
FOR (o:Occupation)
REQUIRE o.soc_code IS UNIQUE;

Cypher Templates for Importing This programs.json Structure
Assumed Parameter Shape from Your App
I recommend that your app transform the raw JSON (object with keys) into an array of:

[
  {
    "program_key": "Ag Food Production Business (AFP)",
    "entries": [ ... all the rows you showed ... ]
  },
  {
    "program_key": "Animal Systems (ANS)",
    "entries": [ ... ]
  },
  ...
]
Then you pass that array as parameter $programs:
``cypher
session.run("""
UNWIND $programs AS p
// cypher...
""", programs=programs_array)

This keeps Cypher clean and avoids tricky dynamic map access.

### Step 0 – Ensure AFNR CareerPathway and ZoneType alignment
``cypher
// ZoneType 'ag' exists already from your type system
MERGE (zt:ZoneType {id:"ag"})
SET zt.label = "Agricultural Planning Zone";

// AFNR CareerPathway
MERGE (cp:CareerPathway {id:"AFNR"})
SET cp.name       = "Agriculture, Food, and Natural Resources",
    cp.source     = "HawaiiCareerPathways",
    cp.updated_at = datetime(),
    cp.created_at = coalesce(cp.created_at, datetime());

// Align AFNR pathway with 'ag' zone type
MERGE (cp)-[:ALIGNS_WITH_ZONE_TYPE]->(zt);

### Step 1 – Create ProgramOfStudy nodes (AFP, ANS, FS, NRM)

``cypher
UNWIND $programs AS p
WITH p.program_key AS programKey, p.entries AS entries

// Get PATHWAY_TITLE & PATHWAY_DESCRIPTION rows
WITH programKey,
     [e IN entries WHERE e.LEVEL = 0 AND e.LEVEL_TYPE = "CUSTOM" AND e.LEVEL_INFO = "PATHWAY_TITLE"][0] AS titleEntry,
     [e IN entries WHERE e.LEVEL = 0 AND e.LEVEL_TYPE = "CUSTOM" AND e.LEVEL_INFO = "PATHWAY_DESCRIPTION"][0] AS descEntry,
     [e IN entries WHERE e.LEVEL = 0 AND e.LEVEL_TYPE = "EARLYCOLLEGE"][0] AS earlyCollegeEntry,
     [e IN entries WHERE e.LEVEL = 0 AND e.LEVEL_TYPE = "START_INFORMATION"][0] AS startInfoEntry

WITH programKey,
     coalesce(titleEntry.LEVEL_DATA, programKey) AS programName,
     descEntry.LEVEL_DATA                         AS programDescription,
     earlyCollegeEntry.LEVEL_INFO                 AS earlyCollegeUrl,
     startInfoEntry.LEVEL_DATA                    AS startText

// Build a stable ID, e.g. "AFNR_Ag_Food_Production_Business_AFP"
WITH programKey, programName, programDescription, earlyCollegeUrl, startText,
     "AFNR_" + replace(replace(programName, " ", "_"), "(", "") AS programId

MERGE (ps:ProgramOfStudy {id: programId})
SET ps.name             = programName,
    ps.description      = programDescription,
    ps.early_college_url= earlyCollegeUrl,
    ps.start_info       = startText,
    ps.cluster_id       = "AFNR",
    ps.source           = "programs.json",
    ps.updated_at       = datetime(),
    ps.created_at       = coalesce(ps.created_at, datetime());

// Link to AFNR CareerPathway
WITH ps
MATCH (cp:CareerPathway {id:"AFNR"})
MERGE (cp)-[:INCLUDES_PROGRAM]->(ps);

Note: You can change how programId is generated; just keep it stable and unique.


### Step 2 – Attach Occupations (by LEVEL / stage)
We’ll do three passes: LEVEL=1 (entry), LEVEL=2 (cc), LEVEL=3 (university).
Entry-level occupations (LEVEL 1)

``cypher
UNWIND $programs AS p
WITH p.program_key AS programKey, p.entries AS entries

// Derive the same programId logic as above (must match)
WITH programKey, entries,
     [e IN entries WHERE e.LEVEL = 0 AND e.LEVEL_TYPE = "CUSTOM" AND e.LEVEL_INFO = "PATHWAY_TITLE"][0] AS titleEntry
WITH programKey, entries,
     "AFNR_" + replace(replace(coalesce(titleEntry.LEVEL_DATA, programKey), " ", "_"), "(", "") AS programId

MATCH (ps:ProgramOfStudy {id: programId})

// Get JOB_TITLE rows at LEVEL 1
WITH ps, entries
UNWIND [e IN entries WHERE e.LEVEL = 1 AND e.LEVEL_TYPE = "JOB_TITLE" AND e.LEVEL_INFO = "RELATED OCCUPATIONS"] AS occEntry
WITH ps, occEntry, split(occEntry.LEVEL_DATA, ",") AS soc_codes
UNWIND soc_codes AS raw_soc

WITH ps, trim(raw_soc) AS soc_code
WHERE soc_code <> ""

MERGE (o:Occupation {soc_code: soc_code})
SET o.source      = coalesce(o.source, "programs.json"),
    o.updated_at  = datetime(),
    o.created_at  = coalesce(o.created_at, datetime())

MERGE (ps)-[:PREPARES_FOR {stage:"entry"}]->(o);

CC-level occupations (LEVEL 2)
Repeat with LEVEL = 2 and stage:"cc":
``cypher
UNWIND $programs AS p
...
// same programId calculation
...
UNWIND [e IN entries WHERE e.LEVEL = 2 AND e.LEVEL_TYPE = "JOB_TITLE" AND e.LEVEL_INFO = "RELATED OCCUPATIONS"] AS occEntry
...
MERGE (ps)-[:PREPARES_FOR {stage:"cc"}]->(o);
University-level occupations (LEVEL 3)
Similarly, LEVEL = 3 and stage:"university".

### Step 3 – Attach TrainingPrograms & Credentials
We’ll use LEVEL to derive the track, and LEVEL_INFO to categorize training.
3.5.1 TrainingPrograms from TRAINING entries
``cypher
UNWIND $programs AS p
WITH p.program_key AS programKey, p.entries AS entries

WITH programKey, entries,
     [e IN entries WHERE e.LEVEL = 0 AND e.LEVEL_TYPE = "CUSTOM" AND e.LEVEL_INFO = "PATHWAY_TITLE"][0] AS titleEntry
WITH programKey, entries,
     "AFNR_" + replace(replace(coalesce(titleEntry.LEVEL_DATA, programKey), " ", "_"), "(", "") AS programId,
     entries

MATCH (ps:ProgramOfStudy {id: programId})

// All TRAINING entries (we’ll branch by LEVEL_INFO)
WITH ps, entries
UNWIND [e IN entries WHERE e.LEVEL_TYPE = "TRAINING"] AS t

WITH ps, t,
     CASE t.LEVEL
       WHEN 1 THEN "entry"
       WHEN 2 THEN "cc"
       WHEN 3 THEN "university"
       ELSE "other"
     END AS trackStage,
     t.LEVEL_INFO AS info,
     t.LEVEL_DATA AS label

// Decide what kind of training this is
WITH ps, trackStage, info, label,
     CASE
       WHEN info CONTAINS "RECOMMENDED CERTIFICATIONS" THEN "certification"
       WHEN info CONTAINS "CERTIFICATIONS" THEN "certification"
       WHEN info CONTAINS "SHORT-TERM TRAINING OPTIONS: CREDITED" THEN "short_term_credited"
       WHEN info CONTAINS "SHORT-TERM TRAINING OPTIONS: NON-CREDIT" THEN "short_term_noncredit"
       WHEN info CONTAINS "RECOMMENDED EDUCATION" THEN "degree_track"
       ELSE "other"
     END AS trainingType

// Branch: Certifications → Credential ; others → TrainingProgram
FOREACH (_ IN CASE WHEN trainingType = "certification" THEN [1] ELSE [] END |
  MERGE (c:Credential {id: replace(label, " ", "_")})
  SET c.name       = label,
      c.type       = "Certification",
      c.source     = "programs.json",
      c.updated_at = datetime(),
      c.created_at = coalesce(c.created_at, datetime())
  MERGE (ps)-[:RECOMMENDS_CREDENTIAL {stage:trackStage}]->(c)
)

FOREACH (_ IN CASE WHEN trainingType <> "certification" THEN [1] ELSE [] END |
  MERGE (tp:TrainingProgram {id: replace(label, " ", "_")})
  SET tp.name        = label,
      tp.track_level = trackStage,
      tp.category    = trainingType,
      tp.source      = "programs.json",
      tp.updated_at  = datetime(),
      tp.created_at  = coalesce(tp.created_at, datetime())
  MERGE (ps)-[:HAS_TRAINING]->(tp)
);
Later, you can parse label into Institution + ProgramName (split on the first :) and connect TrainingProgram to Institution; that’s where you will spatialize to ZoneCell.


### Optionally: map CareerPathway to Planning Zones
Once this career graph exists, you can tie it into your planning type system:
``cypher
// Already created AFNR pathway and ZoneType 'ag'
MATCH (cp:CareerPathway {id:"AFNR"})
MATCH (zt:ZoneType {id:"ag"})
MERGE (cp)-[:ALIGNS_WITH_ZONE_TYPE]->(zt);

Zone nodes now exist for IAL (15), ag baseline (5,039), reserves (376), zoning (1,965),
opportunity zones (25), highways (2,075), government land (25,129), schools (292),
post-secondary (85), stations (21), and transit corridors (4) — all linked to the
res-8 moku backbone. Point features (schools, campuses, stations) use IntraZone anchors
at res-14 for high-fidelity spatial positioning.

Training availability is mapped via post-secondary IntraZone → ZoneCell → Moku.
Demand (occupations) can be mapped at ZoneCell level.
Roll up by MokuDistrict and Moku for district-level planning.


## How This Fits Type System & District Governance
Type-wise:

CareerPathway, ProgramOfStudy, TrainingProgram, Credential, Occupation are node labels (structural types).
Domain types ("entry", "cc", "university", "short_term_credited", "certification", etc.) are properties on nodes or relationships.
Relationships capture semantics:

INCLUDES_PROGRAM, HAS_TRAINING, PREPARES_FOR, LEADS_TO_CREDENTIAL, RECOMMENDS_CREDENTIAL


You do not create labels like :Entry or :CC; instead, you use properties like stage on relationships and track_level on TrainingProgram.

With post-secondary institutions now connected to the spatial backbone via IntraZone,
and demand data mapped at ZoneCell level, you can ask for each MokuDistrict:
“What AFNR programs and trainings exist that prepare for occupations in our
IAL + economic + supply_chain zones?” — and traverse the answer entirely in the graph:

```
CareerPathway (AFNR) → ZoneType (ag) → Zone (IAL/baseline) → ZoneCell → Moku
  ↕ same Moku
IntraZone → WITHIN_CELL → ZoneCell → Moku
IntraZone → ANCHORS → Zone (postsecondary) ← USES_TYPE ← ZoneType (postsecondary)
```

That’s exactly the district-level, project-based data governance & provenance you’re aiming for.