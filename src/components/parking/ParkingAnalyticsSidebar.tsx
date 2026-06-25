"use client";

import { useCallback, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Sparkles } from "lucide-react";
import { conflictByArea, hourlyParkingDemand, hotspots } from "@/data/mock";
import { fetchAIParkingAnalysis } from "@/lib/ai-api";
import { useToast } from "@/components/ui/Toast";
import type { Priority } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const priorityVariant: Record<Priority, "urgent" | "high" | "medium" | "low"> = {
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
};

export function ParkingAnalyticsSidebar() {
  const { toast } = useToast();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiActions, setAiActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"anthropic" | "mock">("mock");

  const runAIAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAIParkingAnalysis();
      setAiAnalysis(result.analysis);
      setAiActions(result.actions);
      setSource(result.source);
      toast("Claude AI 주차 갈등 분석이 완료되었습니다.", "success");
    } catch {
      setAiAnalysis("임시 주차장 설치 시 설봉초 인근 갈등 점수가 87→34로 감소할 것으로 예상됩니다.");
      setAiActions([
        "설봉초등학교 인근 임시 주차장 검토",
        "통학 시간대 주차 단속 강화",
        "공영주차장 안내 표지 확대",
      ]);
      setSource("mock");
      toast("AI 분석 실패 — 샘플 시뮬레이션 결과를 표시합니다.", "warning");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-2.5">
          <CardTitle>레이어 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {["유동인구 히트맵", "학교 안전구역", "주차 제한 구역", "공영주차장"].map((layer, i) => (
            <label key={layer} className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={i < 4}
                onChange={(e) => toast(`「${layer}」 ${e.target.checked ? "표시" : "숨김"}`, "info")}
                className="rounded"
              />
              <span>{layer}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5">
          <CardTitle>핫스팟 순위</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {hotspots.map((h, i) => (
            <button
              key={h.id}
              type="button"
              onClick={() => toast(`${h.name}: ${h.score}/100 · ${h.recommendation}`, "info")}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted">{i + 1}</span>
                <span className="font-medium">{h.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-600">{h.score}</span>
                <Badge variant={priorityVariant[h.priority]}>/100</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5">
          <CardTitle>시간대별 주차 수요</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={hourlyParkingDemand}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} width={28} />
              <Tooltip />
              <Bar dataKey="demand" fill="#2563EB" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5">
          <CardTitle>구역별 갈등 비율</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-[48%] shrink-0">
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie
                    data={conflictByArea}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={2}
                  >
                    {conflictByArea.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {conflictByArea.map((entry) => (
                <li key={entry.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{entry.name}</span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900">
                    {entry.value}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-blue-50">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Claude AI 분석
            </p>
            {source === "anthropic" && (
              <Badge variant="low" className="text-[9px]">실시간</Badge>
            )}
          </div>
          {aiAnalysis ? (
            <>
              <p className="text-xs leading-relaxed text-slate-700">{aiAnalysis}</p>
              <ul className="space-y-1 text-[10px] text-slate-600">
                {aiActions.map((action) => (
                  <li key={action} className="flex gap-1">
                    <span>•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              핫스팟·수요·제한 구역 데이터를 Claude AI가 분석합니다.
            </p>
          )}
          <Button
            size="sm"
            className="w-full"
            onClick={runAIAnalysis}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                분석 중...
              </>
            ) : (
              "AI 분석 실행"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
