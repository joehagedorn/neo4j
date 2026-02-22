/**
 * Neo4j AuraDB connection module
 *
 * Provides a shared driver instance and helpers for running Cypher queries.
 * Reads connection config from .env (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD).
 *
 * Usage:
 *   import { getDriver, runQuery, closeDriver } from './db.mjs';
 *
 *   const records = await runQuery('MATCH (n) RETURN count(n) AS count');
 *   console.log(records[0].get('count'));
 *
 *   await closeDriver();
 */

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  throw new Error('Missing NEO4J_URI, NEO4J_USER, or NEO4J_PASSWORD in .env');
}

let driver;

/**
 * Get or create the Neo4j driver singleton
 */
export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      { disableLosslessIntegers: true }
    );
  }
  return driver;
}

/**
 * Run a Cypher query and return the result records
 * @param {string} cypher - Cypher query string
 * @param {object} params - Query parameters
 * @returns {Promise<import('neo4j-driver').Record[]>}
 */
export async function runQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

/**
 * Run a Cypher write transaction (explicit write mode)
 * @param {string} cypher - Cypher query string
 * @param {object} params - Query parameters
 * @returns {Promise<import('neo4j-driver').Record[]>}
 */
export async function runWrite(cypher, params = {}) {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

/**
 * Close the driver connection
 */
export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
