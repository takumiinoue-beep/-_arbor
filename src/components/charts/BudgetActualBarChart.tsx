"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export function BudgetActualBarChart({
  data,
  nameKey,
}: {
  data: { budget: number; actual: number; [key: string]: string | number }[];
  nameKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${(Number(v) / 10000).toLocaleString()}万`} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Legend />
        <Bar dataKey="budget" name="予算" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="実績" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
