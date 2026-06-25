"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ClipboardList,
  MapPin,
  Trees,
  Wrench,
} from "lucide-react";
import { facilities } from "@/data/mock";
import type { Priority } from "@/types";

const stats = [
  {
    label: "전체 시설",
    value: facilities.length,
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "긴급 점검",
    value: facilities.filter((f) => f.priority === "urgent").length,
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    label: "처리 필요",
    value: facilities.filter((f) => f.aiStatus !== "정상").length,
    icon: Wrench,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    label: "정상 운영",
    value: facilities.filter((f) => f.aiStatus === "정상").length,
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
  },
];

export function FacilityStatsBar() {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
          >
            <div className={`rounded-lg p-2 ${s.bg}`}>
              <Icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const facilityTypeIcons: Record<string, typeof Trees> = {
  공원: Trees,
  어린이공원: Trees,
  체육시설: Building2,
};

export const priorityLabel: Record<Priority, string> = {
  urgent: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};
