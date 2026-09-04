'use strict';

/**
 * The content that ships with a fresh install. Everything here is editable in
 * the admin afterwards — this only decides what you see the first time you
 * open it.
 *
 * Copy carried over verbatim from the Claude Design prototype
 * (design-source/Mohamad Hawa Portfolio.dc.html). Case study bodies that the
 * prototype left as placeholders are still placeholders: they are marked so
 * they are easy to find and replace, rather than invented.
 */

const PLACEHOLDER = 'Placeholder —';

const siteSetting = {
  siteName: 'Mohamad Hawa',
  roleTitle: 'UI/UX Designer',
  location: 'Beirut, Lebanon',
  email: 'mohamadhawa421@gmail.com',
  whatsappNumber: '96176824793',
  phoneLabel: '+961 76 824 793',
  available: true,
  availableLabel: 'Available for new projects',
  bookedLabel: 'Booked — enquiries still welcome',
  contactMode: 'Both',
  portraitFocus: '58% 30%',
  portraitTallFocus: '50% 38%',
  showIntro: true,
  seo: {
    metaTitle: 'Mohamad Hawa — UI/UX Designer',
    metaDescription:
      'UI/UX designer working on web and mobile products — turning complex challenges into interfaces people understand without being taught.',
  },
  __media: {
    portrait: 'mohamad-avatar.jpg',
    logoMark: 'logo-mark.svg',
    logoFull: 'logo-full.svg',
  },
};

const homePage = {
  heroTitle: 'Mohamad Hawa',
  heroSubtitle: 'Designing intuitive experiences.',
  heroIntro:
    'UI/UX designer working on web and mobile products — turning complex challenges into interfaces people understand without being taught. Freelance since 2020, at Poyesis since 2022.',
  primaryCtaLabel: 'See the work',
  secondaryCtaLabel: 'Start a project',

  workEyebrow: 'Selected work',
  workHeadingSuffix: 'projects.',
  workLinkLabel: 'Open the index',

  servicesEyebrow: 'What I do',
  servicesHeading: 'Five ways to work together.',
  servicesIntro:
    'Pick the one that sounds like your project — it opens the brief with that already filled in.',

  manifestoLead: "Complexity isn't the problem.",
  manifestoTail: 'Confusion is.',
  manifestoBody:
    'Complicated things are allowed to be complicated. My job is making sure the person in front of the screen still knows what to do next.',

  processEyebrow: 'How I work',

  aboutEyebrow: 'About',
  aboutHeading: "Six years of shipping other people's ideas.",
  aboutBody:
    'I started freelancing in 2020 and joined Poyesis in 2022. Since then the work has ranged from learning platforms and law firms to logistics products — different industries, same question every time: what is this person actually trying to do?',
  aboutLinkLabel: 'More about me',
  stats: [
    { value: '20+', label: 'projects shipped', animate: true },
    { value: '2020', label: 'designing since', animate: false },
    { value: 'Poyesis', label: '2022 — now', animate: false },
  ],

  contactHeading: "Tell me what you're building.",
  contactBody:
    'Three fields. It opens a message with everything already written — you just press send.',

  seo: {
    metaTitle: 'Mohamad Hawa — UI/UX Designer',
    metaDescription:
      'Designing intuitive experiences for web and mobile. Selected work, services, and how I work.',
  },
};

const workPage = {
  eyebrow: 'Work',
  heading: 'Every project starts the same way.',
  intro:
    'With a question about the person who has to use it. Filter by the kind of work, or read straight through.',
  allFilterLabel: 'All',
  countLabel: 'shown',
  seo: {
    metaTitle: 'Work — Mohamad Hawa',
    metaDescription:
      'Selected UI/UX projects — landing pages, mobile apps, web apps, design systems and redesigns.',
  },
};

const aboutPage = {
  eyebrow: 'About',
  heading: 'I am Mohamad Hawa, and I design things people understand.',
  lead: 'I am passionate about designing intuitive experiences.',
  bodyPrimary:
    'As a UI/UX designer I work on visually engaging, user-centred products across web and mobile — the kind where creativity has to survive contact with a real workflow. My mission is turning complex challenges into experiences that feel obvious.',
  bodySecondary:
    'I started out freelancing in 2020, working directly with small teams and founders who needed a designer who could also explain the decision. In 2022 I joined Poyesis, where the projects got bigger and the systems behind them got more interesting.',
  stats: [
    { value: '20+', label: 'projects shipped', animate: true },
    { value: '2020', label: 'designing since', animate: false },
  ],
  experience: [
    { role: 'UI / UX Designer', organisation: 'Poyesis', period: '2022 — now', order: 0 },
    {
      role: 'Freelance UI / UX Designer',
      organisation: 'Independent clients across Lebanon',
      period: '2020 — 2022',
      order: 1,
    },
  ],
  skills: [
    { label: 'Figma' },
    { label: 'Design systems' },
    { label: 'Prototyping' },
    { label: 'User research' },
    { label: 'Responsive web' },
    { label: 'iOS & Android' },
  ],
  seo: {
    metaTitle: 'About — Mohamad Hawa',
    metaDescription:
      'Six years designing web and mobile products. Freelance since 2020, at Poyesis since 2022.',
  },
};

