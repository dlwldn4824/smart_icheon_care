"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Video } from "lucide-react";
import {
  inferVisionImage,
  inferVisionVideo,
  notifyVisionEventsUpdated,
  VisionApiError,
  type InferenceResult,
} from "@/lib/vision-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const CAMERAS = [
  { id: "CCTV-001", label: "CCTV-001 · 설봉공원 입구" },
  { id: "CCTV-002", label: "CCTV-002 · 장호원 사거리" },
  { id: "CCTV-003", label: "CCTV-003 · 안흥동 상권" },
  { id: "CCTV-004", label: "CCTV-004 · 이천역 광장" },
  { id: "CCTV-005", label: "CCTV-005 · 설봉초 통학로" },
  { id: "DEMO-CCTV-001", label: "DEMO-CCTV-001 · 설봉초 (데모)" },
];

const API_BASE = process.env.NEXT_PUBLIC_VISION_API_URL ?? "http://127.0.0.1:8000";

export function BannerInferenceUpload() {
  const { toast } = useToast();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [cameraId, setCameraId] = useState("CCTV-001");
  const [conf, setConf] = useState(0.25);
  const [busy, setBusy] = useState<"image" | "video" | null>(null);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function previewSrc(r: InferenceResult | null): string | null {
    if (r?.preview_base64) return r.preview_base64;
    if (r?.preview_url) {
      const path = r.preview_url.startsWith("http")
        ? r.preview_url
        : `${API_BASE.replace(/\/$/, "")}${r.preview_url}`;
      return path;
    }
    return localPreview;
  }

  async function runImage(file: File) {
    setBusy("image");
    setError(null);
    setResult(null);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const data = await inferVisionImage(file, { cameraId, conf });
      setResult(data);
      const msg =
        data.count > 0
          ? `이미지 탐지 완료 · ${data.count}건`
          : "탐지된 현수막이 없습니다 (박스가 없으면 conf를 낮춰보세요)";
      toast(msg, data.count > 0 ? "success" : "info");
      notifyVisionEventsUpdated();
    } catch (e) {
      const message = e instanceof VisionApiError ? e.message : "이미지 추론 실패";
      setError(message);
      toast(message, "warning");
    } finally {
      setBusy(null);
      if (imageRef.current) imageRef.current.value = "";
    }
  }

  async function runVideo(file: File) {
    setBusy("video");
    setError(null);
    setResult(null);
    setLocalPreview(null);
    try {
      const data = await inferVisionVideo(file, { cameraId, conf, sampleFps: 2 });
      setResult(data);
      const msg =
        data.count > 0
          ? `영상 탐지 완료 · ${data.count}건`
          : "탐지된 현수막이 없습니다";
      toast(msg, data.count > 0 ? "success" : "info");
      notifyVisionEventsUpdated();
    } catch (e) {
      const message = e instanceof VisionApiError ? e.message : "영상 추론 실패";
      setError(message);
      toast(message, "warning");
    } finally {
      setBusy(null);
      if (videoRef.current) videoRef.current.value = "";
    }
  }

  const img = previewSrc(result) ?? localPreview;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>학습 모델 탐지 업로드</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted">
            이미지/영상 업로드 → YOLO 박스 표시 → 이벤트 생성. 아래 리스트도 함께 갱신됩니다.
          </p>
        </div>
        <Badge variant="outline">POST /api/v1/inference/*</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-muted">카메라</span>
            <select
              className="block min-w-[220px] rounded-md border border-border bg-white px-2 py-1.5 text-xs"
              value={cameraId}
              disabled={busy !== null}
              onChange={(e) => setCameraId(e.target.value)}
            >
              {CAMERAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted">conf</span>
            <input
              type="number"
              min={0.05}
              max={0.95}
              step={0.05}
              value={conf}
              disabled={busy !== null}
              onChange={(e) => setConf(Number(e.target.value))}
              className="block w-20 rounded-md border border-border bg-white px-2 py-1.5 text-xs"
            />
          </label>
          <input
            ref={imageRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runImage(f);
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runVideo(f);
            }}
          />
          <Button size="sm" disabled={busy !== null} onClick={() => imageRef.current?.click()}>
            {busy === "image" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="mr-1 h-3.5 w-3.5" />
            )}
            이미지 탐지
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => videoRef.current?.click()}
          >
            {busy === "video" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Video className="mr-1 h-3.5 w-3.5" />
            )}
            영상 탐지
          </Button>
        </div>

        {busy && (
          <p className="text-[11px] text-amber-700">추론 중… 박스 미리보기가 곧 표시됩니다.</p>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {(img || result) && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="overflow-hidden rounded-lg border border-border bg-slate-950 lg:col-span-7">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt="탐지 결과 미리보기"
                  className="max-h-[420px] w-full object-contain"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                  미리보기 준비 중…
                </div>
              )}
            </div>
            <div className="space-y-2 lg:col-span-5">
              <div className="rounded-lg border border-border bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-800">
                  {result
                    ? result.count > 0
                      ? `탐지 ${result.count}건`
                      : "탐지 0건"
                    : "업로드됨"}
                </p>
                {result && (
                  <p className="mt-1 break-all text-[10px] text-muted">
                    {result.filename ?? "upload"} · boxes {result.boxes?.length ?? 0} · conf{" "}
                    {result.conf ?? conf}
                    <br />
                    {result.weights}
                  </p>
                )}
              </div>
              {result?.events?.length ? (
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {result.events.map((ev) => (
                    <div
                      key={ev.event.event_id}
                      className="rounded-lg border border-border bg-white p-2 text-[11px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-800">{ev.event.event_id}</p>
                        <Badge variant="urgent">{ev.illegal.level}</Badge>
                      </div>
                      <p className="mt-1 text-slate-600">
                        conf {(ev.event.det_conf * 100).toFixed(1)}% · 불법 {ev.illegal.score} ·
                        우선순위 {ev.priority.level}
                      </p>
                      <p className="text-[10px] text-muted">
                        {ev.event.location_name} · {ev.event.status}
                      </p>
                    </div>
                  ))}
                </div>
              ) : result ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted">
                  박스가 없으면 현수막이 없거나 conf가 높을 수 있습니다. conf를 0.15~0.25로 낮추고
                  다시 시도하세요.
                </p>
              ) : null}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted">
          권장 테스트: <code>platform/datasets/banner_mvp_all/images/val/*.jpg</code>
        </p>
      </CardContent>
    </Card>
  );
}
