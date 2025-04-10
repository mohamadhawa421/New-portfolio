"use client"

import { useEffect, useRef } from "react"

interface WavesAnimationProps {
  speed?: number
}

export default function WavesAnimation({ speed = 1 }: WavesAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastTime = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = 300
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const waves = [
      { color: "#90dda9", amplitude: 50, frequency: 0.01, speed: 0.02 * speed, offset: 0, lineWidth: 2, verticalFrequency: 0.02, verticalAmplitude: 10, phaseSpeed: 0.0005 * speed },
      { color: "#fbb03b", amplitude: 40, frequency: 0.015, speed: 0.03 * speed, offset: 50, lineWidth: 1.5, verticalFrequency: 0.025, verticalAmplitude: 8, phaseSpeed: 0.0007 * speed },
      { color: "#FFFFFF", amplitude: 35, frequency: 0.008, speed: 0.015 * speed, offset: 100, lineWidth: 2, verticalFrequency: 0.018, verticalAmplitude: 12, phaseSpeed: 0.0004 * speed },
      { color: "#103D69", amplitude: 25, frequency: 0.008, speed: 0.020 * speed, offset: 150, lineWidth: 1.5, verticalFrequency: 0.03, verticalAmplitude: 6, phaseSpeed: 0.0006 * speed },
    ]

    let animationId: number
    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastTime.current
      lastTime.current = timestamp

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      waves.forEach((wave) => {
        // No longer updating the offset directly for sliding

        ctx.beginPath()

        for (let x = 0; x <= canvas.width; x += 2) {
          const horizontalWave1 = Math.sin(x * wave.frequency * 0.8 + wave.offset) * wave.amplitude
          const horizontalWave2 = Math.sin(x * wave.frequency * 1.2 + wave.offset * 1.5) * (wave.amplitude * 0.5)
          const horizontalWave = horizontalWave1 + horizontalWave2

          // Vertical bending that evolves in place based on time
          const verticalBend = Math.sin(x * wave.verticalFrequency + timestamp * wave.phaseSpeed) * wave.verticalAmplitude;

          const y = canvas.height - 100 - horizontalWave - verticalBend;

          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        ctx.strokeStyle = wave.color
        ctx.lineWidth = wave.lineWidth
        ctx.stroke()
      })

      animationId = requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [speed])

  return <canvas ref={canvasRef} className="w-full h-full" />
}