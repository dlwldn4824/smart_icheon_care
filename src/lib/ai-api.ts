import type { Priority, Recommendation } from "@/types";

export type AISource = "anthropic" | "mock";

export interface AIBriefingResult {
  summary: string;
  highlights: string[];
  source: AISource;
}

export interface AIRecommendationsResult {
  recommendations: Recommendation[];
  source: AISource;
}

export interface AIParkingAnalysisResult {
  analysis: string;
  actions: string[];
  source: AISource;
}

export interface AIReportSummaryResult {
  summary: string;
  highlights: string[];
  riskScore: number;
  source: AISource;
}

export interface AIStatusResult {
  configured: boolean;
  model: string;
}

/** live: true 일 때만 서버가 Claude API를 호출합니다. */
async function postLiveJSON<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, live: true }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "AI 요청에 실패했습니다.");
  }
  return data as T;
}

export async function fetchAIStatus(): Promise<AIStatusResult> {
  const res = await fetch("/api/ai/status");
  return res.json();
}

export async function fetchAIBriefing(): Promise<AIBriefingResult> {
  return postLiveJSON<AIBriefingResult>("/api/ai/briefing");
}

export async function fetchAIRecommendations(): Promise<AIRecommendationsResult> {
  return postLiveJSON<AIRecommendationsResult>("/api/ai/recommendations");
}

export async function fetchAIParkingAnalysis(): Promise<AIParkingAnalysisResult> {
  return postLiveJSON<AIParkingAnalysisResult>("/api/ai/parking-analysis");
}

export async function fetchAIReportSummary(
  title: string,
  type: string,
): Promise<AIReportSummaryResult> {
  return postLiveJSON<AIReportSummaryResult>("/api/ai/report-summary", { title, type });
}

export function isValidPriority(value: string): value is Priority {
  return ["urgent", "high", "medium", "low"].includes(value);
}
