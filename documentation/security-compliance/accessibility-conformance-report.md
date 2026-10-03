# Accessibility conformance report — WCAG 2.1 AA

> DESC evidence (CLAUDE.md §9.4, §11.3, §17). Update whenever tokens or motion change.

## Colour contrast — "Clay" edition (2026-10-03)

Every text/background token pair used by the interface, computed with the WCAG 2.1
relative-luminance formula from the values in `shared/design-tokens/design-tokens.css`.
Threshold: 4.5:1 for text, 3:1 for graphical objects (chart lines and bars). Clay relief
(the `--clay-*` shadows) is decoration only: no text or state depends on it. **Result: all pairs pass.**

**light**

| Text | Background | Ratio | Result |
|---|---|---|---|
| `ink` #1C2737 | `surface` #ECF1F6 | 13.25:1 | Pass |
| `ink` #1C2737 | `canvas` #D9E1EA | 11.41:1 | Pass |
| `ink` #1C2737 | `surface-sunken` #DEE5ED | 11.86:1 | Pass |
| `ink-muted` #465267 | `surface` #ECF1F6 | 6.94:1 | Pass |
| `ink-muted` #465267 | `surface-sunken` #DEE5ED | 6.21:1 | Pass |
| `ink-muted` #465267 | `canvas` #D9E1EA | 5.97:1 | Pass |
| `ink-faint` #56627A | `surface` #ECF1F6 | 5.40:1 | Pass |
| `ink-faint` #56627A | `canvas` #D9E1EA | 4.65:1 | Pass |
| `ink-faint` #56627A | `surface-sunken` #DEE5ED | 4.83:1 | Pass |
| `on-primary` #1C2737 | `primary` #F4C64A | 9.34:1 | Pass |
| `primary-ink` #6B4E00 | `surface` #ECF1F6 | 6.81:1 | Pass |
| `primary-ink` #6B4E00 | `primary-soft` #F8EBC2 | 6.50:1 | Pass |
| `ok` #1F6848 | `surface` #ECF1F6 | 5.90:1 | Pass |
| `ok` #1F6848 | `canvas` #D9E1EA | 5.08:1 | Pass |
| `ok` #1F6848 | `ok-soft` #D3ECDF | 5.37:1 | Pass |
| `warn` #7A5300 | `surface` #ECF1F6 | 6.03:1 | Pass |
| `warn` #7A5300 | `warn-soft` #F5E6C3 | 5.54:1 | Pass |
| `critical` #A1312A | `surface` #ECF1F6 | 6.18:1 | Pass |
| `critical` #A1312A | `critical-soft` #F5DCD8 | 5.39:1 | Pass |
| `ink` #1C2737 | `primary-soft` #F8EBC2 | 12.66:1 | Pass |
| `sign-legend` #1C2737 | `sign` #F4C64A | 9.34:1 | Pass |
| `gantry-ink` #FFFFFF | `gantry` #2A3A52 | 11.50:1 | Pass |
| `gantry-muted` #C3CEDD | `gantry` #2A3A52 | 7.23:1 | Pass |
| `sign` #F4C64A | `gantry` #2A3A52 | 7.13:1 | Pass |
| `sign-on-stop` #FFFFFF | `sign-stop` #B3362C | 6.03:1 | Pass |
| `chart-primary` (graphic, 3:1) #8F6A00 | `surface` #ECF1F6 | 4.37:1 | Pass |
| `chart-secondary` (graphic, 3:1) #5B7DA6 | `surface` #ECF1F6 | 3.75:1 | Pass |

**dark**

