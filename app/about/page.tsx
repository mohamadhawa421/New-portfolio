"use client"

import Image from "next/image"
import Link from "next/link"
import { Download, Mail, Phone, Globe, FileText, Linkedin, MessageCircle } from "lucide-react"
import { useMobileDetect } from "../../hooks/use-mobile"

export default function AboutPage() {
  const { isMobile } = useMobileDetect()

  return (
    <div className="bg-[#1d1d1d] text-white pb-safe">
      {/* Profile Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 md:p-6">
        <div className="md:col-span-1">
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
            <Link
              href="#"
              className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
            >
              <Globe className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">mohamadhawa.vercel.app</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
            >
              <FileText className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">mohamadhawa.vercel.app/blog</span>
            </Link>
            <Link
              href="mailto:Mohamadhawa421@gmail.com"
              className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
            >
              <Mail className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">Mohamadhawa421@gmail.com</span>
            </Link>
            <Link
              href="tel:+96176824793"
              className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
            >
              <Phone className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">+961 76 824 793</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
            >
              <Linkedin className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">Linkedin</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 text-gray-300 hover:text-[#90dda9] transition-colors py-1"
            >
              <MessageCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">Whatsapp</span>
            </Link>
          </div>

          {/* Download CV Button */}
          <div className="mt-8">
            <button className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#1a1a1a] hover:bg-[#252525] rounded-lg text-white transition-colors">
              <Download className="w-5 h-5" />
              Download My CV
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-8 md:space-y-10">
          {/* Work Experience */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Work Experience</h2>

            <div className="space-y-6 md:space-y-8">
              <div>
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
              </div>

              <div>
                <h3 className="text-gray-400">Freelancer</h3>
                <h4 className="text-lg md:text-xl font-semibold">UI/UX Designer</h4>
                <p className="text-xs md:text-sm text-gray-300 mt-2 leading-relaxed">
                  Designed user-friendly web and mobile interfaces by conducting user research and creating wireframes,
                  prototypes, and high-fidelity designs. Collaborated with clients and developers to ensure seamless
                  design implementation while meeting project deadlines. Focused on accessibility, scalability, and
                  staying updated with UI/UX trends to deliver innovative solutions.
                </p>
                <p className="text-xs md:text-sm text-gray-400 mt-2">2020 - 2022</p>
              </div>
            </div>
          </section>

          {/* Stack */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Stack</h2>
            <div className="grid grid-cols-5 gap-2 md:gap-4">
              {["Xd", "Figma", "Zeplin", "Sketch", "HTML", "CSS", "Js", "Ai", "Ps"].map((tool, index) => (
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
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-500 rounded"></div>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">UI/UX Design For Web & Mobile</h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Custom designs focused on user-centered, responsive, and intuitive interfaces for websites and
                      apps.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-500 rounded"></div>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">Wireframing & Prototyping</h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Creating wireframes, interactive prototypes, and user flows to visualize and test the user
                      journey.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-500 rounded"></div>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">Visual & Interaction Design</h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Crafting visually engaging and accessible designs with a focus on aesthetics and interaction.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-500 rounded"></div>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">Mobile App Design</h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Designing seamless and engaging experiences for mobile apps with attention to platform-specific
                      design principles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-500 rounded"></div>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">UI/UX Audits & Redesign</h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Conducting audits of existing interfaces to identify issues and suggesting improvements to enhance
                      usability and performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Process */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Process For You</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  1
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Initial Consultation</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Understanding your business goals, project scope, and user needs to set expectations and timelines.
                </p>
              </div>

              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  2
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Research & Analysis</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Conducting user research, competitive analysis, and market research to gather insights that inform
                  design decisions.
                </p>
              </div>

              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  3
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Wireframing & Prototyping</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Presenting wireframes and interactive prototypes to visualize the user journey and gather feedback
                  before moving to high-fidelity design.
                </p>
              </div>

              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  4
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Design & Refinement</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Creating high-fidelity UI designs with a focus on user experience and visual aesthetics. Iterating
                  based on feedback to refine the design.
                </p>
              </div>

              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  5
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Development Handoff</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Delivering assets and detailed specifications to the development team for seamless implementation.
                </p>
              </div>

              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  6
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Testing & Optimization</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Conducting usability testing to ensure the final product meets user needs and making necessary
                  optimizations post-launch.
                </p>
              </div>

              <div className="bg-[#1a1a1a] p-3 md:p-5 rounded-lg sm:col-span-2 md:col-span-3">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-[#fbb03b] rounded-full flex items-center justify-center text-black font-bold mb-2 md:mb-3">
                  7
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1 md:mb-2">Launch & Support</h3>
                <p className="text-xs md:text-sm text-gray-300">
                  Assisting with the final launch and offering ongoing support to ensure everything functions as
                  expected.
                </p>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">The Cost Of Creativity</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Starter Bundle */}
              <div className="border border-[#1a1a1a] bg-[#0d0d0d] rounded-lg overflow-hidden">
                <div className="p-4 md:p-6">
                  <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Starter Bundle</h3>
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Up to 5 pages/screens (web or mobile)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Basic user research</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Wireframes and high-fidelity designs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Responsive design</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">2 design revisions</span>
                    </li>
                  </ul>
                  <div className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">$700</div>
                  <div className="inline-block px-3 py-1 bg-[#1a1a1a] text-xs rounded-full">Start Small</div>
                </div>
              </div>

              {/* Professional Bundle */}
              <div className="border-2 border-[#90dda9] bg-[#0d0d0d] rounded-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 bg-[#90dda9] text-black text-xs px-3 py-1 font-semibold">
                  MOST POPULAR
                </div>
                <div className="p-4 md:p-6">
                  <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Professional Bundle</h3>
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Up to 10 pages/screens (web or mobile)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">In-depth user research</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Wireframes, prototypes, and high-fidelity designs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Design system (basic components)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Responsive design</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">4 design revisions</span>
                    </li>
                  </ul>
                  <div className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">$1500</div>
                  <div className="inline-block px-3 py-1 bg-[#1a1a1a] text-xs rounded-full">Level Up</div>
                </div>
              </div>

              {/* Premium Bundle */}
              <div className="border border-[#1a1a1a] bg-[#0d0d0d] rounded-lg overflow-hidden">
                <div className="p-4 md:p-6">
                  <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Premium Bundle</h3>
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Unlimited pages/screens (web or mobile)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Full-scale user research</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">
                        Detailed wireframes, interactive prototypes, and final designs
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Complete design system</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Collaboration with developers during implementation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">Usability testing post-launch</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#90dda9] font-bold">✓</span>
                      <span className="text-xs md:text-sm">6 design revisions</span>
                    </li>
                  </ul>
                  <div className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">$2,500+</div>
                  <div className="inline-block px-3 py-1 bg-[#1a1a1a] text-xs rounded-full">Own It All</div>
                </div>
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-400 mt-4 italic text-center px-4">
              "Lower prices for custom packages and redesigning are available for unique project needs. Contact me for a
              tailored quote."
            </p>
          </section>

          {/* Additional Notes */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#90dda9]">Additional Notes</h2>

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
        </div>
      </div>
    </div>
  )
}
