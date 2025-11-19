const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();
const fs = require('fs');

async function debug() {
  const data = await pdfExtract.extract('feedback/ASME B36.10-2022.pdf', {});

  const page = data.pages[13]; // Page 14

  console.log('=== PAGE 14 TABLE DATA ===\n');

  // Sort by Y position (top to bottom), then X (left to right)
  const sorted = page.content.sort((a: any, b: any) => {
    if (Math.abs(a.y - b.y) < 2) {
      return a.x - b.x; // Same row, sort by X
    }
    return a.y - b.y; // Different rows, sort by Y
  });

  // Group into rows
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let lastY = -1;

  sorted.forEach((item: any) => {
    if (lastY >= 0 && Math.abs(item.y - lastY) > 2) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [];
    }
    if (item.str.trim()) {
      currentRow.push(item.str.trim());
    }
    lastY = item.y;
  });
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Print first 100 rows
  rows.slice(0, 100).forEach((row, i) => {
    const rowStr = row.join(' | ');
    console.log(`${i}: ${rowStr}`);
  });

  // Save to file for analysis
  const output = rows.map((row, i) => `${i}: ${row.join(' | ')}`).join('\n');
  fs.writeFileSync('scripts/output/page14-table.txt', output);
}

debug().catch(console.error);
