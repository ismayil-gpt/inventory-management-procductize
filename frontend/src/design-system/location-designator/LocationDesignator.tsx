import { useTranslation } from 'react-i18next';

// The signature element (CLAUDE.md §9.6). Takes an ARRAY of segments — never
// three fixed values — so it renders any hierarchy depth (§5A.2). Codes are
// never translated or mirrored; in RTL the segment order reverses but each
// code stays LTR.
interface LocationDesignatorProps {
  segments: string[];
  contextLabel?: string;
  itemCount?: number;
  scanning?: boolean;
}

export function LocationDesignator({
  segments,
  contextLabel,
  itemCount,
  scanning = false,
}: LocationDesignatorProps) {
  const { t } = useTranslation();
  const hasScan = segments.length > 0;
  const cells = hasScan ? segments : ['———', '———', '———'];

  // 5+ segments shrink; 2–4 render full size (§9.6).
  const fontSize = cells.length >= 5 ? '28px' : 'var(--text-designator)';

  return (
    <section
      aria-label="Active location"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4) var(--space-6)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          className="designator"
          dir="ltr"
          style={{ display: 'flex', alignItems: 'stretch', color: hasScan ? 'var(--ink)' : 'var(--ink-faint)' }}
        >
          {cells.map((segment, index) => (
            <div
              key={`${segment}-${index}`}
              style={{
                fontSize,
                fontWeight: 500,
                padding: '2px 18px',
                borderInlineStart: index === 0 ? 'none' : '1px solid var(--hairline-strong)',
                whiteSpace: 'nowrap',
              }}
            >
              {segment}
            </div>
          ))}
        </div>
        {contextLabel && (
          <span
            style={{
              fontSize: 'var(--text-2xs)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              maxWidth: '40%',
              textAlign: 'end',
            }}
          >
            {contextLabel}
          </span>
        )}
      </div>

      {/* 2px gold rule beneath the segment row only (§9.6). */}
      <div style={{ height: '2px', background: 'var(--gold)', marginTop: 'var(--space-3)' }} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--ink-muted)',
        }}
      >
        <span className="tabular">
          {typeof itemCount === 'number' ? t('locations.itemsOnShelf', { count: itemCount }) : ''}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {t('locations.scanningActive')}
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: scanning ? 'var(--ok)' : 'var(--ink-faint)',
            }}
          />
        </span>
      </div>
    </section>
  );
}
