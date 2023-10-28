import Image from "next/image"
import Flexbox from "./Flexbox"

export default function Card({color,image,isMobile}:any) {
  return (
    <Flexbox justify="center" align="center" className={`${isMobile ? "w-[360px] h-[360px]" : "w-[560px] h-[560px]" } ${color} rounded-3xl py-5`}>
        <Image
        className={`${isMobile ? "w-[360px]" : ""}` }
        src={image}
        alt="project"
        quality={100}
        height={540}
        />
    </Flexbox>
  )
}
