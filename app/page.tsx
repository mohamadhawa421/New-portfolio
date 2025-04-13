"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import WavesAnimation from "@/components/waves-animation"
import { Menu, X } from "lucide-react"
import { useMobileDetect } from "@/hooks/use-mobile"
// import CatchTheCatGame from "@/components/CatchTheCatGame"

export default function HomePage() {
  const particlesRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isMobile, isIOS } = useMobileDetect()
  const [showGame, setShowGame] = useState(false);

  // Prevent direct navigation away from homepage
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url !== "/") {
        router.push(url)
      }
    }

    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      router.replace("/")
    }
  }, [router])

  useEffect(() => {
    if (!particlesRef.current) return
    
    particlesRef.current.innerHTML = ""
    const count = isMobile ? 10 : 25
    const fragment = document.createDocumentFragment()
    
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div")
      const size = Math.random() * 4 + 1
      const x = Math.random() * 100
      const y = Math.random() * 100
      const duration = Math.random() * (isMobile ? 45 : 35) + (isMobile ? 25 : 20)
      const delay = Math.random() * 8
      
      particle.className = "absolute rounded-full gpu-accelerated"
      particle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x}%;
        top: ${y}%;
        opacity: 0;
        background-color: ${Math.random() > 0.5 ? "#90dda9" : "#fbb03b"};
        will-change: transform, opacity;
        animation: float ${duration}s ${delay}s infinite ease-in-out;
      `
      fragment.appendChild(particle)
    }
    
    particlesRef.current.appendChild(fragment)
    
    return () => {
      if (particlesRef.current) {
        particlesRef.current.innerHTML = ""
      }
    }
  }, [isMobile])

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <div className="page-content min-h-screen bg-black text-white relative">
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none z-0"></div>

      <header
        className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 relative z-20"
        style={{ pointerEvents: "auto" }}
      ><Image
                     src={"/Logo.svg"}
                     alt={"Logo"}
                     width={110}
                     height={33}
                     quality={100}
                   />

        <nav className="hidden md:flex space-x-6">
          <Link href="/about" className="text-sm hover:text-[#90dda9] transition-colors">
            About Me
          </Link>
          <Link href="/projects" className="home-interactive text-sm hover:text-[#90dda9] transition-colors">
            Projects
          </Link>
        </nav>

        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1a1a] text-white"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-95 z-10 flex flex-col items-center justify-center space-y-8 animate-fadeIn">
          <Link
            href="/about"
            className="text-xl font-medium hover:text-[#90dda9] transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            About Me
          </Link>
          <Link
            href="/projects"
            className="text-xl font-medium hover:text-[#90dda9] transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Projects
          </Link>
          {/* <Link
            href="/contact"
            className="text-xl font-medium hover:text-[#90dda9] transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Contact
          </Link> */}
        </div>
      )}

      <main
        className="flex flex-col items-center justify-center px-4 sm:px-6 pt-8 sm:pt-20 pb-20 relative z-5 w-full max-w-4xl mx-auto"
        style={{ pointerEvents: "auto", minHeight: "calc(100vh - 400px)" }}
      >
        <p className="text-center text-base sm:text-lg mb-3 sm:mb-4 px-2">
          I'm Mohamad Hawa, and I'm passionate about designing intuitive experiences.
        </p>

        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-center max-w-4xl leading-tight">
          Let's Make Some <span className="text-[#fbb03b]">Pixel-Perfect</span> Magic —
          <br className="hidden sm:block" />
          No Magic <span className="text-[#90dda9]">Wand</span> Required.
        </h1>

        <p className="text-center max-w-3xl mt-6 sm:mt-8 text-sm sm:text-base text-gray-300 px-2">
          As a UI/UX designer, I specialize in crafting visually engaging and user-centered designs that blend
          creativity with functionality. My mission is to transform complex challenges into seamless experiences that
          empower users and drive impact. Let's create something remarkable together.
        </p>

        <div className=" mt-12 sm:mt-4 gap-2 flex flex-col items-center">
        <Link
          href="/about"
          className="home-interactive sm:mt-12 px-6 sm:px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-opacity-90 transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
        >
          Check me out!
        </Link>
        {/* <button
  onClick={() => setShowGame(true)}
  className=" sm:mt-2 mt-2 px-6 sm:px-8 py-3 bg-[#fbb03b] text-black rounded-full font-medium hover:bg-opacity-90 transition-all transform hover:scale-105 active:scale-95"
>
  Play Cat Chase Game!
</button> */}

</div>

        {/* Mobile Waves */}
        <div className="md:hidden w-full relative z-0">
          <WavesAnimation speed={isMobile ? 0.1 : 0.3} />
        </div>
      </main>

      {/* Desktop Waves */}
      {!isMobile && (
        <div className={`absolute bottom-0 left-0 right-0 ${isIOS ? "h-[200px] sm:h-[300px]" : "h-[300px]"} z-0 w-full overflow-hidden`}>
          <WavesAnimation speed={0.3} />
        </div>
      )}
      {/* {showGame && <CatchTheCatGame onClose={() => setShowGame(false)} />} */}
    </div>
  )
}