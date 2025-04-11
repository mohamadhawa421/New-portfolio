"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Drawer } from "vaul"
import HomePage from "../app/page" // Import the HomePage component directly
import { useMobileDetect } from "@/hooks/use-mobile"

const VisuallyHidden = ({ children }: { children: React.ReactNode }) => <div className="sr-only">{children}</div>

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState<{ path: string; key: string } | null>(null)
  const { isMobile, isIOS } = useMobileDetect()

  // Is this the home page?
  const isHomePage = pathname === "/"

  // Handle navigation state
  useEffect(() => {
    if (isHomePage) {
      setCurrentPage(null)
    } else {
      setCurrentPage({
        path: pathname,
        key: `${pathname}-${Date.now()}`,
      })
    }
  }, [pathname, isHomePage])

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  // Calculate safe drawer height for iOS
  const drawerHeight = isIOS ? "92%" : "95%"

  return (
    <div className="stack-container">
      {/* Base Layer - Always shows home page component */}
      <div
        className={`home-base ${currentPage ? "scaled" : ""}`}
        style={{
          willChange: "transform, opacity, filter",
          contain: "paint",
        }}
      >
        {/* Always render the HomePage component in the background */}
        <HomePage />
      </div>

      {/* Overlay Page - Only for non-home pages */}
      {!isHomePage && currentPage && (
        <Drawer.Root
          key={currentPage.key}
          open={true}
          onOpenChange={(open) => !open && handleClose()}
          shouldScaleBackground={false}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" style={{ willChange: "opacity" }} />
            <Drawer.Content
              className={`fixed bottom-0 left-0 right-0 rounded-t-[10px] bg-[#1d1d1d] focus:outline-none z-50 transform-gpu overflow-hidden`}
              style={{
                height: drawerHeight,
                transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
                willChange: "transform",
                contain: "content",
                backfaceVisibility: "hidden",
                WebkitOverflowScrolling: "touch", // For iOS momentum scrolling
              }}
            >
              <VisuallyHidden>
                <Drawer.Title>Navigation Drawer</Drawer.Title>
              </VisuallyHidden>

              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300/50 mb-4 mt-3" />
              <div
                className="h-[calc(100%-30px)] overflow-y-auto pb-safe overscroll-contain"
                style={{
                  WebkitOverflowScrolling: "touch", // For iOS momentum scrolling
                }}
              >
                {children}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}

      {/* Render home page content directly when on home page */}
      {isHomePage && children}
    </div>
  )
}
