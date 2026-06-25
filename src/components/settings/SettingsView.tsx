"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  Database,
  LayoutDashboard,
  Map,
  Save,
  Shield,
  UserCircle,
} from "lucide-react";
import { currentUser } from "@/data/user";
import { fetchAIStatus } from "@/lib/ai-api";
import { hasVWorldApiKey } from "@/lib/map-config";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type SettingsTab = "profile" | "notifications" | "dashboard" | "map" | "system";

const tabs: { id: SettingsTab; label: string; icon: typeof UserCircle }[] = [
  { id: "profile", label: "내 정보", icon: UserCircle },
  { id: "notifications", label: "알림 설정", icon: Bell },
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "map", label: "지도·API", icon: Map },
  { id: "system", label: "시스템", icon: Database },
];

const defaultNotifications = {
  urgent: true,
  cctv: true,
  parking: true,
  facility: true,
  snow: true,
  complaint: true,
  emailDigest: false,
  sound: true,
};

const defaultDashboard = {
  autoRefresh: true,
  refreshInterval: "5",
  compactMode: false,
  showWeather: true,
};

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-slate-50">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-[10px] text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

function Field({
  label,
  value,
  type = "text",
  readOnly = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100",
          readOnly && "bg-slate-50 text-slate-600",
        )}
      />
    </div>
  );
}

