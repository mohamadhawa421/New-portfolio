import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import ClientLayout from "./ClientLayout"
import HomeBackground from "./page" // Import home page as background

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <title>Mohammad Hawa - UI/UX Designer Portfolio</title>
        <meta name="description" content="Professional UI/UX Designer specializing in web and mobile applications" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={`${inter.className} h-full`}>
        {/* Persistent Background */}
        <div className="fixed inset-0 z-0">
          <HomeBackground />
        </div>
        
        {/* Content Layers */}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}