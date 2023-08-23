"use client";
import React, {useState} from 'react'
import Filter from './Filter'
import ActiveComponent from './ActiveComponent';

function Work() {

    const [activeLink, setActiveLink] = useState('skills');

    const handleLinkClick = (link:any) => {
      setActiveLink(link);
    };

  return (
    <div className="flex w-full min-h-screen flex-col gap-16 py-12" id='services'>
        <Filter activeLink = {activeLink} handleLinkClick = {handleLinkClick}/>
        <ActiveComponent activeLink={activeLink} />
    </div>
  )
}

export default Work