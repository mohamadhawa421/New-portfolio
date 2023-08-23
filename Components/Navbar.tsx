import React from 'react'
import Image from 'next/image'
import Logo from "../public/Images/Logo.svg"
import Link from 'next/link'

function Navbar() {
  return (
    <div className='flex items-center justify-between w-full'>
        <Image
        src={Logo}
        alt='logo'/>
        
        <ul className='flex w-[15rem] justify-between items-center text-white font-light text-sm '>
            <li className='text-Grey'><Link href={"#services"}>Services</Link></li>
            <li className='text-Grey'>Works</li>
            <li className='text-Grey'>Contact me</li>
        </ul>
    </div>
  )
}

export default Navbar