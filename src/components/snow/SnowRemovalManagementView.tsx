"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CloudSnow, Search, Snowflake, Thermometer, Truck } from "lucide-react";
import { snowRemovalProgressDaily, snowRemovalRoutes } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { Priority, SnowRemovalRoute, SnowRemovalStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const IcheonVWorldMap = dynamic(() => import("@/components/map/IcheonVWorldMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-xs text-muted">지도 로딩...</div>,
});

const priorityConfig: Record<Priority, { label: string; variant: "urgent" | "high" | "medium" | "low" }> = {
  urgent: { label: "긴급", variant: "urgent" },
  high: { label: "높음", variant: "high" },
  medium: { label: "보통", variant: "medium" },
  low: { label: "낮음", variant: "low" },
};

const statusConfig: Record<
  SnowRemovalStatus,
  { label: string; variant: "urgent" | "medium" | "low" | "info" }
> = {
  pending: { label: "대기", variant: "urgent" },
  scheduled: { label: "예정", variant: "info" },
  in_progress: { label: "진행중", variant: "medium" },
  completed: { label: "완료", variant: "low" },
};

const conditionColor: Record<SnowRemovalRoute["roadCondition"], string> = {
  양호: "text-green-600",
  습설: "text-blue-600",
  적설: "text-orange-600",
  결빙: "text-red-600",
};

const areaFilters = ["전체", "설봉동", "안흥동", "신둔면", "장호원읍", "모가면", "부발읍", "중앙동"];
const statusFilters = ["전체", "대기", "예정", "진행중", "완료"] as const;

export function SnowRemovalManagementView() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("전체");
  const [selected, setSelected] = useState<SnowRemovalRoute>(snowRemovalRoutes[0]);

  const stats = useMemo(
    () => ({
      total: snowRemovalRoutes.length,
      completed: snowRemovalRoutes.filter((r) => r.status === "completed").length,
      inProgress: snowRemovalRoutes.filter((r) => r.status === "in_progress").length,
      pending: snowRemovalRoutes.filter((r) => r.status === "pending" || r.status === "scheduled").length,
      avgProgress: Math.round(
        snowRemovalRoutes.reduce((sum, r) => sum + r.progress, 0) / snowRemovalRoutes.length,
      ),
    }),
    [],
  );

  const filtered = useMemo(() => {
    return snowRemovalRoutes.filter((r) => {
      const matchSearch =
        r.name.includes(search) || r.address.includes(search) || r.assignee.includes(search);
      const matchArea = areaFilter === "전체" || r.area === areaFilter;
      const matchStatus = statusFilter === "전체" || statusConfig[r.status].label === statusFilter;
      return matchSearch && matchArea && matchStatus;
    });
  }, [search, areaFilter, statusFilter]);

  const priorityList = useMemo(
    () => [...snowRemovalRoutes].sort((a, b) => {
      const order: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    }),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; 제설 관리</p>
          <h1 className="text-lg font-bold text-slate-900">제설 관리</h1>
          <p className="text-xs text-muted">AI 기반 제설 우선순위 분석 및 구간별 작업 현황을 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("기상 연동 데이터를 갱신했습니다.", "info")}>
            기상 갱신
          </Button>
          <Button size="sm" onClick={() => toast("제설 작업 일정이 등록되었습니다.", "success")}>
            작업 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "전체 구간", value: stats.total, icon: Snowflake, color: "text-blue-600 bg-blue-50" },
          { label: "완료", value: stats.completed, icon: CloudSnow, color: "text-green-600 bg-green-50" },
          { label: "진행중", value: stats.inProgress, icon: Truck, color: "text-orange-600 bg-orange-50" },
          { label: "대기·예정", value: stats.pending, icon: Thermometer, color: "text-red-600 bg-red-50" },
          { label: "평균 진행률", value: `${stats.avgProgress}%`, icon: Snowflake, color: "text-indigo-600 bg-indigo-50" },
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">제설 구간 지도</span>
              <Badge variant="info">VWorld Demo</Badge>
            </div>
            <div className="h-64 lg:h-72">
              <IcheonVWorldMap />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="py-2.5">
            <CardTitle>AI 제설 우선순위</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-y-auto">
            {priorityList.slice(0, 6).map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelected(r);
                  toast(`「${r.name}」 구간을 선택했습니다.`, "info");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-slate-50",
                  selected.id === r.id ? "border-primary bg-blue-50/50" : "border-gray-100",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted">{i + 1}</span>
                  <div>
                    <p className="font-medium text-slate-800">{r.name}</p>
                    <p className="text-[10px] text-muted">{r.roadCondition} · {r.snowfallCm}cm</p>
                  </div>
                </div>
                <Badge variant={priorityConfig[r.priority].variant}>
                  {priorityConfig[r.priority].label}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="구간명, 주소, 담당자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {areaFilters.map((a) => (
            <option key={a}>{a}</option>
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
              <span className="text-sm font-semibold text-slate-800">제설 구간 목록</span>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">구간명</th>
                    <th className="px-3 py-2.5 font-medium">지역</th>
                    <th className="px-3 py-2.5 font-medium">노면</th>
                    <th className="px-3 py-2.5 font-medium">적설</th>
                    <th className="px-3 py-2.5 font-medium">진행률</th>
                    <th className="px-3 py-2.5 font-medium">상태</th>
                    <th className="px-4 py-2.5 font-medium">우선순위</th>
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
                        <p className="font-medium text-slate-800">{r.name}</p>
                        <p className="text-[10px] text-muted">{r.address}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">{r.area}</td>
                      <td className={cn("px-3 py-3 font-medium", conditionColor[r.roadCondition])}>
                        {r.roadCondition}
                      </td>
                      <td className="px-3 py-3">{r.snowfallCm}cm</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${r.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted">{r.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={statusConfig[r.status].variant}>
                          {statusConfig[r.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityConfig[r.priority].variant}>
                          {priorityConfig[r.priority].label}
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

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">구간 상세</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src="/images/snow-removal-square.png"
                  alt="제설 작업 현장"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  CCTV · 제설 작업 현장
                </div>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{selected.name}</h3>
                  <p className="text-xs text-muted">{selected.area} · {selected.address}</p>
                </div>
                <Badge variant={priorityConfig[selected.priority].variant}>
                  {priorityConfig[selected.priority].label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "담당자", value: selected.assignee },
                  { label: "장비", value: selected.equipment },
                  { label: "연장", value: `${selected.lengthKm}km` },
                  { label: "적설량", value: `${selected.snowfallCm}cm` },
                  { label: "노면상태", value: selected.roadCondition },
                  { label: "최근 작업", value: selected.lastWorked ?? "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] text-muted">{item.label}</p>
                    <p className="font-medium text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>작업 진행률</span>
                  <span className="font-semibold text-slate-700">{selected.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => toast(`「${selected.name}」 제설 작업을 시작했습니다.`, "success")}
                >
                  작업 시작
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => toast("담당자에게 알림을 보냈습니다.", "info")}
                >
                  담당자 알림
                </Button>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="py-2.5">
              <CardTitle>주간 제설 실적</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snowRemovalProgressDaily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="completed" name="완료" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
