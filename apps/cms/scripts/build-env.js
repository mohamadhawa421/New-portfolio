'use strict';

/**
 * Booting Strapi requires a handful of secrets to be set. Locally they come
 * from .env. On a build machine — or in a maintenance script on a fresh clone —
 * there is no .env, and it does not matter what they are: nothing is served, no
 * token is issued, and the database is only read or edited in process. So fill
 * in placeholders rather than making the deploy depend on six secrets.
 *
 * Anything already in the environment wins, so a real .env is never overridden.
 */
function ensureBuildEnv() {
  const placeholders = {
    APP_KEYS: 'build-only-key-one,build-only-key-two',
    API_TOKEN_SALT: 'build-only-salt',
    ADMIN_JWT_SECRET: 'build-only-secret',
    TRANSFER_TOKEN_SALT: 'build-only-transfer-salt',
    JWT_SECRET: 'build-only-jwt-secret',
    ENCRYPTION_KEY: 'build-only-encryption-key',
    DATABASE_CLIENT: 'sqlite',
    DATABASE_FILENAME: 'data/portfolio.db',
  };

  for (const [key, value] of Object.entries(placeholders)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

module.exports = { ensureBuildEnv };
