# Accessibility conformance report — WCAG 2.1 AA

> DESC evidence (CLAUDE.md §9.4, §11.3, §17). Update whenever tokens or motion change.

## Colour contrast — palette option A "Direction sign" (2026-10-01)

Every text/background token pair used by the interface, computed with the WCAG 2.1
relative-luminance formula from the values in `shared/design-tokens/design-tokens.css`.
Threshold: 4.5:1 for text, 3:1 for graphical objects (chart lines and bars). **Result: all pairs pass.**

**light**

| Text | Background | Ratio | Result |
|---|---|---|---|
| `ink` #1A1D18 | `surface` #FFFFFF | 17.03:1 | Pass |
| `ink` #1A1D18 | `canvas` #F1F2EE | 15.15:1 | Pass |
| `ink-muted` #50574D | `surface` #FFFFFF | 7.47:1 | Pass |
| `ink-muted` #50574D | `surface-sunken` #E8EAE4 | 6.16:1 | Pass |
| `ink-faint` #656C62 | `surface` #FFFFFF | 5.42:1 | Pass |
| `ink-faint` #656C62 | `canvas` #F1F2EE | 4.82:1 | Pass |
| `on-primary` #1A1D18 | `primary` #F2C230 | 10.17:1 | Pass |
| `primary-ink` #6E5100 | `surface` #FFFFFF | 7.39:1 | Pass |
| `primary-ink` #6E5100 | `primary-soft` #FBF3D6 | 6.65:1 | Pass |
| `ok` #2E6A3E | `surface` #FFFFFF | 6.47:1 | Pass |
| `warn` #7E5400 | `surface` #FFFFFF | 6.66:1 | Pass |
| `critical` #A8241C | `surface` #FFFFFF | 7.16:1 | Pass |
| `critical` #A8241C | `critical-soft` #F6E0DE | 5.67:1 | Pass |
| `warn` #7E5400 | `warn-soft` #F6ECD6 | 5.67:1 | Pass |
| `sign-legend` #1A1D18 | `sign` #F2C230 | 10.17:1 | Pass |
| `gantry-ink` #4A3D0F | `gantry` #FBF3D6 | 9.61:1 | Pass |
| `gantry-muted` #6B5A1C | `gantry` #FBF3D6 | 6.09:1 | Pass |
| `sign-on-stop` #FFFFFF | `sign-stop` #B3261E | 6.54:1 | Pass |
| `chart-primary (graphic, 3:1)` #A07800 | `surface` #FFFFFF | 4.05:1 | Pass |

**dark**

| Text | Background | Ratio | Result |
|---|---|---|---|
| `ink` #E4E9EE | `surface` #161D25 | 13.90:1 | Pass |
| `ink` #E4E9EE | `canvas` #0F141A | 15.14:1 | Pass |
| `ink-muted` #9AA6B2 | `surface` #161D25 | 6.85:1 | Pass |
| `ink-muted` #9AA6B2 | `surface-sunken` #0B1015 | 7.71:1 | Pass |
| `ink-faint` #8592A0 | `surface` #161D25 | 5.35:1 | Pass |
| `ink-faint` #8592A0 | `canvas` #0F141A | 5.83:1 | Pass |
| `on-primary` #121619 | `primary` #F2C230 | 10.86:1 | Pass |
| `primary-ink` #F2C230 | `surface` #161D25 | 10.14:1 | Pass |
| `primary-ink` #F2C230 | `primary-soft` #2A2416 | 9.20:1 | Pass |
| `ok` #72C189 | `surface` #161D25 | 7.85:1 | Pass |
| `warn` #E3B24D | `surface` #161D25 | 8.69:1 | Pass |
| `critical` #F2847D | `surface` #161D25 | 6.77:1 | Pass |
| `critical` #F2847D | `critical-soft` #2E1A1C | 6.54:1 | Pass |
| `sign-legend` #F2C230 | `sign` #0B1015 | 11.40:1 | Pass |
| `gantry-ink` #E4E9EE | `gantry` #0B1015 | 15.64:1 | Pass |
| `gantry-muted` #9AA6B2 | `gantry` #0B1015 | 7.71:1 | Pass |
| `sign-on-stop` #FFFFFF | `sign-stop` #C9362C | 5.19:1 | Pass |

Notes:

- `ink-faint` on `canvas` (4.82:1 light) is the tightest text pair. Do not lighten `ink-faint`.
- Light-theme `--primary` (#F2C230) is only ever a fill under dark text (10.17:1). The accent as
  text uses `--primary-ink` (7.39:1); as a chart mark, `--chart-primary` (4.05:1, graphics need 3:1).
- `gold` (#C99A0E) is used only for sign borders and rules, never as text.

## Colour is never the only signal

- Stock status: 6px square **plus** a text label (`StockStatusIndicator`).
- Sign types differ in shape as well as colour: the location sign has a yellow border,
  the stop sign an inset white outline, and the go sign is a solid yellow field.

## Motion

All animation (page entry, sign swing, split-flap designator, count-up figures, growing
bars, sliding rail indicator, drawer/modal entry) respects `prefers-reduced-motion: reduce`:

- CSS: duration tokens drop to 0ms and a global rule zeroes animation and transition durations.
- JS: `SplitFlapText` and `CountUpNumber` check the media query and render the final value at once.
- The split-flap and count-up components expose the final value to screen readers through
  `sr-only` text, so assistive technology never hears the intermediate characters.

## Automated axe-core pass (2026-10-01)

`frontend/e2e/accessibility.spec.ts` runs axe-core (WCAG 2.0/2.1 A and AA) on all 16 screens in
English/light and Arabic/dark, plus the sign-in screen. Run with `npm run test:e2e` in `frontend/`.

- First run: 2 issue types on 3 screens, identical in both modes. 5 filter dropdowns had no
  accessible name (Movements, Products, Audit log), and 2 scrolling tables could not be reached
  by keyboard. Both fixed (`aria-label`; scrolling region with `role="region"`, a label and `tabIndex=0`).
- Second run: **0 violations** on every screen in both modes. No colour-contrast failures.

## Not yet done

- Screens behind interactions (modals, drawers, the two-step sign-in step) are not yet in the axe run.
- Manual keyboard walk-through and a screen-reader pass (NVDA / VoiceOver), which axe cannot replace.
- Tablet widths (768 and 1024 px).
