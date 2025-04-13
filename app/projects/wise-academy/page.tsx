"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ProjectDetails() {
  const router = useRouter()

  const handleBack = () => {
    router.back()
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
            WISE Academy a high standard school based in the US promoting academic excellence in a faith based and safe
            environment for our students. Wise Academy faced challenges with their existing student management system,
            which was outdated, unintuitive, and lacked features to handle the increasing number of students. They
            needed a modern, scalable, and user-friendly back-office solution to streamline student enrollment, track
            records, and manage communication effectively.
          </p>
        </div>

        {/* Problem Statement */}
        <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">

          <div><h2 className="text-4xl/tight font-black mb-1">Problem</h2>
          <h2 className="text-4xl/tight font-black text-[#90DDA9]">Statement</h2></div>

          <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          <p className="text-sm text-[#8c8e93] leading-relaxed">
            Wise Academy faced challenges with their existing student management system, which was outdated,
            unintuitive, and lacked features to handle the increasing number of students. They needed a modern,
            scalable, and user-friendly back- office solution to streamline student enrollment, track records, and
            manage communication effectively.
          </p>
        </div>
      </div>

      {/* Project Details Bar */}
      <div className="bg-[#121212] rounded-[20px] p-5 mb-2 grid grid-cols-4 gap-2">
        <div>
          <p className="text-sm text-[#8c8e93]">Client</p>
          <p className="text-base font-medium">Wise Academy</p>
        </div>
        <div>
          <p className="text-sm text-[#8c8e93]">Project</p>
          <p className="text-base font-medium">Back-Office System</p>
        </div>
        <div>
          <p className="text-sm text-[#8c8e93]">Timeline</p>
          <p className="text-base font-medium">One Week</p>
        </div>
        <div>
          <p className="text-sm text-[#8c8e93]">Results</p>
          <p className="text-base font-medium">44+ Screens</p>
        </div>
      </div>

      {/* Research & Insights */}
      <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5 mb-2">

        <div><h2 className="text-4xl/tight font-black mb-1">Research</h2>
        <h2 className="text-4xl/tight font-black text-[#90DDA9]">& Insights</h2></div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

        <p className="text-sm mb-4">To understand the client's needs, I conducted:</p>

        <ul className="list-disc list-inside space-y-2 mb-4 pl-1">
          <li className="text-sm">
            <span className="font-medium">Stakeholder Interviews:</span>{" "}
            <span className="text-[#8c8e93]">
              Discussions with Wise Academy's staff to identify pain points and must-have features.
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
          <li className="text-sm text-[#8c8e93]">Staff struggled with locating and updating student data quickly.</li>
          <li className="text-sm text-[#8c8e93]">New enrollments required multiple manual steps, leading to delays.</li>
          <li className="text-sm text-[#8c8e93]">
            A lack of filtering options for student records made tracking alumni difficult.
          </li>
        </ul>
      </div>

      {/* Design Process */}
      <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5 mb-2">

        <div><h2 className="text-4xl/tight font-black mb-1">Design</h2>
        <h2 className="text-4xl/tight font-black text-[#90DDA9]">Process</h2></div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

        <div className="flex flex-col items-center md:flex-row gap-2">

          {/* Wireframes */}
          <div className="bg-[#292929] h-[350px] rounded-lg p-4">
            <div className="w-6 h-6 bg-black rounded-sm p-4 flex items-center justify-center mb-3">
              <span className="text-sm font-bold text-[#90DDA9]">1</span>
            </div>
            <h3 className="text-base font-semibold mb-2">Wireframes</h3>
            <p className="text-sm font-medium text-[#8c8e93] mb-3">
              Created low-fidelity wireframes to map out the core functionality, including:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li className="text-sm text-[#8c8e93]">A dashboard with overview of active and pending enrollments.</li>
              <li className="text-sm text-[#8c8e93]">
                A student database with advanced filters and search functionality.
              </li>
              <li className="text-sm text-[#8c8e93]">
                A students/parents database with advanced filters and search functionality.
              </li>
              <li className="text-sm text-[#8c8e93]">A calendar tool for managing interviews.</li>
            </ul>
          </div>
          <div className="h-[1px] w-8 rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          {/* Prototypes */}
          <div className="bg-[#292929] h-[350px] rounded-lg p-4">
          <div className="w-6 h-6 bg-black rounded-sm p-4 flex items-center justify-center mb-3">
              <span className="text-sm font-bold text-[#90DDA9]">2</span>
            </div>
            <h3 className="text-base font-semibold mb-2">Prototypes</h3>
            <p className="text-sm font-medium text-[#8c8e93] mb-3">Built interactive prototypes to test key workflows:</p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li className="text-sm text-[#8c8e93]">Adding and updating student data.</li>
              <li className="text-sm text-[#8c8e93]">Filtering old and new students by batch, grades, or status.</li>
              <li className="text-sm text-[#8c8e93]">
                Managing communication (e.g., sending emails or notifications, interviews).
              </li>
            </ul>
          </div>
          <div className="h-[1px] w-8 rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

          {/* Final UI Design */}
          <div className="bg-[#292929] h-[350px] rounded-lg p-4">
          <div className="w-6 h-6 bg-black rounded-sm p-4 flex items-center justify-center mb-3">
              <span className="text-sm font-bold text-[#90DDA9]">3</span>
            </div>
            <h3 className="text-base font-semibold mb-2">Final UI Design</h3>
            <p className="text-sm font-medium text-[#8c8e93] mb-3">
              The final designs were clean, professional, and aligned with Wise Academy's branding. Key features
              included:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li className="text-sm text-[#8c8e93]">Dashboard Analytics: Visualized enrollment trends.</li>
              <li className="text-sm text-[#8c8e93]">
                Student Management Module: Easy-to-use interface for adding, editing, and searching student records.
              </li>
              <li className="text-sm text-[#8c8e93]">
                Automated notification system to remind parents for upcoming payments, deadlines and interviews.
              </li>
            </ul>
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

          <div><p className="text-sm mb-3">The Design Focused On Solving Wise Academy's Challenges By:</p>

          <ul className="list-disc list-inside space-y-2 pl-1">
            <li className="text-sm text-[#8c8e93]">
              <span className="font-medium">Improved Efficiency:</span> Reduced time spent managing student data by 40%.
            </li>
            <li className="text-sm text-[#8c8e93]">
              <span className="font-medium">Streamlined Enrollment:</span> Created a path to view and find student
              records within seconds.
            </li>
            <li className="text-sm text-[#8c8e93]">
              <span className="font-medium">Enhanced Usability:</span> A clean layout with intuitive navigation ensured
              ease of use for all staff levels.
            </li>
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
                Administrators reported a 50% reduction in time spent managing student data.
              </p>
            </li>
            <li>
              <p className="text-sm font-medium">Positive Feedback:</p>
              <p className="text-sm text-[#8c8e93]">Staff praised the intuitive design and improved workflows.</p>
            </li>
            <li>
              <p className="text-sm font-medium">Client Satisfaction:</p>
              <p className="text-sm text-[#8c8e93]">
                Wise Academy expressed interest in extending the platform for managing other aspects of school
                operations.
              </p>
            </li>
          </ul>
        </div>
      </div>

      {/* Visuals & Screenshots */}
      <div className="flex flex-col bg-[#121212] rounded-3xl gap-6 p-5">

        <div><h2 className="text-4xl/tight font-black mb-1">Visuals</h2>
        <h2 className="text-4xl/tight font-black text-[#90DDA9]">& Screenshots</h2></div>

        <div className="h-[1px] w-full rounded-full" style={{background: 'linear-gradient(90deg, rgba(235, 235, 235, 0) 0%, #90DDA9 50%, rgba(235, 235, 235, 0) 100%)'}} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Dashboard & Insights */}
          <div className="rounded-xl overflow-hidden">
            <Image
              src="/projects/Wise/Insights.jpg"
              alt="Dashboard & Insights"
              width={750}
              height={412}
              quality={100}
              className="object-cover w-full h-full"
            /></div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Database Management */}
            <div className="rounded-xl overflow-hidden">
              <Image
                src="/projects/Wise/database.png"
                alt="Database Management"
                width={538}
                height={202}
                quality={100}
                className="object-cover w-full h-full"
              /></div>

            {/* Interview Calendar */}
              <div className="rounded-xl overflow-hidden">
                <Image
                  src="/projects/Wise/interview.png"
                  alt="Calendar View"
                  width={538}
                  height={202}
                  quality={100}
                  className="object-cover w-full h-full"
                /></div>
          </div>
        </div>
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
