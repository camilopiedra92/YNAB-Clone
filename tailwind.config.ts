import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                border: "rgba(255, 255, 255, 0.10)",
                input: "rgba(255, 255, 255, 0.10)",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "#137fec",
                    foreground: "hsl(var(--primary-foreground))",
                    50: '#e8f4fd',
                    100: '#c5e3fa',
                    200: '#9dd0f6',
                    300: '#6bb8f0',
                    400: '#3ea1e9',
                    500: '#137fec',
                    600: '#0f6ad0',
                    700: '#0c55a8',
                    800: '#094182',
                    900: '#072e5e',
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    'accent-foreground': "hsl(var(--sidebar-accent-foreground))",
                    border: "var(--sidebar-border)",
                    primary: "hsl(var(--sidebar-primary))",
                    'primary-foreground': "hsl(var(--sidebar-primary-foreground))",
                    ring: "hsl(var(--sidebar-ring))",
                },
                ynab: {
                    blue: "hsl(var(--ynab-blue))",
                    green: "hsl(var(--ynab-green))",
                    red: "hsl(var(--ynab-red))",
                    yellow: "hsl(var(--ynab-yellow))",
                },
                glass: {
                    panel: "var(--glass-panel-bg)",
                    border: "var(--glass-panel-border)",
                    row: "var(--glass-row-bg)",
                    'row-hover': "var(--glass-row-hover)",
                }
            },
            fontFamily: {
                display: ['Manrope', 'sans-serif'],
                sans: ['Manrope', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: "0.5rem",
                lg: "1rem",
                md: "0.75rem",
                sm: "0.375rem",
                xl: "1.5rem",
                '2xl': "2rem",
                'full': "9999px",
            },
            boxShadow: {
                /* Glass shadows */
                'glass': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                'glass-lg': '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
                'glass-glow-green': '0 0 15px -3px rgba(74, 222, 128, 0.2)',
                'glass-glow-red': '0 0 15px -3px rgba(248, 113, 113, 0.2)',
                'glass-glow-primary': '0 0 15px -3px rgba(19, 127, 236, 0.3)',
                'premium': '0 8px 24px rgba(0, 0, 0, 0.3)',
                'premium-hover': '0 16px 40px rgba(0, 0, 0, 0.35)',
            },
            backdropBlur: {
                xs: '2px',
            },
            backgroundImage: {
                'gradient-premium': 'linear-gradient(135deg, #137fec 0%, #7c3aed 100%)',
            },
            animation: {
                'subtle-float': 'subtle-float 3s ease-in-out infinite',
                'blob-drift': 'blob-drift 10s ease-in-out infinite',
            },
            keyframes: {
                'subtle-float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                },
                'blob-drift': {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.95)' },
                },
            }
        },
    },
    plugins: [],
};

export default config;
