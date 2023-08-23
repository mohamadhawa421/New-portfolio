import React from 'react'
import Skill from './Skill'

function MobileDev() {
  return (
    <div className='flex flex-col gap-2 text-white'>
<span className='text-Grey font-light text-sm'>- Mobile Development</span>


<p className='text-white font-light text-2xl w-[17rem]'>
“The most important impact on society and the world is <span className='font-regular text-gold'>the Smartphone"</span>.</p>



  <p className='text-Grey font-light w-[20rem]'>
  When it comes to apps, i design then develop React-Native framework.</p>

  <div className='flex gap-14  mt-[3rem]'>
  <Skill skillName = "React Native"/>
  </div>
    
    </div>
  )
}

export default MobileDev