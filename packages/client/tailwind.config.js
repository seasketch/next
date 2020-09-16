const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  purge: [
    "src/**/*.js",
    "src/**/*.jsx",
    "src/**/*.ts",
    "src/**/*.tsx",
    "public/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          300: "rgb(71,163,220)",
          400: "rgb(61,153,210)",
          500: "rgb(46, 115, 182)",
          600: "rgb(36, 105, 172)",
        },
        secondary: {
          300: defaultTheme.colors.gray["500"],
          500: defaultTheme.colors.gray["800"],
        },
      },
    },
  },
  variants: {},
  plugins: [require("@tailwindcss/ui")],
};
