const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  purge: [
    "src/**/*.js",
    "src/**/*.jsx",
    "src/**/*.ts",
    "src/**/*.tsx",
    "public/**/*.html",
  ],
  darkMode: "media",
  theme: {
    extend: {
      cursor: {
        grab: "grab",
        grabbing: "grabbing",
      },
      width: {
        26: "6.5rem",
        27: "6.75rem",
      },
      maxWidth: {
        "1/4": "25%",
        "1/3": "33.33%",
        "1/2": "50%",
        "3/4": "75%",
      },
      maxHeight: {
        "almost-full": "90vh",
      },
      minWidth: {
        lg: "32rem",
        xl: "36rem",
      },
      screens: {
        tall: { raw: "(min-height: 700px)" },
      },
      flexGrow: {
        0: 0,
        1: 1,
        2: 2,
        DEFAULT: 1,
      },
      flex: {
        2: "2 2 0%",
      },
      spacing: {
        144: "36rem",
        128: "32rem",
        160: "40rem",
      },
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          300: "rgb(71,163,220)",
          400: "rgb(61,153,210)",
          500: "rgb(46, 115, 182)",
          600: "rgb(36, 105, 172)",
          700: "rgb(31, 41, 98)",
          // 700: "#2643a2",
          800: "rgb(58 73 101)",
          900: "rgb(0 91 179)",
        },
        secondary: {
          300: defaultTheme.colors.gray["500"],
          500: defaultTheme.colors.gray["800"],
        },
        "cool-gray": {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        "deep-blue": {
          500: "#373c4e",
        },
      },
    },
  },
  variants: {
    extend: {
      scale: ["active"],
      padding: ["hover"],
      display: ["group-hover"],
    },
    space: ["responsive", "direction"],
    inset: ["responsive", "direction"],
    padding: ["responsive", "direction"],
    textAlign: ["responsive", "direction"],
    borderRadius: ["responsive", "direction"],
    translate: ["responsive", "direction"],
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
    require("tailwindcss-dir")(),
  ],
  // plugins: [require("@tailwindcss/ui")],
};
