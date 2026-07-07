"use client";

export type TableColumn<T> = {
  key: string;
  label: string;
  className?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
};

export default function Table<T extends { id?: string | number }>({
  columns,
  data,
  emptyMessage = "データがありません",
}: {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
}) {
  if (!data || data.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-400">{emptyMessage}</div>;
  }

  return (
    <div className="-mx-6 overflow-x-auto px-6" style={{ WebkitOverflowScrolling: "touch" }}>
      <table className="text-sm" style={{ minWidth: 560 }}>
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`pb-2 pr-4 text-left text-xs font-semibold text-slate-500 ${col.className || ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-slate-50 transition-colors hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className={`py-2.5 pr-4 ${col.className || ""}`}>
                  {col.render
                    ? col.render((row as Record<string, unknown>)[col.key], row)
                    : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
