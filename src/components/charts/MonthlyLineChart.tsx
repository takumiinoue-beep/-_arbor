"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { MonthlyAggregate } from "@/lib/aggregate";

export function MonthlyLineChart({ data }: { data: MonthlyAggregate[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${(Number(v) / 10000).toLocaleString()}万`} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Legend />
        <Line type="monotone" dataKey="budget" name="予算" stroke="#94a3b8" strokeWidth={2} />
        <Line type="monotone" dataKey="actual" name="実績" stroke="#2563eb" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
