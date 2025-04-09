"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"

// Project type definition
type ProjectType = "all" | "mobile" | "web" | "showcase" | "redesign"

// Project interface
interface Project {
  id: string
  title: string
  description: string
  image: string
  type: ProjectType | ProjectType[]
  link: string
}

// Sample projects data
const projects: Project[] = [
  {
    id: "wise-academy-1",
    title: "Wise Academy",
    description:
      "WISE Academy a high standard school based in the US promoting academic excellence in a faith based and safe environment for our students.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["web"],
    link: "/projects/wise-academy",
  },
  {
    id: "project-2",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["mobile"],
    link: "#",
  },
  {
    id: "project-3",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["showcase"],
    link: "#",
  },
  {
    id: "project-4",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["redesign"],
    link: "#",
  },
  {
    id: "wise-academy-2",
    title: "Wise Academy",
    description:
      "WISE Academy a high standard school based in the US promoting academic excellence in a faith based and safe environment for our students.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["web"],
    link: "/projects/wise-academy",
  },
  {
    id: "project-6",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["mobile"],
    link: "#",
  },
  {
    id: "project-7",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["showcase"],
    link: "#",
  },
  {
    id: "project-8",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["redesign"],
    link: "#",
  },
  {
    id: "wise-academy-3",
    title: "Wise Academy",
    description:
      "WISE Academy a high standard school based in the US promoting academic excellence in a faith based and safe environment for our students.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["web"],
    link: "/projects/wise-academy",
  },
  {
    id: "project-10",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["mobile"],
    link: "#",
  },
  {
    id: "project-11",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["showcase"],
    link: "#",
  },
  {
    id: "project-12",
    title: "Project Name",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.",
    image: "/placeholder.svg?height=200&width=300",
    type: ["redesign"],
    link: "#",
  },
]

export default function ProjectsPage() {
  const [activeFilter, setActiveFilter] = useState<ProjectType>("all")

  // Filter projects based on active filter
  const filteredProjects = projects.filter((project) => {
    if (activeFilter === "all") return true
    if (Array.isArray(project.type)) {
      return project.type.includes(activeFilter)
    }
    return project.type === activeFilter
  })

  // Get project type badge
  const getProjectTypeBadge = (type: ProjectType | ProjectType[]) => {
    const projectType = Array.isArray(type) ? type[0] : type

    switch (projectType) {
      case "web":
        return <span className="inline-block px-2 py-1 text-xs bg-[#121212] text-white rounded-md">Web App</span>
      case "mobile":
        return <span className="inline-block px-2 py-1 text-xs bg-[#121212] text-white rounded-md">Mobile App</span>
      case "showcase":
        return (
          <span className="inline-block px-2 py-1 text-xs bg-[#121212] text-[#0acf83] rounded-md">
            Showcase Website
          </span>
        )
      case "redesign":
        return <span className="inline-block px-2 py-1 text-xs bg-[#121212] text-[#fbb03b] rounded-md">Redesign</span>
      default:
        return null
    }
  }

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "tween", ease: "easeInOut", duration: 0.5 }}
      className="min-h-screen bg-black text-white p-5 md:p-7"
    >
      {/* Back Button */}
      <Link href="/about" className="inline-flex items-center text-white hover:text-[#0acf83] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        <span>Bring Me Back</span>
      </Link>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-6 mb-8 border-b border-[#1A1A1A] pb-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`text-sm pb-2 ${
            activeFilter === "all" ? "text-[#0acf83] border-b-2 border-[#0acf83]" : "text-white hover:text-[#0acf83]"
          } transition-colors`}
        >
          All
        </button>
        <button
          onClick={() => setActiveFilter("mobile")}
          className={`text-sm pb-2 ${
            activeFilter === "mobile" ? "text-[#0acf83] border-b-2 border-[#0acf83]" : "text-white hover:text-[#0acf83]"
          } transition-colors`}
        >
          Mobile apps
        </button>
        <button
          onClick={() => setActiveFilter("web")}
          className={`text-sm pb-2 ${
            activeFilter === "web" ? "text-[#0acf83] border-b-2 border-[#0acf83]" : "text-white hover:text-[#0acf83]"
          } transition-colors`}
        >
          Web apps
        </button>
        <button
          onClick={() => setActiveFilter("showcase")}
          className={`text-sm pb-2 ${
            activeFilter === "showcase"
              ? "text-[#0acf83] border-b-2 border-[#0acf83]"
              : "text-white hover:text-[#0acf83]"
          } transition-colors`}
        >
          Showcase Websites
        </button>
        <button
          onClick={() => setActiveFilter("redesign")}
          className={`text-sm pb-2 ${
            activeFilter === "redesign"
              ? "text-[#0acf83] border-b-2 border-[#0acf83]"
              : "text-white hover:text-[#0acf83]"
          } transition-colors`}
        >
          Redesigns
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {filteredProjects.map((project) => (
          <Link href={project.link} key={project.id} className="block">
            <div className="bg-[#121212] rounded-lg overflow-hidden hover:border hover:border-[#0acf83] transition-all">
              <div className="h-48 bg-[#1e293b] relative">
                <Image
                  src={project.image || "/placeholder.svg"}
                  alt={project.title}
                  width={400}
                  height={200}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium mb-1">{project.title}</h3>
                <p className="text-xs text-[#8c8e93] mb-3">{project.description}</p>
                <div className="mt-2">{getProjectTypeBadge(project.type)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Call to Action */}
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
    </motion.div>
  )
}
