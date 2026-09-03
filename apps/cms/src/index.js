'use strict';

/**
 * Content types the Astro front end needs to read anonymously at build time.
 * Granting these on boot means a fresh clone works without anyone having to
 * tick sixteen checkboxes in Settings → Roles → Public first.
 */
const PUBLIC_READ = {
  'api::project.project': ['find', 'findOne'],
  'api::service.service': ['find', 'findOne'],
  'api::process-step.process-step': ['find', 'findOne'],
  'api::site-setting.site-setting': ['find'],
  'api::home-page.home-page': ['find'],
  'api::work-page.work-page': ['find'],
  'api::about-page.about-page': ['find'],
  'api::contact-page.contact-page': ['find'],
};

async function grantPublicReadAccess(strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) {
    strapi.log.warn('[bootstrap] No public role found; skipping permission setup.');
    return;
  }

  const wanted = Object.entries(PUBLIC_READ).flatMap(([uid, actions]) =>
    actions.map((action) => `${uid}.${action}`)
  );

  const existing = await strapi.db
    .query('plugin::users-permissions.permission')
    .findMany({ where: { role: publicRole.id, action: wanted } });

  const have = new Set(existing.map((p) => p.action));
  const missing = wanted.filter((action) => !have.has(action));

  for (const action of missing) {
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: { action, role: publicRole.id },
    });
  }

  if (missing.length) {
    strapi.log.info(`[bootstrap] Granted ${missing.length} public read permission(s).`);
  }
}

module.exports = {
  /**
   * Runs before the application is initialised.
   */
  register(/* { strapi } */) {},

  /**
   * Runs once the application has started.
   */
  async bootstrap({ strapi }) {
    try {
      await grantPublicReadAccess(strapi);
    } catch (error) {
      strapi.log.error(`[bootstrap] Could not set public permissions: ${error.message}`);
    }
  },
};
