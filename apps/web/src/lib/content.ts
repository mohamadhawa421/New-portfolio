/**
 * Everything the pages read. Each getter takes its slice of the exported
 * content snapshot, falls back to `fallback.ts` if that slice is missing, then
 * normalises the result into the shapes in `types.ts` so components never have
 * to care which source they got.
 *
 * Reads are synchronous now that the source is a bundled JSON module, but the
 * getters stay async so pages keep awaiting them.
 */

import { read, toMedia, toMediaList } from './source';
import * as fallback from './fallback';
import type {
  AboutPage,
  ContactPage,
  Constraint,
  Decision,
  Experience,
  HomePage,
  Metric,
  ProcessStep,
  Project,
  Seo,
  Service,
  SiteSettings,
  Stat,
  WorkPage,
} from './types';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const text = (value: unknown, fallbackValue = ''): string =>
  typeof value === 'string' && value.trim() !== '' ? value : fallbackValue;

const bool = (value: unknown, fallbackValue: boolean): boolean =>
  typeof value === 'boolean' ? value : fallbackValue;

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

export const initialsOf = (name: string): string =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

/**
 * Memoises a loader for the life of the process, so a build normalises each
 * slice once however many pages ask for it. Safe in dev too: the snapshot is a
 * bundled module, so Vite reloads the whole thing when `npm run export`
 * rewrites it.
 */
function cache<T>(loader: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) pending = loader();
    return pending;
  };
}

/* ------------------------------------------------------------------ */
/* Component mappers                                                   */
/* ------------------------------------------------------------------ */

const mapSeo = (raw: any): Seo => ({
  metaTitle: text(raw?.metaTitle) || undefined,
  metaDescription: text(raw?.metaDescription) || undefined,
  shareImage: toMedia(raw?.shareImage),
});

const mapStats = (raw: unknown): Stat[] =>
  list<any>(raw).map((item) => ({
    value: text(item?.value),
    label: text(item?.label),
    animate: bool(item?.animate, true),
  }));

const mapConstraints = (raw: unknown): Constraint[] =>
  list<any>(raw).map((item) => ({
    title: text(item?.title),
    body: text(item?.body),
  }));

const mapDecisions = (raw: unknown): Decision[] =>
  list<any>(raw).map((item) => ({
    eyebrow: text(item?.eyebrow, 'Decision'),
    title: text(item?.title),
    body: text(item?.body),
  }));

const mapMetrics = (raw: unknown): Metric[] =>
  list<any>(raw).map((item) => ({
    value: text(item?.value),
    label: text(item?.label),
    animate: bool(item?.animate, true),
  }));

const mapExperience = (raw: unknown): Experience[] =>
  list<any>(raw)
    .slice()
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((item) => ({
      role: text(item?.role),
      organisation: text(item?.organisation),
      period: text(item?.period),
    }));

const mapOptions = (raw: unknown): string[] =>
  list<any>(raw)
    .map((item) => text(item?.label))
    .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

function mapProject(raw: any, index: number): Project {
  const title = text(raw?.title, 'Untitled project');
  return {
    title,
    slug: text(raw?.slug, `project-${index + 1}`),
    category: text(raw?.category, 'Sector'),
    discipline: text(raw?.discipline, 'Discipline'),
    summary: text(raw?.summary),
    role: text(raw?.role, 'UI / UX Design'),
    order: typeof raw?.order === 'number' ? raw.order : index,
    featured: bool(raw?.featured, false),
    cover: toMedia(raw?.cover, title),
    chipBg: text(raw?.chipBg, '#efeff1'),
    chipInk: text(raw?.chipInk, '#86868b'),
    briefLead: text(raw?.briefLead),
    briefBody: text(raw?.briefBody),
    problemLead: text(raw?.problemLead),
    constraints: mapConstraints(raw?.constraints),
    approachLead: text(raw?.approachLead),
    approachBody: text(raw?.approachBody),
    approachShot: toMedia(raw?.approachShot),
    approachCaption: text(raw?.approachCaption),
    decisions: mapDecisions(raw?.decisions),
    shippedHeading: text(raw?.shippedHeading, 'The screens that carry the work.'),
    gallery: toMediaList(raw?.gallery),
    metrics: mapMetrics(raw?.metrics),
    reflectionLead: text(raw?.reflectionLead),
    reflectionBody: text(raw?.reflectionBody),
    seo: mapSeo(raw?.seo),
    num: pad(index + 1),
    initials: initialsOf(title),
  };
}

export const getProjects = cache(async (): Promise<Project[]> => {
  const remote = read<any[]>('projects');

  const source = remote && remote.length ? remote : fallback.fallbackProjects;

  return source
    .slice()
    .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
    .map(mapProject);
});

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const projects = await getProjects();
  return projects.find((project) => project.slug === slug);
}

