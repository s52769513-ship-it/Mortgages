/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
        heading: ['Heebo', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
          subtle: 'rgb(var(--ink-subtle) / <alpha-value>)',
        },
        steel: {
          100: 'rgb(var(--steel-100) / <alpha-value>)',
          200: 'rgb(var(--steel-200) / <alpha-value>)',
          300: 'rgb(var(--steel-300) / <alpha-value>)',
          400: 'rgb(var(--steel-400) / <alpha-value>)',
          500: 'rgb(var(--steel-500) / <alpha-value>)',
          600: 'rgb(var(--steel-600) / <alpha-value>)',
          700: 'rgb(var(--steel-700) / <alpha-value>)',
          800: 'rgb(var(--steel-800) / <alpha-value>)',
          900: 'rgb(var(--steel-900) / <alpha-value>)',
        },
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          tint: 'rgb(var(--ok-tint) / <alpha-value>)',
          ink: 'rgb(var(--ok-ink) / <alpha-value>)',
        },
        busy: {
          DEFAULT: 'rgb(var(--busy) / <alpha-value>)',
          tint: 'rgb(var(--busy-tint) / <alpha-value>)',
          ink: 'rgb(var(--busy-ink) / <alpha-value>)',
        },
        wait: {
          DEFAULT: 'rgb(var(--wait) / <alpha-value>)',
          tint: 'rgb(var(--wait-tint) / <alpha-value>)',
          ink: 'rgb(var(--wait-ink) / <alpha-value>)',
        },
        urgent: {
          DEFAULT: 'rgb(var(--urgent) / <alpha-value>)',
          tint: 'rgb(var(--urgent-tint) / <alpha-value>)',
          ink: 'rgb(var(--urgent-ink) / <alpha-value>)',
        },
        // Brand accent from the logo mark. Deliberately not a status colour —
        // nothing in a record ever means "gold".
        gold: {
          DEFAULT: 'rgb(var(--gold) / <alpha-value>)',
          tint: 'rgb(var(--gold-tint) / <alpha-value>)',
          ink: 'rgb(var(--gold-ink) / <alpha-value>)',
        },
        rail: 'rgb(var(--neutral-rail) / <alpha-value>)',
      },
      borderColor: {
        // Two distinct hairlines: .10 separates regions, .09 separates rows.
        DEFAULT: 'rgb(var(--line) / 0.10)',
        hair: 'rgb(var(--line) / 0.10)',
        row: 'rgb(var(--line) / 0.09)',
        field: 'rgb(var(--line) / 0.18)',
      },
      borderRadius: {
        // "A larger element is rounder; a small one stays crisp."
        sm: '6px',
        DEFAULT: '10px',
        md: '10px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        surface: '0 1px 2px rgb(var(--ink) / 0.04)',
        raised: '0 1px 2px rgb(var(--ink) / 0.04), 0 8px 24px rgb(var(--ink) / 0.06)',
        modal: '0 20px 60px rgb(var(--ink) / 0.16)',
        button: '0 1px 2px rgb(var(--steel-800) / 0.22)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        micro: '120ms',
        base: '180ms',
        overlay: '220ms',
        slow: '400ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'overlay-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        ring: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-12deg)' },
          '40%': { transform: 'rotate(10deg)' },
          '60%': { transform: 'rotate(-6deg)' },
          '80%': { transform: 'rotate(4deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'overlay-in': 'overlay-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        ring: 'ring 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
