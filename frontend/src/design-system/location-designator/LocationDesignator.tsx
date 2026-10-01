import { useTranslation } from 'react-i18next';
import { SplitFlapText } from '../airfield-signs/SplitFlapText';

// The signature element (CLAUDE.md §9.6): a gantry of airfield location signs,
// one panel per segment. Takes an ARRAY of segments — never three fixed
// values — so it renders any hierarchy depth (§5A.2). Codes are never
// translated or mirrored; in RTL the panel order reverses (flex follows the
// document direction) but each code stays LTR.
interface LocationDesignatorProps {
  segments: string[];
  contextLabel?: string;
  itemCount?: number;
  scanning?: boolean;
}

// Each panel starts its flap a beat after the one before it.
const PANEL_STAGGER_MS = 90;

export function LocationDesignator({
  segments,
  contextLabel,
  itemCount,
  scanning = false,
}: LocationDesignatorProps) {
  const { t } = useTranslation();
  const hasScan = segments.length > 0;
  const fullPath = segments.join('-');

  // 6+ segments: first, an ellipsis, then the final three — the leaf is what
  // the operator is standing in front of (§9.6).
  const cells = !hasScan
    ? ['———', '———', '———']
    : segments.length >= 6
      ? [segments[0], '⋯', ...segments.slice(-3)]
      : segments;
  const fontSize = segments.length >= 5 ? '30px' : 'var(--text-designator)';

  return (
    <section
      aria-label={hasScan ? `${t('locations.activeLocation')} ${fullPath}` : t('locations.activeLocation')}
      style={{
        background: 'var(--gantry)',
        border: '1px solid var(--gantry-line)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
        {cells.map((segment, index) => {
          const isEllipsis = segment === '⋯';
          return (
            <div
              key={`${index}-${fullPath}`}
              dir="ltr"
              className="sign-location sign-enter"
              title={isEllipsis ? fullPath : undefined}
              tabIndex={isEllipsis ? 0 : undefined}
              style={{
                fontSize,
                lineHeight: 1,
                letterSpacing: 'var(--tracking-designator)',
                padding: '12px 18px 8px',
                minWidth: '2.2ch',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                opacity: hasScan ? 1 : 0.4,
                cursor: isEllipsis ? 'help' : undefined,
                animationDelay: `${index * PANEL_STAGGER_MS}ms`,
              }}
            >
              <SplitFlapText text={segment} startDelayMs={index * PANEL_STAGGER_MS} isAnimated={hasScan && !isEllipsis} />
            </div>
          );
        })}
        {contextLabel && (
          <span
            style={{
              marginInlineStart: 'auto',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--gantry-ink)',
              maxWidth: '40%',
              textAlign: 'end',
            }}
          >
            {contextLabel}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--gantry-line)',
          fontSize: 'var(--text-xs)',
          color: 'var(--gantry-muted)',
        }}
      >
        <span className="tabular">
          {typeof itemCount === 'number' ? t('locations.itemsOnShelf', { count: itemCount }) : ''}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {t('locations.scanningActive')}
          {scanning ? (
            <span className="beacon" aria-hidden />
          ) : (
            <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: 'var(--radius-dot)', border: '1px solid var(--gantry-muted)' }} />
          )}
        </span>
      </div>
    </section>
  );
}
