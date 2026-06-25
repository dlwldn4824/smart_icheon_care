"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { fetchAIBriefing } from "@/lib/ai-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface AIBriefingBannerProps {
  fallbackSummary: string;
  fallbackHighlights: string[];
  period: string;
}

export function AIBriefingBanner({
  fallbackSummary,
  fallbackHighlights,
  period,
}: AIBriefingBannerProps) {
  const [summary, setSummary] = useState(fallbackSummary);
  const [highlights, setHighlights] = useState(fallbackHighlights);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"anthropic" | "mock">("mock");

  const loadBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAIBriefing();
      setSummary(result.summary);
      setHighlights(result.highlights);
      setSource(result.source);
    } catch {
      setSummary(fallbackSummary);
      setHighlights(fallbackHighlights);
      setSource("mock");
    } finally {
      setLoading(false);
    }
  }, [fallbackSummary, fallbackHighlights]);

  useEffect(() => {
    setSummary(fallbackSummary);
    setHighlights(fallbackHighlights);
    setSource("mock");
  }, [fallbackSummary, fallbackHighlights, period]);

  return (
    <div className="rounded-2xl border border-primary/10 bg-gradient-to-r from-primary-soft/80 to-indigo-50/80 p-5 shadow-[0_8px_32px_rgba(79,124,255,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-slate-800">AI 오늘의 종합 브리핑</span>
          <Badge variant="info" className="text-[10px]">{period}</Badge>
          {source === "anthropic" && (
            <Badge variant="low" className="text-[10px]">Claude 실시간</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={source === "anthropic" ? "outline" : "default"}
          onClick={loadBriefing}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              분석 중...
            </>
          ) : source === "anthropic" ? (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              다시 분석
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI 분석하기
            </>
          )}
        </Button>
      </div>
      {source === "mock" && !loading && (
        <p className="mb-2 text-[10px] text-muted">샘플 브리핑입니다. Claude AI 분석을 실행하려면 버튼을 누르세요.</p>
      )}
      <p className="text-sm leading-relaxed text-slate-700">{summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {highlights.slice(0, 4).map((h) => (
          <span key={h} className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] text-slate-600 shadow-sm">
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}
