import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './Components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        Grey : "rgba(255, 255, 255, 0.60)",
        gold : "#9D845A",
        darkblue : "071224"
      },
    },
  },
  plugins: [],
}
export default config
