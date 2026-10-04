// ===== EXCEL YARDIMCISI =====
// Tüm rapor/export'lar buradan geçer: başlık stili + formül enjeksiyon koruması tek noktada.
const ExcelJS = require('exceljs');

// Formül enjeksiyonu: = + - @ ile başlayan kullanıcı metnine ' ön eki
function xl(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function newWorkbook() {
  return new ExcelJS.Workbook();
}

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF86010' } };
}

function autoWidth(sheet, defaultWidth) {
  sheet.columns.forEach(col => {
    let max = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(Math.max(max + 2, 12), defaultWidth || 48);
  });
}

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { xl, newWorkbook, styleHeader, autoWidth, sendWorkbook };
