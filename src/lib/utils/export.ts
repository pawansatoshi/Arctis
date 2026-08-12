// ============================================================
// ARCTIS Export System — client-side, no external dependencies
// Supports CSV, JSON, TXT, PDF and Excel-compatible XLS.
// ============================================================

export interface ExportRow {
  [key: string]: string | number | boolean | null | undefined;
}

function escapeCsv(value: unknown): string {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function exportCSV(rows: ExportRow[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(','))].join('\n');
  downloadBlob(`\uFEFF${csv}`, `${filename}.csv`, 'text/csv');
}

export function exportJSON(data: unknown, filename: string): void {
  downloadBlob(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
}

export function exportTXT(rows: ExportRow[], filename: string): void {
  const lines = rows.map((row) =>
    Object.entries(row)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ')
  );
  downloadBlob(lines.join('\n'), `${filename}.txt`, 'text/plain');
}

export function exportPDF(rows: ExportRow[], filename: string, title: string): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const safe = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html><html><head><title>${safe(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:10px;color:#111;margin:24px}
    h1{font-size:17px;margin:0 0 4px}p.meta{color:#666;font-size:9px;margin:0 0 14px}
    table{width:100%;border-collapse:collapse}th{background:#f4f4f5;text-align:left;padding:6px;font-size:9px;border-bottom:1px solid #ddd}
    td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top;word-break:break-all} @media print{body{margin:0}}
  </style></head><body><h1>${safe(title)}</h1><p class="meta">Exported from ARCTIS · ${new Date().toLocaleString()} · ${rows.length} records</p>
  <table><thead><tr>${headers.map((h) => `<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((row) => `<tr>${headers.map((h) => `<td>${safe(row[h])}</td>`).join('')}</tr>`).join('')}
  </tbody></table></body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

// Excel-compatible SpreadsheetML 2003 file. It is a real Excel workbook
// format (not a CSV renamed to .xlsx), works without adding a heavy client
// dependency, and preserves all transaction IDs as text.
export function exportExcel(rows: ExportRow[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const xmlEscape = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Worksheet ss:Name="Transactions"><Table>
      <Row>${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}</Row>
      ${rows.map((row) => `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(row[h])}</Data></Cell>`).join('')}</Row>`).join('')}
    </Table></Worksheet>
  </Workbook>`;
  downloadBlob(`\uFEFF${xml}`, `${filename}.xls`, 'application/vnd.ms-excel');
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
