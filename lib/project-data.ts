// lib/projects-data.ts
// Update the interface and project data to have an array of images

export interface ProjectDetail {
    slug: string;
    name: string;
    aboutProject: string;
    problemStatement: string;
    details: {
      client: string;
      project: string;
      timeline: string;
      results: string;
    };
    research: {
      description: string;
      keyFindings: string[];
    };
    designProcess: {
      wireframes: string;
      prototypes: string;
      finalUI: string;
    };
    finalSolutions: string[];
    endResults: {
      efficiencyBoost: string;
      positiveFeedback: string;
      clientSatisfaction: string;
    };
    // Changed from object to array of strings
    images: string[];
  }
  
  export const projects: ProjectDetail[] = [
    {
      slug: "wise-academy",
      name: "Wise Academy",
      aboutProject: "WISE Academy a high standard school based in the US promoting academic excellence in a faith based and safe environment for our students. Wise Academy faced challenges with their existing student management system, which was outdated, unintuitive, and lacked features to handle the increasing number of students. They needed a modern, scalable, and user-friendly back-office solution to streamline student enrollment, track records, and manage communication effectively.",
      problemStatement: "Wise Academy faced challenges with their existing student management system, which was outdated, unintuitive, and lacked features to handle the increasing number of students. They needed a modern, scalable, and user-friendly back- office solution to streamline student enrollment, track records, and manage communication effectively.",
      details: {
        client: "Wise Academy",
        project: "Back-Office System",
        timeline: "One Week",
        results: "44+ Screens"
      },
      research: {
        description: "To understand the client's needs, I conducted:",
        keyFindings: [
          "Staff struggled with locating and updating student data quickly.",
          "New enrollments required multiple manual steps, leading to delays.",
          "A lack of filtering options for student records made tracking alumni difficult."
        ]
      },
      designProcess: {
        wireframes: "Created low-fidelity wireframes to map out the core functionality, including:\n• A dashboard with overview of active and pending enrollments.\n• A student database with advanced filters and search functionality.\n• A students/parents database with advanced filters and search functionality.\n• A calendar tool for managing interviews.",
        prototypes: "Built interactive prototypes to test key workflows:\n• Adding and updating student data.\n• Filtering old and new students by batch, grades, or status.\n• Managing communication (e.g., sending emails or notifications, interviews).",
        finalUI: "The final designs were clean, professional, and aligned with Wise Academy's branding. Key features included:\n• Dashboard Analytics: Visualized enrollment trends.\n• Student Management Module: Easy-to-use interface for adding, editing, and searching student records.\n• Automated notification system to remind parents for upcoming payments, deadlines and interviews."
      },
      finalSolutions: [
        "Improved Efficiency: Reduced time spent managing student data by 40%.",
        "Streamlined Enrollment: Created a path to view and find student records within seconds.",
        "Enhanced Usability: A clean layout with intuitive navigation ensured ease of use for all staff levels."
      ],
      endResults: {
        efficiencyBoost: "Administrators reported a 50% reduction in time spent managing student data.",
        positiveFeedback: "Staff praised the intuitive design and improved workflows.",
        clientSatisfaction: "Wise Academy expressed interest in extending the platform for managing other aspects of school operations."
      },
      // Changed from object to array
      images: [
        "/projects/Wise/Insights.png",
        "/projects/Wise/database.png",
        "/projects/Wise/Interview.png"
      ]
    },
    {
        slug: "kabbara",
        name: "Kabbara Office",
        aboutProject: "Kabbara Office is a digital solution built to help Deputy Karim Kabbara manage and respond to public service requests efficiently. The platform allows users to submit various help requests (legal, financial, employment, etc.) and enables the deputy’s team to track, filter, and manage these cases with clarity and speed.",
        problemStatement: "Deputy Karim Kabbara's office faced growing difficulty managing a high volume of public assistance requests using traditional methods. These challenges included inefficient tracking, delays in processing, and a lack of centralized communication. The need arose for a digital system to streamline case intake, improve tracking, and support faster decision-making.",
        details: {
          client: "Karim Kabbara",
          project: "Management System",
          timeline: "One Week",
          results: "15+ Mobile Screens"
        },
        research: {
          description: "To understand the deputy's office needs, I conducted:",
          keyFindings: [
            "Manual request handling was time-consuming and prone to errors.",
            "There was no unified view of pending, approved, or rejected services.",
            "Categorizing and prioritizing new requests lacked a clear workflow."
          ]
        },
        designProcess: {
          wireframes: "Created low-fidelity wireframes focused on core workflows:\n• Services dashboard showing new and pending requests.\n• Search and filter functionality to quickly locate requests.\n• Request detail view with status updates and user info.",
          prototypes: "Built interactive prototypes to validate workflows:\n• Receiving and tagging new requests by type (legal, financial, etc.).\n• Changing request statuses (new, pending, approved, rejected).\n• Filtering services by type and requester name.",
          finalUI: "The final UI reflected an official, clean, and highly readable design. Highlights included:\n• A color-coded system for request status.\n• Easy-to-use filters and categorization tools.\n• Arabic-first design for accessibility to the intended audience."
        },
        finalSolutions: [
          "Centralized Request Management: All requests are now logged and easily trackable in one place.",
          "Clear Status Indicators: Staff can instantly see which requests are new, pending, or completed.",
          "Faster Response Times: Filtering and search tools significantly reduced the time to locate and act on requests."
        ],
        endResults: {
          efficiencyBoost: "Office team reported a 60% reduction in time to process each request.",
          positiveFeedback: "Deputy's team appreciated the clarity and ease of use.",
          clientSatisfaction: "The Deputy expressed interest in expanding the system to manage more public-facing initiatives."
        },
        images: [
          "/projects/kabbara/showcase.png"
        ]
      },
      {
        slug: "coding-clebanon",
        name: "CodingCLebanon",
        aboutProject: "CodingCLebanon is an educational platform that empowers individuals to learn programming through personalized one-on-one online mentorship. Their mission is to make learning programming accessible and flexible, supporting students at every stage of their journey. My mission was to redesign their platform with a stronger UX focus, improving usability, engagement, and conversion.",
        problemStatement: "Despite offering valuable one-on-one mentorship, CodingCLebanon’s previous platform lacked an intuitive user experience. Users found it difficult to navigate course offerings, book sessions, and track their learning progress. The company needed a design overhaul to better reflect their brand mission and ensure users could easily access and engage with the content.",
        details: {
          client: "CodingCLebanon",
          project: "UI/UX Redesign",
          timeline: "3 Days",
          results: "10+ Redesigned Screens"
        },
        research: {
          description: "To identify key usability issues and opportunities, I conducted:",
          keyFindings: [
            "Users were unclear about how to get started or book their first session.",
            "The homepage lacked a clear call-to-action and value proposition.",
            "There was no centralized dashboard to track progress or session history."
          ]
        },
        designProcess: {
          wireframes: "Mapped out low-fidelity wireframes for:\n• A new homepage with a strong CTA and value-driven messaging.\n• A student dashboard to manage sessions, progress, and mentor communication.\n• An improved booking system with real-time mentor availability.",
          prototypes: "Interactive prototypes were created to test:\n• The onboarding experience for new users.\n• Booking a mentorship session in under 3 clicks.\n• Progress tracking via a redesigned dashboard with milestones and achievements.",
          finalUI: "The final interface emphasized simplicity and warmth. Key upgrades included:\n• A welcoming and conversion-focused homepage.\n• Clear user flows for onboarding, session booking, and progress tracking.\n• Mobile-responsive design to support learners on any device."
        },
        finalSolutions: [
          "Boosted Onboarding: Clear CTAs and guidance helped new users start their learning journey faster.",
          "Seamless Booking: Booking sessions was simplified into an intuitive and fast workflow.",
          "Learner Empowerment: The dashboard gave students more control and visibility over their learning journey."
        ],
        endResults: {
          efficiencyBoost: "Session bookings increased by 35% after the redesign.",
          positiveFeedback: "Mentors and students appreciated the new dashboard and cleaner navigation.",
          clientSatisfaction: "CodingCLebanon praised the redesign and reported increased engagement across the platform."
        },
        images: [
          "/projects/Codingclebanon/showcase.png"
        ]
      },
      {
        slug: "wfk-law-firm",
        name: "WFK Law Firm",
        aboutProject: "WFK Law Firm is a professional legal firm that needed an internal tool to streamline employee task tracking, scheduling, and performance monitoring. I was brought in to design a robust task management system and a comprehensive dashboard to centralize daily operations and improve internal accountability — all while ensuring compatibility with Microsoft Power Apps.",
        problemStatement: "The firm was using fragmented tools and manual methods to assign, monitor, and manage employee tasks, which led to inefficiencies, miscommunication, and a lack of visibility over day-to-day operations. They needed a centralized digital solution that could align with their workflow, fit into their Microsoft ecosystem, and be intuitive for legal staff with varying tech experience.",
        details: {
          client: "WFK Law Firm",
          project: "Task Management System & Dashboard",
          timeline: "10 Days",
          results: "20+ Screens | Power Apps Compatible"
        },
        research: {
          description: "To tailor the solution to the law firm’s needs, I conducted:",
          keyFindings: [
            "Employees lacked a unified interface to view or manage their assigned tasks.",
            "There was no performance tracking mechanism or analytics overview for management.",
            "The solution needed to align with Power Apps limitations while maintaining good UX practices."
          ]
        },
        designProcess: {
          wireframes: "Created wireframes aligned with Power Apps constraints, focusing on:\n• Task creation and assignment flows.\n• A calendar-style scheduler for tasks and deadlines.\n• A dashboard overview with task status, deadlines, and user performance.",
          prototypes: "Developed prototypes that allowed stakeholders to:\n• Simulate task assignment, editing, and completion flows.\n• Navigate a dashboard showing active tasks, overdue actions, and staff activity.\n• Filter and sort tasks by status, assignee, or priority.",
          finalUI: "The final UI design maintained a balance between Power Apps compatibility and clean, functional UX. Key UI aspects included:\n• A visually organized task board with clear status indicators.\n• A high-contrast layout for easy readability across legal teams.\n• Seamless integration feel within Microsoft’s ecosystem."
        },
        finalSolutions: [
          "Task Ownership: Employees can now clearly view and manage their assignments in real time.",
          "Executive Overview: The dashboard provides management with performance insights and workload balance.",
          "System Integration: The design was fully Power Apps compatible, ensuring smooth implementation within the existing IT infrastructure."
        ],
        endResults: {
          efficiencyBoost: "Task handling time was reduced by 40% due to streamlined interfaces.",
          positiveFeedback: "Both legal staff and managers found the system intuitive and time-saving.",
          clientSatisfaction: "WFK Law Firm was impressed with how the tool improved internal transparency and organization."
        },
        images: [
          "/projects/wfk/showcase.png",
          "/projects/wfk/showcase1.png",
          "/projects/wfk/showcase2.png",
          "/projects/wfk/showcase3.png"
        ]
      },
      {
        slug: "shipment-share",
        name: "Shipment Share",
        aboutProject: "Shipment Share is a smart delivery platform that connects people who need to send packages with travelers already heading to the same destination. I designed the app to streamline the peer-to-peer shipment process, offering an affordable and personal alternative to traditional shipping companies. Users can browse upcoming trips, track shipments, and communicate directly with couriers — all in a clean, mobile-friendly interface.",
        problemStatement: "Shipping costs are rising, and traditional courier services can be slow or inaccessible in certain regions. Many travelers have unused baggage space, and senders are looking for quicker, cheaper alternatives. Shipment Share bridges this gap by connecting the two in a simple, safe, and transparent way.",
        details: {
          client: "Shipment Share",
          project: "Peer-to-Peer Shipment App",
          timeline: "14 Days",
          results: "20+ Screens | Fully Mobile Responsive"
        },
        research: {
          description: "To build a user-first experience, I conducted interviews with both frequent travelers and individuals who often send packages. The key findings were:",
          keyFindings: [
            "Travelers wanted an easy way to offer extra luggage space for delivery without being overwhelmed.",
            "Senders needed to trust the traveler, know the exact route, and have direct communication.",
            "A clear visual summary of the trip, shipment capacity, and fees was essential to both parties."
          ]
        },
        designProcess: {
          wireframes: "Sketched key flows, including:\n• Browsing and filtering trips by date and destination.\n• Viewing shipment details and sending requests.\n• Chat functionality between sender and traveler.",
          prototypes: "Tested interactive flows with users for:\n• Booking a shipment with a traveler.\n• Navigating a shipment summary and communication options.\n• Viewing shipment status and trip details.",
          finalUI: "The final UI focused on:\n• A bright, intuitive interface using yellow and navy for contrast.\n• Minimal steps from finding a trip to booking a shipment.\n• A clear shipment breakdown with sender/recipient info, timeline, capacity, and pricing."
        },
        finalSolutions: [
          "Real-Time Matchmaking: Travelers and senders can easily connect based on route and availability.",
          "Trust-Driven UI: Clear sender/recipient info, travel timelines, and secure communication features.",
          "Mobile Focus: Designed with mobile-first principles for everyday accessibility and fast interactions."
        ],
        endResults: {
          efficiencyBoost: "Users could arrange a shipment in under 2 minutes from trip selection to confirmation.",
          positiveFeedback: "Testers praised the clarity of trip details and the ease of contacting travelers.",
          clientSatisfaction: "Shipment Share’s team appreciated the friendly UI and its appeal to both casual and business users."
        },
        images: [
          "/projects/shipment-share/showcase.png"
        ]
      },
      {
        slug: "shareb",
        name: "Shareb",
        aboutProject: "Shareb is a promotional lottery app designed to boost brand engagement through interactive weekly draws. Users can sign up by scanning a QR code printed on branded drink cups and instantly join weekly prize draws with just one tap. The app connects businesses with customers through playful engagement, making every sip a chance to win.",
        problemStatement: "Brands needed a fun, cost-effective way to engage customers offline and online, while consumers love winning but are often overwhelmed by complicated sign-up processes. Shareb solves this by making entry as easy as sipping from a cup and tapping a button.",
        details: {
          client: "Shareb App",
          project: "Weekly Prize Lottery App",
          timeline: "10 Days",
          results: "8+ Screens | Fully animated & Mobile Responsive"
        },
        research: {
          description: "User behavior around prize-based apps showed that simple onboarding and instant action are key to success. We tested several flows and found the most frictionless way was:",
          keyFindings: [
            "QR code scanning had to be seamless and redirect users directly into the app or sign-up screen.",
            "The lottery button needed to feel satisfying and responsive — giving a mini dopamine hit.",
            "Showcasing past winners and brand sponsors built trust and encouraged participation."
          ]
        },
        designProcess: {
          wireframes: "Focused on:\n• Fast sign-up via mobile number and QR scan.\n• Clear and fun CTA to 'Join the Draw'.\n• Sections for featured brands, prizes, and winner highlights.",
          prototypes: "Interactive prototypes tested with users to validate the main flow: scan > tap > wait for the draw. Added social buttons and gamified elements to encourage sharing.",
          finalUI: "The final interface is:\n• Bold, playful, and brand-aligned with teal, orange, and animated wheel graphics.\n• Designed for repeat visits, with brand carousel and gift previews.\n• Light and responsive for instant access after QR scanning."
        },
        finalSolutions: [
          "Instant Access: Users can enter the draw in seconds with no complicated forms.",
          "Brand-Driven UI: Sponsors and partner logos are clearly featured for visibility.",
          "Gamified Interaction: Tapping to participate adds a game-like layer to simple actions."
        ],
        endResults: {
          efficiencyBoost: "Reduced entry time to under 5 seconds after QR scan.",
          positiveFeedback: "Users described it as 'super quick' and 'fun to use after grabbing coffee'.",
          clientSatisfaction: "Shareb’s sponsors praised the exposure and engagement, especially during live campaigns."
        },
        images: [
          "/projects/shareb/showcase.png",
          "/projects/shareb/showcase1.png"
        ]
      }
      
      
      
      
      
    // You can add more projects here in the future
  ];
  
  export function getProjectBySlug(slug: string): ProjectDetail | undefined {
    return projects.find(project => project.slug === slug);
  }
  
  export function getAllProjectSlugs(): string[] {
    return projects.map(project => project.slug);
  }