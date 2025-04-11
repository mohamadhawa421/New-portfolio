"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"

type ProjectType = "all" | "mobile" | "web" | "showcase" | "redesign"

interface Project {
  id: string
  title: string
  description: string
  image: string
  type: ProjectType | ProjectType[]
  link: string
}

const projects: Project[] = [
  {
    id: "wise-academy",
    title: "Wise Academy",
    description: "School management system design for academic excellence",
    image: "/projects/wise.png",
    type: ["web"],
    link: "/projects/wise-academy"
  },
  {
    id: "mobile-banking",
    title: "Mobile Banking App",
    description: "Secure financial transactions with intuitive interface",
    image: "/projects/banking-app.jpg",
    type: ["mobile"],
    link: "/projects/mobile-banking"
  },
  {
    id: "ecommerce-platform",
    title: "E-commerce Platform",
    description: "Complete online shopping solution",
    image: "/projects/ecommerce.jpg",
    type: ["web", "showcase"],
    link: "/projects/ecommerce"
  },
  {
    id: "mobile-banking4",
    title: "Mobile Banking App",
    description: "Secure financial transactions with intuitive interface",
    image: "/projects/banking-app.jpg",
    type: ["mobile"],
    link: "/projects/mobile-banking"
  },
  {
    id: "wise-academy2",
    title: "Wise Academy",
    description: "School management system design for academic excellence",
    image: "/projects/wise.png",
    type: ["web"],
    link: "/projects/wise-academy"
  },
  {
    id: "mobile-banking2",
    title: "Mobile Banking App",
    description: "Secure financial transactions with intuitive interface",
    image: "/projects/banking-app.jpg",
    type: ["mobile"],
    link: "/projects/mobile-banking"
  },
  {
    id: "ecommerce-platform2",
    title: "E-commerce Platform",
    description: "Complete online shopping solution",
    image: "/projects/ecommerce.jpg",
    type: ["web", "showcase"],
    link: "/projects/ecommerce"
  },
  {
    id: "mobile-banking3",
    title: "Mobile Banking App",
    description: "Secure financial transactions with intuitive interface",
    image: "/projects/banking-app.jpg",
    type: ["mobile"],
    link: "/projects/mobile-banking"
  }
  // Add more projects as needed
]

export default function ProjectsPage() {
  const [activeFilter, setActiveFilter] = useState<ProjectType>("all")

  const filteredProjects = projects.filter((project) => {
    if (activeFilter === "all") return true
    if (Array.isArray(project.type)) {
      return project.type.includes(activeFilter)
    }
    return project.type === activeFilter
  })

  const getProjectTypeBadge = (type: ProjectType | ProjectType[]) => {
    const projectType = Array.isArray(type) ? type[0] : type
    switch (projectType) {
      case "web": return <span className="px-2 py-1 text-xs bg-[#333B36] text-[#90DDA9] rounded-md">Web App</span>
      case "mobile": return <span className="px-2 py-1 text-xs bg-[#1755944a] text-[#027df8] rounded-md">Mobile App</span>
      case "showcase": return <span className="px-2 py-1 text-xs bg-[#121212] text-[#0acf83] rounded-md">Showcase</span>
      case "redesign": return <span className="px-2 py-1 text-xs bg-[#121212] text-[#fbb03b] rounded-md">Redesign</span>
      default: return null
    }
  }

  return (
    <div className="page-content min-h-screen bg-[1d1d1d]] text-white p-5 md:p-7">
      <div className="flex flex-wrap gap-6 border-b border-[#1A1A1A] pb-2">
        {/* Filter buttons... (keep existing filter buttons) */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        {filteredProjects.map((project) => (
          <Link href={project.link} key={project.id} className="block">
            <div className=" bg-[#292929] rounded-xl p-3 overflow-hidden hover:border hover:border-white transition-all">
              <div className="h-52 bg-[#1e293b] rounded-2xl relative overflow-hidden">
                <Image
                  src={project.image}
                  alt={project.title}
                  width={300}
                  height={200}
                  quality={100}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-1">{project.title}</h3>
                <p className="min-h-8 text-xs text-[#8C8E93] mb-3">{project.description}</p>
                <div className="mt-2">{getProjectTypeBadge(project.type)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="text-center py-10">
        <h2 className="text-xl font-medium mb-2">Have a project in mind?</h2>
        <p className="text-sm text-[#8c8e93] mb-6">Let's create a user-friendly solution together.</p>
        <Link
          href="/contact"
          className="inline-block px-6 py-3 border border-[#0acf83] text-[#0acf83] rounded-full hover:bg-[#0acf83] hover:bg-opacity-10 transition-colors"
        >
          Contact Me
        </Link>
      </div>
    </div>
  )
}