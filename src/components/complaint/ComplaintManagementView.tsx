"use client";

import { useMemo, useState } from "react";
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
import { CheckCircle, Clock, MessageSquare, Search, User } from "lucide-react";
import { complaintCategoryStats, complaintTrendMonthly, complaints } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { Complaint, ComplaintStatus, Priority } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const statusConfig: Record<ComplaintStatus, { label: string; variant: "info" | "medium" | "urgent" | "low" }> = {
  received: { label: "접수완료", variant: "info" },
  reviewing: { label: "검토중", variant: "medium" },
  processing: { label: "처리중", variant: "urgent" },
  completed: { label: "완료", variant: "low" },
};

const priorityConfig: Record<Priority, { label: string; variant: "urgent" | "high" | "medium" | "low" }> = {
  urgent: { label: "긴급", variant: "urgent" },
  high: { label: "높음", variant: "high" },
  medium: { label: "보통", variant: "medium" },
  low: { label: "낮음", variant: "low" },
};

const statusOrder: ComplaintStatus[] = ["received", "reviewing", "processing", "completed"];
const categoryFilters = ["전체", "불법 현수막", "공원/시설", "제설 요청", "불법 주차"];
const statusFilters = ["전체", "접수완료", "검토중", "처리중", "완료"] as const;

function ProgressStepper({ status }: { status: ComplaintStatus }) {
  const currentIdx = statusOrder.indexOf(status);

  return (
    <div className="flex items-center justify-between py-3">
      {statusOrder.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <div key={step} className="flex flex-1 flex-col items-center">
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
            <span className="mt-1 text-[9px] text-muted">{statusConfig[step].label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ComplaintManagementView() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("전체");
  const [selected, setSelected] = useState<Complaint>(complaints[0]);

  const stats = useMemo(
    () => ({
      total: complaints.length,
      received: complaints.filter((c) => c.status === "received").length,
      reviewing: complaints.filter((c) => c.status === "reviewing").length,
      processing: complaints.filter((c) => c.status === "processing").length,
      completed: complaints.filter((c) => c.status === "completed").length,
    }),
    [],
  );

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      const matchSearch =
        c.title.includes(search) ||
        c.category.includes(search) ||
        (c.location?.includes(search) ?? false) ||
        (c.reporter?.includes(search) ?? false);
      const matchCategory = categoryFilter === "전체" || c.category === categoryFilter;
      const matchStatus = statusFilter === "전체" || statusConfig[c.status].label === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [search, categoryFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; 민원 관리</p>
          <h1 className="text-lg font-bold text-slate-900">민원 관리</h1>
          <p className="text-xs text-muted">시민 민원 접수·처리 현황을 통합 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("민원 접수 양식을 열었습니다.", "info")}>
            민원 접수
          </Button>
          <Button size="sm" onClick={() => toast("민원 처리 리포트를 다운로드했습니다.", "success")}>
            리포트 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "전체 민원", value: stats.total, icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
          { label: "접수완료", value: stats.received, icon: Clock, color: "text-slate-600 bg-slate-100" },
          { label: "검토중", value: stats.reviewing, icon: User, color: "text-orange-600 bg-orange-50" },
          { label: "처리중", value: stats.processing, icon: MessageSquare, color: "text-red-600 bg-red-50" },
          { label: "완료", value: stats.completed, icon: CheckCircle, color: "text-green-600 bg-green-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>민원 유형별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={complaintCategoryStats}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {complaintCategoryStats.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {complaintCategoryStats.map((c) => (
                <span key={c.name} className="flex items-center gap-1 text-[10px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>월별 민원 발생 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complaintTrendMonthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="민원" fill="#3B82F6" radius={[4, 4, 0, 0]} />
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
            placeholder="제목, 위치, 신고자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {categoryFilters.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as (typeof statusFilters)[number])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {statusFilters.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-muted">{filtered.length}건</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">민원 목록</span>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">제목</th>
                    <th className="px-3 py-2.5 font-medium">유형</th>
                    <th className="px-3 py-2.5 font-medium">접수일</th>
                    <th className="px-3 py-2.5 font-medium">출처</th>
                    <th className="px-3 py-2.5 font-medium">우선순위</th>
                    <th className="px-4 py-2.5 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={cn(
                        "cursor-pointer border-t border-gray-50 transition-colors hover:bg-blue-50/50",
                        selected.id === c.id && "bg-blue-50",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{c.title}</p>
                        <p className="text-[10px] text-muted">{c.location ?? "—"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {c.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted">{c.date}</td>
                      <td className="px-3 py-3 text-xs">{c.source ?? "—"}</td>
                      <td className="px-3 py-3">
                        {c.priority ? (
                          <Badge variant={priorityConfig[c.priority].variant} className="text-[10px]">
                            {priorityConfig[c.priority].label}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusConfig[c.status].variant}>
                          {statusConfig[c.status].label}
                        </Badge>
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

        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">민원 상세</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{selected.category}</Badge>
              <Badge variant={statusConfig[selected.status].variant}>
                {statusConfig[selected.status].label}
              </Badge>
            </div>

            <div>
              <h3 className="font-bold text-slate-900">{selected.title}</h3>
              <p className="mt-0.5 text-xs text-muted">{selected.date} 접수</p>
            </div>

            <ProgressStepper status={selected.status} />

            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs">
              {selected.location && (
                <p><span className="text-muted">위치:</span> {selected.location}</p>
              )}
              {selected.reporter && (
                <p><span className="text-muted">신고자:</span> {selected.reporter}</p>
              )}
              {selected.source && (
                <p><span className="text-muted">출처:</span> {selected.source}</p>
              )}
              {selected.assignee && (
                <p><span className="text-muted">담당:</span> {selected.assignee}</p>
              )}
              {selected.description && (
                <p className="leading-relaxed text-slate-700">{selected.description}</p>
              )}
              {selected.completedDate && (
                <p className="font-medium text-green-600">{selected.completedDate} 처리 완료</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => toast(`「${selected.title}」 처리를 시작했습니다.`, "success")}
              >
                처리 시작
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => toast("담당자에게 알림을 보냈습니다.", "info")}
              >
                담당자 배정
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
