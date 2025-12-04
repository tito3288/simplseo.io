// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "#e5e7eb", // use a fallback gray or any valid value
        input: "#00bf63",
        ring: "#00bf63",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#00bf63",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "#00bf63",
          foreground: "hsl(var(--secondary-foreground))",
        },
      },
      animation: {
        'bounce-squash': 'bounce-squash 1s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-in-out',
        'fade-up': 'fade-up 0.6s ease-out forwards',
      },
      keyframes: {
        'bounce-squash': {
          '0%': { transform: 'translateY(0) scaleX(1) scaleY(1)' },
          '10%': { transform: 'translateY(-20px) scaleX(1.05) scaleY(0.95)' },
          '25%': { transform: 'translateY(-50px) scaleX(0.95) scaleY(1.05)' },
          '50%': { transform: 'translateY(0) scaleX(1.2) scaleY(0.8)' },
          '75%': { transform: 'translateY(-30px) scaleX(0.98) scaleY(1.02)' },
          '100%': { transform: 'translateY(0) scaleX(1) scaleY(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
