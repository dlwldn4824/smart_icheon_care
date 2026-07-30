"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { recommendations as mockRecommendations } from "@/data/mock";
import { fetchAIRecommendations } from "@/lib/ai-api";
import { useActionRegistration, useActionRegistry } from "@/lib/action-registry";
import { useToast } from "@/components/ui/Toast";
import { ActionStatus } from "@/components/actions/ActionStatus";
import type { Priority, Recommendation } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const priorityLabel: Record<Priority, string> = {
  urgent: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const priorityVariant: Record<Priority, "urgent" | "high" | "info" | "low"> = {
  urgent: "urgent",
  high: "high",
  medium: "info",
  low: "low",
};

const priorityBorder: Record<Priority, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-400",
  low: "border-l-green-500",
};

function RecommendationCard({
  rec,
  compact,
}: {
  rec: Recommendation;
  compact: boolean;
}) {
  const { isRegistered, action, openRegister } = useActionRegistration("recommendation", rec.id);

  return (
    <div
      className={cn(
        "shrink-0 flex flex-col rounded-md border border-gray-100 border-l-4 bg-slate-50/50",
        isRegistered ? "border-l-green-500" : priorityBorder[rec.priority],
        compact ? "px-2 py-1.5" : "p-2",
      )}
    >
      <div className="mb-1 flex items-center gap-1">
        <Badge variant={isRegistered ? "low" : priorityVariant[rec.priority]} className="text-[9px]">
          {isRegistered ? "조치 완료" : priorityLabel[rec.priority]}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 font-semibold leading-tight text-slate-800",
            compact ? "line-clamp-2 text-[11px]" : "text-xs",
            isRegistered && "text-slate-600",
          )}
        >
          {rec.title}
        </p>
        <Button
          variant={isRegistered ? "outline" : "default"}
          size="sm"
          className={cn("shrink-0 self-center", compact ? "h-6 px-2.5 text-[9px]" : "h-6 px-2.5 text-[9px]")}
          onClick={() => openRegister(rec.title, rec.detail)}
          disabled={isRegistered}
        >
          {isRegistered ? (
            <>
              <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
              완료
            </>
          ) : (
            "조치"
          )}
        </Button>
      </div>
      {!compact && <p className="mt-1 text-[10px] text-muted">{rec.detail}</p>}
      {action && (
        <ActionStatus
          action={action}
          compact={!compact}
          inline={compact}
          className="mt-1"
        />
      )}
    </div>
  );
}

export function AIRecommendationPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const { actions } = useActionRegistry();
  const assignedCount = actions.filter((a) => a.sourceType === "recommendation").length;
  const [items, setItems] = useState<Recommendation[]>(
    compact ? mockRecommendations.slice(0, 3) : mockRecommendations,
  );
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"anthropic" | "mock">("mock");

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAIRecommendations();
      const next = compact ? result.recommendations.slice(0, 3) : result.recommendations;
      setItems(next);
      setSource(result.source);
    } catch {
      const fallback = compact ? mockRecommendations.slice(0, 3) : mockRecommendations;
      setItems(fallback);
      setSource("mock");
      toast("AI 분석에 실패해 샘플 데이터를 표시합니다.", "warning");
    } finally {
      setLoading(false);
    }
  }, [compact, toast]);

  return (
    <div className="elevated-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-semibold text-slate-800">AI 운영 추천</span>
          {assignedCount > 0 && (
            <Badge variant="low" className="text-[8px]">조치 {assignedCount}건</Badge>
          )}
          {source === "anthropic" && (
            <Badge variant="low" className="text-[8px]">Claude</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={source === "anthropic" ? "outline" : "default"}
          className={compact ? "h-6 text-[10px]" : undefined}
          onClick={loadRecommendations}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              분석 중
            </>
          ) : source === "anthropic" ? (
            <>
              <RefreshCw className="mr-1 h-3 w-3" />
              다시 분석
            </>
          ) : (
            <>
              <Sparkles className="mr-1 h-3 w-3" />
              AI 분석하기
            </>
          )}
        </Button>
      </div>

      {source === "mock" && !loading && (
        <p className="shrink-0 border-b border-gray-50 px-3 py-1 text-[9px] text-muted">
          샘플 추천입니다. Claude AI 분석을 실행하려면 버튼을 누르세요.
        </p>
      )}

      {compact ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {items.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} compact />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {items.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} compact={false} />
          ))}
        </div>
      )}
    </div>
  );
}
