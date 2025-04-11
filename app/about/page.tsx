"use client"

import Image from "next/image"
import Link from "next/link"
import { Download, Mail, Phone, Globe, FileText, Linkedin, MessageCircle } from "lucide-react"
import { useMobileDetect } from "../../hooks/use-mobile"

// Define types for better TypeScript support
type ServiceProps = {
  title: string;
  description: string;
}

type ProcessStepProps = {
  number: number;
  title: string;
  description: string;
  fullWidth?: boolean;
}

type PricingTierProps = {
  title: string;
  price: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}

type ContactLinkProps = {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  children: React.ReactNode;
};

// Extract components for reusability and cleaner code
const ContactLink = ({ icon: Icon, href, children }: ContactLinkProps) => (
  <Link
    href={href}
    className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    <span className="text-sm md:text-base">{children}</span>
  </Link>
)

const Service = ({ title, description }: ServiceProps) => (
  <div className="space-y-2">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
        <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-500 rounded"></div>
      </div>
      <div>
        <h3 className="text-sm md:text-base font-semibold">{title}</h3>
        <p className="text-xs md:text-sm text-gray-300">{description}</p>
      </div>
    </div>
  </div>
)

const ProcessStep = ({ number, title, description, fullWidth = false }: ProcessStepProps) => (
  <div className={`bg-[#1a1a1a] p-3 md:p-5 rounded-lg ${fullWidth ? "sm:col-span-2 md:col-span-3" : ""}`}>
    <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
      {number}
    </div>
    <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">{title}</h3>
    <p className="text-xs md:text-sm text-gray-300">{description}</p>
  </div>
)

