"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ClipboardList,
  MapPin,
  Search,
  Wrench,
} from "lucide-react";
import { facilities, maintenanceRecords } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { FacilityRow, Priority } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MapApiBadge } from "@/components/map/MapApiBadge";
import dynamic from "next/dynamic";
import type { MapMarker } from "@/types";

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

const statusConfig = {
  completed: { label: "완료", variant: "low" as const },
  scheduled: { label: "예정", variant: "info" as const },
  in_progress: { label: "진행중", variant: "medium" as const },
};

const priorityFilters = ["전체", "긴급", "높음", "보통", "낮음"] as const;

export function FacilityManagementView() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("전체");
  const [priorityFilter, setPriorityFilter] = useState<(typeof priorityFilters)[number]>("전체");
  const [selected, setSelected] = useState<FacilityRow>(facilities[0]);

  const facilityTypes = useMemo(
    () => ["전체", ...Array.from(new Set(facilities.map((f) => f.type))).sort()],
    [],
  );

  const stats = useMemo(
    () => ({
      total: facilities.length,
      urgent: facilities.filter((f) => f.priority === "urgent" || f.priority === "high").length,
      inProgress: maintenanceRecords.filter((m) => m.status === "in_progress").length,
      normal: facilities.filter((f) => f.aiStatus === "정상").length,
    }),
    [],
  );

  const filtered = useMemo(() => {
    return facilities.filter((f) => {
      const matchSearch =
        f.name.includes(search) ||
        f.address.includes(search) ||
        f.aiStatus.includes(search);
      const matchType = typeFilter === "전체" || f.type === typeFilter;
      const matchPriority =
        priorityFilter === "전체" || priorityConfig[f.priority].label === priorityFilter;
      return matchSearch && matchType && matchPriority;
    });
  }, [search, typeFilter, priorityFilter]);

  const facilityMarkers = useMemo<MapMarker[]>(
    () =>
      filtered.map((f) => ({
        id: f.id,
        type: "park",
        lat: f.lat,
        lng: f.lng,
        label: f.name,
      })),
    [filtered],
  );

  const facilityMaintenance = maintenanceRecords.filter((m) => m.facilityId === selected.id);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; 시설 관리</p>
          <h1 className="text-lg font-bold text-slate-900">시설 관리</h1>
          <p className="text-xs text-muted">공원·체육시설 유지보수 현황 및 AI 점검 결과를 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("점검 일정을 등록했습니다.", "success")}>
            점검 등록
          </Button>
          <Button size="sm" onClick={() => toast("시설 관리 리포트를 다운로드했습니다.", "success")}>
            리포트 다운로드
          </Button>
        </div>
      </div>

      {/* 통계 · 검색(좌) + 시설 위치 지도(우) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "전체 시설", value: stats.total, icon: Building2, color: "text-blue-600 bg-blue-50" },
              { label: "긴급·높음", value: stats.urgent, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
              { label: "점검 진행중", value: stats.inProgress, icon: Wrench, color: "text-orange-600 bg-orange-50" },
              { label: "정상", value: stats.normal, icon: CheckCircle, color: "text-green-600 bg-green-50" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className={cn("rounded-lg p-2", s.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-[11px] text-muted">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-[160px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="시설명, 주소, AI 상태 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {facilityTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as (typeof priorityFilters)[number])}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {priorityFilters.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="shrink-0 text-xs text-muted">{filtered.length}건</span>
          </div>
        </div>

        <div className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-slate-800">시설 위치 지도</span>
            </div>
            <MapApiBadge />
          </div>
          <div className="relative min-h-[220px] flex-1">
            <IcheonVWorldMap zones={[]} markers={facilityMarkers} clusterMarkers={false} />
          </div>
        </div>
      </div>

      {/* 메인: 테이블 + 상세 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 시설 목록 */}
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">시설 목록</span>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">시설명</th>
                    <th className="px-3 py-2.5 font-medium">유형</th>
                    <th className="px-3 py-2.5 font-medium">유동인구</th>
                    <th className="px-3 py-2.5 font-medium">민원</th>
                    <th className="px-3 py-2.5 font-medium">AI 상태</th>
                    <th className="px-4 py-2.5 font-medium">우선순위</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelected(f)}
                      className={cn(
                        "cursor-pointer border-t border-gray-50 transition-colors hover:bg-blue-50/50",
                        selected.id === f.id && "bg-blue-50",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{f.name}</p>
                        <p className="text-[10px] text-muted">{f.address}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {f.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted">{f.floatingPopulation.toLocaleString()}명</td>
                      <td className="px-3 py-3">{f.complaints}건</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1 text-xs">
                          {f.aiStatus === "정상" ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                          )}
                          {f.aiStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityConfig[f.priority].variant}>
                          {priorityConfig[f.priority].label}
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

        {/* 상세 패널 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">시설 상세</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{selected.name}</h3>
                  <p className="text-xs text-muted">{selected.type} · {selected.address}</p>
                </div>
                <Badge variant={priorityConfig[selected.priority].variant}>
                  {priorityConfig[selected.priority].label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "담당자", value: selected.manager },
                  { label: "최근 점검", value: selected.lastInspection },
                  { label: "다음 정비", value: selected.nextMaintenance },
                  { label: "민원", value: `${selected.complaints}건` },
                  { label: "유동인구", value: `${selected.floatingPopulation.toLocaleString()}명` },
                  { label: "AI 상태", value: selected.aiStatus },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] text-muted">{item.label}</p>
                    <p className="font-medium text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => toast(`「${selected.name}」 정비 일정이 등록되었습니다.`, "success")}
                >
                  정비 등록
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

          {/* 유지보수 이력 */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-slate-800">유지보수 이력</span>
            </div>
            <div className="max-h-40 space-y-2 overflow-y-auto p-3">
              {facilityMaintenance.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">등록된 이력이 없습니다.</p>
              ) : (
                facilityMaintenance.map((m) => (
                  <div key={m.id} className="rounded-lg border border-gray-100 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{m.action}</p>
                      <Badge variant={statusConfig[m.status].variant} className="text-[10px]">
                        {statusConfig[m.status].label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {m.date} · {m.assignee}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
