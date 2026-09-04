export interface Media {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Seo {
  metaTitle?: string;
  metaDescription?: string;
  shareImage?: Media | null;
}

export interface Stat {
  value: string;
  label: string;
  animate: boolean;
}

export interface Constraint {
  title: string;
  body: string;
}

export interface Decision {
  eyebrow: string;
  title: string;
  body: string;
}

export interface Metric {
  value: string;
  label: string;
  animate: boolean;
}

export interface Experience {
  role: string;
  organisation: string;
  period: string;
}

export interface Project {
  title: string;
  slug: string;
  /**
   * Every service this project answers to, in the order it was filed. Drives
   * the Work page filters, so each one is the title of a Service.
   */
  categories: string[];
  /** The first category. Leads the card and case study meta line. */
  category: string;
  discipline: string;
  summary: string;
  role: string;
  order: number;
  featured: boolean;
  cover: Media | null;
  chipBg: string;
  chipInk: string;
  briefLead: string;
  briefBody: string;
  problemLead: string;
  constraints: Constraint[];
  approachLead: string;
  approachBody: string;
  approachShot: Media | null;
  approachCaption: string;
  decisions: Decision[];
  shippedHeading: string;
  gallery: Media[];
  metrics: Metric[];
  reflectionLead: string;
  reflectionBody: string;
  seo: Seo;
  /** Zero-padded position, e.g. "01". Derived from `order`. */
  num: string;
  /** Up to two initials, shown when there is no cover image. */
  initials: string;
}

export interface Service {
  title: string;
  description: string;
  ctaLabel: string;
  order: number;
  num: string;
}

export interface ProcessStep {
  title: string;
  description: string;
  order: number;
}

export interface SiteSettings {
  siteName: string;
  roleTitle: string;
  location: string;
  email: string;
  whatsappNumber: string;
  phoneLabel: string;
  available: boolean;
  availableLabel: string;
  bookedLabel: string;
  contactMode: 'WhatsApp' | 'Email' | 'Both';
  portrait: Media | null;
  portraitFocus: string;
  portraitTallFocus: string;
  logoMark: Media | null;
  logoFull: Media | null;
  showIntro: boolean;
  seo: Seo;
  /** Derived */
  waHref: string;
  mailHref: string;
  availabilityLabel: string;
}

export interface HomePage {
  heroTitle: string;
  heroSubtitle: string;
  heroIntro: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  workEyebrow: string;
  workHeadingSuffix: string;
  workLinkLabel: string;
  servicesEyebrow: string;
  servicesHeading: string;
  servicesIntro: string;
  manifestoLead: string;
  manifestoTail: string;
  manifestoBody: string;
  processEyebrow: string;
  aboutEyebrow: string;
  aboutHeading: string;
  aboutBody: string;
  aboutLinkLabel: string;
  stats: Stat[];
  contactHeading: string;
  contactBody: string;
  seo: Seo;
}

export interface WorkPage {
  eyebrow: string;
  heading: string;
  intro: string;
  allFilterLabel: string;
  countLabel: string;
  seo: Seo;
}

export interface AboutPage {
  eyebrow: string;
  heading: string;
  lead: string;
  bodyPrimary: string;
  bodySecondary: string;
  stats: Stat[];
  experience: Experience[];
  skills: string[];
  seo: Seo;
}

export interface ContactPage {
  heading: string;
  body: string;
  homeBody: string;
  budgetOptions: string[];
  unsureLabel: string;
  formNameLabel: string;
  formNamePlaceholder: string;
  formServiceLabel: string;
  formBudgetLabel: string;
  formBriefLabel: string;
  formBriefPlaceholder: string;
  formWhatsappCta: string;
  formEmailCta: string;
  formHint: string;
  formErrorName: string;
  formErrorBrief: string;
  formSentWhatsapp: string;
  formSentEmail: string;
  formGreeting: string;
  seo: Seo;
}
