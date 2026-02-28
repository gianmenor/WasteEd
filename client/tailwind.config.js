/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideDown: {
          from: {
            opacity: '0',
            transform: 'translateY(-10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeInDown: {
          from: {
            opacity: '0',
            transform: 'translateY(-20px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeInUp: {
          from: {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideIn: {
          from: {
            opacity: '0',
            transform: 'scale(0.9) translateY(-20px)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1) translateY(0)',
          },
        },
        pulseRing: {
          '0%, 100%': {
            transform: 'translate(-50%, -50%) scale(1)',
            opacity: '0.7',
          },
          '50%': {
            transform: 'translate(-50%, -50%) scale(1.2)',
            opacity: '0.3',
          },
        },
        wasteIconPulse: {
          '0%, 100%': {
            opacity: '0.2',
            transform: 'translate(-50%, -50%) scale(1)',
          },
          '50%': {
            opacity: '0.4',
            transform: 'translate(-50%, -50%) scale(1.1)',
          },
        },
        binFillUp: {
          from: { height: '0' },
          to: { height: '100%' },
        },
        overflow: {
          from: {
            opacity: '0',
            transform: 'translateX(-50%) scale(0)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(-50%) scale(1)',
          },
        },
        skeletonPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fillBar: {
          from: { width: '0%' },
          to: { width: 'var(--bar-width)' },
        },
        skeletonLoading: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        slideDown: 'slideDown 0.2s ease',
        fadeInDown: 'fadeInDown 0.6s ease-out',
        fadeInUp: 'fadeInUp 0.6s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        pulseRing: 'pulseRing 2s infinite',
        wasteIconPulse: 'wasteIconPulse 2s infinite',
        binFillUp: 'binFillUp 2s ease-out',
        overflow: 'overflow 1s ease-out 1.5s both',
        skeletonPulse: 'skeletonPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        fillBar: 'fillBar 1.5s ease-out',
        skeletonLoading: 'skeletonLoading 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}