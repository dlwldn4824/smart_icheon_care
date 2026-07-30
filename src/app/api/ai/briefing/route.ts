import { NextResponse } from "next/server";
import { buildBriefingContext } from "@/lib/ai-context";
import { isLiveRequest, MOCK_BRIEFING } from "@/lib/ai-mock-server";
import { callAnthropic, isAnthropicConfigured, parseJsonFromResponse } from "@/lib/anthropic-server";

const SYSTEM = `당신은 경기도 이천시 공무원을 위한 도시 인프라 AI 분석가입니다.
주차, CCTV, 시설, 제설, 민원 데이터를 바탕으로 일일 운영 브리핑을 작성합니다.
반드시 한국어로 작성하고, JSON만 출력하세요.`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!isLiveRequest(body)) {
    return NextResponse.json({ ...MOCK_BRIEFING, source: "mock" });
  }

  if (!isAnthropicConfigured()) {
    return NextResponse.json({ ...MOCK_BRIEFING, source: "mock" });
  }

  try {
    const context = buildBriefingContext();
    const userMessage = `다음 이천시 운영 데이터를 분석해 일일 브리핑을 작성하세요.

데이터:
${JSON.stringify(context)}

JSON 형식:
{
  "summary": "2~3문장 종합 요약",
  "highlights": ["핵심 하이라이트 3~4개"]
}`;

    const text = await callAnthropic(SYSTEM, userMessage, 800);
    const parsed = parseJsonFromResponse<{ summary: string; highlights: string[] }>(text);

    return NextResponse.json({
      summary: parsed.summary,
      highlights: parsed.highlights ?? [],
      source: "anthropic",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 브리핑 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
