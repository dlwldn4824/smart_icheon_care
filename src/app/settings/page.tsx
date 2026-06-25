import { Suspense } from "react";
import { SettingsView } from "@/components/settings/SettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted">설정 로딩 중...</div>}>
      <SettingsView />
    </Suspense>
  );
}
