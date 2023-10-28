import 'tailwindcss/tailwind.css'
import './globals.css'
import type { Metadata } from 'next'
import localFont from '@next/font/local'

const Poppins = localFont({
  src: [
    {
      path: '../public/Fonts/Poppins-Regular.ttf',
      weight: '400'
    },
    {
      path: '../public/Fonts/Poppins-Bold.ttf',
      weight: '700'
    }
  ],
  variable: '--font-poppins'
})

export const metadata: Metadata = {
  title: 'Mohamad Hawa',
  description: 'My portfolio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${Poppins.variable} font-sans`}>{children}</body>
    </html>
  )
}
