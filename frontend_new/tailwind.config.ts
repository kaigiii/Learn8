import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#58CC02",
          "green-dark": "#46a302",
          coral: "#E8734A",
          "coral-dark": "#d4623c",
          teal: "#7AC7C4",
          "teal-light": "#B8E6E3",
          "teal-bg": "#E8F5F4",
          gray: {
            50: "#F7F7F7",
            100: "#EEEEEE",
            200: "#E2E2E2",
            300: "#CBCBCB",
            400: "#AFAFAF",
            500: "#6B6B6B",
            600: "#545454",
            700: "#333333",
          },
        },
      },
      fontFamily: {
        heading: ["'Nunito'", "sans-serif"],
        body: ["'Open Sans'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
