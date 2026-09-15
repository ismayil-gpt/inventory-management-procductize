import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../design-system/modal/Modal';
import { useLocationTypes, bulkCreateLocations, ApiError } from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';

interface LevelRow { locationTypeId: string; prefix: string; from: number; to: number; }

const PREFIX_BY_CODE: Record<string, string> = { STORE_ROOM: 'SR', RACK: 'R', LEVEL: 'L', ZONE: 'Z', AISLE: 'A', BIN: 'B', WAREHOUSE: 'WH', SITE: 'S' };
const prefixFor = (code: string) => PREFIX_BY_CODE[code] ?? code.slice(0, 2).toUpperCase();

// Instant, client-side preview — no network round-trip.
function computePreview(levels: LevelRow[], parentDesignator: string): { count: number; sample: string[] } {
  let frontier = [parentDesignator];
  const all: string[] = [];
  for (const lvl of levels) {
    const from = Number(lvl.from);
    const to = Number(lvl.to);
    if (!lvl.locationTypeId || !Number.isFinite(from) || !Number.isFinite(to) || to < from) return { count: 0, sample: [] };
    const next: string[] = [];
    for (const parent of frontier) {
      for (let i = from; i <= to; i++) {
        const des = parent ? `${parent}-${lvl.prefix}${i}` : `${lvl.prefix}${i}`;
        all.push(des);
        next.push(des);
      }
    }
    frontier = next;
  }
  return { count: all.length, sample: all.slice(0, 30) };
}

export function BulkCreateModal({ parent, onClose, onCreated }: { parent: { id: string; designator: string } | null; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const types = useLocationTypes();
  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentDepth = parent ? parent.designator.split('-').length - 1 : -1;

  // Pre-fill the levels that can go under this parent (e.g. Store Room→Rack→Level).
  useEffect(() => {
    if (seeded || !types.data) return;
    const usable = types.data.filter((ty) => ty.depth > parentDepth);
    setLevels(usable.length ? usable.map((ty) => ({ locationTypeId: ty.id, prefix: prefixFor(ty.code), from: 1, to: 1 })) : [{ locationTypeId: '', prefix: '', from: 1, to: 1 }]);
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.data]);

  const setLevel = (i: number, patch: Partial<LevelRow>) => setLevels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLevel = () => setLevels((ls) => [...ls, { locationTypeId: '', prefix: '', from: 1, to: 1 }]);
  const removeLevel = (i: number) => setLevels((ls) => ls.filter((_, idx) => idx !== i));

  const preview = useMemo(() => computePreview(levels, parent?.designator ?? ''), [levels, parent]);
  const canCreate = preview.count > 0 && levels.every((l) => l.locationTypeId && l.prefix.trim());

  const create = async () => {
    setError(null); setBusy(true);
    try {
      await bulkCreateLocations({ parentId: parent?.id ?? null, levels: levels.map((l) => ({ locationTypeId: l.locationTypeId, prefix: l.prefix.trim(), from: Number(l.from), to: Number(l.to) })) }, false);
      await queryClient.invalidateQueries({ queryKey: ['locations-tree'] });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? (language === 'ar' ? err.body.messageAr : err.body.messageEn) ?? t('errors.generic') : t('errors.generic'));
      setBusy(false);
    }
  };

  const input: React.CSSProperties = { height: '34px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 10px', fontSize: 'var(--text-sm)' };
  const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '3px' };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer' };

  return (
    <Modal title={t('locations.bulkCreate')} onClose={onClose} width={620}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', margin: '0 0 var(--space-4)' }}>
        {t('locations.bulkUnder')}: <b dir="ltr" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{parent?.designator ?? t('locations.root')}</b>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {levels.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap', padding: 'var(--space-3)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
            <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
              <label style={fieldLabel}>{t('locations.type')}</label>
              <select style={input} value={l.locationTypeId} onChange={(e) => setLevel(i, { locationTypeId: e.target.value })}>
                <option value="">—</option>
                {types.data?.map((ty) => <option key={ty.id} value={ty.id}>{name(ty.nameEn, ty.nameAr)}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 90px' }}>
              <label style={fieldLabel}>{t('locations.prefix')}</label>
              <input style={input} value={l.prefix} onChange={(e) => setLevel(i, { prefix: e.target.value })} dir="ltr" />
            </div>
            <div style={{ width: '64px' }}>
              <label style={fieldLabel}>{t('locations.from')}</label>
              <input style={input} type="number" min={0} className="tabular" value={l.from} onChange={(e) => setLevel(i, { from: Number(e.target.value) })} />
            </div>
            <div style={{ width: '64px' }}>
              <label style={fieldLabel}>{t('locations.to')}</label>
              <input style={input} type="number" min={0} className="tabular" value={l.to} onChange={(e) => setLevel(i, { to: Number(e.target.value) })} />
            </div>
            <button type="button" onClick={() => removeLevel(i)} disabled={levels.length === 1} aria-label={t('common.delete')} title={t('common.delete')}
              style={{ height: '34px', width: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: levels.length === 1 ? 'var(--ink-faint)' : 'var(--critical)', cursor: levels.length === 1 ? 'default' : 'pointer' }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addLevel} style={{ ...btn, height: '34px', border: '1px dashed var(--hairline-strong)', background: 'transparent', color: 'var(--ink-muted)', marginTop: 'var(--space-3)' }}>
        <Plus size={15} strokeWidth={1.5} /> {t('locations.addLevel')}
      </button>

      {/* Live preview — updates as you type */}
      <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--primary-soft)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--primary)' }}>{t('locations.willCreate', { count: preview.count })}</div>
        {preview.sample.length > 0 && (
          <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)', marginTop: '6px', lineHeight: 1.7, maxHeight: '92px', overflow: 'auto' }}>
            {preview.sample.join('  ·  ')}{preview.count > preview.sample.length ? '  …' : ''}
          </div>
        )}
      </div>

      {error && <div role="alert" style={{ marginTop: 'var(--space-3)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
        <button type="button" onClick={onClose} style={{ ...btn, border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}>{t('common.cancel')}</button>
        <button type="button" onClick={() => void create()} disabled={busy || !canCreate} style={{ ...btn, border: 'none', background: busy || !canCreate ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500 }}>
          {busy ? t('common.loading') : t('locations.createN', { count: preview.count })}
        </button>
      </div>
    </Modal>
  );
}
