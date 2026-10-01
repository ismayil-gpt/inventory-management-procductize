// The Mizan mark (2026-10-01): a balance scale — mīzān — drawn as an airfield
// location sign. Black field, inset yellow border, yellow legend. Inline SVG
// so it takes the sign tokens; the files in /public/logo carry the same
// drawing with fixed colours for the favicon and printed documents.
export function MizanMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ flex: 'none', display: 'block' }}
    >
      <rect width="64" height="64" rx="14" fill="var(--sign)" />
      <rect x="4.5" y="4.5" width="55" height="55" rx="10.5" fill="none" stroke="var(--sign-legend)" strokeWidth="2.5" opacity="0.9" />
      <g fill="var(--sign-legend)" stroke="var(--sign-legend)" strokeLinecap="round" strokeLinejoin="round">
        <rect x="14" y="19.5" width="36" height="3.5" rx="1.75" stroke="none" />
        <rect x="30.25" y="21" width="3.5" height="23" stroke="none" />
        <rect x="22" y="43" width="20" height="4" rx="2" stroke="none" />
        <path d="M17 23 L11.5 33 M17 23 L22.5 33 M47 23 L41.5 33 M47 23 L52.5 33" fill="none" strokeWidth="1.8" />
        <path d="M9.5 33 h15 a7.5 5.5 0 0 1 -15 0 z M39.5 33 h15 a7.5 5.5 0 0 1 -15 0 z" stroke="none" />
      </g>
      <circle cx="32" cy="21.25" r="3.6" fill="var(--sign-legend)" />
      <circle cx="32" cy="21.25" r="1.4" fill="var(--sign)" />
    </svg>
  );
}
