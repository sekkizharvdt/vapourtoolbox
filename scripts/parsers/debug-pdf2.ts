const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();

async function debug() {
  const data = await pdfExtract.extract('feedback/ASME B36.10-2022.pdf', {});
  
  console.log(`Total pages: ${data.pages.length}`);
  
  // Check pages 10-15 for tables
  for (let pageNum = 10; pageNum <= 15; pageNum++) {
    const page = data.pages[pageNum - 1];
    console.log(`\n=== PAGE ${pageNum} ===`);
    
    // Sample first 30 items
    page.content.slice(0, 30).forEach((item: any) => {
      if (item.str.trim()) {
        console.log(item.str);
      }
    });
  }
}

debug().catch(console.error);
