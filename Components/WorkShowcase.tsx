import React from 'react'
import Image from 'next/image'

function WorkShowcase({image1,image2,image3}:any) {
  return (
    <div className='flex flex-col gap-2 mt-8'>
        <span className='text-Grey font-light text-sm'>- Projects</span>
        <div className='flex gap-4'>

    <Image
    className='rounded-3xl'
    width={300}
    src={image1}
    alt='image 1'
    quality={100}
    />
    <Image
    className='rounded-2xl'
    width={300}
    src={image2}
    alt='image 2'
    quality={100}
    />
    <Image
    className='rounded-2xl'
    width={300}
    src={image3}
    alt='image 3'
    quality={100}
    />
  </div>
    </div>
    
  )
}

export default WorkShowcase