"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Video } from "lucide-react";
import {
  inferVisionImage,
  inferVisionVideo,
  inspectVisionBanner,
  notifyVisionEventsUpdated,
  VisionApiError,
  type InferenceResult,
  type InspectResult,
} from "@/lib/vision-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const CAMERAS = [
  { id: "CCTV-001", label: "CCTV-001 · 설봉공원 입구" },
  { id: "CCTV-002", label: "CCTV-002 · 장호원 사거리" },
  { id: "CCTV-003", label: "CCTV-003 · 안흥동 상권" },
  { id: "CCTV-004", label: "CCTV-004 · 이천역 광장" },
  { id: "CCTV-005", label: "CCTV-005 · 설봉초 통학로" },
  { id: "DEMO-CCTV-001", label: "DEMO-CCTV-001 · 설봉초 (데모)" },
];

const API_BASE = process.env.NEXT_PUBLIC_VISION_API_URL ?? "http://127.0.0.1:8000";

function verdictBadge(v: string | undefined): "urgent" | "high" | "medium" | "low" | "outline" {
  if (v === "ILLEGAL_SUSPECT") return "urgent";
  if (v === "LIKELY_LEGAL") return "low";
  if (v === "NEEDS_REVIEW") return "medium";
  if (v === "LOW_RISK") return "outline";
  return "outline";
}

function verdictLabel(v: string | undefined): string {
  if (v === "ILLEGAL_SUSPECT") return "불법 의심";
  if (v === "LIKELY_LEGAL") return "합법 추정";
  if (v === "NEEDS_REVIEW") return "추가 검토";
  if (v === "LOW_RISK") return "저위험";
  return v || "-";
}