export function SettingsView() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [profile, setProfile] = useState({
    name: currentUser.name,
    role: currentUser.role,
    department: currentUser.department,
    email: currentUser.email,
    phone: currentUser.phone,
  });
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [mapLayer, setMapLayer] = useState("Base");
  const [aiEngine, setAiEngine] = useState("확인 중...");

  useEffect(() => {
    if (tabParam && tabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (activeTab !== "system" && activeTab !== "map") return;

    fetchAIStatus()
      .then((status) => {
        setAiEngine(
          status.configured
            ? `Claude API (${status.model})`
            : "시뮬레이션 모드 (API 키 미설정)",
        );
      })
      .catch(() => setAiEngine("시뮬레이션 모드"));
  }, [activeTab]);

  function handleSave() {
    toast("설정이 저장되었습니다.", "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; 설정</p>
          <h1 className="text-lg font-bold text-slate-900">설정</h1>
          <p className="text-xs text-muted">계정, 알림, 대시보드 및 시스템 환경을 관리합니다.</p>
        </div>
        <Button size="sm" onClick={handleSave}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          변경사항 저장
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardContent className="p-2">
            <nav className="space-y-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      activeTab === tab.id
                        ? "bg-primary font-medium text-white"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>내 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                    {profile.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {profile.name} {profile.role}
                    </p>
                    <p className="text-xs text-muted">{profile.department}</p>
                    <p className="mt-1 text-[10px] text-muted">사번 {currentUser.employeeId}</p>
                  </div>
                  <Badge variant="low" className="ml-auto text-[10px]">
                    <Shield className="mr-1 h-3 w-3" />
                    공무원 계정
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="이름" value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
                  <Field label="직급" value={profile.role} readOnly />
                  <Field label="부서" value={profile.department} readOnly />
                  <Field
                    label="이메일"
                    type="email"
                    value={profile.email}
                    onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
                  />
                  <Field
                    label="연락처"
                    value={profile.phone}
                    onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
                  />
                  <Field label="최근 접속" value={currentUser.lastLogin} readOnly />
                </div>

                <Button variant="outline" size="sm" onClick={() => toast("비밀번호 변경 양식을 열었습니다.", "info")}>
                  비밀번호 변경
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>알림 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Toggle
                  label="긴급 알림"
                  description="긴급·높음 우선순위 이벤트 즉시 알림"
                  checked={notifications.urgent}
                  onChange={(v) => setNotifications((n) => ({ ...n, urgent: v }))}
                />
                <Toggle
                  label="CCTV AI 탐지"
                  description="불법 현수막, 주차, 잔디 등 AI 탐지 알림"
                  checked={notifications.cctv}
                  onChange={(v) => setNotifications((n) => ({ ...n, cctv: v }))}
                />
                <Toggle
                  label="주차 갈등"
                  description="핫스팟 발생 및 주차 리스크 알림"
                  checked={notifications.parking}
                  onChange={(v) => setNotifications((n) => ({ ...n, parking: v }))}
                />
                <Toggle
                  label="시설 관리"
                  description="시설 점검·유지보수 관련 알림"
                  checked={notifications.facility}
                  onChange={(v) => setNotifications((n) => ({ ...n, facility: v }))}
                />
                <Toggle
                  label="제설 작업"
                  description="제설 우선순위 및 작업 완료 알림"
                  checked={notifications.snow}
                  onChange={(v) => setNotifications((n) => ({ ...n, snow: v }))}
                />
                <Toggle
                  label="민원 접수"
                  description="신규 민원 및 처리 상태 변경 알림"
                  checked={notifications.complaint}
                  onChange={(v) => setNotifications((n) => ({ ...n, complaint: v }))}
                />
                <Toggle
                  label="알림음"
                  description="긴급 알림 시 소리 재생"
                  checked={notifications.sound}
                  onChange={(v) => setNotifications((n) => ({ ...n, sound: v }))}
                />
                <Toggle
                  label="일일 요약 이메일"
                  description="매일 오전 8시 AI 운영 요약 메일 수신"
                  checked={notifications.emailDigest}
                  onChange={(v) => setNotifications((n) => ({ ...n, emailDigest: v }))}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "dashboard" && (
            <Card>
              <CardHeader>
                <CardTitle>대시보드 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Toggle
                  label="자동 새로고침"
                  description="대시보드 데이터를 주기적으로 갱신"
                  checked={dashboard.autoRefresh}
                  onChange={(v) => setDashboard((d) => ({ ...d, autoRefresh: v }))}
                />
                <div>
                  <label className="mb-1 block text-xs text-muted">새로고침 간격</label>
                  <select
                    value={dashboard.refreshInterval}
                    onChange={(e) => setDashboard((d) => ({ ...d, refreshInterval: e.target.value }))}
                    disabled={!dashboard.autoRefresh}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-slate-50"
                  >
                    <option value="1">1분</option>
                    <option value="5">5분</option>
                    <option value="10">10분</option>
                    <option value="30">30분</option>
                  </select>
                </div>
                <Toggle
                  label="컴팩트 모드"
                  description="대시보드 위젯 간격을 줄여 더 많은 정보 표시"
                  checked={dashboard.compactMode}
                  onChange={(v) => setDashboard((d) => ({ ...d, compactMode: v }))}
                />
                <Toggle
                  label="날씨 정보 표시"
                  description="헤더에 이천시 날씨 정보 표시"
                  checked={dashboard.showWeather}
                  onChange={(v) => setDashboard((d) => ({ ...d, showWeather: v }))}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "map" && (
            <Card>
              <CardHeader>
                <CardTitle>지도·API 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-gray-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">VWorld API 키</p>
                    <Badge variant={hasVWorldApiKey() ? "low" : "medium"}>
                      {hasVWorldApiKey() ? "연결됨" : "데모 모드"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    {hasVWorldApiKey()
                      ? "NEXT_PUBLIC_VWORLD_API_KEY 환경변수가 설정되어 있습니다."
                      : ".env.local에 NEXT_PUBLIC_VWORLD_API_KEY를 설정하면 공식 API를 사용합니다."}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted">기본 지도 레이어</label>
                  <select
                    value={mapLayer}
                    onChange={(e) => setMapLayer(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="Base">일반 지도</option>
                    <option value="Satellite">위성 지도</option>
                    <option value="Hybrid">하이브리드</option>
                    <option value="gray">회색 지도</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-muted">기본 중심 좌표</p>
                    <p className="font-medium text-slate-700">37.272, 127.435</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-muted">기본 줌 레벨</p>
                    <p className="font-medium text-slate-700">13</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "system" && (
            <Card>
              <CardHeader>
                <CardTitle>시스템 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "플랫폼", value: "Smart Icheon Care v0.1.0" },
                  { label: "환경", value: "프로토타입 (개발)" },
                  { label: "데이터 소스", value: "Mock 데이터 · VWorld 지도" },
                  { label: "AI 엔진", value: aiEngine },
                  { label: "마지막 동기화", value: "2026.06.24 14:32" },
                  { label: "담당 기관", value: "이천시청 시설관리과" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm"
                  >
                    <span className="text-muted">{item.label}</span>
                    <span className="font-medium text-slate-800">{item.value}</span>
                  </div>
                ))}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast("데이터 동기화를 시작했습니다.", "info")}
                  >
                    데이터 동기화
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast("캐시를 초기화했습니다.", "success")}
                  >
                    캐시 초기화
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
