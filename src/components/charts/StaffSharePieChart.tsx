"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { StaffAggregate } from "@/lib/aggregate";

const COLORS = ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];

export function StaffSharePieChart({ data }: { data: StaffAggregate[] }) {
  const chartData = data.filter((d) => d.actual > 0);

  if (chartData.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">表示できる実績データがありません</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="actual"
          nameKey="staffName"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={(entry: PieLabelRenderProps) => String(entry.name ?? "")}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
