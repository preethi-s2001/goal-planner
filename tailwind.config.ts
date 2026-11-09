import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#EEF0FF",
          100: "#E0E4FE",
          200: "#C7CEFC",
          300: "#9FA8F8",
          400: "#737BF0",
          500: "#504DE4",
          600: "#3D36CA",
          700: "#312A9E",
          800: "#262274",
          900: "#1E1B4B",
          950: "#121033",
          DEFAULT: "#1E1B4B",
        },
        accent: {
          50: "#FEF4F0",
          100: "#FDE8E1",
          200: "#FBD1C3",
          300: "#F8B19C",
          400: "#F5876B",
          500: "#F4623A",
          600: "#E04920",
          700: "#B83514",
          800: "#912D15",
          900: "#782916",
          DEFAULT: "#F4623A",
        },
        surface: {
          DEFAULT: "#FAF7F2",
          card: "#FFFFFF",
          border: "#EAE6DF",
          subtle: "#F4F0E8",
        },
        brand: {
          50: "#EEF0FF",
          100: "#E0E4FE",
          200: "#C7CEFC",
          300: "#9FA8F8",
          400: "#737BF0",
          500: "#1E1B4B",
          600: "#1E1B4B",
          700: "#17143B",
          800: "#121033",
          900: "#0D0B24",
          950: "#070614",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
        sans: ["var(--font-sans)", "DM Sans", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
