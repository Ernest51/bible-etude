/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",       // ton fichier principal
    "./public/**/*.html",        // tous les autres éventuels fichiers HTML dans /public
    "./src/**/*.{js,ts,jsx,tsx}",// JS/TS/React si tu en ajoutes
    "./api/**/*.{js,ts}"         // inclut les fonctions serverless
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
        },
        slate: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        }
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        md: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
        lg: "0 10px 20px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
  ],
};