/** The large 16:9 project at the top of the home page list, plus the rest. */
export async function getHomeProjectSplit(): Promise<{ lead?: Project; rest: Project[] }> {
  const projects = await getProjects();
  if (!projects.length) return { rest: [] };
  const leadIndex = Math.max(
    0,
    projects.findIndex((project) => project.featured)
  );
  return {
    lead: projects[leadIndex],
    rest: projects.filter((_, i) => i !== leadIndex),
  };
}

/* ------------------------------------------------------------------ */
/* Services and process                                                */
/* ------------------------------------------------------------------ */

export const getServices = cache(async (): Promise<Service[]> => {
  const remote = read<any[]>('services');

  const source = remote && remote.length ? remote : fallback.fallbackServices;

  return source
    .slice()
    .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((raw: any, index: number) => ({
      title: text(raw?.title),
      description: text(raw?.description),
      ctaLabel: text(raw?.ctaLabel, 'Start here'),
      order: typeof raw?.order === 'number' ? raw.order : index,
      num: pad(index + 1),
    }));
});

export const getProcessSteps = cache(async (): Promise<ProcessStep[]> => {
  const remote = read<any[]>('processSteps');

  const source = remote && remote.length ? remote : fallback.fallbackProcessSteps;

  return source
    .slice()
    .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((raw: any, index: number) => ({
      title: text(raw?.title),
      description: text(raw?.description),
      order: typeof raw?.order === 'number' ? raw.order : index,
    }));
});

/* ------------------------------------------------------------------ */
/* Site settings                                                       */
/* ------------------------------------------------------------------ */

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const remote = read<any>('siteSetting');
  const raw = remote ?? fallback.fallbackSiteSettings;
  const fb = fallback.fallbackSiteSettings;

  const email = text(raw?.email, fb.email);
  const whatsappNumber = text(raw?.whatsappNumber, fb.whatsappNumber);
  const available = bool(raw?.available, fb.available);
  const availableLabel = text(raw?.availableLabel, fb.availableLabel);
  const bookedLabel = text(raw?.bookedLabel, fb.bookedLabel);
  const siteName = text(raw?.siteName, fb.siteName);

  const contactMode = (['WhatsApp', 'Email', 'Both'] as const).includes(raw?.contactMode)
    ? (raw.contactMode as SiteSettings['contactMode'])
    : 'Both';

  return {
    siteName,
    roleTitle: text(raw?.roleTitle, fb.roleTitle),
    location: text(raw?.location, fb.location),
    email,
    whatsappNumber,
    phoneLabel: text(raw?.phoneLabel, fb.phoneLabel),
    available,
    availableLabel,
    bookedLabel,
    contactMode,
    portrait: toMedia(raw?.portrait, `Portrait of ${siteName}`) ?? toMedia(fb.portrait, siteName),
    portraitFocus: text(raw?.portraitFocus, fb.portraitFocus),
    portraitTallFocus: text(raw?.portraitTallFocus, fb.portraitTallFocus),
    logoMark: toMedia(raw?.logoMark, siteName) ?? toMedia(fb.logoMark, siteName),
    logoFull:
      toMedia(raw?.logoFull, `${siteName} — ${text(raw?.roleTitle, fb.roleTitle)}`) ??
      toMedia(fb.logoFull, siteName),
    showIntro: bool(raw?.showIntro, fb.showIntro),
    seo: mapSeo(raw?.seo ?? fb.seo),
    waHref: `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}`,
    mailHref: `mailto:${email}`,
    availabilityLabel: available ? availableLabel : bookedLabel,
  };
});

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export const getHomePage = cache(async (): Promise<HomePage> => {
  const remote = read<any>('homePage');
  const raw = remote ?? fallback.fallbackHomePage;
  const fb = fallback.fallbackHomePage;

  return {
    heroTitle: text(raw?.heroTitle, fb.heroTitle),
    heroSubtitle: text(raw?.heroSubtitle, fb.heroSubtitle),
    heroIntro: text(raw?.heroIntro, fb.heroIntro),
    primaryCtaLabel: text(raw?.primaryCtaLabel, fb.primaryCtaLabel),
    secondaryCtaLabel: text(raw?.secondaryCtaLabel, fb.secondaryCtaLabel),
    workEyebrow: text(raw?.workEyebrow, fb.workEyebrow),
    workHeadingSuffix: text(raw?.workHeadingSuffix, fb.workHeadingSuffix),
    workLinkLabel: text(raw?.workLinkLabel, fb.workLinkLabel),
    servicesEyebrow: text(raw?.servicesEyebrow, fb.servicesEyebrow),
    servicesHeading: text(raw?.servicesHeading, fb.servicesHeading),
    servicesIntro: text(raw?.servicesIntro, fb.servicesIntro),
    manifestoLead: text(raw?.manifestoLead, fb.manifestoLead),
    manifestoTail: text(raw?.manifestoTail, fb.manifestoTail),
    manifestoBody: text(raw?.manifestoBody, fb.manifestoBody),
    processEyebrow: text(raw?.processEyebrow, fb.processEyebrow),
    aboutEyebrow: text(raw?.aboutEyebrow, fb.aboutEyebrow),
    aboutHeading: text(raw?.aboutHeading, fb.aboutHeading),
    aboutBody: text(raw?.aboutBody, fb.aboutBody),
    aboutLinkLabel: text(raw?.aboutLinkLabel, fb.aboutLinkLabel),
    stats: mapStats(raw?.stats).length ? mapStats(raw?.stats) : mapStats(fb.stats),
    contactHeading: text(raw?.contactHeading, fb.contactHeading),
    contactBody: text(raw?.contactBody, fb.contactBody),
    seo: mapSeo(raw?.seo ?? fb.seo),
  };
});

