"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useSearchParams } from "next/navigation"

export default function WiseAcademyProject() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from") || "about"

  const backLink = from === "projects" ? "/projects" : "/about"
  const backText = from === "projects" ? "All Projects" : "Bring Me Back"

  return (
    <div className="page-content min-h-screen bg-black text-white p-5 md:p-7">
      {/* Back Button */}
      <Link href={backLink} className="inline-flex items-center text-white hover:text-[#0acf83] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        <span>{backText}</span>
      </Link>

      {/* Top Section - About & Problem */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* About The Project */}
        <div className="bg-[#121212] rounded-[20px] p-5">
          <h2 className="text-[34px] font-bold mb-1">
            <span className="text-white">About</span> <span className="text-[#90DDA9]">The</span>
          </h2>
          <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">Project</h2>
          <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

          <p className="text-sm text-[#8c8e93] mb-4 leading-relaxed">
            WISE Academy a high standard school based in the US promoting academic excellence in a faith based and safe
            environment for our students. Wise Academy faced challenges with their existing student management system,
            which was outdated, unintuitive, and lacked features to handle the increasing number of students. They
            needed a modern, scalable, and user-friendly back-office solution to streamline student enrollment, track
            records, and manage communication effectively.
          </p>
        </div>

        {/* Problem Statement */}
        <div className="bg-[#121212] rounded-[20px] p-5">
          <h2 className="text-[34px] font-bold mb-1">
            <span className="text-white">Problem</span>
          </h2>
          <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">Statement</h2>
          <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

          <p className="text-sm text-[#8c8e93] leading-relaxed">
            Wise Academy faced challenges with their existing student management system, which was outdated,
            unintuitive, and lacked features to handle the increasing number of students. They needed a modern,
            scalable, and user-friendly back- office solution to streamline student enrollment, track records, and
            manage communication effectively.
          </p>
        </div>
      </div>

      {/* Project Details Bar */}
      <div className="bg-[#121212] rounded-[20px] p-5 mb-6 grid grid-cols-4 gap-4">
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
      <div className="bg-[#121212] rounded-[20px] p-5 mb-6">
        <h2 className="text-[34px] font-bold mb-1">
          <span className="text-white">Research</span>
        </h2>
        <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">& Insights</h2>
        <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

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
      <div className="bg-[#121212] rounded-[20px] p-5 mb-6">
        <h2 className="text-[34px] font-bold mb-1">
          <span className="text-white">Design</span>
        </h2>
        <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">Process</h2>
        <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Wireframes */}
          <div className="bg-[#1A1A1A] rounded-lg p-4">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-black">1</span>
            </div>
            <h3 className="text-base font-medium mb-2">Wireframes</h3>
            <p className="text-xs text-[#8c8e93] mb-3">
              Created low-fidelity wireframes to map out the core functionality, including:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li className="text-xs text-[#8c8e93]">A dashboard with overview of active and pending enrollments.</li>
              <li className="text-xs text-[#8c8e93]">
                A student database with advanced filters and search functionality.
              </li>
              <li className="text-xs text-[#8c8e93]">
                A students/parents database with advanced filters and search functionality.
              </li>
              <li className="text-xs text-[#8c8e93]">A calendar tool for managing interviews.</li>
            </ul>
          </div>

          {/* Prototypes */}
          <div className="bg-[#1A1A1A] rounded-lg p-4">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-black">2</span>
            </div>
            <h3 className="text-base font-medium mb-2">Prototypes</h3>
            <p className="text-xs text-[#8c8e93] mb-3">Built interactive prototypes to test key workflows:</p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li className="text-xs text-[#8c8e93]">Adding and updating student data.</li>
              <li className="text-xs text-[#8c8e93]">Filtering old and new students by batch, grades, or status.</li>
              <li className="text-xs text-[#8c8e93]">
                Managing communication (e.g., sending emails or notifications, interviews).
              </li>
            </ul>
          </div>

          {/* Final UI Design */}
          <div className="bg-[#1A1A1A] rounded-lg p-4">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-black">3</span>
            </div>
            <h3 className="text-base font-medium mb-2">Final UI Design</h3>
            <p className="text-xs text-[#8c8e93] mb-3">
              The final designs were clean, professional, and aligned with Wise Academy's branding. Key features
              included:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li className="text-xs text-[#8c8e93]">Dashboard Analytics: Visualized enrollment trends.</li>
              <li className="text-xs text-[#8c8e93]">
                Student Management Module: Easy-to-use interface for adding, editing, and searching student records.
              </li>
              <li className="text-xs text-[#8c8e93]">
                Automated notification system to remind parents for upcoming payments, deadlines and interviews.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Final Solutions & End Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Final Solutions */}
        <div className="bg-[#121212] rounded-[20px] p-5">
          <h2 className="text-[34px] font-bold mb-1">
            <span className="text-white">Final</span>
          </h2>
          <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">Solutions</h2>
          <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

          <p className="text-sm mb-3">The Design Focused On Solving Wise Academy's Challenges By:</p>

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
          </ul>
        </div>

        {/* End Results */}
        <div className="bg-[#121212] rounded-[20px] p-5">
          <h2 className="text-[34px] font-bold mb-1">
            <span className="text-white">End</span>
          </h2>
          <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">Results</h2>
          <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

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
      <div className="bg-[#121212] rounded-[20px] p-5 mb-6">
        <h2 className="text-[34px] font-bold mb-1">
          <span className="text-white">Visuals</span>
        </h2>
        <h2 className="text-[34px] font-bold mb-4 text-[#90DDA9]">& Screenshots</h2>
        <div className="w-full h-[3px] bg-gradient-to-r from-[#90DDA9] to-transparent mb-5"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dashboard & Insights */}
          <div className="relative bg-[#1e3a8a] rounded-lg overflow-hidden h-[300px]">
            <Image
              src="/placeholder.svg?height=300&width=500"
              alt="Dashboard & Insights"
              width={500}
              height={300}
              className="object-cover w-full h-full"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#000000] to-transparent">
              <h3 className="text-lg font-medium">Dashboard &</h3>
              <h3 className="text-lg font-medium">Insights</h3>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Database Management */}
            <div className="relative bg-white rounded-lg overflow-hidden h-[140px]">
              <Image
                src="/placeholder.svg?height=140&width=500"
                alt="Database Management"
                width={500}
                height={140}
                className="object-cover w-full h-full"
              />
              <div className="absolute top-0 left-0 right-0 p-4">
                <h3 className="text-lg font-medium text-[#121212]">Database Management</h3>
              </div>
            </div>

            {/* Interview Calendar */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#f59e0b] rounded-lg p-4 flex flex-col justify-end h-[140px]">
                <h3 className="text-lg font-medium text-white">Interview</h3>
                <h3 className="text-lg font-medium text-white">Calendar</h3>
              </div>
              <div className="relative bg-white rounded-lg overflow-hidden h-[140px]">
                <Image
                  src="/placeholder.svg?height=140&width=240"
                  alt="Calendar View"
                  width={240}
                  height={140}
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center py-10">
        <h2 className="text-xl font-medium mb-2">Have a similar project in mind?</h2>
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
