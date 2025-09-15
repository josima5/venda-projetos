/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-gold': '#c5a47e',
        'brand-gold-dark': '#b3916c',
        'brand-dark': '#212121',
        'brand-light-gold': '#fbf8f4',
        'brand-light-gold-border': '#f2e9dd',
      },
    },
  },
  plugins: [],
};
