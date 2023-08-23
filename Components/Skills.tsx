import React from 'react'
import Skill from './Skill'
import WorkShowcase from './WorkShowcase'
import image1 from "../public/Images/1.png"
import image2 from "../public/Images/2.png"
import image3 from "../public/Images/3.png"

function Skills() {
  return (


    <div className='flex flex-col gap-12 text-white'>
      <div className='flex flex-col gap-4 h-[25rem]'>
<span className='text-Grey font-light text-sm'>- About me</span>
<p className='text-white font-light text-2xl w-[15rem]'>
<span className='font-regular text-gold'>3 Years </span>
  of experience in web des<span className='font-regular text-gold'>ig</span>n and development.</p>
  <p className='text-Grey font-light w-[15rem]'>a web developer and designer passionate about enhancing user experience and maximizing user interface</p>

  <div className='flex gap-14  mt-[3rem]'>
  <Skill skillName = "ReactJS"/>
  <Skill skillName = "NodeJs"/>
  <Skill skillName = "React Native"/>
  </div>

  <div className='flex gap-14  mt-[1.3rem]'>
  <Skill skillName = "NextJs"/>
  <Skill skillName = "Figma"/>
  <Skill skillName = "Adobe XD"/>
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

export default Skills