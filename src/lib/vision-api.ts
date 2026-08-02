export type VisionEvent = {
  event: {
    event_id: string;
    camera_id: string;
    track_id?: number;
    class_name: string;
    det_conf: number;
    status: string;
    approx_lat: number;
    approx_lng: number;
    risk_score?: number;
    admin_district?: string;
    location_name?: string;
    location_is_approximate?: boolean;
    detected_at?: string;
    thumb_url?: string | null;
    bbox_xyxy?: number[];
    illegal_candidate?: boolean;
    verdict?: string;
    content_verdict?: string;
    ocr_text?: string;
  };
  illegal: {
    score: number;
    level: string;
    reasons: string[];
    requires_human_review: boolean;
  };
  priority: {
    score: number;
    level: string;
    label?: string;
    reasons: string[];
  };
  geo_notes?: string[];
  illegal_candidate?: boolean;
  verdict?: string;
};

const DEFAULT_BASE = process.env.NEXT_PUBLIC_VISION_API_URL ?? "http://127.0.0.1:8000";

export class VisionApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisionApiError";
  }
}

export async function fetchVisionEvents(
  options: { illegalOnly?: boolean; baseUrl?: string } = {},
): Promise<VisionEvent[]> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE;
  const qs = options.illegalOnly ? "?illegal_only=true" : "";
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/events${qs}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new VisionApiError(
      `FastAPI에 연결할 수 없습니다 (${url}). platform/에서 uvicorn backend.app.main:app --port 8000 실행 후 다시 시도하세요.`,
    );
  }
  if (!res.ok) {
    throw new VisionApiError(`API 오류 ${res.status}: ${url}`);
  }
  return (await res.json()) as VisionEvent[];
}

export type VisionStatistics = {
  total_events: number;
  by_priority: Record<string, number>;
  by_district: Record<string, number>;
  by_status: Record<string, number>;
};

export async function fetchVisionStatistics(
  baseUrl: string = DEFAULT_BASE,
): Promise<VisionStatistics> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/statistics`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new VisionApiError(`FastAPI에 연결할 수 없습니다 (${url}).`);
  }
  if (!res.ok) {
    throw new VisionApiError(`API 오류 ${res.status}: ${url}`);
  }
  return (await res.json()) as VisionStatistics;
}

export async function patchVisionEventStatus(
  eventId: string,
  status: string,
  actor?: string,
  baseUrl: string = DEFAULT_BASE,
): Promise<VisionEvent> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/events/${eventId}/status`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, actor }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new VisionApiError(`상태 변경 실패: ${text}`);
  }
  return (await res.json()) as VisionEvent;
}

export type InferenceResult = {
  events: VisionEvent[];
  count: number;
  weights: string;
  filename?: string | null;
  camera_id?: string;
  conf?: number;
  preview_base64?: string | null;
  preview_url?: string | null;
  boxes?: Array<{
    bbox_xyxy: number[];
    label: string;
    event_id?: string | null;
    illegal_candidate?: boolean;
    verdict?: string;
    risk_score?: number;
  }>;
  raw_detection_count?: number;
};

export type InspectResult = {
  content_verdict: "ILLEGAL_SUSPECT" | "LIKELY_LEGAL" | "NEEDS_REVIEW" | string;
  confidence: number;
  ocr_text: string;
  reasons: string[];
  flags: Record<string, unknown>;
  crop_preview_base64?: string | null;
  event_id?: string | null;
  camera_id?: string;
  bbox_xyxy?: number[];
};

export const VISION_EVENTS_UPDATED = "vision-events-updated";

export function notifyVisionEventsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VISION_EVENTS_UPDATED));
  }
}

export async function inferVisionImage(
  file: File,
  options: { cameraId?: string; conf?: number } = {},
  baseUrl: string = DEFAULT_BASE,
): Promise<InferenceResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/inference/image`;
  const body = new FormData();
  body.append("file", file);
  body.append("camera_id", options.cameraId ?? "CCTV-001");
  body.append("conf", String(options.conf ?? 0.25));
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body });
  } catch {
    throw new VisionApiError(`FastAPI에 연결할 수 없습니다 (${url}).`);
  }
  if (!res.ok) {
    throw new VisionApiError(`이미지 추론 실패 ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as InferenceResult;
}

export async function inferVisionVideo(
  file: File,
  options: { cameraId?: string; conf?: number; sampleFps?: number } = {},
  baseUrl: string = DEFAULT_BASE,
): Promise<InferenceResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/inference/video`;
  const body = new FormData();
  body.append("file", file);
  body.append("camera_id", options.cameraId ?? "CCTV-001");
  body.append("conf", String(options.conf ?? 0.25));
  body.append("sample_fps", String(options.sampleFps ?? 2));
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body });
  } catch {
    throw new VisionApiError(`FastAPI에 연결할 수 없습니다 (${url}).`);
  }
  if (!res.ok) {
    throw new VisionApiError(`영상 추론 실패 ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as InferenceResult;
}

export async function inspectVisionBanner(
  file: File,
  bboxXyxy: number[],
  options: { cameraId?: string; eventId?: string | null } = {},
  baseUrl: string = DEFAULT_BASE,
): Promise<InspectResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/inference/inspect`;
  const body = new FormData();
  body.append("file", file);
  body.append("bbox_xyxy", JSON.stringify(bboxXyxy));
  body.append("camera_id", options.cameraId ?? "CCTV-001");
  if (options.eventId) body.append("event_id", options.eventId);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body });
  } catch {
    throw new VisionApiError(`FastAPI에 연결할 수 없습니다 (${url}).`);
  }
  if (!res.ok) {
    throw new VisionApiError(`배너 내용 검사 실패 ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as InspectResult;
}
