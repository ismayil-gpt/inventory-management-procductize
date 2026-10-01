import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Cpu, Mail, ChevronDown } from 'lucide-react';
import { parseControlMatrix, type ControlStatus } from './control-matrix-parser';

// "Your data never leaves this building" — the on-premise promise (§1, DESC
// control 18) made visible, followed by every DESC control (§11.1) with its
// honest status read straight from the evidence matrix. Nothing here is
// marketing: a control in progress is shown as in progress.
const STATUS_LOOK: Record<ControlStatus, { style: React.CSSProperties; order: number }> = {
  VERIFIED: { style: { background: 'var(--sign-go)', color: 'var(--sign-on-go)' }, order: 0 },
  IMPLEMENTED: { style: { background: 'var(--ok-soft)', color: 'var(--ok)', border: '1px solid var(--ok)' }, order: 1 },
  IN_PROGRESS: { style: { background: 'var(--warn-soft)', color: 'var(--warn)', border: '1px solid var(--warn)' }, order: 2 },
  NOT_STARTED: { style: { background: 'transparent', color: 'var(--ink-muted)', border: '1px solid var(--hairline-strong)' }, order: 3 },
};

const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '10px 12px', background: 'var(--surface-sunken)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 'var(--text-sm)', borderTop: '1px solid var(--hairline)', verticalAlign: 'top' };

export function SecurityCompliancePage() {
  const { t, i18n } = useTranslation();
  const { rows, lastUpdated } = useMemo(() => parseControlMatrix(), []);
  const [openRow, setOpenRow] = useState<number | null>(null);

  const counts = rows.reduce<Record<ControlStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { VERIFIED: 0, IMPLEMENTED: 0, IN_PROGRESS: 0, NOT_STARTED: 0 },
  );
  const residency = rows.find((r) => r.number === 18);
  const controlName = (n: number, fallback: string) =>
    i18n.exists(`compliance.control.${n}`) ? t(`compliance.control.${n}`) : fallback;

  const promises = [
    { Icon: Building2, title: t('compliance.promiseDataTitle'), body: t('compliance.promiseDataBody') },
    { Icon: Cpu, title: t('compliance.promiseAiTitle'), body: t('compliance.promiseAiBody') },
    { Icon: Mail, title: t('compliance.promiseEmailTitle'), body: t('compliance.promiseEmailBody') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <section style={{ background: 'var(--gantry)', border: '1px solid var(--gantry-line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', color: 'var(--gantry-ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800 }}>{t('compliance.headline')}</h2>
          {residency && (
            <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-chip)', fontSize: 'var(--text-xs)', fontWeight: 600, ...STATUS_LOOK[residency.status].style }}>
              {t(`compliance.status.${residency.status}`)}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          {promises.map(({ Icon, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Icon size={20} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gantry-muted)', lineHeight: 1.5 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t('compliance.controlsTitle')}</h2>
        {(Object.keys(counts) as ControlStatus[]).map((s) => (
          <span key={s} style={{ padding: '2px 10px', borderRadius: 'var(--radius-chip)', fontSize: 'var(--text-xs)', fontWeight: 600, ...STATUS_LOOK[s].style }}>
            {t(`compliance.status.${s}`)} <span className="tabular">{counts[s]}</span>
          </span>
        ))}
        {lastUpdated && (
          <span dir="ltr" style={{ marginInlineStart: 'auto', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
            {t('compliance.lastUpdated')} {lastUpdated.split('-').reverse().join('/')}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', maxWidth: '78ch' }}>{t('compliance.controlsIntro')}</p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '48px' }}>#</th>
              <th style={th}>{t('compliance.colControl')}</th>
              <th style={{ ...th, width: '160px' }}>{t('compliance.colStatus')}</th>
              <th style={{ ...th, width: '48px' }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = openRow === r.number;
              return (
                <tr key={r.number}>
                  <td className="tabular" style={{ ...td, color: 'var(--ink-muted)' }}>{r.number}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{controlName(r.number, r.controlEn)}</div>
                    {isOpen && (
                      <div dir="ltr" style={{ marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', lineHeight: 1.6, textAlign: 'left', maxWidth: '90ch' }}>
                        {r.evidence}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-chip)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap', ...STATUS_LOOK[r.status].style }}>
                      {t(`compliance.status.${r.status}`)}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'end' }}>
                    <button
                      type="button"
                      onClick={() => setOpenRow(isOpen ? null : r.number)}
                      aria-expanded={isOpen}
                      aria-label={t('compliance.showEvidence')}
                      title={t('compliance.showEvidence')}
                      style={{ display: 'inline-grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink-muted)', cursor: 'pointer' }}
                    >
                      <ChevronDown size={16} strokeWidth={1.5} aria-hidden style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform var(--motion-duration) var(--motion-easing)' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
