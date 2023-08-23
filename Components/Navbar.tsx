"use client"
import React, {useState, useEffect} from 'react'
import Image from 'next/image'
import Logo from "../public/Images/Logo.svg"
import Link from 'next/link'

function Navbar() {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setScrolling(true);
      } else {
        setScrolling(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);


  return (
    <div className={`flex items-center justify-between w-full fixed px-24 py-10 z-20 ${scrolling ? "backdrop-blur-md" : ""}`}>
        <Image
        src={Logo}
        alt='logo'/>
        
        <ul className='flex w-[15rem] justify-between items-center text-white font-light text-sm '>
            <li className='text-Grey'><Link href={"#"}>Home</Link></li>
            <li className='text-Grey'><Link href={"#services"}>Services</Link></li>
            <li className='text-Grey'>Contact me</li>
        </ul>
    </div>
  )
}

export default Navbar