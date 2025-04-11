"use client"

import { useEffect, useRef, memo } from "react"

interface WavesAnimationProps {
  speed?: number
}

const WavesAnimation = memo(function WavesAnimation({ speed = 1 }: WavesAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Fix the ref type to allow for undefined value from requestAnimationFrame
  const animationRef = useRef<number | undefined>(undefined)
  const lastTimeRef = useRef(0)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Get context once
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    // Optimize canvas size updates
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const displayWidth = window.innerWidth
      const displayHeight = 300
      
      // Set canvas size with device pixel ratio for sharper rendering
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
      
      // Scale the context to ensure correct drawing operations
      ctx.scale(dpr, dpr)
      
      // Set display size (CSS pixels)
      canvas.style.width = `${displayWidth}px`
      canvas.style.height = `${displayHeight}px`
    }

    // Set size initially
    resizeCanvas()
    
    // Add passive listener for performance
    window.addEventListener("resize", resizeCanvas, { passive: true })

    // Pre-calculate some values for better performance
    const displayWidth = window.innerWidth
    const baseHeight = 300 - 100 // canvas.height - 100

    // Make speed overall slower by applying a reduction factor
    const speedReduction = 0.4 // Reduces overall speed by 60%
    const adjustedSpeed = speed * speedReduction
    
    // Use fewer waves but better composited animation with reduced speed
    const waves = [
      { 
        color: "#90dda9", 
        amplitude: 50, 
        frequency: 0.01, 
        offset: 0, 
        lineWidth: 2, 
        verticalFrequency: 0.02, 
        verticalAmplitude: 10, 
        phaseSpeed: 0.0003 * adjustedSpeed // Slower phase speed
      },
      { 
        color: "#fbb03b", 
        amplitude: 40, 
        frequency: 0.015, 
        offset: 50, 
        lineWidth: 1.5, 
        verticalFrequency: 0.025, 
        verticalAmplitude: 8, 
        phaseSpeed: 0.0004 * adjustedSpeed // Slower phase speed
      },
      { 
        color: "#FFFFFF", 
        amplitude: 35, 
        frequency: 0.008, 
        offset: 100, 
        lineWidth: 2, 
        verticalFrequency: 0.018, 
        verticalAmplitude: 12, 
        phaseSpeed: 0.0002 * adjustedSpeed // Slower phase speed
      },
    ]

    // Pre-allocate arrays for performance
    const xPoints = new Array(Math.ceil(displayWidth / 2) + 1)
    for (let i = 0; i < xPoints.length; i++) {
      xPoints[i] = i * 2
    }

    // Animation function with performance optimizations
    const animate = (timestamp: number) => {
      // Throttle animation on slower devices
      const now = timestamp
      const elapsed = now - lastTimeRef.current
      
      // Only render every ~16ms (60fps) even if requestAnimationFrame
      // is called more frequently on high refresh rate screens
      if (elapsed < 16) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      
      lastTimeRef.current = now - (elapsed % 16) // Adjust time for consistent timing
      
      ctx.clearRect(0, 0, displayWidth, 300) // Only clear what's needed

      waves.forEach((wave) => {
        ctx.beginPath()
        
        // First point
        let x = 0
        let horizontalWave1 = Math.sin(x * wave.frequency * 0.8 + wave.offset) * wave.amplitude
        let horizontalWave2 = Math.sin(x * wave.frequency * 1.2 + wave.offset * 1.5) * (wave.amplitude * 0.5)
        let horizontalWave = horizontalWave1 + horizontalWave2
        let verticalBend = Math.sin(x * wave.verticalFrequency + timestamp * wave.phaseSpeed) * wave.verticalAmplitude
        let y = baseHeight - horizontalWave - verticalBend
        
        ctx.moveTo(x, y)
        
        // Draw points at optimized intervals
        for (let i = 1; i < xPoints.length; i++) {
          x = xPoints[i]
          
          // Calculate wave with optimized math - slowed down
          horizontalWave1 = Math.sin(x * wave.frequency * 0.8 + wave.offset + timestamp * 0.0005 * adjustedSpeed) * wave.amplitude
          horizontalWave2 = Math.sin(x * wave.frequency * 1.2 + wave.offset * 1.5 + timestamp * 0.0005 * adjustedSpeed) * (wave.amplitude * 0.5)
          horizontalWave = horizontalWave1 + horizontalWave2
          
          // Skip redundant calculations when possible
          verticalBend = Math.sin(x * wave.verticalFrequency + timestamp * wave.phaseSpeed) * wave.verticalAmplitude
          
          y = baseHeight - horizontalWave - verticalBend
          
          ctx.lineTo(x, y)
        }

        // Update offset values based on time for wave animation - slowed down
        wave.offset += elapsed * 0.002 * adjustedSpeed
        
        // Set properties only once per wave
        ctx.strokeStyle = wave.color
        ctx.lineWidth = wave.lineWidth
        ctx.stroke()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    // Proper cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [speed]) // Only re-run if speed changes

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full gpu-accelerated" 
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    />
  )
})

export default WavesAnimation