export function BannerInferenceUpload() {
  const { toast } = useToast();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const imgNaturalRef = useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const [cameraId, setCameraId] = useState("CCTV-001");
  const [conf, setConf] = useState(0.25);
  const [busy, setBusy] = useState<"image" | "video" | "inspect" | null>(null);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoxIdx, setSelectedBoxIdx] = useState<number | null>(null);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [illegalOnly, setIllegalOnly] = useState(false);

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

  async function runInspect(bbox: number[], eventId?: string | null, idx?: number) {
    const file = lastFileRef.current;
    if (!file) {
      toast("원본 이미지가 없습니다. 이미지를 다시 업로드하세요.", "warning");
      return;
    }
    setBusy("inspect");
    setError(null);
    if (typeof idx === "number") setSelectedBoxIdx(idx);
    try {
      const data = await inspectVisionBanner(file, bbox, { cameraId, eventId });
      setInspect(data);
      toast(`내용 검사 · ${verdictLabel(data.content_verdict)}`, "info");
      notifyVisionEventsUpdated();
    } catch (e) {
      const message = e instanceof VisionApiError ? e.message : "배너 내용 검사 실패";
      setError(message);
      toast(message, "warning");
    } finally {
      setBusy(null);
    }
  }

  async function runImage(file: File) {
    setBusy("image");
    setError(null);
    setResult(null);
    setInspect(null);
    setSelectedBoxIdx(null);
    lastFileRef.current = file;
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const data = await inferVisionImage(file, { cameraId, conf });
      setResult(data);
      const suspects = (data.events || []).filter(
        (e) => e.event.illegal_candidate || e.event.verdict === "ILLEGAL_SUSPECT",
      ).length;
      const msg =
        data.count > 0
          ? `불법 현수막(의심) 탐지 · ${data.count}건 (의심 ${suspects})`
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
    setInspect(null);
    setSelectedBoxIdx(null);
    lastFileRef.current = file;
    setLocalPreview(null);
    try {
      const data = await inferVisionVideo(file, { cameraId, conf, sampleFps: 2 });
      setResult(data);
      const msg =
        data.count > 0
          ? `영상 탐지 완료 · ${data.count}건 — 박스를 클릭해 내용 검사`
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
  const boxes = result?.boxes ?? [];
  const events = (result?.events ?? []).filter((ev) => {
    if (!illegalOnly) return true;
    return (
      ev.event.illegal_candidate ||
      ev.event.verdict === "ILLEGAL_SUSPECT" ||
      (ev.event.risk_score ?? 0) >= 70
    );
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>불법 현수막(의심) 탐지</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted">
            1단계: YOLO 현수막 탐지 + 공공데이터 Risk. 2단계: 박스를 클릭하면 해당 배너 OCR·마크
            검사. 최종 확정은 공무원 CONFIRMED.
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
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={illegalOnly}
              onChange={(e) => setIllegalOnly(e.target.checked)}
            />
            불법 의심만
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
          <p className="text-[11px] text-amber-700">
            {busy === "inspect" ? "선택한 배너 내용 검사 중…" : "추론 중… 박스 미리보기가 곧 표시됩니다."}
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {(img || result) && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative overflow-hidden rounded-lg border border-border bg-slate-950 lg:col-span-7">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt="탐지 결과 미리보기"
                  className="max-h-[420px] w-full object-contain"
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    imgNaturalRef.current = {
                      w: el.naturalWidth || 1,
                      h: el.naturalHeight || 1,
                    };
                  }}
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                  미리보기 준비 중…
                </div>
              )}
              {/* Clickable box overlays in percent of displayed image box */}
              {img && boxes.length > 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative max-h-[420px] w-full" style={{ aspectRatio: `${imgNaturalRef.current.w} / ${imgNaturalRef.current.h}` }}>
                    {boxes.map((b, i) => {
                      const [x1, y1, x2, y2] = b.bbox_xyxy;
                      const nw = imgNaturalRef.current.w;
                      const nh = imgNaturalRef.current.h;
                      const left = (x1 / nw) * 100;
                      const top = (y1 / nh) * 100;
                      const width = ((x2 - x1) / nw) * 100;
                      const height = ((y2 - y1) / nh) * 100;
                      const suspect = Boolean(b.illegal_candidate);
                      return (
                        <button
                          key={`${b.event_id ?? i}-${i}`}
                          type="button"
                          title={`${b.label} — 클릭하여 내용 검사`}
                          className={cn(
                            "pointer-events-auto absolute border-2 bg-transparent transition hover:bg-white/10",
                            selectedBoxIdx === i
                              ? "border-amber-300"
                              : suspect
                                ? "border-red-500"
                                : "border-emerald-400",
                          )}
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                          }}
                          disabled={busy !== null}
                          onClick={() => void runInspect(b.bbox_xyxy, b.event_id, i)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="bg-black/50 px-2 py-1 text-[10px] text-slate-200">
                박스를 클릭하면 해당 현수막만 OCR·마크 검사합니다.
              </p>
            </div>
            <div className="space-y-2 lg:col-span-5">
              <div className="rounded-lg border border-border bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-800">
                  {result
                    ? result.count > 0
                      ? `탐지 ${result.count}건 · 표시 ${events.length}건`
                      : "탐지 0건"
                    : "업로드됨"}
                </p>
                {result && (
                  <p className="mt-1 break-all text-[10px] text-muted">
                    {result.filename ?? "upload"} · boxes {boxes.length} · conf {result.conf ?? conf}
                  </p>
                )}
              </div>

              {inspect && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">2단계 · 배너 내용 검사</p>
                    <Badge variant={verdictBadge(inspect.content_verdict)}>
                      {verdictLabel(inspect.content_verdict)}
                    </Badge>
                  </div>
                  {inspect.crop_preview_base64 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={inspect.crop_preview_base64}
                      alt="선택한 배너 크롭"
                      className="max-h-36 w-full rounded border border-border object-contain bg-white"
                    />
                  )}
                  <p className="text-slate-700">
                    <span className="text-muted">OCR</span> {inspect.ocr_text || "(없음)"}
                  </p>
                  <p className="text-slate-700">confidence {(inspect.confidence * 100).toFixed(0)}%</p>
                  <ul className="space-y-0.5 text-slate-600">
                    {inspect.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {events.length ? (
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {events.map((ev) => {
                    const suspect =
                      ev.event.illegal_candidate || ev.event.verdict === "ILLEGAL_SUSPECT";
                    return (
                      <button
                        key={ev.event.event_id}
                        type="button"
                        className="w-full rounded-lg border border-border bg-white p-2 text-left text-[11px] hover:border-primary"
                        disabled={busy !== null || !ev.event.bbox_xyxy}
                        onClick={() => {
                          if (ev.event.bbox_xyxy) {
                            void runInspect(ev.event.bbox_xyxy, ev.event.event_id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-800">{ev.event.event_id}</p>
                          <Badge variant={suspect ? "urgent" : "outline"}>
                            {verdictLabel(ev.event.verdict || (suspect ? "ILLEGAL_SUSPECT" : "LOW_RISK"))}
                          </Badge>
                        </div>
                        <p className="mt-1 text-slate-600">
                          conf {(ev.event.det_conf * 100).toFixed(1)}% · Risk {ev.event.risk_score ?? "-"} ·{" "}
                          {ev.priority.level}
                        </p>
                        <p className="text-[10px] text-muted">클릭 → 이 배너 내용 검사</p>
                      </button>
                    );
                  })}
                </div>
              ) : result ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted">
                  표시할 이벤트가 없습니다. 필터를 끄거나 conf를 낮춰 보세요.
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
