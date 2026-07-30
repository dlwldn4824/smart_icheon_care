"use client";

import { useState } from "react";
import { complaints } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { Complaint, ComplaintStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";

const steps: { key: ComplaintStatus; label: string }[] = [
  { key: "received", label: "접수완료" },
  { key: "reviewing", label: "검토중" },
  { key: "processing", label: "처리중" },
  { key: "completed", label: "완료" },
];

const statusOrder: ComplaintStatus[] = ["received", "reviewing", "processing", "completed"];

const statusBadge: Record<ComplaintStatus, "info" | "medium" | "urgent" | "low"> = {
  received: "info",
  reviewing: "medium",
  processing: "urgent",
  completed: "low",
};

const statusLabel: Record<ComplaintStatus, string> = {
  received: "접수완료",
  reviewing: "검토중",
  processing: "처리중",
  completed: "완료",
};

function ProgressStepper({ status }: { status: ComplaintStatus }) {
  const currentIdx = statusOrder.indexOf(status);

  return (
    <div className="flex items-center justify-between py-3">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                done && "bg-green-500 text-white",
                current && "bg-primary text-white",
                !done && !current && "bg-slate-200 text-slate-400",
              )}
            >
              {done ? "✓" : i + 1}
            </div>
            <span className="mt-1 text-[9px] text-muted">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ComplaintStatusCard({ complaint }: { complaint: Complaint }) {
  const { toast } = useToast();

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{complaint.category}</Badge>
        <Badge variant={statusBadge[complaint.status]}>{statusLabel[complaint.status]}</Badge>
      </div>
      <h3 className="mt-2 font-semibold">{complaint.title}</h3>
      <p className="text-xs text-muted">{complaint.date} 접수</p>
      <ProgressStepper status={complaint.status} />
      {complaint.assignee && (
        <p className="text-xs text-muted">담당: {complaint.assignee}</p>
      )}
      {complaint.completedDate && (
        <p className="text-xs text-green-600">{complaint.completedDate} 처리 완료</p>
      )}
      <button
        type="button"
        onClick={() => toast(`${complaint.title} 상세 정보를 불러왔습니다.`, "info")}
        className="mt-2 text-sm text-primary"
      >
        상세 보기 →
      </button>
    </div>
  );
}

export function ComplaintList() {
  const [filter, setFilter] = useState<"all" | "processing" | "completed">("all");

  const filtered = complaints.filter((c) => {
    if (filter === "all") return true;
    if (filter === "processing") return c.status === "processing" || c.status === "reviewing";
    return c.status === "completed";
  });

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex gap-2">
        {[
          { key: "all" as const, label: "전체" },
          { key: "processing" as const, label: "처리중" },
          { key: "completed" as const, label: "완료" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              filter === tab.key ? "bg-primary text-white" : "bg-slate-100 text-slate-600",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((c) => (
          <ComplaintStatusCard key={c.id} complaint={c} />
        ))}
      </div>
    </div>
  );
}
