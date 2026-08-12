/**
 * Run a .cypher file against AuraDB, statement by statement.
 *
 * Strips // comments, splits on ';', executes each statement sequentially
 * via db.mjs (auto-commit sessions — LOAD CSV and CALL IN TRANSACTIONS safe).
 *
 * Usage: node run-cypher.mjs <path/to/file.cypher>
 */

import { readFileSync } from 'fs';
import { runQuery, closeDriver } from './db.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node run-cypher.mjs <file.cypher>');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const statements = raw
  .split('\n')
  .filter(line => !line.trim().startsWith('//'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(Boolean);

console.log(`${file}: ${statements.length} statement(s)`);

for (const [i, stmt] of statements.entries()) {
  const started = Date.now();
  try {
    const records = await runQuery(stmt);
    console.log(`  [${i + 1}/${statements.length}] ok (${Date.now() - started}ms, ${records.length} rows)`);
  } catch (e) {
    console.error(`  [${i + 1}/${statements.length}] FAILED: ${e.message}`);
    await closeDriver();
    process.exit(1);
  }
}

await closeDriver();
console.log('done');