const contactPage = {
  heading: "Tell me what you're building.",
  body:
    'Fill this in and it opens a message with everything already written. Or reach me directly — both work.',
  homeBody:
    'Three fields. It opens a message with everything already written — you just press send.',
  budgetOptions: [
    { label: '$500 – $1k' },
    { label: '$1k – $3k' },
    { label: '$3k – $7k' },
    { label: '$7k+' },
  ],
  unsureLabel: 'Not sure yet',
  formNameLabel: 'Your name',
  formNamePlaceholder: 'Who am I talking to?',
  formServiceLabel: 'What do you need?',
  formBudgetLabel: 'Budget',
  formBriefLabel: 'What are you building?',
  formBriefPlaceholder:
    "A sentence or two is plenty — what it is, who it's for, and when you'd like to start.",
  formWhatsappCta: 'Send on WhatsApp',
  formEmailCta: 'Send by email',
  formHint:
    'Nothing is stored or sent from this page — it opens the message in your own app so you stay in control.',
  formErrorName: 'Add your name so I know who is writing.',
  formErrorBrief: 'Tell me a little more about the project — a sentence is enough.',
  formSentWhatsapp: 'WhatsApp opened — press send there to deliver it.',
  formSentEmail: 'Your mail app should be opening with the message ready.',
  formGreeting: 'Hi Mohamad, I would like to talk about a project.',
  seo: {
    metaTitle: 'Contact — Mohamad Hawa',
    metaDescription:
      'Start a project. Three fields and it opens a WhatsApp or email message with everything already written.',
  },
};

const services = [
  {
    title: 'Landing page / showcase website',
    description:
      'One page — or a short set of them — that says the right thing in the right order and asks for one action.',
    ctaLabel: 'Start here',
    order: 0,
  },
  {
    title: 'Mobile app',
    description:
      'iOS and Android products designed thumb-first: the model underneath, the flows on top, and every state in between.',
    ctaLabel: 'Start here',
    order: 1,
  },
  {
    title: 'Web app',
    description:
      'Dashboards, portals and internal tools where a lot of data has to stay readable and a lot of people have to stay oriented.',
    ctaLabel: 'Start here',
    order: 2,
  },
  {
    title: 'Design system',
    description: 'Components, tokens, and rules so the tenth screen looks like the first.',
    ctaLabel: 'Start here',
    order: 3,
  },
  {
    title: 'Redesign web / mobile',
    description:
      'An existing product taken apart and rebuilt around what people are actually trying to do with it.',
    ctaLabel: 'Start here',
    order: 4,
  },
];

const processSteps = [
  {
    title: 'Understand the mess.',
    description: 'The problem, the people, and the process nobody has questioned in years.',
    order: 0,
  },
  {
    title: 'Find the signal.',
    description: 'Turn everything we learned into one opportunity actually worth building.',
    order: 1,
  },
  {
    title: 'Design the system.',
    description: 'Not just screens — the model underneath that keeps the screens honest.',
    order: 2,
  },
  {
    title: 'Test the idea.',
    description:
      'With the people who will use it on a Tuesday, not with the people who signed off.',
    order: 3,
  },
  {
    title: 'Ship the thing.',
    description: 'Sit with the developers until it is real, then look at what changed.',
    order: 4,
  },
];

/** The case study body the prototype ships for every project. Still placeholder text. */
const caseStudyDefaults = {
  problemLead: 'Three things were true at once, and each one made the others worse.',
  constraints: [
    {
      title: 'The first constraint',
      body: `${PLACEHOLDER} what the existing product or process did to the person using it, in one or two sentences.`,
    },
    {
      title: 'The second constraint',
      body: `${PLACEHOLDER} the business or technical limit that ruled out the obvious answer.`,
    },
    {
      title: 'The third constraint',
      body: `${PLACEHOLDER} the thing everyone had stopped questioning because it had always been that way.`,
    },
  ],
  approachLead:
    'Before any screens, a model: what the objects are, and what a person is allowed to do with them.',
  approachBody: `${PLACEHOLDER} the reframing that unlocked the work, and why it was the right bet. Two or three sentences is the right length here; the images below carry the rest.`,
  approachCaption: `${PLACEHOLDER} caption — what this screen is and what to notice in it.`,
  decisions: [
    {
      eyebrow: 'Decision',
      title: 'One route, not four',
      body: `${PLACEHOLDER} a decision you made and the alternative you rejected.`,
    },
    {
      eyebrow: 'Decision',
      title: 'Progressive disclosure',
      body: `${PLACEHOLDER} how complexity was staged rather than hidden.`,
    },
    {
      eyebrow: 'Decision',
      title: 'Plain language',
      body: `${PLACEHOLDER} a copy or labelling change that removed a support question.`,
    },
  ],
  shippedHeading: 'The screens that carry the work.',
  metrics: [
    { value: '3', label: `${PLACEHOLDER} e.g. steps removed from the core flow`, animate: true },
    { value: '40%', label: `${PLACEHOLDER} e.g. faster to complete`, animate: true },
    { value: 'Shipped', label: `${PLACEHOLDER} when it went live and what happened next`, animate: false },
  ],
  reflectionLead: 'What I would do differently, and what I would keep.',
  reflectionBody: `${PLACEHOLDER} the honest reflection. What the constraints taught you, what you would test earlier next time, and what part of the system you are still proud of.`,
};

