import type { Config } from "tailwindcss";

function withOpacity(variableName: string) {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        'space-xs': '0.25rem', 'margin': '2rem', 'space-sm': '0.5rem', 'space-xl': '2.5rem', 'space-lg': '1.5rem',
        'margin-mobile': '1rem', 'space-md': '1rem', 'gutter': '1.5rem', 'gutter-mobile': '0.75rem'
      },
      fontFamily: {
        'title-md': ['Plus Jakarta Sans'], 'headline-lg-mobile': ['Plus Jakarta Sans'], 'label-sm': ['Plus Jakarta Sans'],
        'label-md': ['Plus Jakarta Sans'], 'body-lg': ['Plus Jakarta Sans'], 'body-md': ['Plus Jakarta Sans'],
        'headline-sm': ['Plus Jakarta Sans'], 'metric-stat': ['Plus Jakarta Sans'], 'headline-md': ['Plus Jakarta Sans'],
        'display-hero': ['Plus Jakarta Sans'], 'headline-lg': ['Plus Jakarta Sans'], 'body-sm': ['Plus Jakarta Sans']
      },
      colors: {
        "on-surface-variant":"#3d4947", "on-secondary-fixed-variant":"#3323cc", "on-primary-fixed":"#00201d",
        "surface-container-lowest":"#ffffff", "inverse-primary":"#6bd8cb", "on-secondary-fixed":"#0f0069",
        "primary":"#00685f", "tertiary":"#006947", "tertiary-fixed-dim":"#4edea3", "on-secondary":"#ffffff",
        "secondary":"#4b41e1", "secondary-fixed-dim":"#c3c0ff", "secondary-container":"#645efb",
        "surface-container-high":"#dce9ff", "error":"#ba1a1a", "outline-variant":"#bcc9c6", "background":"#f8f9ff",
        "outline":"#6d7a77", "surface-bright":"#f8f9ff", "primary-fixed-dim":"#6bd8cb", "surface-container":"#e5eeff",
        "surface-container-low":"#eff4ff", "surface-dim":"#cbdbf5", "error-container":"#ffdad6", "on-tertiary":"#ffffff",
        "tertiary-fixed":"#6ffbbe", "on-primary":"#ffffff", "on-primary-container":"#f4fffc", "inverse-on-surface":"#eaf1ff",
        "primary-container":"#008378", "on-tertiary-container":"#f5fff6", "tertiary-container":"#00855b",
        "on-secondary-container":"#fffbff", "on-error":"#ffffff", "inverse-surface":"#213145", "on-tertiary-fixed-variant":"#005236",
        "surface-variant":"#d3e4fe", "on-error-container":"#93000a", "surface-container-highest":"#d3e4fe",
        "on-primary-fixed-variant":"#005049", "on-background":"#0b1c30", "on-tertiary-fixed":"#002113",
        "surface":"#f8f9ff", "secondary-fixed":"#e2dfff", "primary-fixed":"#89f5e7", "on-surface":"#0b1c30",
        "surface-tint":"#006a61",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          foreground: "rgb(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          foreground: "rgb(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--info) / <alpha-value>)",
          foreground: "rgb(var(--info-foreground) / <alpha-value>)",
        },
        chart: {
          "1": "rgb(var(--chart-1) / <alpha-value>)",
          "2": "rgb(var(--chart-2) / <alpha-value>)",
          "3": "rgb(var(--chart-3) / <alpha-value>)",
          "4": "rgb(var(--chart-4) / <alpha-value>)",
          "5": "rgb(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "rgb(var(--background) / <alpha-value>)",
          foreground: "rgb(var(--foreground) / <alpha-value>)",
          primary: "rgb(var(--primary) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
