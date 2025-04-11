"use client"

import { useState, useEffect } from "react"

export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === "undefined") return

    // Function to detect mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ""
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      setIsMobile(mobileRegex.test(userAgent))

      // Check for iOS
      const isIOSDevice = /iPhone|iPad|iPod/i.test(userAgent) && !(window as any).MSStream
      setIsIOS(isIOSDevice)

      // Check for Safari
      const isSafariAgent = /^((?!chrome|android).)*safari/i.test(userAgent)
      setIsSafari(isSafariAgent && isIOSDevice)

      // Set viewport height
      setViewportHeight(window.innerHeight)
    }

    // Initial check
    checkMobile()

    // Update on resize
    window.addEventListener("resize", checkMobile)

    // Handle iOS Safari viewport height changes (when address bar shows/hides)
    if (typeof window !== "undefined") {
      const handleResize = () => {
        setViewportHeight(window.innerHeight)
      }

      window.addEventListener("resize", handleResize)
      window.addEventListener("orientationchange", handleResize)

      // iOS Safari specific event for when the keyboard appears/disappears
      document.addEventListener("focusin", handleResize)
      document.addEventListener("focusout", handleResize)

      return () => {
        window.removeEventListener("resize", handleResize)
        window.removeEventListener("orientationchange", handleResize)
        document.removeEventListener("focusin", handleResize)
        document.removeEventListener("focusout", handleResize)
      }
    }

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  return { isMobile, isIOS, isSafari, viewportHeight }
}