const projects = [
  {
    title: 'Wise Academy',
    slug: 'wise-academy',
    categories: [{ label: 'Web app' }],
    discipline: 'Web app design',
    summary:
      'A learning academy’s platform — programmes, enrolment, and student progress in one place.',
    briefLead:
      'A learning platform where the hardest part was never the visual design — it was the enrolment path.',
    briefBody:
      'Structure first: what a course is, what a cohort is, and what a student sees at each stage. The interface followed from that model rather than the other way around.',
    chipBg: '#efeff1',
    chipInk: '#86868b',
    featured: true,
    order: 0,
  },
  {
    title: 'Kabbara Office',
    slug: 'kabbara-office',
    categories: [{ label: 'Mobile app' }],
    discipline: 'Mobile app design',
    summary: 'A request queue an office can actually work through, on the phone in their pocket.',
    briefLead: 'One screen, one job: know what is waiting and what has already been dealt with.',
    briefBody:
      'Status became the organising idea rather than a label, so the queue could be read at a glance and filtered down to the handful of requests that needed a decision today.',
    chipBg: '#e9e9ec',
    chipInk: '#86868b',
    featured: false,
    order: 1,
  },
  {
    title: 'Coding Lebanon',
    slug: 'coding-lebanon',
    categories: [{ label: 'Landing page / showcase website' }],
    discipline: 'Landing page design',
    summary: 'A learning community’s home for programmes, cohorts, and applications.',
    briefLead:
      'A community site that had to speak to two audiences at once: learners and the people funding them.',
    briefBody:
      'The solution was a clear split in the information hierarchy, so neither audience had to read past content aimed at the other.',
    chipBg: '#f2f2f4',
    chipInk: '#86868b',
    featured: false,
    order: 2,
  },
  {
    title: 'WFK Law Firm',
    slug: 'wfk-law-firm',
    categories: [{ label: 'Web app' }],
    discipline: 'Web app design',
    summary: 'A case board a legal team can read at a glance, inside the tools they already use.',
    briefLead:
      'Legal software tends to hide the one thing the team came for: what is moving, and what is stuck.',
    briefBody:
      'Status was promoted to the front of the interface, in plain language, with a direct route into every case from the board itself.',
    chipBg: '#efeff1',
    chipInk: '#86868b',
    featured: false,
    order: 3,
  },
  {
    title: 'Shipment Share',
    slug: 'shipment-share',
    categories: [{ label: 'Mobile app' }],
    discipline: 'Mobile app design',
    summary: 'Matching senders with travellers — designed thumb-first for mobile.',
    briefLead:
      'A two-sided marketplace where trust is the product and the interface is the only proof of it.',
    briefBody:
      'Every screen had to answer an unspoken question about safety, cost, or timing. Progressive disclosure kept the flow short without hiding the things people actually worry about.',
    chipBg: '#e9e9ec',
    chipInk: '#86868b',
    featured: false,
    order: 4,
  },
  {
    title: 'Shareb',
    slug: 'shareb',
    categories: [{ label: 'Web app' }],
    discipline: 'Web app design',
    summary: 'A promotional entry flow built to be scanned once and understood immediately.',
    briefLead: 'One tap from a printed code to being in the draw, with nothing to read on the way.',
    briefBody:
      'Tokens, components, and rules for spacing and states, documented so the tenth screen someone else builds still looks like the first one I did.',
    chipBg: '#f2f2f4',
    chipInk: '#86868b',
    featured: false,
    order: 5,
  },
].map((project, i) => ({
  ...caseStudyDefaults,
  ...project,
  role: 'UI / UX Design',
  seo: {
    metaTitle: `${project.title} — Mohamad Hawa`,
    metaDescription: project.summary,
  },
  // Mirrors the image mapping the prototype used for each index.
  __media: {
    cover: `cover-${i + 1}.png`,
    approachShot: `shot-${(i % 6) + 1}.png`,
    gallery: [`shot-${((i + 1) % 6) + 1}.png`, `cover-${((i + 3) % 6) + 1}.png`],
  },
}));

module.exports = {
  siteSetting,
  homePage,
  workPage,
  aboutPage,
  contactPage,
  services,
  processSteps,
  projects,
};
