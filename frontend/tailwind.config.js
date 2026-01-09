/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sky color palette (primary)
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8', // Dark mode primary
          500: '#0ea5e9',
          600: '#0284c7', // Light mode primary
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Emerald color palette (success)
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399', // Dark mode success
          500: '#10b981',
          600: '#059669', // Light mode success
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Amber color palette (warning)
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24', // Dark mode warning
          500: '#f59e0b',
          600: '#d97706', // Light mode warning
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Red color palette (error)
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171', // Dark mode error
          500: '#ef4444',
          600: '#dc2626', // Light mode error
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Theme-aware colors using CSS variables
        theme: {
          bg: 'rgb(var(--color-background) / <alpha-value>)',
          surface: 'rgb(var(--color-surface) / <alpha-value>)',
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
          'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
          'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
          border: 'rgb(var(--color-border) / <alpha-value>)',
          success: 'rgb(var(--color-success) / <alpha-value>)',
          warning: 'rgb(var(--color-warning) / <alpha-value>)',
          error: 'rgb(var(--color-error) / <alpha-value>)',
          info: 'rgb(var(--color-info) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // Additional spacing values for design system
        '18': '4.5rem', // 72px
        '88': '22rem', // 352px
        '128': '32rem', // 512px
      },
      animation: {
        // Fade animations
        'fade-in': 'fadeIn 200ms ease-in-out',
        'fade-out': 'fadeOut 200ms ease-in-out',
        'fade-in-up': 'fadeInUp 200ms ease-in-out',
        'fade-in-down': 'fadeInDown 200ms ease-in-out',
        
        // Slide animations
        'slide-in-right': 'slideInRight 200ms ease-in-out',
        'slide-in-left': 'slideInLeft 200ms ease-in-out',
        'slide-in-up': 'slideInUp 200ms ease-in-out',
        'slide-in-down': 'slideInDown 200ms ease-in-out',
        'slide-out-right': 'slideOutRight 200ms ease-in-out',
        'slide-out-left': 'slideOutLeft 200ms ease-in-out',
        
        // Pulse animations
        'pulse-slow': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        
        // Number counting animation
        'count-up': 'countUp 500ms ease-out',
        
        // Sidebar collapse animation
        'collapse': 'collapse 200ms ease-in-out',
        'expand': 'expand 200ms ease-in-out',
        
        // Toast animations
        'toast-enter': 'toastEnter 200ms ease-out',
        'toast-exit': 'toastExit 200ms ease-in',
        
        // Skeleton loading
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        
        // Spin (for loading spinners)
        'spin-slow': 'spin 1.5s linear infinite',
        'spin-fast': 'spin 0.5s linear infinite',
      },
      keyframes: {
        // Fade keyframes
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        
        // Slide keyframes
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        
        // Number counting
        countUp: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        
        // Collapse/Expand
        collapse: {
          '0%': { width: '16rem' },
          '100%': { width: '4rem' },
        },
        expand: {
          '0%': { width: '4rem' },
          '100%': { width: '16rem' },
        },
        
        // Toast
        toastEnter: {
          '0%': { opacity: '0', transform: 'translateY(-100%) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        toastExit: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-100%) scale(0.95)' },
        },
        
        // Skeleton loading
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
