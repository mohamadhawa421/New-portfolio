import React from 'react';

function Filter({activeLink, handleLinkClick}:any) {
  return (
    <div className='filter'>
      <ul className='flex text-white font-light gap-6 text-sm '>
        <li
          className={`text-Grey cursor-pointer ${activeLink === 'skills' ? 'active' : ''}`}
          onClick={() => handleLinkClick('skills')}
        >
          Skills
        </li>
        <li
          className={`text-Grey cursor-pointer ${activeLink === 'design' ? 'active' : ''}`}
          onClick={() => handleLinkClick('design')}
        >
          Design
        </li>
        <li
          className={`text-Grey cursor-pointer ${activeLink === 'web-development' ? 'active' : ''}`}
          onClick={() => handleLinkClick('web-development')}
        >
          Web Development
        </li>
        <li
          className={`text-Grey cursor-pointer ${activeLink === 'mobile-development' ? 'active' : ''}`}
          onClick={() => handleLinkClick('mobile-development')}
        >
          Mobile Development
        </li>
      </ul>
    </div>
  );
}

export default Filter;
