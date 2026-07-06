"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ProjectChartRow, StaffGroupBand } from "@/lib/aggregate";

const BAND_COLORS = ["#eff6ff", "#f8fafc"];

export function StaffGroupedProjectBarChart({
  data,
  bands,
}: {
  data: ProjectChartRow[];
  bands: StaffGroupBand[];
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">表示できる案件データがありません</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        {bands.map((band, index) => (
          <ReferenceArea
            key={`${band.staffName}-${index}`}
            x1={band.startProjectName}
            x2={band.endProjectName}
            fill={BAND_COLORS[index % BAND_COLORS.length]}
            fillOpacity={1}
            ifOverflow="visible"
            label={{ value: band.staffName, position: "insideTop", fontSize: 12, fill: "#475569" }}
          />
        ))}
        <XAxis
          dataKey="projectName"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={70}
        />
        <YAxis tickFormatter={(v) => `${(Number(v) / 10000).toLocaleString()}万`} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          labelFormatter={(label, payload) => {
            const row = payload?.[0]?.payload as ProjectChartRow | undefined;
            return row ? `${row.staffName} / ${label}` : label;
          }}
        />
        <Legend />
        <Bar dataKey="budget" name="予算" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="実績" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
