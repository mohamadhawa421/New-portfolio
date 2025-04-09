"use client"

import { useEffect, useRef } from "react"

interface WavesAnimationProps {
  speed?: number
}

export default function WavesAnimation({ speed = 1 }: WavesAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = 300
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Wave parameters - updated to be thin lines like in the image
    // Apply the speed factor to slow down the animation
    const waves = [
      { color: "#90dda9", amplitude: 40, frequency: 0.01, speed: 0.02 * speed, offset: 0, lineWidth: 2 },
      { color: "#fbb03b", amplitude: 30, frequency: 0.015, speed: 0.03 * speed, offset: 50, lineWidth: 1.5 },
      { color: "#666666", amplitude: 25, frequency: 0.008, speed: 0.015 * speed, offset: 100, lineWidth: 1 },
    ]

    // Animation loop
    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      waves.forEach((wave) => {
        wave.offset += wave.speed

        ctx.beginPath()

        // Draw thin lines instead of filled areas
        for (let x = 0; x <= canvas.width; x += 2) {
          // Use multiple sine waves for more organic look
          const y1 = Math.sin(x * wave.frequency * 0.8 + wave.offset) * wave.amplitude
          const y2 = Math.sin(x * wave.frequency * 1.2 + wave.offset * 1.5) * (wave.amplitude * 0.5)
          const y = canvas.height - 100 - y1 - y2

          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        // Set line style
        ctx.strokeStyle = wave.color
        ctx.lineWidth = wave.lineWidth
        ctx.stroke()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [speed])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
