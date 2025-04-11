"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Drawer } from "vaul"

const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <div className="sr-only">{children}</div>
)

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [stack, setStack] = useState<Array<{ path: string; key: string }>>([])

  useEffect(() => {
    if (pathname === "/") {
      setStack([])
      return
    }
    
    setStack(prev => {
      const existing = prev.find(item => item.path === pathname)
      if (existing) return prev
      
      return [...prev, { 
        path: pathname, 
        key: `${pathname}-${Date.now()}` 
      }]
    })
  }, [pathname])

  const handleClose = (index: number) => {
    setStack(prev => prev.slice(0, index))
    if (index === 0) router.push("/")
  }

  return (
    <div className="stack-container">
      {/* Homepage Base Layer */}
      <div className={`home-base ${stack.length > 0 ? 'scaled' : ''}`}>
        {children}
      </div>

      {/* Overlay Pages */}
      {stack.map(({ path, key }, index) => (
        <Drawer.Root
          key={key}
          open={true}
          onOpenChange={(open) => !open && handleClose(index)}
          shouldScaleBackground={false}
          nested
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40" style={{ zIndex: 40 + index }} />
            <Drawer.Content 
              className="fixed bottom-0 left-0 right-0 h-[95%] rounded-t-[10px] bg-[#040404] focus:outline-none"
              style={{ 
                zIndex: 50 + index,
                transform: `translateY(${index * 20}px) scale(${1 - index * 0.02})`,
                transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
              }}
            >
              <VisuallyHidden>
                <Drawer.Title>Navigation Drawer</Drawer.Title>
              </VisuallyHidden>
              
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300/50 mb-4 mt-3" />
              <div className="h-full overflow-y-auto pb-8">
                {children}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ))}
    </div>
  )
}