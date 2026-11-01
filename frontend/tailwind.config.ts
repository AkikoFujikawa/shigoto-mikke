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
        background: "#F8F7FF",
        navy: "#183769",
        accent: "#FFD95A",
      },

      fontSize: {
        xs: "12px",
        sm: "14px",
        base: "16px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
      },

      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
      },

      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },

      boxShadow: {
        card: "0 4px 16px rgba(24, 55, 105, 0.08)",
      },

      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
    },
  },
  plugins: [],
};

export default config;
