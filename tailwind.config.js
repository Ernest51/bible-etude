/** @type {import('tailwindcss').Config} */
module.exports = {
  // IMPORTANT : on scanne bien le dossier /public et ton JS
  content: [
    "./public/**/*.html",
    "./public/**/*.js",
    "./src/**/*.js"
  ],
  theme: {
    extend: {}
  },
  plugins: []
}
