// §9.6 — the small designator chip used in tables: last two segments, mono,
// with the full designator in a tooltip. Codes are never translated; kept LTR.
export function LocationChip({ designator }: { designator: string }) {
  const segments = designator.split('-');
  const shown = segments.length > 2 ? segments.slice(-2) : segments;
  const truncated = segments.length > shown.length;

  return (
    <span
      dir="ltr"
      title={designator}
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        overflow: 'hidden',
        lineHeight: 1.6,
      }}
    >
      {truncated && (
        <span style={{ padding: '0 5px', color: 'var(--ink-faint)', borderInlineEnd: '1px solid var(--hairline)' }}>⋯</span>
      )}
      {shown.map((seg, i) => (
        <span
          key={`${seg}-${i}`}
          style={{
            padding: '0 6px',
            color: 'var(--ink)',
            borderInlineStart: i === 0 && !truncated ? 'none' : '1px solid var(--hairline)',
          }}
        >
          {seg}
        </span>
      ))}
    </span>
  );
}
