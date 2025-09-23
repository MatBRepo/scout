// tailwind.config.ts
import type { Config } from "tailwindcss"

const config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  // If you're on Tailwind v3.x, this is fine. If you ever move to v4, adjust plugins accordingly.
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
