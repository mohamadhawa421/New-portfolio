import Navbar from '@/Components/Navbar'
import Image from 'next/image'
import Bulb from "../public/Images/bulb.png"
import Facebook from "../public/Images/fb.svg"
import Instagram from "../public/Images/instagram.svg"
import Github from "../public/Images/github.svg"
import LinkedIn from "../public/Images/linkedin.svg"
import Work from '@/Components/Work'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-24">
      <Navbar/>
      <div className='flex justify-between w-full py-32'>
        <div className='flex flex-col justify-between h-full gap-6'>
          <h1 className='text-8xl text-white w-[30rem] font-bold pt-4'>Mohamad Hawa</h1>
          <p className='text-white font-light text-xl w-[15rem]'>Web <span className='font-medium text-gold'>developer</span> and des<span className='font-medium text-gold'>ig</span>ner Based in Lebanon<span className='font-medium text-gold'>.</span></p>
          <p className='text-Grey font-light w-[18rem]'>Create and <span className='text-gold'>adorn</span> your online presence, user <span className='text-white'>interface</span> and <span className='text-white'>experience</span>.</p>
          <button className='hireme mt-4'>Hire me!</button>
          <div className='flex justify-between w-[10rem] mt-[1.5rem]'>
            <Image
            src={Facebook}
            alt='facebook'
            quality={100}
            width={32}/>
            
            <Image
            src={Instagram}
            alt='instagram'
            quality={100}
            width={32}/>
            <Image
            src={LinkedIn}
            alt='Linkedin'
            quality={100}
            width={32}/>
            <Image
            src={Github}
            alt='Github'
            quality={100}
            width={32}/>
          </div>
          
        </div>

      <div className=' relative flex items-center justify-center w-[500px] h-[500px]'>
        <div className='blob w-[500px] h-[500px] absolute'>
        <svg width="500" height="500" viewBox="0 0 562 435" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill="url(#paint0_linear_435_4)">

<animate attributeName='d'
dur="10000ms"
repeatCount="indefinite"
values='
M303.333 3.92758C371.506 5.83445 446.362 0.338922 495.524 36.8003C545.238 73.6715 549.204 131.802 547.43 184.967C545.714 236.415 521.393 282.122 485.885 325.703C435.144 387.981 398.434 478.784 303.333 484.565C207.928 490.365 148.314 408.015 89.5246 349.798C40.2471 301.001 -0.575993 246.8 0.787082 184.967C2.12855 124.114 34.3066 62.9616 96.6704 25.644C153.765 -8.52067 231.105 1.9073 303.333 3.92758Z;
M284.979 0.0060308C332.205 0.64552 358.267 51.7975 396.084 80.7272C446.309 119.149 520.978 132.894 538.995 194.326C560.069 266.181 540.238 349.382 491.259 405.236C440.322 463.321 361.279 483.565 284.979 483.993C208.209 484.424 130.246 463.536 76.4225 407.563C22.9784 351.985 -14.9874 269.127 6.43329 194.326C25.923 126.268 113.599 117.647 170.892 77.6779C210.125 50.3076 237.487 -0.637056 284.979 0.0060308Z;
M260.267 1.3276C331.725 -5.78655 386.341 53.3489 437.351 99.2451C488.618 145.373 546.829 194.233 547.419 259.695C548.011 325.463 497.112 381.885 440.266 422.786C389.711 459.16 324.487 460.343 260.267 466.301C184.022 473.376 95.1968 507.414 39.1963 460.001C-17.0775 412.356 -0.144343 327.881 16.2399 259.695C29.1298 206.051 78.8504 172.726 118.247 131.014C163.677 82.9153 190.815 8.24216 260.267 1.3276Z;
M303.333 3.92758C371.506 5.83445 446.362 0.338922 495.524 36.8003C545.238 73.6715 549.204 131.802 547.43 184.967C545.714 236.415 521.393 282.122 485.885 325.703C435.144 387.981 398.434 478.784 303.333 484.565C207.928 490.365 148.314 408.015 89.5246 349.798C40.2471 301.001 -0.575993 246.8 0.787082 184.967C2.12855 124.114 34.3066 62.9616 96.6704 25.644C153.765 -8.52067 231.105 1.9073 303.333 3.92758Z;'>
</animate>

</path>
<defs>
<linearGradient id="paint0_linear_435_4" x1="141.118" y1="15.4118" x2="551.554" y2="230.022" gradientUnits="userSpaceOnUse">
<stop stop-color="#FC2D80"/>
<stop offset="1" stop-color="#021750"/>
</linearGradient>
</defs>
</svg>



        </div>

        <div className='blob w-[500px] h-[500px] absolute blur-2xl'>
        <svg width="500" height="500" viewBox="0 0 562 435" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill="url(#paint0_linear_435_4)">

<animate attributeName='d'
dur="10000ms"
repeatCount="indefinite"
values='
M303.333 3.92758C371.506 5.83445 446.362 0.338922 495.524 36.8003C545.238 73.6715 549.204 131.802 547.43 184.967C545.714 236.415 521.393 282.122 485.885 325.703C435.144 387.981 398.434 478.784 303.333 484.565C207.928 490.365 148.314 408.015 89.5246 349.798C40.2471 301.001 -0.575993 246.8 0.787082 184.967C2.12855 124.114 34.3066 62.9616 96.6704 25.644C153.765 -8.52067 231.105 1.9073 303.333 3.92758Z;
M284.979 0.0060308C332.205 0.64552 358.267 51.7975 396.084 80.7272C446.309 119.149 520.978 132.894 538.995 194.326C560.069 266.181 540.238 349.382 491.259 405.236C440.322 463.321 361.279 483.565 284.979 483.993C208.209 484.424 130.246 463.536 76.4225 407.563C22.9784 351.985 -14.9874 269.127 6.43329 194.326C25.923 126.268 113.599 117.647 170.892 77.6779C210.125 50.3076 237.487 -0.637056 284.979 0.0060308Z;
M260.267 1.3276C331.725 -5.78655 386.341 53.3489 437.351 99.2451C488.618 145.373 546.829 194.233 547.419 259.695C548.011 325.463 497.112 381.885 440.266 422.786C389.711 459.16 324.487 460.343 260.267 466.301C184.022 473.376 95.1968 507.414 39.1963 460.001C-17.0775 412.356 -0.144343 327.881 16.2399 259.695C29.1298 206.051 78.8504 172.726 118.247 131.014C163.677 82.9153 190.815 8.24216 260.267 1.3276Z;
M303.333 3.92758C371.506 5.83445 446.362 0.338922 495.524 36.8003C545.238 73.6715 549.204 131.802 547.43 184.967C545.714 236.415 521.393 282.122 485.885 325.703C435.144 387.981 398.434 478.784 303.333 484.565C207.928 490.365 148.314 408.015 89.5246 349.798C40.2471 301.001 -0.575993 246.8 0.787082 184.967C2.12855 124.114 34.3066 62.9616 96.6704 25.644C153.765 -8.52067 231.105 1.9073 303.333 3.92758Z;'>
</animate>

</path>
<defs>
<linearGradient id="paint0_linear_435_4" x1="141.118" y1="15.4118" x2="551.554" y2="230.022" gradientUnits="userSpaceOnUse">
<stop stop-color="#FC2D80"/>
<stop offset="1" stop-color="#021750"/>
</linearGradient>
</defs>
</svg>



        </div>
      </div>
        
              </div>


      <Work/>


    </main>
  )
}
