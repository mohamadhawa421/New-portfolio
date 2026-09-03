import type { Schema, Struct } from '@strapi/strapi';

export interface SharedConstraint extends Struct.ComponentSchema {
  collectionName: 'components_shared_constraints';
  info: {
    description: 'One of the numbered constraints in a case study\'s "The problem" section.';
    displayName: 'Constraint';
    icon: 'exclamationMarkCircle';
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedDecision extends Struct.ComponentSchema {
  collectionName: 'components_shared_decisions';
  info: {
    description: 'A design decision card in the case study\'s "The approach" section.';
    displayName: 'Decision';
    icon: 'bulletList';
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    eyebrow: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Decision'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedExperience extends Struct.ComponentSchema {
  collectionName: 'components_shared_experiences';
  info: {
    description: "A role in the About page's work history.";
    displayName: 'Experience';
    icon: 'briefcase';
  };
  attributes: {
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    organisation: Schema.Attribute.String;
    period: Schema.Attribute.String;
    role: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedMetric extends Struct.ComponentSchema {
  collectionName: 'components_shared_metrics';
  info: {
    description: 'An outcome figure in the case study\'s "What shipped" section.';
    displayName: 'Metric';
    icon: 'chartPie';
  };
  attributes: {
    animate: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.Text & Schema.Attribute.Required;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedOption extends Struct.ComponentSchema {
  collectionName: 'components_shared_options';
  info: {
    description: 'A single choice in a dropdown, e.g. a budget band or a skill tag.';
    displayName: 'Option';
    icon: 'filter';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Per-page search and social metadata. Leave blank to fall back to the site defaults.';
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 70;
      }>;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedStat extends Struct.ComponentSchema {
  collectionName: 'components_shared_stats';
  info: {
    description: 'A headline figure with a caption, e.g. "20+ / projects shipped".';
    displayName: 'Stat';
    icon: 'chartBubble';
  };
  attributes: {
    animate: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'shared.constraint': SharedConstraint;
      'shared.decision': SharedDecision;
      'shared.experience': SharedExperience;
      'shared.metric': SharedMetric;
      'shared.option': SharedOption;
      'shared.seo': SharedSeo;
      'shared.stat': SharedStat;
    }
  }
}
