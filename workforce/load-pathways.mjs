/**
 * Load Career Pathways knowledge graph into Neo4j AuraDB
 *
 * Creates: CareerPathway, ProgramOfStudy, Occupation, TrainingProgram, Credential
 * Bridges to spatial graph via ALIGNS_WITH_ZONE_TYPE (AFNR → ag)
 *
 * Run: node workforce/load-pathways.mjs
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWrite, closeDriver } from '../db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 1. Cluster normalization: TITLE in programs.json → canonical name + ID
// ---------------------------------------------------------------------------

const CLUSTER_MAP = {
  'Advanced Manufacturing':
    { id: 'ADV_MFG', name: 'Advanced Manufacturing', topic: 1 },
  'Agriculture Food and Natural Resources':
    { id: 'AFNR', name: 'Agriculture, Food, and Natural Resources', topic: 2 },
  'Agriculture Food and Natural Resources Offered At 7 UH Community College Campuses':
    { id: 'AFNR', name: 'Agriculture, Food, and Natural Resources', topic: 2 },
  'Architectural Engineering':
    { id: 'ARCH_ENG', name: 'Architectural Design and Engineering Technology', topic: 3 },
  'Building and Construction':
    { id: 'BUILD_CONST', name: 'Building and Construction', topic: 4 },
  'Business Management, Finance, and Marketing':
    { id: 'BUS_FIN_MKT', name: 'Business Management, Finance, and Marketing', topic: 5 },
  'Culture Arts':
    { id: 'CULT_ARTS', name: 'Cultural Arts, Media, and Entertainment', topic: 6 },
  'Education Support':
    { id: 'EDU', name: 'Education', topic: 7 },
  'Education Teaching':
    { id: 'EDU', name: 'Education', topic: 7 },
  'Energy':
    { id: 'ENERGY', name: 'Energy', topic: 8 },
  'Health Services':
    { id: 'HEALTH', name: 'Health Services', topic: 9 },
  'Hospitality Tourism':
    { id: 'HOSP_TOUR', name: 'Hospitality, Tourism, and Recreation', topic: 10 },
  'Information Technology':
    { id: 'IT', name: 'Information Technology and Digital Transformation', topic: 11 },
  'Law and Public Safety':
    { id: 'LAW_SAFETY', name: 'Law and Public Safety', topic: 12 },
  'Transportation Services':
    { id: 'TRANSPORT', name: 'Transportation Services', topic: 13 },
};

// ---------------------------------------------------------------------------
// 2. Program key → ProgramOfStudy ID suffix
//    Explicit map avoids regex ambiguity for non-standard keys
// ---------------------------------------------------------------------------

const PROGRAM_SUFFIX = {
  'Ag Food Production Business (AFP)': 'AFP',
  'Alternative Fuels Technology (AFT)': 'AFT',
  'Animal Systems (ANS)': 'ANS',
  'Architectural Design (AD)': 'AD',
  'Artificial Intelligence (AI)': 'AI',
  'Automation and Robotics Technology (ART)': 'ART',
  'Automotive Collision Repair (ACR)': 'ACR',
  'Automotive Maintenance and Light Repair (MLR)': 'MLR',
  'Aviation Maintenance Technology (AMT)': 'AMT',
  'Business Management (BUS MGMT)': 'BUS_MGMT',
  'Culinary Arts (CA)': 'CA',
  'Cybersecurity (Cyber)': 'CYBER',
  'Diagnostic Services (DS)': 'DS',
  'Digital Design (DD)': 'DD',
  'Electro-Mechanical Technology (EMT)': 'EMT',
  'Elementary School (K-6th Grade)': 'ELEMENTARY',
  'Emergency Medical Services (EMS/EMT)': 'EMS_EMT',
  'Engineering Technology (ENG TECH)': 'ENG_TECH',
  'Entrepreneurship (ENTRE)': 'ENTRE',
  'Fashion and Artisan Design (FAD)': 'FAD',
  'Film and Media Production (FMP)': 'FMP',
  'Financial Management (FIN MGMT)': 'FIN_MGMT',
  'Fire and Emergency Services (FES)': 'FES',
  'Food Systems (FS)': 'FS',
  'Human Performance Therapeutic Services (HPTS)': 'HPTS',
  'Law Enforcement Services (LES)': 'LES',
  'Marine Maintenance Technology (MMT)': 'MMT',
  'Marketing Management (MRKT MGMT)': 'MRKT_MGMT',
  'Mechanical, Electrical, and Plumbing (MEP) Systems': 'MEP',
  'Middle/High School (6th-12th Grade)': 'MIDDLE_HIGH',
  'Natural Resources Management (NRM)': 'NRM',
  'Networking': 'NETWORKING',
  'Nursing Services (NS)': 'NS',
  'Power Grid Technology (PGT)': 'PGT',
  'Pre-Law': 'PRE_LAW',
  'Preschool/Early Childhood (birth-3rd. Grade)': 'PRESCHOOL',
  'Programming': 'PROGRAMMING',
  'Public Health Services (PHS)': 'PHS',
  'Residential and Commercial Construction': 'RES_COMM_CONST',
  'School Counselor (HSTB Licensed)': 'SCHOOL_COUNSELOR',
  'School Psychologist': 'SCHOOL_PSYCHOLOGIST',
  'School Social Worker': 'SCHOOL_SOCIAL_WORKER',
  'Supply Chain and Logistics Technology (SCLT)': 'SCLT',
  'Sustainable Energies Technology (SET)': 'SET',
  'Sustainable Hospitality and Tourism Management (SHTM)': 'SHTM',
  'Web Design and Development (WDD)': 'WDD',
  'Welding': 'WELDING',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_MAP = { 1: 'entry', 2: 'cc', 3: 'university' };

function slugify(text) {
  return text
    .replace(/[ʻ'']/g, '')              // remove Hawaiian okina and smart quotes
    .replace(/[^a-zA-Z0-9]+/g, '_')     // non-alphanum → underscore
    .replace(/^_|_$/g, '')              // trim leading/trailing underscores
    .substring(0, 80);                  // cap length
}

function resolveCluster(entries) {
  const validTitles = entries
    .map(e => e.TITLE)
    .filter(t => t !== 'OVERRIDE' && t !== 'pathway match title on button');
  for (const t of validTitles) {
    if (CLUSTER_MAP[t]) return CLUSTER_MAP[t];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Career Pathways Knowledge Graph ===\n');

  // Read source files
  const programs = JSON.parse(readFileSync(path.join(__dirname, 'programs.json'), 'utf-8'));
  const programKeys = Object.keys(programs);
  console.log(`Programs in JSON: ${programKeys.length}`);

  // -----------------------------------------------------------------------
  // Phase 0 — Constraints
  // -----------------------------------------------------------------------
  console.log('\n--- Phase 0: Constraints ---');
  const constraints = [
    'CREATE CONSTRAINT careerpathway_id IF NOT EXISTS FOR (cp:CareerPathway) REQUIRE cp.id IS UNIQUE',
    'CREATE CONSTRAINT programofstudy_id IF NOT EXISTS FOR (ps:ProgramOfStudy) REQUIRE ps.id IS UNIQUE',
    'CREATE CONSTRAINT trainingprogram_id IF NOT EXISTS FOR (tp:TrainingProgram) REQUIRE tp.id IS UNIQUE',
    'CREATE CONSTRAINT credential_id IF NOT EXISTS FOR (c:Credential) REQUIRE c.id IS UNIQUE',
    'CREATE CONSTRAINT occupation_soc IF NOT EXISTS FOR (o:Occupation) REQUIRE o.soc_code IS UNIQUE',
  ];
  for (const cypher of constraints) {
    await runWrite(cypher);
  }
  console.log(`Constraints ensured: ${constraints.length}`);

  // -----------------------------------------------------------------------
  // Pre-process: resolve cluster for each program
  // -----------------------------------------------------------------------
  const programMeta = []; // { key, entries, cluster, suffix, programId }
  const seenClusters = new Map(); // cluster.id → cluster

  for (const key of programKeys) {
    const entries = programs[key];
    const cluster = resolveCluster(entries);
    if (!cluster) {
      console.warn(`  WARN: No cluster resolved for "${key}" — skipping`);
      continue;
    }
    const suffix = PROGRAM_SUFFIX[key];
    if (!suffix) {
      console.warn(`  WARN: No suffix mapping for "${key}" — skipping`);
      continue;
    }
    const programId = `${cluster.id}_${suffix}`;
    seenClusters.set(cluster.id, cluster);
    programMeta.push({ key, entries, cluster, suffix, programId });
  }

  console.log(`\nResolved ${programMeta.length} programs across ${seenClusters.size} clusters`);

  // -----------------------------------------------------------------------
  // Phase 1 — CareerPathway nodes
  // -----------------------------------------------------------------------
  console.log('\n--- Phase 1: CareerPathway nodes ---');
  let cpCount = 0;
  for (const [, cluster] of seenClusters) {
    await runWrite(
      `MERGE (cp:CareerPathway {id: $id})
       SET cp.name         = $name,
           cp.topic_number = $topic,
           cp.source       = 'HawaiiCareerPathways',
           cp.created_at   = coalesce(cp.created_at, datetime()),
           cp.updated_at   = datetime()`,
      { id: cluster.id, name: cluster.name, topic: cluster.topic }
    );
    cpCount++;
  }
  console.log(`CareerPathways created: ${cpCount}`);

  // -----------------------------------------------------------------------
  // Phase 2 — ProgramOfStudy nodes + INCLUDES_PROGRAM
  // -----------------------------------------------------------------------
  console.log('\n--- Phase 2: ProgramOfStudy nodes ---');
  let psCount = 0;
  let includesCount = 0;

  for (const pm of programMeta) {
    const { entries, cluster, programId, key } = pm;

    // Extract metadata from LEVEL=0 entries
    const titleEntry = entries.find(e => e.LEVEL === 0 && e.LEVEL_TYPE === 'CUSTOM' && e.LEVEL_INFO === 'PATHWAY_TITLE');
    const descEntry = entries.find(e => e.LEVEL === 0 && e.LEVEL_TYPE === 'CUSTOM' && e.LEVEL_INFO === 'PATHWAY_DESCRIPTION');
    const ecEntry = entries.find(e => e.LEVEL === 0 && e.LEVEL_TYPE === 'EARLYCOLLEGE');
    const startEntry = entries.find(e => e.LEVEL === 0 && e.LEVEL_TYPE === 'START_INFORMATION');

    const programName = titleEntry?.LEVEL_DATA || key;
    const description = descEntry?.LEVEL_DATA || null;
    const earlyCollegeUrl = ecEntry?.LEVEL_INFO || null;
    const startInfo = startEntry?.LEVEL_DATA || null;

    await runWrite(
      `MERGE (ps:ProgramOfStudy {id: $id})
       SET ps.name             = $name,
           ps.description      = $description,
           ps.cluster_id       = $clusterId,
           ps.early_college_url = $ecUrl,
           ps.start_info       = $startInfo,
           ps.source           = 'programs.json',
           ps.created_at       = coalesce(ps.created_at, datetime()),
           ps.updated_at       = datetime()`,
      {
        id: programId,
        name: programName,
        description,
        clusterId: cluster.id,
        ecUrl: earlyCollegeUrl,
        startInfo,
      }
    );
    psCount++;

    // Link to CareerPathway
    await runWrite(
      `MATCH (cp:CareerPathway {id: $cpId})
       MATCH (ps:ProgramOfStudy {id: $psId})
       MERGE (cp)-[:INCLUDES_PROGRAM]->(ps)`,
      { cpId: cluster.id, psId: programId }
    );
    includesCount++;
  }
  console.log(`ProgramsOfStudy created: ${psCount}`);
  console.log(`INCLUDES_PROGRAM relationships: ${includesCount}`);

  // -----------------------------------------------------------------------
  // Phase 3 — Occupation nodes + PREPARES_FOR
  // -----------------------------------------------------------------------
  console.log('\n--- Phase 3: Occupation nodes ---');
  let occCount = 0;
  let preparesCount = 0;
  const seenSoc = new Set();

  for (const pm of programMeta) {
    const { entries, programId } = pm;

    const jobEntries = entries.filter(
      e => e.LEVEL_TYPE === 'JOB_TITLE' && e.LEVEL_INFO === 'RELATED OCCUPATIONS'
    );

    for (const je of jobEntries) {
      const stage = STAGE_MAP[je.LEVEL];
      if (!stage) continue;
      if (!je.LEVEL_DATA || je.LEVEL_DATA.trim() === '') continue;

      const socCodes = je.LEVEL_DATA.split(',').map(s => s.trim()).filter(Boolean);
      for (const soc of socCodes) {
        if (!seenSoc.has(soc)) {
          await runWrite(
            `MERGE (o:Occupation {soc_code: $soc})
             SET o.source     = coalesce(o.source, 'programs.json'),
                 o.created_at = coalesce(o.created_at, datetime()),
                 o.updated_at = datetime()`,
            { soc }
          );
          seenSoc.add(soc);
          occCount++;
        }

        await runWrite(
          `MATCH (ps:ProgramOfStudy {id: $psId})
           MATCH (o:Occupation {soc_code: $soc})
           MERGE (ps)-[:PREPARES_FOR {stage: $stage}]->(o)`,
          { psId: programId, soc, stage }
        );
        preparesCount++;
      }
    }
  }
  console.log(`Occupations created: ${occCount}`);
  console.log(`PREPARES_FOR relationships: ${preparesCount}`);

  // -----------------------------------------------------------------------
  // Phase 4 — TrainingProgram + Credential nodes
  // -----------------------------------------------------------------------
  console.log('\n--- Phase 4: TrainingProgram & Credential nodes ---');
  let tpCount = 0;
  let credCount = 0;
  let hasTrainingCount = 0;
  let recommCredCount = 0;
  const seenTp = new Set();
  const seenCred = new Set();

  for (const pm of programMeta) {
    const { entries, programId } = pm;

    // TRAINING entries
    const trainingEntries = entries.filter(e => e.LEVEL_TYPE === 'TRAINING');

    for (const te of trainingEntries) {
      const stage = STAGE_MAP[te.LEVEL] || 'other';
      const label = te.LEVEL_DATA?.trim();
      if (!label || label === '' || label === 'Not Available') continue;

      const info = te.LEVEL_INFO || '';
      const isCert = info.includes('CERTIFICATIONS');

      if (isCert) {
        // → Credential
        const credId = slugify(label);
        if (!seenCred.has(credId)) {
          await runWrite(
            `MERGE (c:Credential {id: $id})
             SET c.name       = $name,
                 c.type       = 'Certification',
                 c.source     = 'programs.json',
                 c.created_at = coalesce(c.created_at, datetime()),
                 c.updated_at = datetime()`,
            { id: credId, name: label }
          );
          seenCred.add(credId);
          credCount++;
        }
        await runWrite(
          `MATCH (ps:ProgramOfStudy {id: $psId})
           MATCH (c:Credential {id: $credId})
           MERGE (ps)-[:RECOMMENDS_CREDENTIAL {stage: $stage}]->(c)`,
          { psId: programId, credId: slugify(label), stage }
        );
        recommCredCount++;
      } else {
        // → TrainingProgram
        const tpId = slugify(label);
        const category = info.includes('SHORT-TERM TRAINING OPTIONS: CREDITED') ? 'short_term_credited'
          : info.includes('SHORT-TERM TRAINING OPTIONS: NON-CREDIT') ? 'short_term_noncredit'
          : (info.includes('SHORT-TERM TRAINING: NON-CREDIT') ? 'short_term_noncredit'
          : info.includes('RECOMMENDED EDUCATION') ? 'recommended_education'
          : 'other');

        if (!seenTp.has(tpId)) {
          await runWrite(
            `MERGE (tp:TrainingProgram {id: $id})
             SET tp.name        = $name,
                 tp.track_level = $trackLevel,
                 tp.category    = $category,
                 tp.source      = 'programs.json',
                 tp.created_at  = coalesce(tp.created_at, datetime()),
                 tp.updated_at  = datetime()`,
            { id: tpId, name: label, trackLevel: stage, category }
          );
          seenTp.add(tpId);
          tpCount++;
        }
        await runWrite(
          `MATCH (ps:ProgramOfStudy {id: $psId})
           MATCH (tp:TrainingProgram {id: $tpId})
           MERGE (ps)-[:HAS_TRAINING {stage: $stage}]->(tp)`,
          { psId: programId, tpId, stage }
        );
        hasTrainingCount++;
      }
    }

    // OPTIONS entries → TrainingProgram with category "other_option"
    const optionEntries = entries.filter(
      e => e.LEVEL_TYPE === 'OPTIONS' && e.LEVEL_INFO === 'OTHER OPTIONS'
    );

    for (const oe of optionEntries) {
      const stage = STAGE_MAP[oe.LEVEL] || 'other';
      const label = oe.LEVEL_DATA?.trim();
      if (!label || label === '') continue;

      const tpId = slugify(label);
      if (!seenTp.has(tpId)) {
        await runWrite(
          `MERGE (tp:TrainingProgram {id: $id})
           SET tp.name        = $name,
               tp.track_level = $trackLevel,
               tp.category    = 'other_option',
               tp.source      = 'programs.json',
               tp.created_at  = coalesce(tp.created_at, datetime()),
               tp.updated_at  = datetime()`,
          { id: tpId, name: label, trackLevel: stage }
        );
        seenTp.add(tpId);
        tpCount++;
      }
      await runWrite(
        `MATCH (ps:ProgramOfStudy {id: $psId})
         MATCH (tp:TrainingProgram {id: $tpId})
         MERGE (ps)-[:HAS_TRAINING {stage: $stage}]->(tp)`,
        { psId: programId, tpId, stage }
      );
      hasTrainingCount++;
    }
  }
  console.log(`TrainingPrograms created: ${tpCount}`);
  console.log(`Credentials created: ${credCount}`);
  console.log(`HAS_TRAINING relationships: ${hasTrainingCount}`);
  console.log(`RECOMMENDS_CREDENTIAL relationships: ${recommCredCount}`);

  // -----------------------------------------------------------------------
  // Phase 5 — ZoneType bridge (AFNR → ag)
  // -----------------------------------------------------------------------
  console.log('\n--- Phase 5: ZoneType bridge ---');
  await runWrite(
    `MATCH (cp:CareerPathway {id: 'AFNR'})
     MATCH (zt:ZoneType {id: 'ag'})
     MERGE (cp)-[:ALIGNS_WITH_ZONE_TYPE]->(zt)`
  );
  console.log('AFNR → ag ZoneType bridge created');

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n=== Summary ===');
  console.log(`CareerPathways:          ${cpCount}`);
  console.log(`ProgramsOfStudy:         ${psCount}`);
  console.log(`Occupations:             ${occCount}`);
  console.log(`TrainingPrograms:        ${tpCount}`);
  console.log(`Credentials:             ${credCount}`);
  console.log(`INCLUDES_PROGRAM:        ${includesCount}`);
  console.log(`PREPARES_FOR:            ${preparesCount}`);
  console.log(`HAS_TRAINING:            ${hasTrainingCount}`);
  console.log(`RECOMMENDS_CREDENTIAL:   ${recommCredCount}`);
  console.log(`ALIGNS_WITH_ZONE_TYPE:   1`);

  await closeDriver();
  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
