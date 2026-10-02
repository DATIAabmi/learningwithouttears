type Col = { display_name: string };
type Row = (string | number | null)[];

const COL_NAME_MAP: Record<string, string> = {
  "ST": "State",
  "Camp": "Campaign",
  "Camp.": "Campaign",
  "Dist": "District",
  "Dom": "Domain",
  "Eng": "Engagements",
  "Downloads": "Total Downloads",
  "Organization": "District",
  "Campaign #": "Campaign",
  "Source Link": "Link",
};

function friendlyName(name: string): string {
  return COL_NAME_MAP[name] ?? name;
}

export function exportToCsv(filename: string, cols: Col[], rows: Row[]) {
  const escape = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = cols.map((c) => escape(friendlyName(c.display_name))).join(",");
  const body = rows.map((row) => row.map((cell) => escape(cell)).join(",")).join("\n");
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
