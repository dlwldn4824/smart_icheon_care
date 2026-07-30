"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Car, Megaphone, Snowflake, TrendingDown, TrendingUp, Wrench } from "lucide-react";
import { dashboardTrends } from "@/lib/dashboard-metrics";
import type { DashboardTrendPoint } from "@/types/dashboard-metrics";
import { cn } from "@/lib/utils";

const iconMap = {
  complaint: Megaphone,
  facility: Wrench,
  parking: Car,
  snow: Snowflake,
} as const;

type TrendItem = DashboardTrendPoint;

function SparkTooltip({
  active,
  payload,
  unit,
  title,
}: {
  active?: boolean;
  payload?: { payload: { date: string; value: number } }[];
  unit: string;
  title: string;
}) {
  if (!active || !payload?.[0]) return null;
  const { date, value } = payload[0].payload;

  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted">2026.{date}</p>
      <p className="text-xs font-bold text-slate-900">
        {title} {value}
        {unit}
      </p>
    </div>
  );
}

function LastPointDot({
  cx,
  cy,
  index,
  dataLength,
  color,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  dataLength: number;
  color: string;
}) {
  if (index !== dataLength - 1 || cx == null || cy == null) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
    </>
  );
}

function TrendMetricCard({ trend }: { trend: TrendItem }) {
  const gradientId = useId().replace(/:/g, "");
  const Icon = iconMap[trend.iconName];
  const up = trend.changePercent >= 0;
  const lastValue = trend.data[trend.data.length - 1];

  const chartData = useMemo(
    () =>
      trend.data.map((value, i) => ({
        value,
        date: trend.labels?.[i] ?? `${i + 1}`,
      })),
    [trend.data, trend.labels],
  );

  const displayValue =
    "isProgress" in trend && trend.isProgress
      ? `${trend.value}`
      : trend.value.toLocaleString();

  return (
    <div className="elevated-card flex h-[190px] flex-col overflow-hidden px-4 py-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${trend.color}18` }}
        >
          <Icon className="h-4 w-4" style={{ color: trend.color }} strokeWidth={2} />
        </div>
        <p className="truncate text-xs font-bold text-slate-800">{trend.title}</p>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none tracking-tight text-slate-900">
            {displayValue}
            <span className="ml-0.5 text-sm font-semibold text-muted">{trend.unit}</span>
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-0.5 text-[10px] font-semibold",
              up ? "text-red-500" : "text-emerald-600",
            )}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {up ? "+" : ""}
            {trend.changePercent}%
            <span className="font-normal text-muted">지난달 대비</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted">최근</p>
          <p className="text-sm font-bold" style={{ color: trend.color }}>
            {lastValue}
            {"isProgress" in trend && trend.isProgress ? "구간" : trend.unit}
          </p>
        </div>
      </div>

      <div className="relative mt-1 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 2, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={trend.color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={trend.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip
              content={
                <SparkTooltip
                  unit={"isProgress" in trend && trend.isProgress ? "구간" : trend.unit}
                  title={trend.title.replace(" 추이", "").replace(" 진행률", "")}
                />
              }
              cursor={{ stroke: trend.color, strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={trend.color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={(props) => (
                <LastPointDot {...props} dataLength={chartData.length} color={trend.color} />
              )}
              activeDot={{ r: 4, fill: trend.color, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted">{trend.subtitle}</p>
        {"isProgress" in trend && trend.isProgress && trend.progress && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(trend.progress.current / trend.progress.total) * 100}%`,
                  backgroundColor: trend.color,
                }}
              />
            </div>
            <span className="shrink-0 text-[9px] font-semibold text-slate-600">
              {trend.progress.current}/{trend.progress.total}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TrendChartsRow() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {dashboardTrends.map((trend) => (
        <TrendMetricCard key={trend.id} trend={trend} />
      ))}
    </div>
  );
}
