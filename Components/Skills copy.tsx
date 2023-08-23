import React from 'react'
import Skill from './Skill'

function Skills() {
  return (
    <div className='flex flex-col gap-2 text-white'>
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
  )
}

export default Skills