// 進捗率（件数 ÷ 設定件数）の数字と棒。設定件数が0のときは「-」
export function Progress({ acquired, target }: { acquired: number; target: number }) {
  if (target <= 0) return <span className="text-slate-300">-</span>;
  const ratio = (acquired / target) * 100;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${ratio >= 100 ? "bg-emerald-500" : "bg-sky-500"}`}
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </div>
      <span className="w-14 text-right">{`${Math.round(ratio * 100) / 100}%`}</span>
    </div>
  );
}
