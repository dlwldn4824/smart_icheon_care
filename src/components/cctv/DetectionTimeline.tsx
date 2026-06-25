"use client";

import { useState } from "react";
import { detectionEvents } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { DetectionEvent, Severity } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const severityDot: Record<Severity, string> = {
  violation: "bg-red-500",
  caution: "bg-yellow-500",
  info: "bg-blue-500",
};

export function DetectionTimeline() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>(detectionEvents[0]?.id ?? "");

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>실시간 탐지 이력</CardTitle>
        <Badge variant="info">{detectionEvents.length}건</Badge>
      </CardHeader>
      <CardContent className="max-h-48 space-y-1 overflow-y-auto p-2">
        {detectionEvents.map((event: DetectionEvent) => (
          <button
            key={event.id}
            type="button"
            onClick={() => {
              setSelected(event.id);
              toast(`${event.time} ${event.location} · ${event.type} ${event.confidence}%`, "info");
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50",
              selected === event.id && "border-l-2 border-primary bg-blue-50",
            )}
          >
            <span className="w-10 font-mono text-xs text-muted">{event.time}</span>
            <Badge
              variant={
                event.severity === "violation"
                  ? "urgent"
                  : event.severity === "caution"
                    ? "medium"
                    : "info"
              }
            >
              {event.type}
            </Badge>
            <span className="flex-1 truncate text-xs">{event.location}</span>
            <span className="text-xs font-medium">{event.confidence}%</span>
            <span className={cn("h-2 w-2 rounded-full", severityDot[event.severity])} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
