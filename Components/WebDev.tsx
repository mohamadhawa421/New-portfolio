import React from 'react'
import Skill from './Skill'
import WorkShowcase from './WorkShowcase'
import image1 from "../public/Images/1.png"
import image2 from "../public/Images/2.png"
import image3 from "../public/Images/3.png"

function WebDev() {
  return (

    <div className='flex flex-col gap-2 text-white'>
      <div className='flex flex-col gap-4 h-[25rem]'>
<span className='text-Grey font-light text-sm'>- Web Development</span>


<p className='text-white font-light text-2xl w-[17rem]'>
“Websites promote you 24/7: No employee will do <span className='font-regular text-gold'>that"</span>.</p>



  <p className='text-Grey font-light w-[20rem]'>
  Designing in html, css and javascript, i am able to deliver a fully responsive website with a clean, semantic code also i will develop the backend side and host your website.</p>

  <div className='flex gap-14  mt-[3rem]'>
  <Skill skillName = "ReactJs"/>
  <Skill skillName = "NextJs"/>
  <Skill skillName = "NodeJs"/>
  </div>
  </div>
    
    <WorkShowcase 
    image1={image1}
    image2={image2}
    image3={image3}
    />
    </div>
  )
}

export default WebDev