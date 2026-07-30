import { NextResponse } from "next/server";
import { buildOperationalContext } from "@/lib/ai-context";
import { isLiveRequest, MOCK_RECOMMENDATIONS } from "@/lib/ai-mock-server";
import { isValidPriority } from "@/lib/ai-api";
import { callAnthropic, isAnthropicConfigured, parseJsonFromResponse } from "@/lib/anthropic-server";
import type { Recommendation } from "@/types";

const SYSTEM = `당신은 이천시 스마트 도시 인프라 플랫폼의 AI 운영 어드바이저입니다.
데이터를 분석해 실행 가능한 운영 추천을 제시합니다. 한국어로 작성하고 JSON만 출력하세요.`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!isLiveRequest(body)) {
    return NextResponse.json({ recommendations: MOCK_RECOMMENDATIONS, source: "mock" });
  }

  if (!isAnthropicConfigured()) {
    return NextResponse.json({ recommendations: MOCK_RECOMMENDATIONS, source: "mock" });
  }

  try {
    const context = buildOperationalContext();
    const userMessage = `다음 데이터로 긴급도 순 운영 추천 3건을 생성하세요.

데이터:
${JSON.stringify(context)}

JSON 형식 (배열):
[
  {
    "id": "ai-rec-1",
    "priority": "urgent|high|medium|low",
    "title": "20자 이내 권고 제목",
    "detail": "1문장 상세 설명",
    "score": 0-100 (선택)
  }
]`;

    const text = await callAnthropic(SYSTEM, userMessage, 1024);
    const raw = parseJsonFromResponse<Array<Record<string, unknown>>>(text);

    const recommendations: Recommendation[] = raw.slice(0, 3).map((item, i) => ({
      id: String(item.id ?? `ai-rec-${i + 1}`),
      priority: isValidPriority(String(item.priority)) ? String(item.priority) as Recommendation["priority"] : "medium",
      title: String(item.title ?? "운영 추천"),
      detail: String(item.detail ?? ""),
      score: typeof item.score === "number" ? item.score : undefined,
    }));

    return NextResponse.json({ recommendations, source: "anthropic" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 추천 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