| Text | Background | Ratio | Result |
|---|---|---|---|
| `ink` #E7ECF3 | `surface` #253043 | 11.18:1 | Pass |
| `ink` #E7ECF3 | `canvas` #1B2230 | 13.42:1 | Pass |
| `ink` #E7ECF3 | `surface-sunken` #1F2838 | 12.47:1 | Pass |
| `ink-muted` #B3BDCC | `surface` #253043 | 6.99:1 | Pass |
| `ink-muted` #B3BDCC | `surface-sunken` #1F2838 | 7.80:1 | Pass |
| `ink-muted` #B3BDCC | `canvas` #1B2230 | 8.40:1 | Pass |
| `ink-faint` #98A3B5 | `surface` #253043 | 5.21:1 | Pass |
| `ink-faint` #98A3B5 | `canvas` #1B2230 | 6.25:1 | Pass |
| `ink-faint` #98A3B5 | `surface-sunken` #1F2838 | 5.81:1 | Pass |
| `on-primary` #1C2737 | `primary` #F4C64A | 9.34:1 | Pass |
| `primary-ink` #F4C64A | `surface` #253043 | 8.23:1 | Pass |
| `primary-ink` #F4C64A | `primary-soft` #3A3320 | 7.78:1 | Pass |
| `ok` #86D9B4 | `surface` #253043 | 7.96:1 | Pass |
| `ok` #86D9B4 | `canvas` #1B2230 | 9.56:1 | Pass |
| `ok` #86D9B4 | `ok-soft` #1F3B33 | 7.28:1 | Pass |
| `warn` #F2C26A | `surface` #253043 | 8.03:1 | Pass |
| `warn` #F2C26A | `warn-soft` #3A3120 | 7.74:1 | Pass |
| `critical` #F4A49C | `surface` #253043 | 6.72:1 | Pass |
| `critical` #F4A49C | `critical-soft` #41262A | 6.93:1 | Pass |
| `ink` #E7ECF3 | `primary-soft` #3A3320 | 10.57:1 | Pass |
| `sign-legend` #1C2737 | `sign` #F4C64A | 9.34:1 | Pass |
| `gantry-ink` #FFFFFF | `gantry` #121A27 | 17.46:1 | Pass |
| `gantry-muted` #B9C4D4 | `gantry` #121A27 | 9.90:1 | Pass |
| `sign` #F4C64A | `gantry` #121A27 | 10.83:1 | Pass |
| `sign-on-stop` #FFFFFF | `sign-stop` #C9443A | 4.80:1 | Pass |
| `chart-primary` (graphic, 3:1) #F4C64A | `surface` #253043 | 8.23:1 | Pass |
| `chart-secondary` (graphic, 3:1) #8FB0D6 | `surface` #253043 | 5.91:1 | Pass |

Notes:

- `ink-faint` and `ok` on `canvas` are the tightest light pairs. Do not lighten either.
- `--primary` (butter yellow) is only ever a fill under dark text. The accent as text uses
  `--primary-ink`; as a chart mark, `--chart-primary`.
- The gantry is navy clay in both themes, so the yellow sign tiles read the same day and night.
- `gold` is used only for rules, never as text.

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

## Overlays, keyboard and tablet (2026-10-02)

`frontend/e2e/accessibility-overlays.spec.ts` and `keyboard-and-tablet.spec.ts`:

- **axe on every overlay** (new product, import, new store room, bulk create, add supplier, add user,
  end-sessions confirmation, assistant panel) in English/light and Arabic/dark, and on both
  two-step sign-in screens (code entry and enrolment). First run: the location generator's
  labels were not linked to their fields. Fixed; now **0 violations**.
- **Keyboard only**: sign in, reach a menu item with Tab and open it with Enter, expand a
  storage tree branch, open a dialog, close it with Escape and land back on the opener — passes.
  Fixed on the way: storage tree rows were mouse-only `div`s (now buttons announcing open or
  closed); product rows opened only on click (the name is now a link); dialogs and panels had no
  Escape, focus move, Tab containment or focus return (new `dialog-focus.hook.ts`).
- **Focus visible** (WCAG 2.4.7) on every focusable element reached by Tab on all 16 screens.
  Fixed: the top-bar search hid its outline, and date fields lost it in Chromium.
- **Tablets** (§9.7) at 768 × 1024 and 1024 × 768 on all 16 screens: no sideways scrolling, rail
  collapsed to icons, every button, link and field at least 44 px tall (status strip grows to 44 px).

Full end-to-end run after these changes: 17 passed, 1 opt-in skipped.

## Clay edition re-run (2026-10-03)

After the clay restyle (new palette, fonts, shadows and radii) the full accessibility suite was
run again against the live development build:

- `e2e/accessibility.spec.ts`: every screen, English light and Arabic dark — **0 violations**.
- `e2e/accessibility-overlays.spec.ts`: every pop-up, both two-step screens, both modes — **0 violations**.
- `e2e/keyboard-and-tablet.spec.ts`: keyboard-only flow, focus visible on every screen, tablets at
  768 and 1024 px — **pass**. The focus check was tightened: a box shadow no longer counts as a
  focus indicator, because every clay surface carries one at rest. Only an outline counts, and
  every focusable element has one.
- `e2e/preferences.spec.ts`: language and theme persist — **pass**.

Also fixed: in Arabic the dashboard's category chart drew its labels under the bars and cut them
off; the chart now renders its (already mirrored) SVG left to right.

## Not yet done

- A screen-reader pass with real assistive technology (NVDA on Windows, VoiceOver on iPad) by a person.
- Testing on the actual tablets the store keepers will use.
