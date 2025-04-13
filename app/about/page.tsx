"use client"

import Image from "next/image"
import { useMobileDetect } from "../../hooks/use-mobile"


const SERVICES = [
  {
    title: "UI/UX Design For Web & Mobile",
    description: "Custom designs focused on user-centered, responsive, and intuitive interfaces for websites and apps.",
    image: "/icons/design.svg"
  },
  {
    title: "Wireframing & Prototyping",
    description: "Creating wireframes, interactive prototypes, and user flows to visualize and test the user journey.",
    image: "/icons/wireframe.svg"
  },
  {
    title: "Visual & Interaction Design",
    description: "Crafting visually engaging and accessible designs with a focus on aesthetics and interaction.",
    image: "/icons/visual interaction.svg"
  },
  {
    title: "Mobile App Design",
    description: "Designing seamless and engaging experiences for mobile apps with attention to platform-specific design principles.",
    image: "/icons/mobile.svg"
  },
  {
    title: "UI/UX Audits & Redesign",
    description: "Conducting audits of existing interfaces to identify issues and suggesting improvements to enhance usability and performance.",
    image: "/icons/audits.svg"
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

export default function AboutPage() {
  const { isMobile } = useMobileDetect()

  return (
    <div className="bg-[#1d1d1d] text-white pb-safe">
      <div className="flex flex-col md:flex-row gap-2 p-4 md:p-6">
        {/* Profile Section */}
        <div className="flex flex-col flex-shrink-0 items-start gap-2 w-full md:w-[448px]">
          <div className="self-stretch rounded-[1.25rem] overflow-hidden">
            <Image
              src="/profile-image.jpg"
              alt="Mohamad hawa"
              width={240}
              height={140}
              quality={100}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="flex flex-col items-center gap-8 self-stretch p-[2.125rem] rounded-[1.25rem] bg-[#121212]">
            <div className="flex flex-col items-start gap-8 self-stretch">
              <div className="flex flex-col items-start gap-2 self-stretch">
                <div className="self-stretch text-white font-['Inter'] text-[1.375rem] font-semibold leading-[normal] capitalize">
                  Mohamad Hawa
                </div>
                <div className="self-stretch text-[#8c8e93] font-['Inter'] font-light text-sm leading-[normal] capitalize">
                  UI UX Designer @ Poyesis
                </div>
              </div>
              <div className="flex flex-col items-start self-stretch gap-4">
                {/* <div className="flex justify-between items-center self-stretch">
                  <div className="text-white font-['Inter'] text-sm font-semibold capitalize">Blog</div>
                  <div className="flex items-center gap-3 text-[#8c8e93] font-['Inter'] text-sm">mohamadhawa.vercel.app/blog</div>
                </div> */}
                <div className="flex justify-between items-center self-stretch">
                  <div className="text-white font-['Inter'] text-sm font-semibold capitalize">Email</div>
                  <div className="flex items-center gap-3 text-[#8c8e93] font-['Inter'] text-sm">Mohamadhawa421@gmail.com</div>
                </div>
                <div className="flex justify-between items-center self-stretch">
                  <div className="text-white font-['Inter'] text-sm font-semibold capitalize">Phone</div>
                  <div className="flex items-center gap-3 text-[#8c8e93] font-['Inter'] text-sm">+961 76 824 793</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-4 w-full">
  {/* LinkedIn Button */}
  <a 
    href="https://www.linkedin.com/in/mohamad-hawa-45aa09246" // Replace with your actual LinkedIn URL
    className="flex justify-center items-center gap-1 w-full h-[3.3125rem] rounded-full border border-white text-white font-['Inter'] text-sm font-semibold capitalize transition-all duration-300 hover:bg-white/10 hover:border-white/80 hover:no-underline"
  >
    LinkedIn
  </a>

  {/* WhatsApp Button */}
  <a 
    href="https://wa.link/mlum9h" // Replace with your actual WhatsApp URL
    className="flex justify-center items-center gap-1 w-full h-[3.3125rem] rounded-full border border-white text-white font-['Inter'] text-sm font-semibold capitalize transition-all duration-300 hover:bg-white/10 hover:border-white/80 hover:no-underline"
  >
    WhatsApp
  </a>

  {/* Download CV Button */}
  {/* <a 
    href="#cv-download-link" // Replace with your actual CV download URL
    className="flex justify-center items-center gap-1 w-full h-[3.3125rem] rounded-full border border-white text-white font-['Inter'] text-sm font-semibold capitalize transition-all duration-300 hover:bg-white/10 hover:border-white/80 hover:no-underline"
  >
    Download my CV
  </a> */}
</div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-8 md:gap-10">
          {/* Work Experience */}
          <div className="flex flex-col gap-2">
            <div className="relative flex flex-col gap-6 p-6 rounded-[1.25rem] bg-[#121212]">
              <div className="text-white font-['Inter'] text-[1.375rem] font-semibold capitalize">
                Work experience
              </div>
              <div className="absolute top-[4rem] left-6 w-24 h-[0.1875rem] rounded-full bg-[#90dda9]" />
              <div className="flex flex-col gap-6">
                {/* Poyesis */}
                <div className="flex flex-col gap-2">
                  <div className="text-[#8c8e93] font-['Inter'] text-sm">Poyesis</div>
                  <div className="flex flex-col gap-3">
                    <div className="text-white font-['Inter'] text-sm font-semibold capitalize">UI UX Designer</div>
                    <div className="flex flex-col gap-2">
                      <div className="text-[#8c8e93] font-['Inter'] text-xs">
                        Collaborated with cross-functional teams to design innovative user experiences for web and mobile applications, including projects in French for local clients. Worked on high-profile projects for global brands like LVMH and Total Energies. Conducted user research, developed prototypes, and ensured designs aligned with client objectives. Focused on creating accessible, aesthetically pleasing, and user-centric solutions that enhanced brand identity and user engagement, while adapting designs for the French-speaking audience.
                      </div>
                      <div className="text-[#90dda9] font-['Inter'] text-xs">2022 - Present</div>
                    </div>
                  </div>
                </div>

                {/* Freelancer */}
                <div className="flex flex-col gap-2">
                  <div className="text-[#8c8e93] font-['Inter'] text-sm">Freelancer</div>
                  <div className="flex flex-col gap-3">
                    <div className="text-white font-['Inter'] text-sm font-semibold capitalize">UI UX Designer</div>
                    <div className="flex flex-col gap-2">
                      <div className="text-[#8c8e93] font-['Inter'] text-xs">
                        Designed user-friendly web and mobile interfaces by conducting user research and creating wireframes, prototypes, and high-fidelity designs. Collaborated with clients and developers to ensure seamless design implementation while meeting project deadlines. Focused on accessibility, scalability, and staying updated with UI/UX trends to deliver innovative solutions.
                      </div>
                      <div className="text-[#8c8e93] font-['Inter'] text-xs">2020 - 2022</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stack Section - Mobile & Desktop Optimized */}
<div className="relative flex items-start gap-4 sm:gap-6 py-4 px-6 rounded-2xl bg-[#121212] w-full overflow-hidden">
  {/* Title with underline - Fixed width to prevent wrapping */}
  <div className="relative flex-shrink-0">
    <div className="text-white font-['Inter'] text-xl sm:text-[1.375rem] font-semibold capitalize whitespace-nowrap">Stack</div>
    <div className="absolute left-0 bottom-[-0.5rem] w-9 h-1 sm:h-[0.1875rem] rounded-full bg-[#90dda9]" />
  </div>

  {/* Stack Icons - Scrollable container */}
  <div className="flex-1 overflow-x-auto pb-2 hide-scrollbar">
    <div className="flex gap-2 sm:gap-2 w-max sm:w-full">
      {[
        { src: "./icons/figma.svg", alt: "Figma" },
        { src: "./icons/xd.svg", alt: "Adobe XD" },
        { src: "./icons/notion.svg", alt: "Notion" },
        { src: "./icons/chatgpt.svg", alt: "ChatGPT" },
        { src: "./icons/slack.svg", alt: "Slack" },
        { src: "./icons/trello.svg", alt: "Trello" },
        { src: "./icons/ai.svg", alt: "Adobe Illustrator" },
        { src: "./icons/ps.svg", alt: "Photoshop" }
      ].map((icon, index) => (
        <div key={index} className="flex-shrink-0">
          <Image
            src={icon.src}
            alt={icon.alt}
            width={48}
            height={48}
            className="w-10 h-10 sm:w-12 sm:h-12 hover:scale-105 transition-transform duration-200"
          />
        </div>
      ))}
    </div>
  </div>

  {/* Custom CSS to hide scrollbar */}
  <style jsx>{`
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}</style>
</div>
            {/* Services Section */}
          <section className="relative flex flex-col gap-8 p-6 rounded-[1.25rem] bg-[#121212]">
            <h2 className="text-white font-['Inter'] text-[1.375rem] font-semibold capitalize">Services</h2>
            <div className="absolute top-[4rem] left-6 w-14 h-[0.1875rem] rounded-full bg-[#90dda9]" />
            <div className="flex flex-col gap-6">
              {SERVICES.map((service, idx) => (
                <div key={idx} className="flex flex-col gap-6">
                  <div className="flex items-start gap-3">
                  <Image
                  src={service.image}
                  alt="icon"
                  width={36}
                  height={36}
                  />
                    <div>
                      <h3 className="text-sm md:text-base font-semibold">{service.title}</h3>
                      <p className="text-xs md:text-sm text-gray-300">{service.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Process Section */}
          <section className="relative flex flex-col gap-6 p-6 rounded-[1.25rem] bg-[#121212]">
            <h2 className="text-white font-['Inter'] text-[1.375rem] font-semibold capitalize">Process</h2>
            <div className="absolute top-[4rem] left-6 w-12 h-[0.1875rem] rounded-full bg-[#90dda9]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
  {PROCESS_STEPS.slice(0, 4).map((step, index) => (
    <div
      key={index}
      className={`bg-[#292929] p-3 md:p-5 rounded-xl ${
        step.fullWidth ? "sm:col-span-2 md:col-span-3" : ""
      }`}
    >
      <div className="w-9 h-9 md:w-8 md:h-8 bg-[#121212] rounded-[8px] flex items-center justify-center text-[#90DDA9] font-bold mb-2 md:mb-3">
        {step.number}
      </div>
      <h3 className="text-smS md:text-base font-semibold mb-1 md:mb-2">{step.title}</h3>
      <p className="text-xs md:text-sm text-[#8C8E93]">{step.description}</p>
    </div>
  ))}

  {/* Wrap 5-6-7 in a 3-column row */}
  <div className="md:col-span-4 flex flex-col sm:flex-row gap-2">
    {PROCESS_STEPS.slice(4).map((step, index) => (
      <div
        key={index}
        className="flex-1 bg-[#292929] p-3 md:p-5 rounded-xl"
      >
        <div className="w-9 h-9 md:w-8 md:h-8 bg-[#121212] rounded-[8px] flex items-center justify-center text-[#90DDA9] font-bold mb-2 md:mb-3">
          {step.number}
        </div>
        <h3 className="text-smS md:text-base font-semibold mb-1 md:mb-2">{step.title}</h3>
        <p className="text-xs md:text-sm text-[#8C8E93]">{step.description}</p>
      </div>
    ))}
  </div>
</div>

          </section>


          {/* Pricing Section */}
          
{/* Pricing Section */}
<section className="relative flex flex-col items-start gap-4 w-full bg-[#121212] p-6 rounded-[1.25rem]">
<h2 className="text-white font-['Inter'] text-[1.375rem] font-semibold capitalize">The cost of creativity</h2>
<div className="absolute top-[4rem] left-6 w-32 h-[0.1875rem] rounded-full bg-[#90dda9]" />
  <div className="flex flex-col md:flex-row items-start gap-2 w-full overflow-x-auto mt-3">
    {/* Starter Bundle */}
    <div className="flex flex-col justify-between items-start w-full min-w-[280px] h-full md:w-1/3 p-4 rounded-xl bg-[#ebebeb]">
      <div className="flex flex-col gap-4 items-start w-full">
        <div className="flex flex-col justify-center w-full h-7 text-[#121212] font-black capitalize">Starter Bundle</div>
        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(120, 120, 120, 0) 0%, #121212 50%, rgba(120, 120, 120, 0) 100%)'}} />

        <div className="flex flex-col items-start gap-3 w-full min-h-[270px]">
          {[
            "Up to 5 pages/screens (web or mobile)",
            "Basic user research",
            "Wireframes and high-fidelity designs",
            "Responsive design",
            "2 design revisions"
          ].map((feature, index) => (
            <div key={index} className="flex items-start gap-2 w-full">
              <svg width={18} height={18} viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
                <rect width={18} height={18} rx={9} fill="#EBEBEB" />
                <path d="M14.0333 5.4074C13.9636 5.3371 13.8806 5.2813 13.7892 5.24323C13.6979 5.20515 13.5998 5.18555 13.5008 5.18555C13.4018 5.18555 13.3038 5.20515 13.2124 5.24323C13.121 5.2813 13.038 5.3371 12.9683 5.4074L7.38082 11.0024L5.03332 8.6474C4.96093 8.57747 4.87547 8.52248 4.78183 8.48558C4.68819 8.44868 4.58819 8.43058 4.48756 8.43232C4.38692 8.43406 4.28762 8.45561 4.19531 8.49573C4.103 8.53585 4.0195 8.59375 3.94957 8.66615C3.87964 8.73854 3.82465 8.82399 3.78775 8.91763C3.75085 9.01128 3.73275 9.11127 3.73449 9.2119C3.73623 9.31254 3.75778 9.41185 3.7979 9.50416C3.83802 9.59646 3.89593 9.67997 3.96832 9.7499L6.84832 12.6299C6.91804 12.7002 7.00099 12.756 7.09238 12.7941C7.18378 12.8321 7.28181 12.8517 7.38082 12.8517C7.47983 12.8517 7.57786 12.8321 7.66925 12.7941C7.76064 12.756 7.8436 12.7002 7.91332 12.6299L14.0333 6.5099C14.1094 6.43966 14.1702 6.35443 14.2118 6.25955C14.2533 6.16468 14.2748 6.06222 14.2748 5.95865C14.2748 5.85507 14.2533 5.75262 14.2118 5.65774C14.1702 5.56287 14.1094 5.47763 14.0333 5.4074Z" fill="#121212" />
              </svg>
              <div className="text-[#121212] text-xs leading-normal flex-1">{feature}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(120, 120, 120, 0) 0%, #121212 50%, rgba(120, 120, 120, 0) 100%)'}} />
      <div className="flex justify-between items-center w-full mt-6">
        <div className="text-[#121212] text-lg font-bold">$700</div>
        <div className="flex justify-center items-center gap-1 py-2 px-4 rounded-full bg-[#121212] text-white text-xs font-extrabold capitalize">
          Start Small
        </div>
      </div>
    </div>

    {/* Professional Bundle */}
    <div className="flex flex-col justify-between items-start w-full min-w-[280px] md:w-1/3 p-4 rounded-xl bg-[#292929] h-full">
      <div className="flex flex-col items-start w-full gap-4">
        <div className="flex justify-between items-center w-full h-7">
          <div className="text-[#90dda9] font-black capitalize">Professional Bundle</div>
          <div className="flex justify-center items-center py-1 px-2 rounded-full border border-[#ebebeb] text-[#ebebeb] text-[8px] capitalize">
            MOST POPULAR
          </div>
        </div>
        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #858585 50%, rgba(235, 235, 235, 0) 100%)'}} />


        <div className="flex flex-col items-start gap-3 w-full min-h-[270px]">
          {[
            "Up to 10 pages/screens (web or mobile)",
            "In-depth user research",
            "Wireframes, prototypes, and high-fidelity designs",
            "Design system (basic components)",
            "Responsive design",
            "4 design revisions"
          ].map((feature, index) => (
            <div key={index} className="flex items-start gap-2 w-full">
              <svg width={19} height={18} viewBox="0 0 19 18" fill="none" className="flex-shrink-0">
                <path d="M14.3656 5.4074C14.2959 5.3371 14.2129 5.2813 14.1215 5.24323C14.0301 5.20515 13.9321 5.18555 13.8331 5.18555C13.7341 5.18555 13.6361 5.20515 13.5447 5.24323C13.4533 5.2813 13.3703 5.3371 13.3006 5.4074L7.71309 11.0024L5.36559 8.6474C5.2932 8.57747 5.20775 8.52248 5.1141 8.48558C5.02046 8.44868 4.92047 8.43058 4.81983 8.43232C4.7192 8.43406 4.61989 8.45561 4.52758 8.49573C4.43527 8.53585 4.35177 8.59375 4.28184 8.66615C4.21191 8.73854 4.15693 8.82399 4.12002 8.91763C4.08312 9.01128 4.06502 9.11127 4.06677 9.2119C4.06851 9.31254 4.09005 9.41185 4.13017 9.50416C4.17029 9.59646 4.2282 9.67997 4.30059 9.7499L7.18059 12.6299C7.25031 12.7002 7.33327 12.756 7.42466 12.7941C7.51605 12.8321 7.61408 12.8517 7.71309 12.8517C7.8121 12.8517 7.91013 12.8321 8.00152 12.7941C8.09292 12.756 8.17587 12.7002 8.24559 12.6299L14.3656 6.5099C14.4417 6.43966 14.5025 6.35443 14.544 6.25955C14.5856 6.16468 14.607 6.06222 14.607 5.95865C14.607 5.85507 14.5856 5.75262 14.544 5.65774C14.5025 5.56287 14.4417 5.47763 14.3656 5.4074Z" fill="#90DDA9" />
              </svg>
              <div className="text-[#ebebeb] text-xs leading-normal flex-1">{feature}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #858585 50%, rgba(235, 235, 235, 0) 100%)'}} />
      <div className="flex justify-between items-center w-full mt-6">
        <div className="text-[#ebebeb] text-lg font-bold">$1500</div>
        <div className="flex justify-center items-center gap-1 py-2 px-4 rounded-full bg-[#90dda9] text-black text-xs font-extrabold capitalize">
          Level Up
        </div>
      </div>
    </div>

    <div className="relative group flex flex-col justify-between items-start w-full min-w-[280px] md:w-1/3 p-[2px] rounded-xl bg-gradient-to-tr from-[#2B2B2D] to-[#FFD966]">
  {/* Inner card container */}
  <div className="flex flex-col justify-between items-start w-full h-full p-4 rounded-[10px] bg-[#1A1A1A]">
    <div className="flex flex-col gap-4 items-start w-full">
      <div className="flex flex-col justify-center w-full h-7 text-[#ffd966] font-black capitalize">
        Premium Bundle
      </div>
      <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(255, 215, 0, 0) 0%, rgba(255, 193, 7, 1) 50%, rgba(255, 215, 0, 0) 100%)'}} />

      <div className="flex flex-col items-start gap-3 w-full min-h-[270px]">
        {[
          "Unlimited pages/screens (web or mobile)",
          "Full-scale user research",
          "Detailed wireframes, interactive prototypes, and final designs",
          "Complete design system",
          "Collaboration with developers during implementation",
          "Usability testing post-launch",
          "6 design revisions"
        ].map((feature, index) => (
          <div key={index} className="flex items-start gap-2 w-full">
            <svg width={19} height={18} viewBox="0 0 19 18" fill="none" className="flex-shrink-0">
              <path d="M14.6988 5.4074C14.6291 5.3371 14.5462 5.2813 14.4548 5.24323C14.3634 5.20515 14.2654 5.18555 14.1663 5.18555C14.0673 5.18555 13.9693 5.20515 13.8779 5.24323C13.7865 5.2813 13.7036 5.3371 13.6338 5.4074L8.04634 11.0024L5.69884 8.6474C5.62645 8.57747 5.541 8.52248 5.44736 8.48558C5.35371 8.44868 5.25372 8.43058 5.15309 8.43232C5.05245 8.43406 4.95314 8.45561 4.86083 8.49573C4.76853 8.53585 4.68502 8.59375 4.61509 8.66615C4.54517 8.73854 4.49018 8.82399 4.45328 8.91763C4.41637 9.01128 4.39828 9.11127 4.40002 9.2119C4.40176 9.31254 4.4233 9.41185 4.46342 9.50416C4.50354 9.59646 4.56145 9.67997 4.63384 9.7499L7.51384 12.6299C7.58357 12.7002 7.66652 12.756 7.75791 12.7941C7.84931 12.8321 7.94734 12.8517 8.04634 12.8517C8.14535 12.8517 8.24338 12.8321 8.33478 12.7941C8.42617 12.756 8.50912 12.7002 8.57884 12.6299L14.6988 6.5099C14.775 6.43966 14.8357 6.35443 14.8773 6.25955C14.9188 6.16468 14.9403 6.06222 14.9403 5.95865C14.9403 5.85507 14.9188 5.75262 14.8773 5.65774C14.8357 5.56287 14.775 5.47763 14.6988 5.4074Z" fill="#FFD966" />
            </svg>
            <div className="text-[#ebebeb] text-xs leading-normal flex-1">{feature}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(255, 215, 0, 0) 0%, rgba(255, 193, 7, 1) 50%, rgba(255, 215, 0, 0) 100%)'}} />
    <div className="flex justify-between items-center w-full mt-6">
      <div className="text-[#ebebeb] text-lg font-bold">$2,500+</div>
      <div className="flex justify-center items-center gap-1 py-2 px-4 rounded-full bg-[#FFD966] text-black text-xs font-extrabold capitalize">
        Own It All
      </div>
    </div>
  </div>
</div>
  </div>
  
  {/* Rest of the content remains the same */}
  <div className=" text-white text-xs leading-[normal]">
    "Lower prices for custom packages and redesigning are available for unique project needs. Contact me for a tailored quote."
  </div>
  
  <div className="flex flex-col items-start self-stretch p-3 gap-3.5 rounded-xl bg-[#292929]">
    <div className="flex items-center py-1 px-2 rounded-lg bg-[#121212] text-[#90dda9] text-xs capitalize">
      Additional notes
    </div>
    <div className="flex flex-col items-start gap-1 self-stretch">
      <div className="self-stretch text-white text-sm font-semibold capitalize">Why choose me?</div>
      <div className="self-stretch text-[#8C8E93] text-xs font-semibold">
        With 4 years of experience—2 years at a French company, and 2 years of freelancing—I bring a wealth of expertise in crafting intuitive and visually appealing designs that enhance user experience. My attention to detail and commitment to understanding client needs ensure that the end product aligns perfectly with your vision.
      </div>
    </div>
    <div className="flex flex-col items-start gap-1.5 self-stretch">
      <div className="self-stretch text-white text-sm font-semibold capitalize">Hourly rate</div>
      <div className="self-stretch text-[#8c8e93] text-xs">
        $20 - $40 per hour (depending on the project scope and complexity)
      </div>
    </div>
    <div className="flex flex-col items-start gap-1.5 self-stretch">
      <div className="self-stretch text-white text-sm font-semibold capitalize">Payment</div>
      <div className="self-stretch text-[#8c8e93] text-xs">
        Payment Terms: 50% upfront, 50% upon completion.
        Price is quoted in USD; LBP equivalent can be discussed based on the current exchange rate.
      </div>
    </div>
  </div>
</section>
          </div>
        </main>
      </div>
    </div>
  )
}