const PricingTier = ({ title, price, tagline, features, popular = false }: PricingTierProps) => (
  <div 
    className={`${popular ? "border-2 border-[#90dda9]" : "border border-[#1a1a1a]"} bg-[#0d0d0d] rounded-lg overflow-hidden relative`}
  >
    {popular && (
      <div className="absolute top-0 right-0 bg-[#90dda9] text-black text-xs px-3 py-1 font-semibold">
        MOST POPULAR
      </div>
    )}
    <div className="p-4 md:p-6">
      <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">{title}</h3>
      <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-[#90dda9] font-bold">✓</span>
            <span className="text-xs md:text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      <div className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">{price}</div>
      <div className="inline-block px-3 py-1 bg-[#1a1a1a] text-xs rounded-full">{tagline}</div>
    </div>
  </div>
)

// Define data constants for easy maintenance
const SERVICES = [
  {
    title: "UI/UX Design For Web & Mobile",
    description: "Custom designs focused on user-centered, responsive, and intuitive interfaces for websites and apps."
  },
  {
    title: "Wireframing & Prototyping",
    description: "Creating wireframes, interactive prototypes, and user flows to visualize and test the user journey."
  },
  {
    title: "Visual & Interaction Design",
    description: "Crafting visually engaging and accessible designs with a focus on aesthetics and interaction."
  },
  {
    title: "Mobile App Design",
    description: "Designing seamless and engaging experiences for mobile apps with attention to platform-specific design principles."
  },
  {
    title: "UI/UX Audits & Redesign",
    description: "Conducting audits of existing interfaces to identify issues and suggesting improvements to enhance usability and performance."
  }
]

const PROCESS_STEPS = [
  {
    number: 1,
    title: "Initial Consultation",
    description: "Understanding your business goals, project scope, and user needs to set expectations and timelines."
  },
  {
    number: 2,
    title: "Research & Analysis",
    description: "Conducting user research, competitive analysis, and market research to gather insights that inform design decisions."
  },
  {
    number: 3,
    title: "Wireframing & Prototyping",
    description: "Presenting wireframes and interactive prototypes to visualize the user journey and gather feedback before moving to high-fidelity design."
  },
  {
    number: 4,
    title: "Design & Refinement",
    description: "Creating high-fidelity UI designs with a focus on user experience and visual aesthetics. Iterating based on feedback to refine the design."
  },
  {
    number: 5,
    title: "Development Handoff",
    description: "Delivering assets and detailed specifications to the development team for seamless implementation."
  },
  {
    number: 6,
    title: "Testing & Optimization",
    description: "Conducting usability testing to ensure the final product meets user needs and making necessary optimizations post-launch."
  },
  {
    number: 7,
    title: "Launch & Support",
    description: "Assisting with the final launch and offering ongoing support to ensure everything functions as expected.",
    fullWidth: true
  }
]

const PRICING_TIERS = [
  {
    title: "Starter Bundle",
    price: "$700",
    tagline: "Start Small",
    features: [
      "Up to 5 pages/screens (web or mobile)",
      "Basic user research",
      "Wireframes and high-fidelity designs",
      "Responsive design",
      "2 design revisions"
    ]
  },
  {
    title: "Professional Bundle",
    price: "$1500",
    tagline: "Level Up",
    popular: true,
    features: [
      "Up to 10 pages/screens (web or mobile)",
      "In-depth user research",
      "Wireframes, prototypes, and high-fidelity designs",
      "Design system (basic components)",
      "Responsive design",
      "4 design revisions"
    ]
  },
  {
    title: "Premium Bundle",
    price: "$2,500+",
    tagline: "Own It All",
    features: [
      "Unlimited pages/screens (web or mobile)",
      "Full-scale user research",
      "Detailed wireframes, interactive prototypes, and final designs",
      "Complete design system",
      "Collaboration with developers during implementation",
      "Usability testing post-launch",
      "6 design revisions"
    ]
  }
]

const TECH_STACK = ["Xd", "Figma", "Zeplin", "Sketch", "HTML", "CSS", "Js", "Ai", "Ps"]

export default function AboutPage() {
  const { isMobile } = useMobileDetect()

  return (
    <div className="bg-[#1d1d1d] text-white pb-safe">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 md:p-6">
        {/* Profile Section */}
        <aside className="md:col-span-1">
          <div className="aspect-square w-full max-w-[250px] mx-auto md:mx-0 overflow-hidden rounded-lg">
            <Image
              src="/placeholder.svg"
              alt="Mohamad Hawa"
              width={300}
              height={300}
              className="object-cover w-full h-full"
              priority
            />
          </div>
          
          <div className="mt-4 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold">Mohamad Hawa</h1>
            <p className="text-gray-400">UI/UX Designer @ Poyesis</p>
          </div>

          {/* Contact Links */}
          <div className="mt-6 space-y-3">
            <ContactLink icon={Globe} href="#">mohamadhawa.vercel.app</ContactLink>
            <ContactLink icon={FileText} href="#">mohamadhawa.vercel.app/blog</ContactLink>
            <ContactLink icon={Mail} href="mailto:Mohamadhawa421@gmail.com">Mohamadhawa421@gmail.com</ContactLink>
            <ContactLink icon={Phone} href="tel:+96176824793">+961 76 824 793</ContactLink>
            <ContactLink icon={Linkedin} href="#">Linkedin</ContactLink>
            <ContactLink icon={MessageCircle} href="#">Whatsapp</ContactLink>
          </div>

          {/* Download CV Button */}
          <button 
            className="mt-8 flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#1a1a1a] hover:bg-[#252525] rounded-lg text-white transition-colors"
            aria-label="Download CV"
          >
            <Download className="w-5 h-5" />
            Download My CV
          </button>
        </aside>

        {/* Main Content */}
        <main className="md:col-span-2 space-y-8 md:space-y-10">
          {/* Work Experience */}
          <section aria-labelledby="work-experience">
            <h2 id="work-experience" className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">
              Work Experience
            </h2>

            <div className="space-y-6 md:space-y-8">
              <article>
                <h3 className="text-gray-400">Poyesis</h3>
                <h4 className="text-lg md:text-xl font-semibold">UI/UX Designer</h4>
                <p className="text-xs md:text-sm text-gray-300 mt-2 leading-relaxed">
                  Collaborated with cross-functional teams to design innovative user experiences for web and mobile
                  applications, including projects in French for local clients. Worked on high-profile projects for
                  global brands like LVMH and Total Energies. Conducted user research, developed prototypes, and ensured
                  designs aligned with client objectives. Focused on creating accessible, aesthetically pleasing, and
                  user-centric solutions that enhanced brand identity and user engagement, while adapting designs for
                  the French-speaking audience.
                </p>
                <p className="text-xs md:text-sm text-gray-400 mt-2">2020 - Present</p>
              </article>

              <article>
                <h3 className="text-gray-400">Freelancer</h3>
                <h4 className="text-lg md:text-xl font-semibold">UI/UX Designer</h4>
                <p className="text-xs md:text-sm text-gray-300 mt-2 leading-relaxed">
                  Designed user-friendly web and mobile interfaces by conducting user research and creating wireframes,
                  prototypes, and high-fidelity designs. Collaborated with clients and developers to ensure seamless
                  design implementation while meeting project deadlines. Focused on accessibility, scalability, and
                  staying updated with UI/UX trends to deliver innovative solutions.
                </p>
                <p className="text-xs md:text-sm text-gray-400 mt-2">2020 - 2022</p>
              </article>
            </div>
          </section>

          {/* Stack */}
          <section aria-labelledby="stack">
            <h2 id="stack" className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Stack</h2>
            <div className="grid grid-cols-5 gap-2 md:gap-4">
              {TECH_STACK.map((tool, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center justify-center p-2 md:p-3 bg-[#1a1a1a] rounded-lg aspect-square"
                >
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-600 rounded-full mb-1 md:mb-2"></div>
                  <span className="text-[10px] md:text-xs text-center">{tool}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Services */}
          <section aria-labelledby="services">
            <h2 id="services" className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {SERVICES.map((service, index) => (
                <Service 
                  key={index} 
                  title={service.title} 
                  description={service.description} 
                />
              ))}
            </div>
          </section>

          {/* Process */}
          <section aria-labelledby="process">
            <h2 id="process" className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Process For You</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {PROCESS_STEPS.map((step, index) => (
                <ProcessStep
                  key={index}
                  number={step.number}
                  title={step.title}
                  description={step.description}
                  fullWidth={step.fullWidth}
                />
              ))}
            </div>
          </section>

          {/* Pricing */}
          <section aria-labelledby="pricing">
            <h2 id="pricing" className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">The Cost Of Creativity</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PRICING_TIERS.map((tier, index) => (
                <PricingTier
                  key={index}
                  title={tier.title}
                  price={tier.price}
                  tagline={tier.tagline}
                  features={tier.features}
                  popular={tier.popular}
                />
              ))}
            </div>
            <p className="text-xs md:text-sm text-gray-400 mt-4 italic text-center px-4">
              "Lower prices for custom packages and redesigning are available for unique project needs. Contact me for a
              tailored quote."
            </p>
          </section>

          {/* Additional Notes */}
          <section aria-labelledby="additional-notes">
            <h2 id="additional-notes" className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Additional Notes</h2>

            <div className="space-y-4 md:space-y-6">
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Why Choose Me?</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  With 4 years of experience—2 years at a French company, and 2 years of freelancing—I bring a wealth of
                  expertise in crafting intuitive and visually appealing designs that enhance user experience. My
                  attention to detail and commitment to understanding client needs ensure that the end product aligns
                  perfectly with your vision.
                </p>
              </div>

              <div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Hourly Rate</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  $20-$40 per hour (depending on the project scope and complexity)
                </p>
              </div>

              <div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Payment</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Payment Terms: 50% upfront, 50% upon completion.
                  <br />
                  Price is quoted in USD; LBP equivalent can be discussed based on the current exchange rate.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}