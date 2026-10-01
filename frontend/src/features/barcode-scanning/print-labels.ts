import type { Label } from '../../api-client/client';

// Prints a sheet of barcode labels (§6, §7). The barcode PNGs come from the
// backend (bwip-js Code128); titles and codes stay LTR.
//
// The sheet is built inside this page and shown only by the print stylesheet
// (`.print-sheet` in global.css). An earlier version wrote a popup window with
// inline styles and inline scripts, which a strict Content-Security-Policy
// (DESC #13) rightly blocks; building with DOM calls needs neither.
const SHEET_ID = 'mizan-print-sheet';

export function printLabels(labels: Label[], heading = 'Mizan — Labels'): void {
  if (labels.length === 0) return;
  document.getElementById(SHEET_ID)?.remove();

  const sheet = document.createElement('section');
  sheet.id = SHEET_ID;
  sheet.className = 'print-sheet';
  sheet.setAttribute('aria-hidden', 'true');

  const title = document.createElement('h1');
  title.textContent = heading;
  sheet.append(title);

  const grid = document.createElement('div');
  grid.className = 'print-sheet-grid';
  const images: HTMLImageElement[] = [];
  for (const label of labels) {
    const card = document.createElement('div');
    card.className = 'print-label';
    const image = document.createElement('img');
    image.alt = '';
    image.src = label.png;
    images.push(image);
    const code = document.createElement('div');
    code.className = 'print-label-title';
    code.dir = 'ltr';
    code.textContent = label.title;
    const subtitle = document.createElement('div');
    subtitle.className = 'print-label-subtitle';
    subtitle.textContent = label.subtitle;
    card.append(image, code, subtitle);
    grid.append(card);
  }
  sheet.append(grid);
  document.body.append(sheet);

  const removeSheet = () => {
    sheet.remove();
    window.removeEventListener('afterprint', removeSheet);
  };
  window.addEventListener('afterprint', removeSheet);

  // Open the print dialog once every barcode image is ready, so none print blank.
  void Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => window.print());
}
