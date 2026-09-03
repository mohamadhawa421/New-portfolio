'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Strapi 5 does not populate relations, media or components unless asked. The
 * front end always wants the whole record, so default to a full populate and
 * let an explicit ?populate= in the request win if one is given.
 */
const DEFAULT_POPULATE = {
  portrait: true,
  logoMark: true,
  logoFull: true,
  seo: { populate: ['shareImage'] },
};

module.exports = createCoreController('api::site-setting.site-setting', () => ({
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: ctx.query.populate || DEFAULT_POPULATE };
    return await super.find(ctx);
  },

  async findOne(ctx) {
    ctx.query = { ...ctx.query, populate: ctx.query.populate || DEFAULT_POPULATE };
    return await super.findOne(ctx);
  },
}));
