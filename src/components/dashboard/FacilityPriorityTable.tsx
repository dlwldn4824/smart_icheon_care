"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { facilities } from "@/data/mock";
import type { FacilityRow, Priority } from "@/types";
import { Badge } from "@/components/ui/Badge";

const priorityConfig: Record<Priority, { label: string; variant: "urgent" | "high" | "medium" | "low" }> = {
  urgent: { label: "1위", variant: "urgent" },
  high: { label: "2위", variant: "high" },
  medium: { label: "3위", variant: "medium" },
  low: { label: "4위", variant: "low" },
};

const priorityOrder: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const rankLabel = ["1위", "2위", "3위", "4위"];

export function FacilityPriorityTable({ compact = false }: { compact?: boolean }) {
  const sorted = useMemo(() => {
    const copy = [...facilities];
    copy.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return compact ? copy.slice(0, 4) : copy;
  }, [compact]);

  return (
    <div className="elevated-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
        <span className="text-xs font-bold text-slate-800">시설 유지보수 우선순위</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-[10px] text-muted">
              <th className="px-3 py-2 font-medium">시설명</th>
              <th className="px-2 py-2 font-medium">유동인구</th>
              {!compact && <th className="px-2 py-2 font-medium">민원</th>}
              <th className="px-2 py-2 font-medium">AI 상태</th>
              <th className="px-3 py-2 font-medium">순위</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row: FacilityRow, idx) => (
              <tr key={row.id} className="border-t border-gray-50 hover:bg-slate-50/80">
                <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                <td className="px-2 py-2 text-muted">
                  {compact
                    ? `${(row.floatingPopulation / 1000).toFixed(1)}k`
                    : `${row.floatingPopulation.toLocaleString()}명`}
                </td>
                {!compact && <td className="px-2 py-2">{row.complaints}건</td>}
                <td className="px-2 py-2">
                  <span className="flex items-center gap-1">
                    {row.aiStatus === "정상" ? (
                      <CheckCircle className="h-3 w-3 shrink-0 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-orange-500" />
                    )}
                    <span className="truncate text-[10px]">{row.aiStatus}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={priorityConfig[row.priority].variant} className="text-[10px]">
                    {rankLabel[idx] ?? priorityConfig[row.priority].label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
