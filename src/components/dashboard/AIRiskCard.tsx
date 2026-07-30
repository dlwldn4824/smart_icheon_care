"use client";

import { Car, Flag, Snowflake, Trees, TrendingDown, TrendingUp } from "lucide-react";
import { riskCards } from "@/data/mock";
import { buildSparklineAreaPoints, buildSparklinePoints } from "@/lib/sparkline";
import { cn } from "@/lib/utils";
import type { RiskCardData, RiskLevel } from "@/types";
import { Badge } from "@/components/ui/Badge";

const iconMap = {
  trees: Trees,
  car: Car,
  flag: Flag,
  snowflake: Snowflake,
};

const riskBadge: Record<RiskLevel, "urgent" | "high" | "medium" | "low"> = {
  critical: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const height = 24;
  const width = 100;
  const padding = 5;
  const points = buildSparklinePoints(data, width, height, padding);
  const areaPoints = buildSparklineAreaPoints(data, width, height, padding);

  return (
    <div className="h-7 w-full shrink-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

const sparkColor: Record<RiskLevel, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#FBBF24",
  low: "#22C55E",
};

function AIRiskCard({ card }: { card: RiskCardData }) {
  const Icon = iconMap[card.iconName];
  const up = card.changePercent >= 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-white p-2 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <div className="shrink-0 rounded bg-slate-50 p-1">
            <Icon className="h-3 w-3 text-slate-600" />
          </div>
          <p className="truncate text-[10px] font-semibold text-slate-700">{card.title}</p>
        </div>
        <Badge variant={riskBadge[card.riskLevel]} className="shrink-0 text-[9px]">
          {card.riskLabel}
        </Badge>
      </div>
      <div className="mt-1 flex items-end justify-between">
        <div>
          <span className="text-lg font-bold text-slate-900">{card.count}</span>
          <span className="ml-0.5 text-[10px] text-muted">{card.unit}</span>
        </div>
        <span
          className={cn(
            "flex items-center gap-0.5 text-[9px] font-medium",
            up ? "text-red-500" : "text-green-500",
          )}
        >
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {up ? "+" : ""}
          {card.changePercent}%
        </span>
      </div>
      <div className="mt-auto pt-1">
        <Sparkline data={card.trend} color={sparkColor[card.riskLevel]} />
      </div>
    </div>
  );
}

export function AIRiskCardGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2", className)}>
      {riskCards.map((card) => (
        <AIRiskCard key={card.id} card={card} />
      ))}
    </div>
  );
}
