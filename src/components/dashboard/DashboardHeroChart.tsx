"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardHeroSeries, dashboardMetricsMeta } from "@/lib/dashboard-metrics";

const SERIES = [
  { key: "cctv", name: "CCTV 탐지", color: "#4F7CFF", fill: "url(#heroBlue)" },
  { key: "parking", name: "주차 이슈", color: "#FF8A4C", fill: "url(#heroOrange)" },
  { key: "facility", name: "시설 점검", color: "#A78BFA", fill: "url(#heroPurple)" },
] as const;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{total.toLocaleString()}</p>
      <p className="text-[10px] text-muted">AI 탐지 합계</p>
      <div className="mt-2 space-y-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 text-[10px]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-slate-800">{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardHeroChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const latest = dashboardHeroSeries[dashboardHeroSeries.length - 1];
  const totalLatest = latest.cctv + latest.parking + latest.facility;

  const chartData = useMemo(() => dashboardHeroSeries, []);

  return (
    <div className="elevated-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <p className="text-[11px] font-medium text-muted">
            공공데이터·인프라 기준 집계 · 최근 12주
          </p>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">도시 인프라 탐지 추이</h2>
          <p className="mt-0.5 text-[10px] text-muted">
            주차장 {dashboardMetricsMeta.bases.parkingLots}곳 · 공원 {dashboardMetricsMeta.bases.parks}곳 ·
            주차부족 {dashboardMetricsMeta.bases.shortageZones}곳 반영
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-2 pb-4 pt-2 sm:px-4">
        <div className="absolute right-6 top-4 z-10 hidden rounded-2xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur sm:block">
          <p className="text-[10px] text-muted">이번 주 합계</p>
          <p className="text-xl font-bold text-primary">{totalLatest.toLocaleString()}</p>
        </div>
        <div className="h-[220px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
              onMouseMove={(state) => {
                if (state?.activeTooltipIndex != null) {
                  setActiveIndex(Number(state.activeTooltipIndex));
                }
              }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <defs>
                <linearGradient id="heroBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F7CFF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4F7CFF" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="heroOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF8A4C" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#FF8A4C" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="heroPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#E8EDF5" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#CBD5E1", strokeDasharray: "4 4" }} />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={s.fill}
                  fillOpacity={1}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {activeIndex != null && chartData[activeIndex] && (
          <p className="px-3 text-center text-[10px] text-muted">
            {chartData[activeIndex].label} · CCTV {chartData[activeIndex].cctv} · 주차{" "}
            {chartData[activeIndex].parking} · 시설 {chartData[activeIndex].facility}
          </p>
        )}
      </div>
    </div>
  );
}
