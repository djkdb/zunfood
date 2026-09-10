/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MEALGAME palette — bright blue / white / navy with yellow-orange pop
        navy: {
          50: '#eef2ff',
          100: '#dbe3f8',
          700: '#25335c',
          800: '#1a2547',
          900: '#111a33',
          950: '#0a1024',
        },
        brand: {
          50: '#eff8ff',
          100: '#d9eeff',
          200: '#b8e0ff',
          300: '#85ceff',
          400: '#4bb3ff',
          500: '#2196f3',
          600: '#0f76d9',
          700: '#0d5eb0',
          800: '#114f8d',
          900: '#144374',
        },
        pop: {
          300: '#ffd75e',
          400: '#ffc21e',
          500: '#ffa800',
          600: '#f58200',
          700: '#d96500',
        },
        mint: '#28d9a3',
        coral: '#ff5d6c',
        grape: '#8b5cf6',
      },
      fontFamily: {
        sans: ['Pretendard', 'Pretendard Variable', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        pop: '0 6px 0 0 rgba(0,0,0,0.16)',
        'pop-sm': '0 4px 0 0 rgba(0,0,0,0.16)',
        card: '0 10px 30px -12px rgba(17,26,51,0.45)',
        glow: '0 0 42px -6px rgba(75,179,255,0.65)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px) rotate(-1deg)' },
          '40%': { transform: 'translateX(6px) rotate(1deg)' },
          '60%': { transform: 'translateX(-4px) rotate(-0.6deg)' },
          '80%': { transform: 'translateX(4px) rotate(0.6deg)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'pop-in': 'pop-in 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        shake: 'shake 500ms ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
