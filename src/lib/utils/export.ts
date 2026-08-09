// ============================================================
// ARCTIS Export System — client-side, no external dependencies
// Supports: CSV, JSON, TXT (no deps needed)
// PDF: uses browser print API (no jsPDF needed)
// ============================================================

export interface ExportRow {
  [key: string]: string | number | boolean | null | undefined;
}

// ─── CSV ─────────────────────────────────────────────────────
export function exportCSV(rows: ExportRow[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
  downloadBlob(csv, `${filename}.csv`, 'text/csv');
}

// ─── JSON ─────────────────────────────────────────────────────
export function exportJSON(data: unknown, filename: string): void {
  downloadBlob(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
}

// ─── TXT ──────────────────────────────────────────────────────
export function exportTXT(rows: ExportRow[], filename: string): void {
  const lines = rows.map((row) =>
    Object.entries(row)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ')
  );
  downloadBlob(lines.join('\n'), `${filename}.txt`, 'text/plain');
}

// ─── PDF (browser print) ─────────────────────────────────────
export function exportPDF(rows: ExportRow[], filename: string, title: string): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; font-size: 11px; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p.meta { color: #666; font-size: 10px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f4f4f5; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e4e4e7; }
    td { padding: 5px 8px; border-bottom: 1px solid #f4f4f5; font-size: 10px; max-width: 200px; word-break: break-all; }
    tr:hover td { background: #fafafa; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Exported from ARCTIS · ${new Date().toLocaleString()} · ${rows.length} records</p>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${headers.map((h) => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

// ─── Excel (CSV with .xlsx extension — opens in Excel) ───────
export function exportExcel(rows: ExportRow[], filename: string): void {
  // BOM for Excel UTF-8 detection
  const bom = '\uFEFF';
  const headers = Object.keys(rows[0] ?? {});
  const escape  = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = bom + [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
  downloadBlob(csv, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// ─── Helper ───────────────────────────────────────────────────
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
