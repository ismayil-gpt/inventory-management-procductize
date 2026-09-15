import type { Label } from '../../api-client/client';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// Opens a print-ready window with a grid of barcode labels (§6, §7). The barcode
// PNGs come from the backend (bwip-js Code128). Titles/codes stay LTR.
export function printLabels(labels: Label[], heading = 'Mizan — Labels'): void {
  if (labels.length === 0) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const cards = labels
    .map(
      (l) => `<div class="label">
        <img alt="" src="${l.png}" />
        <div class="title" dir="ltr">${escapeHtml(l.title)}</div>
        <div class="subtitle">${escapeHtml(l.subtitle)}</div>
      </div>`,
    )
    .join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'IBM Plex Sans', system-ui, sans-serif; margin: 14px; color: #0D1B22; }
      h1 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .label { border: 1px solid #B9C6CC; border-radius: 3px; padding: 8px; text-align: center; page-break-inside: avoid; }
      .label img { max-width: 100%; height: auto; }
      .title { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 600; font-size: 13px; margin-top: 4px; letter-spacing: 0.04em; }
      .subtitle { font-size: 11px; color: #566A75; margin-top: 2px; }
      .toolbar { margin-bottom: 10px; }
      button { font: inherit; padding: 6px 14px; border: 1px solid #0B4F5E; background: #0B4F5E; color: #fff; border-radius: 3px; cursor: pointer; }
      @media print { .toolbar { display: none; } body { margin: 0; } }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">Print</button> &nbsp; ${labels.length} label(s)</div>
    <h1>${escapeHtml(heading)}</h1>
    <div class="sheet">${cards}</div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
    </body></html>`);
  win.document.close();
}
