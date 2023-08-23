import React from 'react'
import Image from 'next/image'
import check from "../public/Images/check.svg"

function Skill({skillName}:any) {
  return (
    <div className='flex items-center gap-6 w-[11rem]'>
        <Image
        src={check}
        alt='check'/>

        <span className='text-white font-light text-base'>{skillName}</span>
        
    </div>
  )
}

export default Skill