// app/projects/[slug]/page.tsx
"use client"

import { useRouter, useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getProjectBySlug } from "..//../../lib/project-data"
import { useEffect, useState } from "react"
import { ProjectDetail } from "..//../../lib/project-data"
import { notFound } from "next/navigation"
import ImageSlider from "../../../components/ImagesSlider" // Import the extracted component

export default function ProjectDetails() {
  const router = useRouter()
  const params = useParams()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params?.slug) {
      const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug
      const projectData = getProjectBySlug(slug)
      
      if (projectData) {
        setProject(projectData)
      }
      setLoading(false)
    }
  }, [params])

  const handleBack = () => {
    router.back()
  }

  if (loading) {
    return <div className="min-h-screen bg-[#1d1d1d] text-white p-5 flex items-center justify-center">Loading...</div>
  }

  if (!project) {
    return notFound()
  }

  return (
    <div className="page-content min-h-screen bg-[#1d1d1d] text-white p-5 md:p-7">
      {/* Back Button */}
      <button 
        onClick={handleBack}
        className="inline-flex items-center text-white hover:text-[#0acf83] mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        <span>Bring Me Back</span>
      </button>

      {/* Top Section - About & Problem */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {/* About The Project */}
        <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">

          <div><h2 className="text-4xl/tight font-black mb-1">About The</h2>
          <h2 className="text-4xl/tight font-black text-[#90DDA9]">Project</h2></div>
          
          <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          <p className="text-sm text-[#8C8E93] mb-2 leading-relaxed">
            {project.aboutProject}
          </p>
        </div>

        {/* Problem Statement */}
        <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">

          <div><h2 className="text-4xl/tight font-black mb-1">Problem</h2>
          <h2 className="text-4xl/tight font-black text-[#90DDA9]">Statement</h2></div>

          <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          <p className="text-sm text-[#8c8e93] leading-relaxed">
            {project.problemStatement}
          </p>
        </div>
      </div>

      {/* Project Details Bar */}
      <div className="bg-[#121212] rounded-[20px] p-5 mb-2 grid grid-cols-4 gap-2">
        <div>
          <p className="text-sm text-[#8c8e93]">Client</p>
          <p className="text-base font-medium">{project.details.client}</p>
        </div>
        <div>
          <p className="text-sm text-[#8c8e93]">Project</p>
          <p className="text-base font-medium">{project.details.project}</p>
        </div>
        <div>
          <p className="text-sm text-[#8c8e93]">Timeline</p>
          <p className="text-base font-medium">{project.details.timeline}</p>
        </div>
        <div>
          <p className="text-sm text-[#8c8e93]">Results</p>
          <p className="text-base font-medium">{project.details.results}</p>
        </div>
      </div>

      {/* Research & Insights */}
      <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5 mb-2">

        <div><h2 className="text-4xl/tight font-black mb-1">Research</h2>
        <h2 className="text-4xl/tight font-black text-[#90DDA9]">& Insights</h2></div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

        <p className="text-sm mb-4">{project.research.description}</p>

        <ul className="list-disc list-inside space-y-2 mb-4 pl-1">
          <li className="text-sm">
            <span className="font-medium">Stakeholder Interviews:</span>{" "}
            <span className="text-[#8c8e93]">
              Discussions with {project.details.client}'s staff to identify pain points and must-have features.
            </span>
          </li>
          <li className="text-sm">
            <span className="font-medium">User Research:</span>{" "}
            <span className="text-[#8c8e93]">
              Observed how administrators currently handled student data and noted inefficiencies.
            </span>
          </li>
          <li className="text-sm">
            <span className="font-medium">Competitive Analysis:</span>{" "}
            <span className="text-[#8c8e93]">
              Analyzed other academy management tools to identify gaps and opportunities.
            </span>
          </li>
        </ul>

        <p className="text-sm font-medium mb-2">Key Findings:</p>
        <ul className="list-disc list-inside space-y-2 pl-1">
          {project.research.keyFindings.map((finding, index) => (
            <li key={index} className="text-sm text-[#8c8e93]">{finding}</li>
          ))}
        </ul>
      </div>

      {/* Design Process */}
      <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5 mb-2">

        <div><h2 className="text-4xl/tight font-black mb-1">Design</h2>
        <h2 className="text-4xl/tight font-black text-[#90DDA9]">Process</h2></div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

        <div className="flex flex-col items-center gap-2 md:flex-row md:gap-2">
  {/* Wireframes */}
  <div className="bg-[#292929] h-auto md:h-[350px] rounded-lg p-4 flex-1">
    <div className="w-6 h-6 bg-black rounded-sm p-4 flex items-center justify-center mb-3">
      <span className="text-sm font-bold text-[#90DDA9]">1</span>
    </div>
    <h3 className="text-base font-semibold mb-2">Wireframes</h3>
    <p className="text-sm font-medium text-[#8c8e93] mb-3 whitespace-pre-line">
      {project.designProcess.wireframes}
    </p>
  </div>
  <div className="h-[1px] w-8 rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

  {/* Prototypes */}
  <div className="bg-[#292929] h-auto md:h-[350px] rounded-lg p-4 flex-1">
    <div className="w-6 h-6 bg-black rounded-sm p-4 flex items-center justify-center mb-3">
      <span className="text-sm font-bold text-[#90DDA9]">2</span>
    </div>
    <h3 className="text-base font-semibold mb-2">Prototypes</h3>
    <p className="text-sm font-medium text-[#8c8e93] mb-3 whitespace-pre-line">
      {project.designProcess.prototypes}
    </p>
  </div>
  <div className="h-[1px] w-8 rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

  {/* Final UI Design */}
  <div className="bg-[#292929] h-auto md:h-[350px] rounded-lg p-4 flex-1">
    <div className="w-6 h-6 bg-black rounded-sm p-4 flex items-center justify-center mb-3">
      <span className="text-sm font-bold text-[#90DDA9]">3</span>
    </div>
    <h3 className="text-base font-semibold mb-2">Final UI Design</h3>
    <p className="text-sm font-medium text-[#8c8e93] mb-3 whitespace-pre-line">
      {project.designProcess.finalUI}
    </p>
  </div>
</div>
      </div>

      {/* Final Solutions & End Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {/* Final Solutions */}
        <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">

          <div><h2 className="text-4xl/tight font-black mb-1">Final</h2>
          <h2 className="text-4xl/tight font-black text-[#90DDA9]">Solutions</h2></div>

          <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          <div><p className="text-sm mb-3">The Design Focused On Solving {project.details.client}'s Challenges By:</p>

          <ul className="list-disc list-inside space-y-2 pl-1">
            {project.finalSolutions.map((solution, index) => (
              <li key={index} className="text-sm text-[#8c8e93]">
                {solution}
              </li>
            ))}
          </ul></div>
        </div>

        {/* End Results */}
        <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">

        <div><h2 className="text-4xl/tight font-black mb-1">End</h2>
        <h2 className="text-4xl/tight font-black text-[#90DDA9]">Results</h2></div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          <ul className="space-y-3 pl-1">
            <li>
              <p className="text-sm font-medium">Efficiency Boost:</p>
              <p className="text-sm text-[#8c8e93]">
                {project.endResults.efficiencyBoost}
              </p>
            </li>
            <li>
              <p className="text-sm font-medium">Positive Feedback:</p>
              <p className="text-sm text-[#8c8e93]">{project.endResults.positiveFeedback}</p>
            </li>
            <li>
              <p className="text-sm font-medium">Client Satisfaction:</p>
              <p className="text-sm text-[#8c8e93]">
                {project.endResults.clientSatisfaction}
              </p>
            </li>
          </ul>
        </div>
      </div>

      {/* Visuals & Screenshots */}
      <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">
        <div>
          <h2 className="text-4xl/tight font-black mb-1">Visuals</h2>
          <h2 className="text-4xl/tight font-black text-[#90DDA9]">& Screenshots</h2>
        </div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

        {/* Use the separate ImageSlider component */}
        <ImageSlider images={project.images} />
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