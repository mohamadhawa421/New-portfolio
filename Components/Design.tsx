import React from 'react'
import Skill from './Skill'

function Design() {
  return (
    <div className='flex flex-col gap-2 text-white'>
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
  )
}

export default Design