// The Mizan mark (2026-10-03, clay edition): the scannable carton. A carton
// in three-quarter view, lit from above, with a barcode on its shaded side —
// every product in Mizan carries one, and scanning is how stock moves. Four
// bold bars rather than a realistic code, so it still reads at 16px.
// Inline SVG drawn from the brand tokens (fixed in every theme); /public/logo
// carries the same drawing for the favicon and documents. Kept flat inside;
// the tile's clay relief is a CSS shadow, so small sizes stay crisp.
export function MizanMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ flex: 'none', display: 'block', borderRadius: '27%', boxShadow: 'var(--clay-tinted)' }}
    >
      <rect width="120" height="120" rx="32" fill="var(--brand-tile)" />
      <g strokeWidth="2.5" strokeLinejoin="round">
        <polygon points="27,40 60,58.86 60,98.86 27,80" fill="var(--brand-box-left)" stroke="var(--brand-box-left)" />
        <polygon points="60,58.86 93,40 93,80 60,98.86" fill="var(--brand-box-right)" stroke="var(--brand-box-right)" />
        <polygon points="60,21.14 93,40 60,58.86 27,40" fill="var(--brand-box-top)" stroke="var(--brand-box-top)" />
      </g>
      {/* The barcode lies on the right face: x runs along the face, y down it. */}
      <g transform="matrix(1 -0.5714 0 1 60 58.86)" fill="var(--brand-code)">
          <rect x="6" y="9" width="4" height="24" />
          <rect x="13" y="9" width="3" height="24" />
          <rect x="19" y="9" width="5" height="24" />
          <rect x="27" y="9" width="3" height="24" />
      </g>
    </svg>
  );
}
