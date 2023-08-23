import React from 'react'
import Skill from './Skill'
import WorkShowcase from './WorkShowcase'
import image1 from "../public/Images/1.png"
import image2 from "../public/Images/2.png"
import image3 from "../public/Images/3.png"

function MobileDev() {
  return (

    <div className='flex flex-col gap-2 text-white'>
      <div className='flex flex-col gap-4 h-[25rem]'>
<span className='text-Grey font-light text-sm'>- Mobile Development</span>


<p className='text-white font-light text-2xl w-[17rem]'>
“The most important impact on society and the world is <span className='font-regular text-gold'>the Smartphone"</span>.</p>



  <p className='text-Grey font-light w-[20rem]'>
  When it comes to apps, i design then develop React-Native framework.</p>

  <div className='flex gap-14  mt-[3rem]'>
  <Skill skillName = "React Native"/>
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

export default MobileDev