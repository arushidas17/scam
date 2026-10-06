/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces — near-black navy, rising in lightness
        base: {
          DEFAULT: '#070B14',
          950: '#070B14',
          900: '#0A0F1C',
          800: '#0E1526',
          700: '#131C31',
          600: '#1A243D',
        },
        // Hairline borders, meant to be used at low opacity
        hairline: {
          DEFAULT: 'rgba(148, 174, 214, 0.12)',
          strong: 'rgba(148, 174, 214, 0.22)',
        },
        // Single accent — electric cyan-blue
        accent: {
          DEFAULT: '#2BD6FF',
          50: '#EAFBFF',
          100: '#CAF4FF',
          200: '#9BEAFF',
          300: '#63DDFF',
          400: '#2BD6FF',
          500: '#0FB8E6',
          600: '#0693BB',
          700: '#0A7394',
          800: '#0E5C76',
          900: '#114C63',
        },
        // Text ramp
        ink: {
          DEFAULT: '#EEF4FF',
          primary: '#EEF4FF',
          secondary: '#A7B4CB',
          muted: '#8793AD',
          faint: '#7382A0',
        },
        // RISK SEMANTICS ONLY — never decorative
        risk: {
          suspicious: '#FF4D5E',
          'suspicious-dim': 'rgba(255, 77, 94, 0.12)',
          'suspicious-edge': 'rgba(255, 77, 94, 0.35)',
          review: '#FFB224',
          'review-dim': 'rgba(255, 178, 36, 0.12)',
          'review-edge': 'rgba(255, 178, 36, 0.35)',
          normal: '#2CE69B',
          'normal-dim': 'rgba(44, 230, 155, 0.12)',
          'normal-edge': 'rgba(44, 230, 155, 0.35)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.05rem, 4.6vw, 3.1rem)', { lineHeight: '1.04', letterSpacing: '-0.035em', fontWeight: '600' }],
        'display-lg': ['clamp(1.8rem, 4vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-md': ['clamp(1.55rem, 3vw, 2.3rem)', { lineHeight: '1.14', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-sm': ['clamp(1.35rem, 2.4vw, 1.6rem)', { lineHeight: '1.22', letterSpacing: '-0.02em', fontWeight: '600' }],
        eyebrow: ['0.75rem', { lineHeight: '1', letterSpacing: '0.16em', fontWeight: '500' }],
      },
      spacing: {
        gutter: '1rem',
        section: '5.5rem',
        'section-lg': '7.5rem',
      },
      maxWidth: {
        shell: '76rem',
        prose: '42rem',
      },
      borderRadius: {
        card: '14px',
        panel: '18px',
        pill: '999px',
      },
      boxShadow: {
        raised: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -12px rgba(0,0,0,0.7)',
        panel: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 28px 70px -24px rgba(0,0,0,0.85)',
        'accent-glow': '0 0 0 1px rgba(43,214,255,0.3), 0 10px 36px -10px rgba(43,214,255,0.45)',
        'focus-ring': '0 0 0 2px #070B14, 0 0 0 4px #2BD6FF',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgba(148,174,214,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148,174,214,0.055) 1px, transparent 1px)',
        'dot-faint': 'radial-gradient(rgba(148,174,214,0.13) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '56px 56px',
        dot: '22px 22px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        snap: '180ms',
        base: '320ms',
        slow: '600ms',
      },
      keyframes: {
        'sweep-x': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(220%)' } },
      },
      animation: { 'sweep-x': 'sweep-x 2.4s cubic-bezier(0.16,1,0.3,1) infinite' },
    },
  },
  plugins: [],
}
