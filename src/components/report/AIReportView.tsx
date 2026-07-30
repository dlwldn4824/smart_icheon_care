"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  FileText,
  Search,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  aiDetectionWeekly,
  aiDomainScores,
  aiInsights,
  aiReports,
  recommendations,
} from "@/data/mock";
import { cn } from "@/lib/utils";
import { fetchAIReportSummary } from "@/lib/ai-api";
import { useActionRegistration } from "@/lib/action-registry";
import { AIBriefingBanner } from "@/components/ai/AIBriefingBanner";
import { ActionStatus } from "@/components/actions/ActionStatus";
import { useToast } from "@/components/ui/Toast";
import type { AIReport, AIReportDomain, AIReportType, Priority, Recommendation } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const typeLabel: Record<AIReportType, string> = {
  daily: "일일",
  weekly: "주간",
  monthly: "월간",
  custom: "맞춤",
};

const typeVariant: Record<AIReportType, "info" | "medium" | "outline" | "high"> = {
  daily: "info",
  weekly: "medium",
  monthly: "high",
  custom: "outline",
};

const priorityConfig: Record<Priority, { label: string; variant: "urgent" | "high" | "medium" | "low" }> = {
  urgent: { label: "긴급", variant: "urgent" },
  high: { label: "높음", variant: "high" },
  medium: { label: "보통", variant: "medium" },
  low: { label: "낮음", variant: "low" },
};

const domainHref: Record<AIReportDomain, string> = {
  주차: "/parking-analysis",
  CCTV: "/cctv",
  시설: "/facility-management",
  제설: "/snow-removal",
  민원: "/complaint-management",
};

const typeFilters = ["전체", "일일", "주간", "월간", "맞춤"] as const;
const domainFilters = ["전체", "주차", "CCTV", "시설", "제설", "민원"] as const;

function RiskGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-red-600" : score >= 60 ? "text-orange-500" : "text-green-600";
  const bg = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : "bg-green-500";

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score} 100`}
            className={color}
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-bold", color)}>
          {score}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted">리스크 점수</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", bg)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ReportRecommendationItem({ rec }: { rec: Recommendation }) {
  const { isRegistered, action, openRegister } = useActionRegistration("recommendation", rec.id);

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-100 border-l-4 bg-slate-50/50 p-3",
        isRegistered ? "border-l-green-500" : "border-l-primary",
      )}
    >
      <div className="flex items-center justify-between">
        <Badge variant={isRegistered ? "low" : priorityConfig[rec.priority].variant} className="text-[10px]">
          {isRegistered ? "조치 완료" : priorityConfig[rec.priority].label}
        </Badge>
        {rec.score && !isRegistered && (
          <span className="text-xs font-bold text-red-600">{rec.score}/100</span>
        )}
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug text-slate-800">{rec.title}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{rec.detail}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2.5 text-[10px]"
          onClick={() => openRegister(rec.title, rec.detail)}
          disabled={isRegistered}
        >
          {isRegistered ? (
            <>
              <CheckCircle2 className="mr-1 h-3 w-3" />
              완료
            </>
          ) : (
            "조치 등록"
          )}
        </Button>
      </div>
      {action && <ActionStatus action={action} inline className="mt-2" />}
    </div>
  );
}

export function AIReportView() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("전체");
  const [domainFilter, setDomainFilter] = useState<(typeof domainFilters)[number]>("전체");
  const [selected, setSelected] = useState<AIReport>(aiReports[0]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiHighlights, setAiHighlights] = useState<string[]>([]);
  const [aiRiskScore, setAiRiskScore] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSource, setReportSource] = useState<"anthropic" | "mock">("mock");

  const loadReportSummary = useCallback(async (report: AIReport) => {
    if (report.status !== "ready") return;
    setReportLoading(true);
    try {
      const result = await fetchAIReportSummary(report.title, report.type);
      setAiSummary(result.summary);
      setAiHighlights(result.highlights);
      setAiRiskScore(result.riskScore);
      setReportSource(result.source);
    } catch {
      setAiSummary(report.summary);
      setAiHighlights(report.highlights);
      setAiRiskScore(report.riskScore);
      setReportSource("mock");
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    setAiSummary(null);
    setAiHighlights([]);
    setAiRiskScore(null);
    setReportSource("mock");
  }, [selected.id]);

  const stats = useMemo(
    () => ({
      total: aiReports.filter((r) => r.status === "ready").length,
      urgentInsights: aiInsights.filter((i) => i.impact === "urgent").length,
      totalActions: aiReports.reduce((sum, r) => sum + r.actionCount, 0),
      avgAccuracy: 91.2,
    }),
    [],
  );

  const filtered = useMemo(() => {
    return aiReports.filter((r) => {
      const matchSearch = r.title.includes(search) || r.summary.includes(search);
      const matchType = typeFilter === "전체" || typeLabel[r.type] === typeFilter;
      const matchDomain = domainFilter === "전체" || r.domains.includes(domainFilter as AIReportDomain);
      return matchSearch && matchType && matchDomain;
    });
  }, [search, typeFilter, domainFilter]);

  const todayReport = aiReports[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; AI 리포트</p>
          <h1 className="text-lg font-bold text-slate-900">AI 리포트</h1>
          <p className="text-xs text-muted">
            AI가 분석한 도시 인프라 운영 인사이트와 자동 생성 리포트를 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("맞춤 리포트 생성을 시작했습니다.", "info")}>
            맞춤 리포트 생성
          </Button>
          <Button size="sm" onClick={() => toast("선택 리포트를 PDF로 다운로드했습니다.", "success")}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "생성된 리포트", value: stats.total, icon: FileText, color: "text-blue-600 bg-blue-50" },
          { label: "긴급 인사이트", value: stats.urgentInsights, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
          { label: "권장 조치", value: stats.totalActions, icon: Target, color: "text-orange-600 bg-orange-50" },
          { label: "AI 정확도", value: `${stats.avgAccuracy}%`, icon: Brain, color: "text-indigo-600 bg-indigo-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="elevated-card flex items-center gap-3 p-4">
              <div className={cn("rounded-lg p-2.5", s.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <AIBriefingBanner
        period={todayReport.period}
        fallbackSummary={todayReport.summary}
        fallbackHighlights={todayReport.highlights}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>주간 AI 탐지 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aiDetectionWeekly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="탐지" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>도메인별 리스크 점수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiDomainScores} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="domain" tick={{ fontSize: 11 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="score" name="리스크" radius={[0, 4, 4, 0]}>
                    {aiDomainScores.map((entry) => (
                      <Cell key={entry.domain} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="리포트 제목, 내용 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as (typeof typeFilters)[number])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {typeFilters.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as (typeof domainFilters)[number])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {domainFilters.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <span className="text-xs text-muted">{filtered.length}건</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">리포트 목록</span>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">제목</th>
                    <th className="px-3 py-2.5 font-medium">유형</th>
                    <th className="px-3 py-2.5 font-medium">기간</th>
                    <th className="px-3 py-2.5 font-medium">도메인</th>
                    <th className="px-3 py-2.5 font-medium">리스크</th>
                    <th className="px-4 py-2.5 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={cn(
                        "cursor-pointer border-t border-gray-50 transition-colors hover:bg-blue-50/50",
                        selected.id === r.id && "bg-blue-50",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.title}</p>
                        <p className="text-[10px] text-muted">{r.generatedAt}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={typeVariant[r.type]} className="text-[10px]">
                          {typeLabel[r.type]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">{r.period}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.domains.map((d) => (
                            <Badge key={d} variant="outline" className="text-[9px]">
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "font-bold",
                            r.riskScore >= 80 ? "text-red-600" : r.riskScore >= 60 ? "text-orange-500" : "text-green-600",
                          )}
                        >
                          {r.status === "ready" ? r.riskScore : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "ready" ? (
                          <Badge variant="low" className="text-[10px]">완료</Badge>
                        ) : r.status === "generating" ? (
                          <Badge variant="medium" className="text-[10px]">생성중</Badge>
                        ) : (
                          <Badge variant="info" className="text-[10px]">예정</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-12 text-center text-sm text-muted">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">리포트 미리보기</span>
              {reportSource === "anthropic" && (
                <Badge variant="low" className="text-[10px]">Claude</Badge>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">{selected.title}</h3>
                  <p className="text-xs text-muted">{selected.period} · {selected.generatedAt}</p>
                </div>
                <Badge variant={typeVariant[selected.type]}>{typeLabel[selected.type]}</Badge>
              </div>

              {selected.status === "ready" ? (
                <>
                  {reportSource === "mock" && !reportLoading && (
                    <p className="text-[10px] text-muted">
                      샘플 리포트입니다. Claude AI 분석을 실행하려면 아래 버튼을 누르세요.
                    </p>
                  )}
                  {reportLoading ? (
                    <p className="flex items-center text-xs text-muted">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claude AI 요약 생성 중...
                    </p>
                  ) : (
                    <>
                      <RiskGauge score={aiRiskScore ?? selected.riskScore} />
                      <p className="text-xs leading-relaxed text-slate-700">
                        {aiSummary ?? selected.summary}
                      </p>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted">주요 하이라이트</p>
                        {(aiHighlights.length > 0 ? aiHighlights : selected.highlights).map((h) => (
                          <div key={h} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                            <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                            {h}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    variant={reportSource === "anthropic" ? "outline" : "default"}
                    onClick={() => loadReportSummary(selected)}
                    disabled={reportLoading}
                  >
                    {reportLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        분석 중...
                      </>
                    ) : reportSource === "anthropic" ? (
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
                  <div className="flex flex-wrap gap-1">
                    {selected.domains.map((d) => (
                      <Link key={d} href={domainHref[d]}>
                        <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-blue-50">
                          {d} →
                        </Badge>
                      </Link>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => toast(`「${selected.title}」 PDF 다운로드를 시작했습니다.`, "success")}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    이 리포트 다운로드
                  </Button>
                </>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted">리포트를 생성하고 있습니다...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>AI 핵심 인사이트</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-y-auto">
            {aiInsights.map((ins) => (
              <div key={ins.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{ins.domain}</Badge>
                  <div className="flex items-center gap-2">
                    {ins.metric && (
                      <span className="text-xs font-bold text-slate-700">{ins.metric}</span>
                    )}
                    <Badge variant={priorityConfig[ins.impact].variant} className="text-[10px]">
                      {priorityConfig[ins.impact].label}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-800">{ins.title}</p>
                <p className="mt-0.5 text-[10px] text-muted">{ins.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>AI 운영 추천</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec) => (
              <ReportRecommendationItem key={rec.id} rec={rec} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
