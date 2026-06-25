"use client";

import { useState } from "react";
import { Camera, Car, Flag, MapPin, Snowflake, Trees } from "lucide-react";
import { reportCategories } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

const iconMap = {
  flag: Flag,
  trees: Trees,
  snowflake: Snowflake,
  car: Car,
};

export function MobileReportForm() {
  const { toast } = useToast();
  const [category, setCategory] = useState("banner");
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState(
    "공원 입구에 불법 광고 현수막이 설치되어 있습니다.",
  );
  const [submitted, setSubmitted] = useState(false);

  function addPhoto() {
    if (photos.length < 3) {
      setPhotos([...photos, `photo-${photos.length + 1}`]);
    }
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="text-lg font-bold">민원이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-muted">담당 부서에서 검토 후 처리됩니다.</p>
        <Button className="mt-6" onClick={() => setSubmitted(false)}>
          추가 신고하기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {reportCategories.map((cat) => {
          const Icon = iconMap[cat.icon];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                category === cat.id
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium">📷 사진을 추가해주세요</p>
        <p className="mt-1 text-xs text-muted">최대 3장</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={addPhoto}>
            <Camera className="mr-1 h-3.5 w-3.5" />
            카메라
          </Button>
          <Button variant="outline" size="sm" onClick={addPhoto}>
            갤러리
          </Button>
        </div>
        {photos.length > 0 && (
          <div className="mt-4 flex justify-center gap-2">
            {photos.map((p, i) => (
              <div key={p} className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-200 text-xs text-muted">
                  사진 {i + 1}
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-primary">
            🤖 AI가 &apos;불법 현수막&apos;으로 자동 분류했습니다
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">Confidence: 92%</span>
            <button
              type="button"
              onClick={() => toast("AI 분류를 수동으로 변경할 수 있습니다.", "info")}
              className="text-xs text-primary underline"
            >
              분류 변경
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">이천시 설봉동 설봉공원 입구</p>
            <button
              type="button"
              onClick={() => toast("지도에서 위치를 수정합니다.", "info")}
              className="mt-1 text-xs text-primary"
            >
              위치 수정
            </button>
          </div>
        </div>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="불편 사항을 자세히 적어주세요"
        rows={4}
        className="w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-primary"
      />

      <p className="text-center text-[11px] text-muted">
        접수된 민원은 담당 부서에서 검토 후 처리됩니다.
      </p>

      <Button className="w-full" onClick={() => setSubmitted(true)}>
        민원 접수하기
      </Button>
    </div>
  );
}