export const getWorkPage = cache(async (): Promise<WorkPage> => {
  const remote = read<any>('workPage');
  const raw = remote ?? fallback.fallbackWorkPage;
  const fb = fallback.fallbackWorkPage;

  return {
    eyebrow: text(raw?.eyebrow, fb.eyebrow),
    heading: text(raw?.heading, fb.heading),
    intro: text(raw?.intro, fb.intro),
    allFilterLabel: text(raw?.allFilterLabel, fb.allFilterLabel),
    countLabel: text(raw?.countLabel, fb.countLabel),
    seo: mapSeo(raw?.seo ?? fb.seo),
  };
});

export const getAboutPage = cache(async (): Promise<AboutPage> => {
  const remote = read<any>('aboutPage');
  const raw = remote ?? fallback.fallbackAboutPage;
  const fb = fallback.fallbackAboutPage;

  const stats = mapStats(raw?.stats);
  const experience = mapExperience(raw?.experience);
  const skills = mapOptions(raw?.skills);

  return {
    eyebrow: text(raw?.eyebrow, fb.eyebrow),
    heading: text(raw?.heading, fb.heading),
    lead: text(raw?.lead, fb.lead),
    bodyPrimary: text(raw?.bodyPrimary, fb.bodyPrimary),
    bodySecondary: text(raw?.bodySecondary, fb.bodySecondary),
    stats: stats.length ? stats : mapStats(fb.stats),
    experience: experience.length ? experience : mapExperience(fb.experience),
    skills: skills.length ? skills : mapOptions(fb.skills),
    seo: mapSeo(raw?.seo ?? fb.seo),
  };
});

export const getContactPage = cache(async (): Promise<ContactPage> => {
  const remote = read<any>('contactPage');
  const raw = remote ?? fallback.fallbackContactPage;
  const fb = fallback.fallbackContactPage;

  const budgets = mapOptions(raw?.budgetOptions);

  return {
    heading: text(raw?.heading, fb.heading),
    body: text(raw?.body, fb.body),
    homeBody: text(raw?.homeBody, fb.homeBody),
    budgetOptions: budgets.length ? budgets : mapOptions(fb.budgetOptions),
    unsureLabel: text(raw?.unsureLabel, fb.unsureLabel),
    formNameLabel: text(raw?.formNameLabel, fb.formNameLabel),
    formNamePlaceholder: text(raw?.formNamePlaceholder, fb.formNamePlaceholder),
    formServiceLabel: text(raw?.formServiceLabel, fb.formServiceLabel),
    formBudgetLabel: text(raw?.formBudgetLabel, fb.formBudgetLabel),
    formBriefLabel: text(raw?.formBriefLabel, fb.formBriefLabel),
    formBriefPlaceholder: text(raw?.formBriefPlaceholder, fb.formBriefPlaceholder),
    formWhatsappCta: text(raw?.formWhatsappCta, fb.formWhatsappCta),
    formEmailCta: text(raw?.formEmailCta, fb.formEmailCta),
    formHint: text(raw?.formHint, fb.formHint),
    formErrorName: text(raw?.formErrorName, fb.formErrorName),
    formErrorBrief: text(raw?.formErrorBrief, fb.formErrorBrief),
    formSentWhatsapp: text(raw?.formSentWhatsapp, fb.formSentWhatsapp),
    formSentEmail: text(raw?.formSentEmail, fb.formSentEmail),
    formGreeting: text(raw?.formGreeting, fb.formGreeting),
    seo: mapSeo(raw?.seo ?? fb.seo),
  };
});
