"use client"

import type React from "react"
import { AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <div key={pathname}>{children}</div>
    </AnimatePresence>
  )
}
