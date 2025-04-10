"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { usePathname } from "next/navigation"

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()
  const [previousPathname, setPreviousPathname] = useState<string>(pathname)
  const [direction, setDirection] = useState<"forward" | "backward">("forward")
  const [isInitialRender, setIsInitialRender] = useState(true)

  // Track navigation direction
  useEffect(() => {
    // Skip effect on first render but set isInitialRender to false
    if (isInitialRender) {
      setIsInitialRender(false)
      return
    }

    if (previousPathname !== pathname) {
      // If we have a previous pathname, we can determine direction
      const isGoingBack = window.history.state?.idx < window.history.state?.oldIdx
      setDirection(isGoingBack ? "backward" : "forward")
      setPreviousPathname(pathname)
    }
  }, [pathname, previousPathname, isInitialRender])

  // Variants for the page transitions
  const variants = {
    initial: (direction: string) => ({
      opacity: 0,
      scale: 0.95,
      filter: "blur(8px)",
    }),
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        opacity: { duration: 0.4 },
        scale: { duration: 0.4 },
        filter: { duration: 0.3 },
      },
    },
    exit: (direction: string) => ({
      opacity: 0,
      scale: 0.95,
      filter: "blur(8px)",
      transition: {
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
        filter: { duration: 0.2 },
      },
    }),
  }

  return (
    <div className="transition-container">
      <AnimatePresence mode="wait" initial={true} custom={direction}>
        <motion.div
          key={pathname}
          className="page"
          custom={direction}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
