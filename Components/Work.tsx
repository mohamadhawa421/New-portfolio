"use client";
import React, {useState} from 'react'
import Filter from './Filter'
import ActiveComponent from './ActiveComponent';
import Image from 'next/image';
import waves from "../public/Images/waves.png"


function Work() {

    const [activeLink, setActiveLink] = useState('skills');

    const handleLinkClick = (link:any) => {
      setActiveLink(link);
    };

  return (
    <div className=" relative flex w-full min-h-screen flex-col pt-32 gap-16 py-12" id='services'>
        <Filter activeLink = {activeLink} handleLinkClick = {handleLinkClick}/>
        <ActiveComponent activeLink={activeLink} />
        <Image
        className='absolute top-30 right-10 z-0'
        src={waves}
        alt='waves'
        height={400}/>
        
    </div>
  )
}

export default Work