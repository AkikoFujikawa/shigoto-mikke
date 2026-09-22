import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // メインカラー（画面設計.md §1 トーン：やわらかい紫系）
      colors: {
        brand: {
          DEFAULT: "#6C5CE1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
