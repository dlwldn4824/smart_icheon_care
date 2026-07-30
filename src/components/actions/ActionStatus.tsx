"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { formatActionTime } from "@/lib/action-registry";
import type { RegisteredAction } from "@/types";
import { cn } from "@/lib/utils";

export function ActionStatus({
  action,
  compact = false,
  inline = false,
  className,
}: {
  action: RegisteredAction;
  compact?: boolean;
  inline?: boolean;
  className?: string;
}) {
  if (inline) {
    return (
      <p
        className={cn(
          "mt-1 flex min-w-0 items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 text-[9px] leading-tight text-green-700",
          className,
        )}
      >
        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
        <span className="min-w-0 truncate">
          {action.department} · {action.assignee} · {formatActionTime(action.registeredAt)}
        </span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-green-100 bg-green-50",
        compact ? "px-1.5 py-1" : "px-2.5 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-1 text-green-700">
        <CheckCircle2 className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        <span className={cn("font-semibold", compact ? "text-[9px]" : "text-[10px]")}>
          조치 배정 완료
        </span>
      </div>
      <p className={cn("mt-0.5 text-green-800", compact ? "text-[8px]" : "text-[10px]")}>
        {action.department} · {action.assignee}
      </p>
      <p className={cn("flex items-center gap-1 text-green-600", compact ? "text-[8px]" : "text-[9px]")}>
        <Clock3 className="h-2.5 w-2.5 shrink-0" />
        {action.actionType} · {action.dueLabel} · {formatActionTime(action.registeredAt)}
      </p>
    </div>
  );
}
