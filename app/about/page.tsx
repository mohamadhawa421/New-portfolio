"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Download } from "lucide-react"

export default function AboutPage() {
  const mainContentRef = useRef<HTMLDivElement>(null)

  return (
    <div className="page-content about-page-content min-h-screen bg-[#040404] text-white">
      <div className="flex flex-col md:flex-row">
        {/* Fixed Sidebar */}
        <aside className="w-full md:w-1/3 bg-[#040404] p-5 pt-9 md:fixed md:left-0 md:top-0 md:h-screen md:overflow-y-auto">
            <div className="relative w-full h-96 min-h-80 mb-4 overflow-hidden rounded-lg">
              <Image
                src="/profile-image.jpg"
                alt="Mohamad Hawa"
                quality={100}
                width={300}
                height={400}
                className="object-cover w-full h-full"
              />
          </div>

          <div className="flex flex-col gap-6 mb-8 p-8 bg-[#121212] rounded-2xl">
            <div>
            <h1 className="text-3xl font-bold mb-1">Mohamad Hawa</h1>
            <p className="text-[#8c8e93] font-light">UI/UX Designer @ Poyesis</p>
            </div>
            <div className="flex flex-col gap-3">
            <Link href="#" className="block w-full p-3 text-center border rounded-full hover:bg-[#f2f2f2]/10 transition-colors">
              Whatsapp
            </Link>
            <Link href="#" className="block w-full p-3 text-center border rounded-full hover:bg-[#f2f2f2]/10 transition-colors">
              Linkedin
            </Link>
            <Link href="#" className="block w-full p-3 text-center border rounded-full hover:bg-[#f2f2f2]/10 transition-colors">
              E-mail
            </Link>
            <Link href="#" className="block w-full p-3 text-center border rounded-full hover:bg-[#f2f2f2]/10 transition-colors flex items-center justify-center">
              <Download className="w-4 h-4 mr-2" />
              Download My CV
            </Link>
          </div>
          </div>

          
        </aside>

        {/* Scrollable Main Content */}
        <div 
          ref={mainContentRef}
          className="w-full md:w-2/3 md:ml-[33.333%] mr-4 overflow-y-auto"
          style={{ 
            height: '100vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Work Experience */}
          <section className="mb-8 bg-[#121212] p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">Work Experience</h2>
            <div className="h-px bg-[#90DDA9] w-16 mb-6" />

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[#8c8e93]">Poyesis</h3>
                <h4 className="text-xl font-bold mb-2">UI/UX Designer</h4>
                <p className="text-[#8c8e93] leading-relaxed">
                  Collaborated with cross-functional teams to design innovative user experiences for web and mobile applications.
                  Utilized user-centered design principles to conduct research, develop prototypes, and create client-aligned designs.
                </p>
                <p className="text-[#8c8e93] mt-2">2020 - Present</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#8c8e93]">Freelance</h3>
                <h4 className="text-xl font-bold mb-2">UI/UX Designer</h4>
                <p className="text-[#8c8e93] leading-relaxed">
                  Designed user-friendly interfaces through comprehensive research and prototyping.
                  Delivered high-fidelity designs meeting client visions and project deadlines.
                </p>
                <p className="text-[#8c8e93] mt-2">2020 - 2022</p>
              </div>
            </div>
          </section>

          {/* Process Section */}
          <section className="mb-8 bg-[#121212] p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">Process For You</h2>
            <div className="h-px bg-[#90DDA9] w-16 mb-6" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['Initial Consultation', 'Research & Analysis', 'Wireframing', 'Design & Refinement'].map((step, index) => (
                <div key={step} className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="w-8 h-8 bg-[#fbb03b] rounded-full flex items-center justify-center mb-3">
                    <span className="text-black font-bold">{index + 1}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{step}</h3>
                  <p className="text-sm text-[#8c8e93]">
                    {index === 0 && 'Understanding your goals and requirements'}
                    {index === 1 && 'Conducting user and market research'}
                    {index === 2 && 'Creating interactive prototypes'}
                    {index === 3 && 'Developing high-fidelity designs'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing Section */}
          <section className="mb-8 bg-[#121212] p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">The Cost of Creativity</h2>
            <div className="h-px bg-[#90DDA9] w-16 mb-6" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Starter Bundle', price: '$700', features: ['Up to 5 pages', 'Basic research', '2 revisions'] },
                { title: 'Professional Bundle', price: '$1500', features: ['Up to 10 pages', 'In-depth research', '4 revisions'], popular: true },
                { title: 'Premium Bundle', price: '$2,500+', features: ['Unlimited pages', 'Full research', '6 revisions'] }
              ].map((plan, index) => (
                <div key={plan.title} className={`relative bg-[#0D0D0D] p-6 rounded-xl ${plan.popular ? 'border border-[#0acf83]' : 'border border-[#292929]'}`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-[#0acf83] text-black px-3 py-1 text-xs rounded-bl-xl">
                      MOST POPULAR
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-4">{plan.title}</h3>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center">
                        <span className="text-[#90dda9] mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-2 rounded-lg font-medium ${
                    plan.popular 
                      ? 'bg-[#0acf83] text-black hover:bg-[#0acf83]/90' 
                      : 'bg-white/10 hover:bg-white/20'
                  }`}>
                    {index === 0 && 'Start Small'}
                    {index === 1 && 'Level Up'}
                    {index === 2 && 'Own It All'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="pb-20 pt-8 text-center text-xs text-[#8c8e93]">
            © 2024 Mohammad Hawa. All rights reserved.
          </footer>
        </div>
      </div>
    </div>
  )
}