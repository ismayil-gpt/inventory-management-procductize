import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHealth, useSystemInfo } from '../api-client/client';
import { useOutbox } from '../offline-queue/outbox.store';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuthStore } from '../features/authentication/auth.store';

// Persistent 32px status strip (§9.7). Never hidden — it is how the store keeper
// trusts scans are saving. Here it also proves the frontend<->backend link.
export function StatusStrip() {
  const { t } = useTranslation();
  const health = useHealth();
  const system = useSystemInfo();
  const pendingCount = useOutbox((s) => s.pendingCount);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      // Gulf Standard Time (UTC+4), Gregorian, 24h (§10).
      setClock(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Dubai',
          hour12: false,
        }).format(new Date()),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const connected = health.isSuccess && health.data.status === 'ok';
  const connectionColor = connected ? 'var(--ok)' : health.isLoading ? 'var(--warn)' : 'var(--critical)';
  const connectionLabel = connected
    ? t('status.synced')
    : health.isLoading
      ? t('status.syncing')
      : t('status.offline');

  const cell: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    paddingInline: 'var(--space-4)',
    borderInlineEnd: '1px solid var(--hairline)',
    height: '60%',
  };

  return (
    <footer
      style={{
        height: 'var(--status-strip-height)',
        display: 'flex',
        alignItems: 'center',
        margin: '0 var(--shell-gap) var(--shell-gap)',
        paddingInline: 'var(--space-2)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--clay-raised-sm)',
        overflow: 'hidden',
        fontSize: 'var(--text-xs)',
        color: 'var(--ink-muted)',
      }}
    >
      <span style={cell}>
        <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: 'var(--radius-dot)', background: connectionColor }} />
        {connectionLabel}
      </span>
      <span style={cell}>
        API&nbsp;
        <span className="tabular" style={{ color: connected ? 'var(--ink)' : 'var(--critical)' }}>
          {connected ? 'v' + health.data.version : '—'}
        </span>
      </span>
      <span style={cell}>
        DB&nbsp;
        <span style={{ color: health.data?.database === 'connected' ? 'var(--ok)' : 'var(--ink-faint)' }}>
          {health.data?.database ?? '—'}
        </span>
      </span>
      <span style={{ ...cell, color: pendingCount > 0 ? 'var(--warn)' : 'var(--ink-muted)' }} className="tabular">
        {t('status.queueDepth', { count: pendingCount })}
      </span>
      <span style={cell}>{system.data?.organizationCode ?? 'DEMO'}</span>
      {/* The on-premise promise (DESC control 18), always in view. Admins can open the evidence. */}
      {isAdmin ? (
        <Link to="/compliance" style={{ ...cell, color: 'var(--ok)', fontWeight: 600, textDecoration: 'none' }} title={t('compliance.badgeTitle')}>
          <Building2 size={13} strokeWidth={1.75} aria-hidden /> {t('compliance.badge')}
        </Link>
      ) : (
        <span style={{ ...cell, color: 'var(--ok)', fontWeight: 600 }} title={t('compliance.badgeTitle')}>
          <Building2 size={13} strokeWidth={1.75} aria-hidden /> {t('compliance.badge')}
        </span>
      )}
      <span style={{ ...cell, marginInlineStart: 'auto', borderInlineEnd: 'none' }} className="tabular">
        {clock} GST
      </span>
    </footer>
  );
}
