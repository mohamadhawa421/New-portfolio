"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import WavesAnimation from "@/components/waves-animation"

export default function HomePage() {
  const particlesRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    // Create random particles - increased number
    const createParticles = () => {
      if (!particlesRef.current) return

      particlesRef.current.innerHTML = ""
      const count = 50 // Increased from 20 to 50

      for (let i = 0; i < count; i++) {
        const particle = document.createElement("div")
        const size = Math.random() * 4 + 1
        const x = Math.random() * 100
        const y = Math.random() * 100
        const duration = Math.random() * 20 + 10
        const delay = Math.random() * 5

        particle.className = "absolute rounded-full"
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
        particle.style.left = `${x}%`
        particle.style.top = `${y}%`
        particle.style.opacity = "0"
        particle.style.backgroundColor = Math.random() > 0.5 ? "#90dda9" : "#fbb03b"
        particle.style.animation = `float ${duration}s ${delay}s infinite ease-in-out`

        particlesRef.current.appendChild(particle)
      }
    }

    createParticles()

    // Add keyframes for floating animation
    const style = document.createElement("style")
    style.textContent = `
      @keyframes float {
        0%, 100% {
          transform: translateY(0) translateX(0);
          opacity: 0;
        }
        25% {
          opacity: 0.5;
        }
        50% {
          transform: translateY(-100px) translateX(50px);
          opacity: 0.8;
        }
        75% {
          opacity: 0.5;
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Function to navigate to about page sections
  const navigateToSection = (sectionId: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    router.push(`/about#${sectionId}`)
  }

  return (
    <div className="page-content min-h-screen bg-black text-white relative">
      {/* Particles */}
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none z-0"></div>

      {/* Header */}
      <header className="flex justify-between items-center px-6 py-5 relative z-10">
        <Link href="/" className="text-2xl font-medium text-[#90dda9] font-handwriting">
          Mohamad
        </Link>
        <nav className="hidden md:flex space-x-6">
          <a
            href="/about"
            onClick={navigateToSection("about")}
            className="text-sm hover:text-[#90dda9] transition-colors"
          >
            About Me
          </a>
          <a
            href="/about#services"
            onClick={navigateToSection("services")}
            className="text-sm hover:text-[#90dda9] transition-colors"
          >
            Services
          </a>
          <a
            href="/about#craft"
            onClick={navigateToSection("craft")}
            className="text-sm hover:text-[#90dda9] transition-colors"
          >
            My Craft
          </a>
          <a
            href="/about#cost"
            onClick={navigateToSection("cost")}
            className="text-sm hover:text-[#90dda9] transition-colors"
          >
            The Cost Of Creativity
          </a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center px-6 pt-20 pb-32 relative z-10 w-4xl m-auto">
        <p className="text-center text-lg mb-4">
          I'm Mohamad Hawa, and I'm passionate about designing intuitive experiences.
        </p>

        <h1 className="text-4xl md:text-6xl font-bold text-center max-w-4xl">
          Let's Make Some <span className="text-[#fbb03b]">Pixel-Perfect</span> Magic —
          <br />
          No Magic <span className="text-[#90dda9]">Wand</span> Required.
        </h1>

        <p className="text-center max-w-3xl mt-8 text-gray-300">
          As a UI/UX designer, I specialize in crafting visually engaging and user-centered designs that blend
          creativity with functionality. My mission is to transform complex challenges into seamless experiences that
          empower users and drive impact. Let's create something remarkable together.
        </p>

        <Link
          href="/about"
          className="mt-12 px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-opacity-90 transition-all transform hover:scale-105"
        >
          Check me out!
        </Link>
      </main>

      {/* Animated Waves */}
      <div className="absolute bottom-0 left-0 right-0 h-[300px] z-0 w-full overflow-hidden">
        <WavesAnimation speed={0.5} />
      </div>
    </div>
  )
}
