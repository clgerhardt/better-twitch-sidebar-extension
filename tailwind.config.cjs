module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 20s linear infinite',
      },
      colors: {
        'custom-twitch': {
          'light-gray': '#26262c',
          'blue-gray': '#97ACBE',
        }
      }
    },
  },
  prefix: '',
  plugins: [],
}
