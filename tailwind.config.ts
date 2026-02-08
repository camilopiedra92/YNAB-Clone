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
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    50: '#f0f3f7',
                    100: '#d9e1ec',
                    200: '#b8c9dc',
                    300: '#90aac6',
                    400: '#7895b3',
                    500: '#6082b6',
                    600: '#4e6d9a',
                    700: '#3f587e',
                    800: '#354a68',
                    900: '#2d3e57',
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
                    border: "hsl(var(--sidebar-border))",
                    primary: "hsl(var(--sidebar-primary))",
                    'primary-foreground': "hsl(var(--sidebar-primary-foreground))",
                    ring: "hsl(var(--sidebar-ring))",
                },
                ynab: {
                    blue: "hsl(var(--ynab-blue))",
                    green: "hsl(var(--ynab-green))",
                    red: "hsl(var(--ynab-red))",
                    yellow: "hsl(var(--ynab-yellow))",
                }
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "calc(var(--radius) + 4px)",
                '2xl': "calc(var(--radius) + 8px)",
            },
            boxShadow: {
                /* Neumorphic shadows */
                'neu-sm': '3px 3px 8px 0 var(--neu-dark), -3px -3px 8px 0 var(--neu-light)',
                'neu-md': '6px 6px 14px 0 var(--neu-dark), -6px -6px 14px 0 var(--neu-light)',
                'neu-lg': '10px 10px 24px 0 var(--neu-dark-strong), -10px -10px 24px 0 var(--neu-light-strong)',
                'neu-xl': '14px 14px 30px 0 var(--neu-dark-strong), -14px -14px 30px 0 var(--neu-light-strong)',
                'neu-inset': 'inset 3px 3px 6px 0 var(--neu-dark), inset -3px -3px 6px 0 var(--neu-light)',
                'neu-inset-sm': 'inset 2px 2px 4px 0 var(--neu-dark), inset -2px -2px 4px 0 var(--neu-light)',
                'neu-flat': 'none',
                /* Legacy compat */
                'premium': '6px 6px 14px 0 var(--neu-dark), -6px -6px 14px 0 var(--neu-light)',
                'premium-hover': '10px 10px 24px 0 var(--neu-dark-strong), -10px -10px 24px 0 var(--neu-light-strong)',
            },
            backgroundImage: {
                'gradient-premium': 'linear-gradient(135deg, #6082B6 0%, #7895B3 50%, #90AAC6 100%)',
            },
            animation: {
                'subtle-float': 'subtle-float 3s ease-in-out infinite',
            },
            keyframes: {
                'subtle-float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                }
            }
        },
    },
    plugins: [],
};

export default config;
