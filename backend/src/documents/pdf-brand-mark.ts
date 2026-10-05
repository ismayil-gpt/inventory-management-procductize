// The Mizan mark on generated PDFs (purchase orders, reports): the scannable
// carton, the same drawing as frontend/public/logo/mizan-mark.svg, in its fixed
// brand colours. Drawn as vectors so it prints sharp at any size.
const TILE = '#F4C64A';
const BOX_TOP = '#3B4F6E';
const BOX_LEFT = '#2A3A52';
const BOX_RIGHT = '#1F2C40';
const CODE = '#F4C64A';
const BARS: Array<[number, number]> = [[6, 4], [13, 3], [19, 5], [27, 3]];

/** Draws the mark with its top-left corner at (x, y), `size` points square. */
export function drawBrandMark(doc: PDFKit.PDFDocument, x: number, y: number, size: number): void {
  doc.save();
  doc.translate(x, y).scale(size / 120);
  doc.roundedRect(0, 0, 120, 120, 32).fill(TILE);
  doc.polygon([27, 40], [60, 58.86], [60, 98.86], [27, 80]).fill(BOX_LEFT);
  doc.polygon([60, 58.86], [93, 40], [93, 80], [60, 98.86]).fill(BOX_RIGHT);
  doc.polygon([60, 21.14], [93, 40], [60, 58.86], [27, 40]).fill(BOX_TOP);
  // The barcode lies on the shaded right face: x along the face, y down it.
  doc.transform(1, -0.5714, 0, 1, 60, 58.86);
  for (const [bx, width] of BARS) doc.rect(bx, 9, width, 24).fill(CODE);
  doc.restore();
}

