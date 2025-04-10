"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Download } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState<string>("about")
  const searchParams = useSearchParams()
  const router = useRouter()
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Create refs for each section
  const sectionRefs = {
    about: useRef<HTMLElement>(null),
    services: useRef<HTMLElement>(null),
    craft: useRef<HTMLElement>(null),
    cost: useRef<HTMLElement>(null),
  }

  // Function to scroll to a section
  const scrollToSection = (sectionId: string) => {
    const section = sectionRefs[sectionId as keyof typeof sectionRefs]?.current

    if (section && mainContentRef.current) {
      // Calculate position to scroll to (element's top position minus header height)
      const headerHeight = 70 // Approximate height of the header
      const sectionTop = section.offsetTop
      const offsetPosition = sectionTop - headerHeight

      // Scroll the main content div
      mainContentRef.current.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })

      // Update active section and URL
      setActiveSection(sectionId)
      window.history.replaceState({}, "", `#${sectionId}`)
    }
  }

  // Handle navigation link clicks
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const href = e.currentTarget.getAttribute("href")

    if (href && href.startsWith("#")) {
      const sectionId = href.substring(1)
      scrollToSection(sectionId)
    }
  }

  // Check for hash in URL on initial load
  useEffect(() => {
    // Get the section ID from the URL hash
    const hash = window.location.hash.substring(1)

    if (hash && sectionRefs[hash as keyof typeof sectionRefs]?.current) {
      // Small delay to ensure the page is fully loaded
      setTimeout(() => {
        scrollToSection(hash)
      }, 100)
    }
  }, [])

  // Set up intersection observer to update active section on scroll
  useEffect(() => {
    if (!mainContentRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            // Update URL without reloading the page
            window.history.replaceState({}, "", `#${entry.target.id}`)
          }
        })
      },
      {
        root: mainContentRef.current,
        threshold: 0.2, // Trigger when 20% of the element is visible
        rootMargin: "-70px 0px 0px 0px", // Adjust for header height
      },
    )

    // Observe all sections
    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current)
      }
    })

    return () => {
      Object.values(sectionRefs).forEach((ref) => {
        if (ref.current) {
          observer.unobserve(ref.current)
        }
      })
    }
  }, [mainContentRef])

  // Effect to set all underlines to 58px width
  useEffect(() => {
    const setUnderlineWidths = () => {
      const underlines = document.querySelectorAll(".underline-bar")

      underlines.forEach((underline) => {
        const element = underline as HTMLElement
        element.style.width = "58px"
      })
    }

    // Initial setup
    setUnderlineWidths()
  }, [])

  // Sample projects data for My Crafts section
  const projects = [
    {
      id: "wise-academy",
      title: "Wise Academy",
      description:
        "WISE Academy, a high standard school based in Beirut, providing quality education in a fun, relaxed and safe environment for our students.",
      image: "/placeholder.svg?height=200&width=400",
      link: "/projects/wise-academy?from=about",
    },
    {
      id: "project-2",
      title: "Mobile Banking App",
      description:
        "A modern banking application with intuitive UI and secure transaction features for a seamless financial experience.",
      image: "/placeholder.svg?height=200&width=400",
      link: "/projects/mobile-banking?from=about",
    },
    {
      id: "project-3",
      title: "E-commerce Platform",
      description:
        "A comprehensive online shopping platform with advanced filtering, cart management, and payment processing.",
      image: "/placeholder.svg?height=200&width=400",
      link: "/projects/ecommerce?from=about",
    },
  ]

  return (
    <div className="page-content about-page-content flex flex-col min-h-screen bg-[#040404] text-white">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-5 bg-[#040404] sticky top-0 z-10 backdrop-blur-md bg-opacity-80">
        <Link href="/" className="text-xl font-medium text-[#fbb03b]">
          Mohammad
        </Link>
        <nav className="hidden md:flex space-x-6">
          <a
            href="#about"
            onClick={handleNavClick}
            className={`text-sm hover:text-[#90DDA9] transition-colors ${
              activeSection === "about" ? "text-[#90DDA9]" : ""
            }`}
          >
            About Me
          </a>
          <a
            href="#services"
            onClick={handleNavClick}
            className={`text-sm hover:text-[#90DDA9] transition-colors ${
              activeSection === "services" ? "text-[#90DDA9]" : ""
            }`}
          >
            Services
          </a>
          <a
            href="#craft"
            onClick={handleNavClick}
            className={`text-sm hover:text-[#90DDA9] transition-colors ${
              activeSection === "craft" ? "text-[#90DDA9]" : ""
            }`}
          >
            My Craft
          </a>
          <a
            href="#cost"
            onClick={handleNavClick}
            className={`text-sm hover:text-[#90DDA9] transition-colors ${
              activeSection === "cost" ? "text-[#90DDA9]" : ""
            }`}
          >
            The Cost Of Creativity
          </a>
        </nav>
      </header>

      <main className="flex-grow">
        <div className="flex flex-col md:flex-row">
          {/* Sidebar - Fixed when scrolling - 1/3 width */}
          <aside className="sidebar w-full md:w-1/3 bg-[#040404] p-5 md:fixed md:h-screen">
            <div className="mb-6">
              <div className="relative w-full h-[220px] mb-4 overflow-hidden rounded-lg">
                <Image
                  src="/placeholder.svg?height=300&width=250"
                  alt="Mohammad Hawa"
                  width={250}
                  height={300}
                  className="object-cover w-full h-full"
                />
              </div>
              <h1 className="text-xl font-bold">Mohamad Hawa</h1>
              <p className="text-sm text-[#8c8e93]">UI UX Designer @ Poyesis</p>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center">
                <span className="text-xs text-[#8c8e93]">Website</span>
                <span className="text-xs ml-auto">mohammadshawa.vercel.app</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-[#8c8e93]">Blog</span>
                <span className="text-xs ml-auto">mohammadshawa.vercel.app/blog</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-[#8c8e93]">Email</span>
                <span className="text-xs ml-auto">Mohammadshawa421@gmail.com</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-[#8c8e93]">Phone</span>
                <span className="text-xs ml-auto">+961 76 824 793</span>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="#"
                className="flex items-center justify-center w-full p-2.5 border border-[#1abcfe] rounded-md text-[#1abcfe] text-sm hover:bg-[#1abcfe] hover:bg-opacity-10 transition-colors"
              >
                LinkedIn
              </Link>
              <Link
                href="#"
                className="flex items-center justify-center w-full p-2.5 border border-[#25D366] rounded-md text-[#25D366] text-sm hover:bg-[#25D366] hover:bg-opacity-10 transition-colors"
              >
                WhatsApp
              </Link>
              <Link
                href="#"
                className="flex items-center justify-center w-full p-2.5 border border-white rounded-md text-sm hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Download My CV
              </Link>
            </div>
          </aside>

          {/* Main Content - Scrollable with offset for fixed sidebar - 2/3 width */}
          <div
            ref={mainContentRef}
            className="main-content w-full md:w-2/3 md:ml-[33.333%] p-5 overflow-y-auto"
            style={{ height: "calc(100vh - 70px)" }} // Subtract header height
          >
            {/* About Me Section */}
            <section id="about" ref={sectionRefs.about} className="mb-2 bg-[#121212] p-6 rounded-[20px]">
              <h2 className="text-[22px] font-semibold mb-2">Work Experience</h2>
              <div className="h-[3px] bg-[#90DDA9] rounded-full mb-5 underline-bar"></div>

              <div className="mb-6">
                <div className="mb-1">
                  <h3 className="text-sm text-[#8c8e93]">Poyesis</h3>
                  <h4 className="text-base font-bold">UI UX Designer</h4>
                </div>
                <p className="text-xs text-[#8c8e93] mb-2 leading-relaxed">
                  Collaborated with cross-functional teams to design innovative user experiences for web and mobile
                  applications, including projects in French for local clients. Utilized user-centered design to gather
                  requirements, conducted user research, developed prototypes, and created designs aligned with client
                  objectives. Focused on creating accessible, aesthetically pleasing, and user-centric solutions that
                  enhanced brand identity and user engagement, while creating designs for the French-speaking audience.
                </p>
                <p className="text-xs text-[#8c8e93]">2020 - Present</p>
              </div>

              <div>
                <div className="mb-1">
                  <h3 className="text-sm text-[#8c8e93]">Freelance</h3>
                  <h4 className="text-base font-bold">UI UX Designer</h4>
                </div>
                <p className="text-xs text-[#8c8e93] mb-2 leading-relaxed">
                  Designed user-friendly web and mobile interfaces by conducting user research and creating wireframes,
                  prototypes, and high-fidelity designs. Collaborated with clients to understand their vision and
                  provide implementation while meeting project deadlines. Focused on accessibility, usability, and
                  solving usability with UX/UI tools to deliver innovative solutions.
                </p>
                <p className="text-xs text-[#8c8e93]">2020 - 2022</p>
              </div>
            </section>

            {/* Stack */}
            <section className="mb-2 bg-[#121212] p-6 rounded-[20px]">
              <h2 className="text-[22px] font-semibold mb-2">Stack</h2>
              <div className="h-[3px] bg-[#90DDA9] rounded-full mb-5 underline-bar"></div>

              <div className="flex flex-wrap gap-3">
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="Figma" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="XD" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="Sketch" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="Framer" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="Zeplin" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="InVision" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="Illustrator" width={24} height={24} />
                </div>
                <div className="w-10 h-10 bg-[#292929] rounded-md flex items-center justify-center">
                  <Image src="/placeholder.svg?height=24&width=24" alt="Photoshop" width={24} height={24} />
                </div>
              </div>
            </section>

            {/* Services */}
            <section id="services" ref={sectionRefs.services} className="mb-2 bg-[#121212] p-6 rounded-[20px]">
              <h2 className="text-[22px] font-semibold mb-2">Services</h2>
              <div className="h-[3px] bg-[#90DDA9] rounded-full mb-5 underline-bar"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-[#292929] rounded-md flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="text-[#fbb03b] text-sm">🖥️</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">UI/UX Design For Web & Mobile</h3>
                      <p className="text-xs text-[#8c8e93]">
                        Custom designs focused on user-centered, responsive, and intuitive interfaces for websites and
                        apps.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-[#292929] rounded-md flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="text-[#fbb03b] text-sm">🔍</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">Wireframing & Prototyping</h3>
                      <p className="text-xs text-[#8c8e93]">
                        Creating low and high-fidelity prototypes, and user flows to visualize and test the user
                        journey.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-[#292929] rounded-md flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="text-[#fbb03b] text-sm">🎨</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">Visual & Interaction Design</h3>
                      <p className="text-xs text-[#8c8e93]">
                        Creating visually appealing and accessible designs with a focus on aesthetics and interaction.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-[#292929] rounded-md flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="text-[#fbb03b] text-sm">📱</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">Mobile App Design</h3>
                      <p className="text-xs text-[#8c8e93]">
                        Designing cohesive and engaging experiences for mobile apps with attention to platform-specific
                        design principles.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-[#292929] rounded-md flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="text-[#fbb03b] text-sm">🔄</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">UI/UX Audits & Redesign</h3>
                      <p className="text-xs text-[#8c8e93]">
                        Conducting audits of existing interfaces to identify issues and suggesting improvements to
                        enhance usability and performance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Process */}
            <section className="mb-2 bg-[#121212] p-6 rounded-[20px]">
              <h2 className="text-[22px] font-semibold mb-2">Process For You</h2>
              <div className="h-[3px] bg-[#90DDA9] rounded-full mb-5 underline-bar"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">1</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Initial Consultation</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Understanding your goals and requirements, discussing user needs to set expectations and timeline.
                  </p>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">2</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Research & Analysis</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Conducting user and market research, analyzing competitors, and research to gather insights that
                    inform design decisions.
                  </p>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">3</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Wireframing & Prototyping</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Presenting wireframes to visualize the user journey and gather feedback before moving to
                    high-fidelity designs.
                  </p>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">4</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Design & Refinement</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Creating high-fidelity UI designs with attention to color, typography, and visual aesthetics.
                    Iterating based on feedback to refine the design.
                  </p>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">5</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Development Handoff</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Delivering assets and detailed specifications to the development team for seamless implementation.
                  </p>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">6</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Testing & Optimization</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Conducting usability testing to ensure the final product meets user expectations and making
                    necessary optimizations for optimal performance.
                  </p>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-6 h-6 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-xs font-bold text-black">7</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">Launch & Support</h3>
                  <p className="text-xs text-[#8c8e93]">
                    Assisting with the final launch and offering ongoing support to ensure everything functions as
                    expected.
                  </p>
                </div>
              </div>
            </section>

            {/* My Crafts */}
            <section id="craft" ref={sectionRefs.craft} className="mb-2 bg-[#121212] p-6 rounded-[20px]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-[22px] font-semibold mb-2">My Crafts</h2>
                  <div className="h-[3px] bg-[#90DDA9] rounded-full underline-bar"></div>
                </div>
                <Link
                  href="/projects"
                  className="px-3 py-1 text-xs border border-[#8c8e93] rounded-md hover:bg-white hover:bg-opacity-10 transition-colors"
                >
                  See all
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <Link href={project.link} key={project.id} className="block">
                    <div className="bg-[#1A1A1A] rounded-lg overflow-hidden hover:border hover:border-[#0acf83] transition-all">
                      <div className="h-40 bg-[#1e293b] relative">
                        <Image
                          src={project.image || "/placeholder.svg"}
                          alt={project.title}
                          width={400}
                          height={200}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-medium mb-1">{project.title}</h3>
                        <p className="text-xs text-[#8c8e93]">{project.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Pricing */}
            <section id="cost" ref={sectionRefs.cost} className="mb-2 bg-[#121212] p-6 rounded-[20px]">
              <h2 className="text-[22px] font-semibold mb-2">The Cost Of Creativity</h2>
              <div className="h-[3px] bg-[#90DDA9] rounded-full mb-5 underline-bar"></div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Starter Bundle */}
                <div className="bg-[#0D0D0D] p-4 rounded-lg border border-[#292929] flex flex-col">
                  <h3 className="text-sm font-medium mb-3">Starter Bundle</h3>
                  <ul className="space-y-2 mb-4 flex-grow">
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Up to 5 pages/screens (web or mobile)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Basic user research</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Wireframes and high-fidelity designs</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Responsive design</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">2 design revisions</span>
                    </li>
                  </ul>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="text-xl font-bold">$700</span>
                    <button className="px-3 py-1 bg-white text-black rounded-full text-xs font-medium hover:bg-opacity-90 transition-colors">
                      Start Small
                    </button>
                  </div>
                </div>

                {/* Professional Bundle */}
                <div className="bg-[#0D0D0D] p-4 rounded-lg border border-[#0acf83] flex flex-col relative">
                  <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg text-[10px] font-medium border border-[#292929] text-[#8c8e93]">
                    MOST POPULAR
                  </div>
                  <h3 className="text-sm font-medium mb-3">Professional Bundle</h3>
                  <ul className="space-y-2 mb-4 flex-grow">
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Up to 10 pages/screens (web or mobile)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">In-depth user research</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Wireframes, prototypes, and high-fidelity designs</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Design system (basic components)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Responsive design</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">4 design revisions</span>
                    </li>
                  </ul>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="text-xl font-bold">$1500</span>
                    <button className="px-3 py-1 bg-[#0acf83] text-black rounded-full text-xs font-medium hover:bg-opacity-90 transition-colors">
                      Level Up
                    </button>
                  </div>
                </div>

                {/* Premium Bundle */}
                <div className="bg-[#0D0D0D] p-4 rounded-lg flex flex-col relative before:absolute before:inset-0 before:rounded-lg before:p-[1px] before:bg-gradient-to-b before:from-[#fbb03b] before:to-[#D4AF37] before:-z-10">
                  <h3 className="text-sm font-medium mb-3">Premium Bundle</h3>
                  <ul className="space-y-2 mb-4 flex-grow">
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Unlimited pages/screens (web or mobile)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Full-scale user research</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Detailed wireframes, interactive prototypes, and final designs</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Complete design system</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Collaboration with developers during implementation</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">Usability testing post-launch</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#90dda9] mr-2 text-xs">✓</span>
                      <span className="text-xs">6 design revisions</span>
                    </li>
                  </ul>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="text-xl font-bold">$2,500+</span>
                    <button className="px-3 py-1 bg-[#fbb03b] text-black rounded-full text-xs font-medium hover:bg-opacity-90 transition-colors">
                      Own It All
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#8c8e93] mt-3 text-center">
                *Lower prices for custom packages and redesigning are available for unique project needs. Contact me for
                a tailored quote.*
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#040404] p-5 text-center text-xs text-[#8c8e93]">
        © 2024 Mohammad Hawa. All rights reserved.
      </footer>
    </div>
  )
}
