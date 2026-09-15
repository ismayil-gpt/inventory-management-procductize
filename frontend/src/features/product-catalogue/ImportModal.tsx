import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { Modal } from '../../design-system/modal/Modal';
import { downloadImportTemplate, importProductsFile, ApiError, type ImportReport } from '../../api-client/client';

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const onPick = async (f: File | null) => {
    setFile(f); setReport(null); setError(null); setDone(null);
    if (!f) return;
    setBusy(true);
    try {
      setReport(await importProductsFile(f, true)); // dry-run
    } catch (err) {
      setError(err instanceof ApiError ? err.body.messageEn ?? t('errors.generic') : t('errors.generic'));
    } finally { setBusy(false); }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const res = await importProductsFile(file, false);
      if (res.imported > 0) { void queryClient.invalidateQueries(); setDone(res.imported); }
      else setReport(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.messageEn ?? t('errors.generic') : t('errors.generic'));
    } finally { setBusy(false); }
  };

  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer' };

  return (
    <Modal title={t('products.import.title')} onClose={onClose} width={620}>
      {done !== null ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ok)' }}>{t('products.import.done', { count: done })}</div>
          <button type="button" onClick={onClose} style={{ ...btn, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', marginTop: 'var(--space-4)' }}>{t('common.save')}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <button type="button" onClick={() => void downloadImportTemplate()} style={{ ...btn, border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}>
              <Download size={16} strokeWidth={1.5} /> {t('products.import.template')}
            </button>
            <label style={{ ...btn, border: '1px solid var(--primary)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
              <Upload size={16} strokeWidth={1.5} /> {file ? file.name : t('products.import.choose')}
              <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => void onPick(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: 'var(--space-4)' }}>{t('products.import.hint')}</p>

          {busy && <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('common.loading')}</div>}
          {error && <div role="alert" style={{ color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}

          {report && (
            <div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
                <span>{t('products.import.total')}: <b className="tabular">{report.summary.total}</b></span>
                <span style={{ color: 'var(--ok)' }}>{t('products.import.valid')}: <b className="tabular">{report.summary.valid}</b></span>
                <span style={{ color: report.summary.invalid ? 'var(--critical)' : 'var(--ink-muted)' }}>{t('products.import.invalid')}: <b className="tabular">{report.summary.invalid}</b></span>
              </div>
              {report.summary.invalid > 0 && (
                <div style={{ maxHeight: '220px', overflow: 'auto', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
                  {report.rows.filter((r) => r.status === 'error').map((r) => (
                    <div key={r.row} style={{ padding: '8px 12px', borderTop: '1px solid var(--hairline)', fontSize: 'var(--text-xs)' }}>
                      <b>{t('products.import.row')} {r.row}</b> {r.sku && <span style={{ fontFamily: 'var(--font-mono)' }}>({r.sku})</span>}
                      <span style={{ color: 'var(--critical)' }}> — {r.errors.join(' ')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <button type="button" onClick={onClose} style={{ ...btn, border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}>{t('common.cancel')}</button>
                <button type="button" onClick={commit} disabled={busy || report.summary.invalid > 0 || report.summary.valid === 0}
                  style={{ ...btn, border: 'none', background: report.summary.invalid > 0 || report.summary.valid === 0 ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500 }}>
                  {t('products.import.commit', { count: report.summary.valid })}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
