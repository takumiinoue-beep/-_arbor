"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export type DailyAcquisitionRow = { date: string; count: number; amount: number };

export function DailyAcquisitionChart({ data }: { data: DailyAcquisitionRow[] }) {
  const chartData = data.map((d) => ({ ...d, label: `${Number(d.date.slice(8, 10))}日` }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
        <YAxis
          yAxisId="amount"
          tickFormatter={(v) => `${(Number(v) / 10000).toLocaleString()}万`}
          tick={{ fontSize: 12 }}
        />
        <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value, name) => (name === "獲得金額" ? formatCurrency(Number(value)) : `${value}件`)} />
        <Legend />
        <Bar yAxisId="amount" dataKey="amount" name="獲得金額" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="count"
          name="獲得件数"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
