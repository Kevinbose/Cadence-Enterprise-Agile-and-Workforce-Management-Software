/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        jira: {
          page: '#F4F5F7',
          card: '#FFFFFF',
          border: '#DFE1E6',
          text: '#172B4D',
          muted: '#6B778C',
          input: '#FAFBFC',
        },
        yakkay: {
          blue: '#0B89C9',
          'blue-hover': '#0A75A8',
          green: '#35A062',
        },
        alert: {
          bg: '#FFEBE6',
          text: '#DE350B',
          border: '#FFBDAD',
        },
      },
      boxShadow: {
        card: '0 4px 8px -2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
};
