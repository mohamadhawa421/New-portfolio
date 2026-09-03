'use strict';

// Runs before dev / start / seed / export so a fresh clone has a working
// database to open. See scripts/db.js for why there are two files.
const { ensureWorkingDatabase } = require('./db');

try {
  ensureWorkingDatabase();
} catch (error) {
  console.error(`[db] ${error.message}`);
  process.exit(1);
}
