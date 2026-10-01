import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Package, Plus, Printer, Trash2 } from 'lucide-react';
import {
  useLocationsTree, useLocation, resolveLocationByBarcode, fetchLocationLabels, deleteLocation, ApiError,
  type LocationTreeNode,
} from '../../api-client/client';
import { signalScan } from '../../design-system/scan-signal/scan-signal-bus';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from '../authentication/auth.store';
import { LocationDesignator } from '../../design-system/location-designator/LocationDesignator';
import { ConfirmDialog } from '../../design-system/confirm-dialog/ConfirmDialog';
import { BarcodeInput } from '../../features/barcode-scanning/BarcodeInput';
import { printLabels } from '../../features/barcode-scanning/print-labels';
import { BulkCreateModal } from './BulkCreateModal';
import { ShelfView } from './ShelfView';

/** Finds a node and its parent in the loaded tree (the tree is small and already in memory). */
function findWithParent(nodes: LocationTreeNode[], id: string, parent: LocationTreeNode | null = null): { node: LocationTreeNode; parent: LocationTreeNode | null } | null {
  for (const node of nodes) {
    if (node.id === id) return { node, parent };
    const found = findWithParent(node.children, id, node);
    if (found) return found;
  }
  return null;
}

export function LocationsPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const tree = useLocationsTree();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = useLocation(selectedId);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [bulkParent, setBulkParent] = useState<{ id: string; designator: string } | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; designator: string } | null>(null);

  const printShelf = async () => {
    if (!selected.data) return;
    printLabels(await fetchLocationLabels(selected.data.id), selected.data.designator);
  };

  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);

  // Draw the rack when a rack is selected (its children hold stock) or when one
  // of its shelves is — the operator sees where they stand on the whole rack.
  const selectedInTree = selectedId && tree.data ? findWithParent(tree.data, selectedId) : null;
  // Open the tree down to whatever was selected — a scan lands on a shelf deep in the tree.
  useEffect(() => {
    if (!selectedId || !tree.data) return;
    const path: string[] = [];
    const walk = (nodes: LocationTreeNode[]): boolean => nodes.some((n) => {
      if (n.id === selectedId) return true;
      path.push(n.id);
      if (walk(n.children)) return true;
      path.pop();
      return false;
    });
    if (walk(tree.data)) setExpanded((prev) => new Set([...prev, ...path]));
  }, [selectedId, tree.data]);
  const shelfParent = !selectedInTree
    ? null
    : selectedInTree.node.children.some((c) => c.canHoldStock)
      ? selectedInTree.node
      : selectedInTree.node.canHoldStock && selectedInTree.parent?.children.every((c) => c.canHoldStock)
        ? selectedInTree.parent
        : null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const onBarcode = async (code: string) => {
    setBarcodeBusy(true);
    setBarcodeError(null);
    try {
      const loc = await resolveLocationByBarcode(code);
      setSelectedId(loc.id);
      signalScan('accepted', loc.designator, name(loc.typeNameEn, loc.typeNameAr));
    } catch (err) {
      const message = err instanceof ApiError && err.status === 404 ? t('barcode.notFound') : t('errors.generic');
      setBarcodeError(message);
      signalScan('rejected', code, message);
    } finally {
      setBarcodeBusy(false);
    }
  };

  const renderNode = (node: LocationTreeNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const isSelected = node.id === selectedId;
    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (hasChildren) { toggle(node.id); setBulkParent({ id: node.id, designator: node.designator }); }
            if (node.canHoldStock) setSelectedId(node.id);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', height: '36px', cursor: 'pointer',
            paddingInlineStart: `${8 + depth * 18}px`, paddingInlineEnd: '12px',
            background: isSelected ? 'var(--primary-soft)' : 'transparent',
            borderInlineStart: isSelected ? '2px solid var(--primary-ink)' : '2px solid transparent',
          }}
          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-sunken)'; }}
          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ width: '16px', display: 'inline-flex', color: 'var(--ink-faint)' }}>
            {hasChildren ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} style={{ transform: language === 'ar' ? 'scaleX(-1)' : 'none' }} />) : node.canHoldStock ? <Package size={14} strokeWidth={1.5} /> : null}
          </span>
          <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--ink)', minWidth: '36px' }}>{node.code}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name(node.typeNameEn, node.typeNameAr)}
          </span>
          <span className="tabular" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>
            {node.itemCount} · {node.unitCount}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDeleting({ id: node.id, designator: node.designator }); }}
              aria-label={t('common.delete')}
              title={t('common.delete')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '22px', width: '22px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--ink-faint)', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--critical)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const loc = selected.data;

  const toolbarBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => { setBulkParent(null); setShowBulk(true); }} style={{ ...toolbarBtn, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500 }}>
            <Plus size={16} strokeWidth={1.5} /> {t('locations.newRoot')}
          </button>
          <button type="button" onClick={() => setShowBulk(true)} disabled={!bulkParent} style={{ ...toolbarBtn, opacity: bulkParent ? 1 : 0.5 }}>
            <Plus size={16} strokeWidth={1.5} /> {t('locations.bulkCreate')}{bulkParent ? ` · ${bulkParent.designator}` : ''}
          </button>
        </div>
      )}
      {showBulk && <BulkCreateModal parent={bulkParent} onClose={() => setShowBulk(false)} onCreated={() => setShowBulk(false)} />}
      {deleting && (
        <ConfirmDialog
          title={t('locations.deleteTitle')}
          message={t('locations.deleteConfirm', { designator: deleting.designator })}
          onConfirm={async () => {
            await deleteLocation(deleting.id);
            const sel = selected.data?.designator;
            if (sel && (sel === deleting.designator || sel.startsWith(deleting.designator + '-'))) setSelectedId(undefined);
            await queryClient.invalidateQueries({ queryKey: ['locations-tree'] });
          }}
          onClose={() => setDeleting(null)}
        />
      )}

      <BarcodeInput label={t('locations.findByBarcode')} onSubmit={onBarcode} busy={barcodeBusy} error={barcodeError} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.2fr)', gap: 'var(--space-4)', alignItems: 'start' }}>
        {/* Tree */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--hairline)', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
            <span>{t('locations.title')}</span>
            <span>{t('locations.items')} · {t('locations.units')}</span>
          </div>
          <div style={{ paddingBlock: '4px', maxHeight: '60vh', overflow: 'auto' }}>
            {tree.isLoading && <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('common.loading')}</div>}
            {tree.data?.map((root) => renderNode(root, 0))}
          </div>
        </div>

        {/* Selected / scanned location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {!selectedId && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>
              {t('locations.selectHint')}
            </div>
          )}
          {selected.isLoading && <div style={{ color: 'var(--ink-muted)' }}>{t('common.loading')}</div>}
          {loc && (
            <>
              <LocationDesignator
                segments={loc.segments}
                contextLabel={name(loc.typeNameEn, loc.typeNameAr)}
                itemCount={loc.itemCount}
                scanning
              />
              {shelfParent && <ShelfView parent={shelfParent} highlightedId={selectedId} onSelect={setSelectedId} />}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t('locations.stockHere')}</span>
                  {loc.barcode && (
                    <button type="button" onClick={() => void printShelf()} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                      <Printer size={13} strokeWidth={1.5} /> {t('locations.printLabel')}
                    </button>
                  )}
                </div>
                {loc.stock.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('locations.noStockHere')}</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {loc.stock.map((row) => (
                        <tr key={row.productId} style={{ borderTop: '1px solid var(--hairline)' }}>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }} dir="ltr">{row.sku}</td>
                          <td style={{ padding: '10px 16px', fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{name(row.nameEn, row.nameAr)}</td>
                          <td className="tabular" style={{ padding: '10px 16px', textAlign: 'end', fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
