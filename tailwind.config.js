/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Copperplate"', '"Copperplate Gothic Light"', '"Times New Roman"', 'serif'],
        body: ['"Palatino Linotype"', '"Book Antiqua"', 'Palatino', '"Times New Roman"', 'serif'],
      },
      colors: {
        espresso: '#3b2f2a',
        caramel: '#d98c5f',
        cocoa: '#7b4e2b',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.9s ease-out both',
        'float-slow': 'floatSlow 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

