import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './Components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily:{
        sans : ['var(--font-poppins)']
      },
      colors: {
        smokeWhite : "#FFFAFF",
        pink:"#176B87",
        lightblack : "#25282B",
        grey : "#828282",
        lightpink : "#FFD8E7",
        lightyellow : "#FFE9C0",
        lightorange : "#FDEEEA",
        lightbeij : "#F5F0E6",
        lightgreen : "#9CC6C3",
        lightbrown :"#FCE3CF",
      },
      
    },
  },
  plugins: [],
}
export default config
