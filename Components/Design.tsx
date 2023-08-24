import React from 'react'
import Skill from './Skill'
import WorkShowcase from './WorkShowcase'
import image1 from "../public/Images/1.png"
import image2 from "../public/Images/2.png"
import image3 from "../public/Images/3.png"


function Design() {
  return (


    <div className='flex flex-col gap-2 text-white'>
      <div className=' flex flex-col gap-4'>
<span className='text-Grey font-light text-sm'>- Designing</span>


<p className='text-white font-light text-2xl w-[15rem]'>
"There is no such thing as a <span className='font-regular text-gold'>boring</span> project.“</p>
<p className='text-Grey font-light w-[15rem]'>
  Website or mobile app design, my clients get the product that has the best combination of outstanding user experience and visual aesthetics.</p>

  <div className='flex gap-14  mt-[3rem]'>
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

export default Design