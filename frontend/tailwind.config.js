/**
 * Tailwind — custom token config, DEFAULT PALETTE DISABLED (CLAUDE.md §4, §9.2).
 * Colours resolve to the CSS custom properties defined in the shared design
 * tokens, so themes (light/dark) switch without recompiling classes.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replacing (not extending) colors removes the entire default palette.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      canvas: 'var(--canvas)',
      surface: 'var(--surface)',
      'surface-sunken': 'var(--surface-sunken)',
      hairline: 'var(--hairline)',
      'hairline-strong': 'var(--hairline-strong)',
      ink: 'var(--ink)',
      'ink-muted': 'var(--ink-muted)',
      'ink-faint': 'var(--ink-faint)',
      primary: 'var(--primary)',
      'primary-hover': 'var(--primary-hover)',
      'primary-soft': 'var(--primary-soft)',
      'on-primary': 'var(--on-primary)',
      gold: 'var(--gold)',
      'gold-soft': 'var(--gold-soft)',
      ok: 'var(--ok)',
      'ok-soft': 'var(--ok-soft)',
      warn: 'var(--warn)',
      'warn-soft': 'var(--warn-soft)',
      critical: 'var(--critical)',
      'critical-soft': 'var(--critical-soft)',
      info: 'var(--info)',
      focus: 'var(--focus)',
    },
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius-md)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
    },
    extend: {
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        '2xs': ['var(--text-2xs)', 'var(--leading-2xs)'],
        xs: ['var(--text-xs)', 'var(--leading-xs)'],
        sm: ['var(--text-sm)', 'var(--leading-sm)'],
        base: ['var(--text-base)', 'var(--leading-base)'],
        lg: ['var(--text-lg)', 'var(--leading-lg)'],
        xl: ['var(--text-xl)', 'var(--leading-xl)'],
        '2xl': ['var(--text-2xl)', 'var(--leading-2xl)'],
      },
    },
  },
  plugins: [],
};
