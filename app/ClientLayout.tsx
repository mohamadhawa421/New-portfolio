// Optimize re-renders and improve drawer transitions
"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useCallback, memo, useMemo } from "react"
import { Drawer } from "vaul"
import HomePage from "../app/page"
import { useMobileDetect } from "@/hooks/use-mobile"

const VisuallyHidden = ({ children }: { children: React.ReactNode }) => <div className="sr-only">{children}</div>

// Memo-ize HomePage with correct dependencies check
const MemoizedHomePage = memo(HomePage)

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobile, isIOS } = useMobileDetect()
  
  // Use useMemo for derived state instead of useState + useEffect
  const currentPage = useMemo(() => {
    const isHomePage = pathname === "/"
    return isHomePage ? null : {
      path: pathname,
      key: pathname // Use pathname as the sole key
    }
  }, [pathname])
  
  // Is this the home page?
  const isHomePage = pathname === "/"

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  // Add this effect to reset Vaul's internal state
useEffect(() => {
  if (!isHomePage) {
    const timer = setTimeout(() => {
      document.documentElement.style.setProperty('--vaul-scale-drawer', '1');
    }, 50);
    return () => clearTimeout(timer);
  }
}, [isHomePage]);

  // Calculate safe drawer height for iOS - using useMemo for performance
  const drawerHeight = useMemo(() => isIOS ? "92dvh" : "95dvh", [isIOS])

  return (
    <div className="stack-container">
      {/* Base Layer - Always shows home page component with better GPU acceleration */}
      <div
        className={`home-base gpu-accelerated ${currentPage ? "scaled" : ""}`}
        style={{ contain: "paint layout" }}
      >
        <MemoizedHomePage />
      </div>

      {/* Overlay Page - Only render when needed */}
      {!isHomePage && currentPage && (
        <Drawer.Root
        key={currentPage.key}
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            router.back()
          }
        }}
        shouldScaleBackground={true}
        preventScrollRestoration={false} // Add this
        nested={true} // Add this for better stack handling
      >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40 gpu-accelerated" />
            <Drawer.Content
              className="fixed bottom-0 left-0 right-0 rounded-t-[10px] bg-[#1d1d1d] focus:outline-none z-50 overflow-hidden gpu-accelerated"
              style={{
                height: drawerHeight,
                containIntrinsicSize: "auto 100%",
                contain: "paint layout",
              }}
            >
              <VisuallyHidden>
                <Drawer.Title>Navigation Drawer</Drawer.Title>
              </VisuallyHidden>

              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300/50 mb-4 mt-3" />
              <div className="h-[calc(100%-30px)] overflow-y-auto pb-safe overscroll-contain">
                {children}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}

      {/* Don't render children when showing HomePage */}
      {isHomePage && <div aria-hidden="true" style={{ display: "none" }}>{children}</div>}
    </div>
  )
}