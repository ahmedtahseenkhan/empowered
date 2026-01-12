/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#4A148C',
                    50: '#F3E5F5',
                    100: '#E1BEE7',
                    200: '#CE93D8',
                    300: '#BA68C8',
                    400: '#AB47BC',
                    500: '#9C27B0',
                    600: '#8E24AA',
                    700: '#7B1FA2',
                    800: '#6A1B9A',
                    900: '#4A148C',
                },
                secondary: {
                    DEFAULT: '#8B55CC',
                    50: '#F3E5F5',
                    100: '#E1BEE7',
                    200: '#CE93D8',
                    300: '#BA68C8',
                    400: '#AB47BC',
                    500: '#8B55CC',
                    600: '#7E4DBF',
                    700: '#6D28D9',
                    800: '#5B21B6',
                    900: '#4A148C',
                },
                accent: {
                    DEFAULT: '#DD5D00', // Updated to match emplearnings.com
                    50: '#FFF3E0',
                    100: '#FFE0B2',
                    200: '#FFCC80',
                    300: '#FFB74D',
                    400: '#FFA726',
                    500: '#FF9800',
                    600: '#FB8C00',
                    700: '#F57C00',
                    800: '#EF6C00',
                    900: '#DD5D00', // Updated to match emplearnings.com
                },
                empoweredFlag: "#4A148C",
                empoweredFlagLight: "#e3e3fa",
                gold: {
                    500: "#f59e0b",
                    600: "#d97706",
                },
            },
            fontSize: {
                // Custom font sizes from emplearnings.com
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['1rem', { lineHeight: '1.5rem' }],
                'lg': ['1.125rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
                '5xl': ['3rem', { lineHeight: '1' }],
                '6xl': ['3.75rem', { lineHeight: '1' }],
            },
            fontFamily: {
                sans: ['Poppins', 'system-ui', 'sans-serif'],
                poppins: ['Poppins', 'sans-serif'],
            },
            borderRadius: {
                'xl': '1rem',
                '2xl': '1.5rem',
                '3xl': '2rem',
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
                'gradient-primary': 'linear-gradient(135deg, #4A148C 0%, #8B55CC 100%)',
                'gradient-accent': 'linear-gradient(135deg, #DD5D00 0%, #FFA726 100%)',
            },
            boxShadow: {
                "custom-right-bottom": "10px 10px 15px #4A148C",
                "even-xl": "0 0 20px rgba(0, 0, 0, 0.25)",
                'glass': '0 8px 32px 0 rgba(74, 20, 140, 0.1)',
                'glass-lg': '0 12px 48px 0 rgba(74, 20, 140, 0.15)',
            },
            backdropBlur: {
                xs: '2px',
            },
            screens: {
                // Add a custom screen size greater than 1533px
                xxl: "1534px", // Custom screen for widths >= 1534px
                ultrawide: "1920px", // Custom screen for widths >= 1920px
                nxl: "1150px",
                xs: "500px",
                xss: "400px",
            },
        },

        transitionProperty: {
            "grid-rows": "grid-template-rows",
        },
    },
    plugins: [],
}
