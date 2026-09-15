import { useTranslation } from 'react-i18next';

// Empty state for routes whose feature is not built yet — one line of
// instruction, no illustration (§9.8).
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-16) var(--space-6)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{t(titleKey)}</div>
      <p style={{ color: 'var(--ink-muted)', marginTop: 'var(--space-2)' }}>
        This capability is planned for an upcoming phase. See THINGS-TO-DO.md for the roadmap.
      </p>
    </div>
  );
}
