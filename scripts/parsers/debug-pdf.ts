const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();

async function debug() {
  const data = await pdfExtract.extract('feedback/ASME B36.10-2022.pdf', {});
  
  console.log('=== PAGE 6 (likely has pipe table) ===');
  const page = data.pages[5]; // Page 6
  
  // Group text by y-coordinate (rows)
  const rows: Map<number, string[]> = new Map();
  
  page.content.forEach((item: any) => {
    const y = Math.round(item.y);
    if (!rows.has(y)) {
      rows.set(y, []);
    }
    rows.get(y)!.push(item.str);
  });
  
  // Print first 50 rows
  const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
  sortedRows.slice(0, 50).forEach(([y, texts]) => {
    console.log(texts.join(' | '));
  });
}

debug().catch(console.error);
