// §9.6 — the small designator chip used in tables: mono, with the full
// designator in a tooltip. Mirrors the full strip's depth rule (2-5 segments
// show in full — dropping the store room from a 3-segment SR1-R1-L1 designator
// makes two different shelves in different store rooms look identical) and
// only collapses to the final two segments once depth reaches 6+, same
// threshold as LocationDesignator. Codes are never translated; kept LTR.
export function LocationChip({ designator }: { designator: string }) {
  const segments = designator.split('-');
  const shown = segments.length >= 6 ? segments.slice(-2) : segments;
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
