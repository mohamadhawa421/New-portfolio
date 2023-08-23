import React from 'react'
import Skill from './Skill'

function WebDev() {
  return (
    <div className='flex flex-col gap-2 text-white'>
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
  )
}

export default WebDev