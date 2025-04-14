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
    description: "School management system design for academic excellence.",
    image: "/projects/wise/wise.png",
    type: ["web"],
    link: "/projects/wise-academy"
  },
  {
    id: "Kabbara Office",
    title: "Kabbara Office",
    description: "Digital solution built to help Deputy Karim Kabbara manage and respond to public service.",
    image: "/projects/kabbara/kabbara-thumb.png",
    type: ["mobile"],
    link: "/projects/kabbara"
  },
  {
    id: "codingclebanon",
    title: "CodingClebanon",
    description: "a platform that empowers individuals to learn coding through personalized online mentorship.",
    image: "/projects/codingclebanon/thumb.png",
    type: ["redesign"],
    link: "/projects/coding-clebanon"
  },
  {
    id: "wfk",
    title: "WFK Law Firm",
    description: "a professional legal firm that needed an internal tool to streamline employee task tracking.",
    image: "/projects/wfk/thumb.png",
    type: ["web"],
    link: "/projects/wfk-law-firm"
  },
  {
    id: "shipment-share",
    title: "Shipment Share",
    description: "a smart delivery platform that connects people who need to send packages with travelers.",
    image: "/projects/shipment-share/thumb.png",
    type: ["mobile"],
    link: "/projects/shipment-share"
  },
  {
    id: "shareb",
    title: "Shareb",
    description: "a promotional lottery app designed to boost brand engagement through interactive weekly draws.",
    image: "/projects/shareb/thumb.png",
    type: ["mobile"],
    link: "/projects/shareb"
  }
]

const projectTypes: ProjectType[] = ["all", "web", "mobile", "showcase", "redesign"];

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
      case "showcase": return <span className="px-2 py-1 text-xs bg-[#a2067857] text-[#a20678] rounded-md">Showcase</span>
      case "redesign": return <span className="px-2 py-1 text-xs bg-[#f9d29361] text-[#fbb03b] rounded-md">Redesign</span>
      default: return null
    }
  }

  return (
    <div className="page-content min-h-screen bg-[1d1d1d]] text-white p-5 md:p-7">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-[#1A1A1A] pb-6">
        {projectTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
              activeFilter === type
                ? "bg-[#0acf83] text-black"
                : "bg-[#292929] hover:bg-[#3a3a3a]"
            }`}
          >
            {type === "all" ? "All Projects" : type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-12">
        {filteredProjects.map((project) => (
          <Link href={project.link} key={project.id} className="block">
            <div className="bg-[#121212] rounded-2xl p-4 overflow-hidden border-1 border-[#292929] hover:border-[#0acf83] transition-all">
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

      {/* Call to Action */}
      <div className="text-center py-10">
        <h2 className="text-3xl font-black text-[#0acf83] mb-2">Have a similar project in mind?</h2>
        <p className="text-sm mb-6">Let's create a user-friendly solution together.</p>
        <Link
          href="https://wa.link/mlum9h"
          className="inline-block px-6 py-3 border rounded-full hover:text-[#0acf83] hover:border-[#0acf83] hover:bg-opacity-10 transition-colors"
        >
          Contact Me
        </Link>
      </div>
    </div>
  )
}