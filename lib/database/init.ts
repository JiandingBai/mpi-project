import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Initialize SQLite database with schema
 * Uses in-memory database for tests, file-based for production
 */
export function initializeDatabase(dbPath: string = ':memory:'): Database.Database {
  const db = new Database(dbPath);
  
  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  
  db.exec(schema);
  
  return db;
}

/**
 * Check if cached data is fresh (less than maxAgeHours old)
 */
export function isCacheFresh(updatedAt: string, maxAgeHours: number = 24): boolean {
  const cacheTime = new Date(updatedAt).getTime();
  const now = Date.now();
  const ageHours = (now - cacheTime) / (1000 * 60 * 60);
  
  return ageHours < maxAgeHours;
}
