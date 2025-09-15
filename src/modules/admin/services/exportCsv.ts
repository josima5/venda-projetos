// src/modules/admin/services/exportCsv.ts
export type CsvRow = Record<string, string | number | null | undefined>;

function toCsv(rows: CsvRow[]) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Se contém separadores/aspas/quebras de linha, envolve em aspas
    if (/[",;\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ];
  return lines.join("\n");
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
