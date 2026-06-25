import { NextResponse } from "next/server";
import { buildParkingContext } from "@/lib/ai-context";
import { isLiveRequest, MOCK_PARKING } from "@/lib/ai-mock-server";
import { callAnthropic, isAnthropicConfigured, parseJsonFromResponse } from "@/lib/anthropic-server";

const SYSTEM = `당신은 이천시 주차 갈등·교통 분석 전문가입니다.
유동인구 수요와 주차 제한 구역 겹침을 분석합니다. 한국어로 작성하고 JSON만 출력하세요.`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!isLiveRequest(body)) {
    return NextResponse.json({ ...MOCK_PARKING, source: "mock" });
  }

  if (!isAnthropicConfigured()) {
    return NextResponse.json({ ...MOCK_PARKING, source: "mock" });
  }

  try {
    const context = buildParkingContext();
    const userMessage = `주차 갈등 핫스팟과 구역 데이터를 분석하세요.

데이터:
${JSON.stringify(context)}

JSON 형식:
{
  "analysis": "3~4문장 분석 요약",
  "actions": ["즉시 조치 권고 3가지"]
}`;

    const text = await callAnthropic(SYSTEM, userMessage, 800);
    const parsed = parseJsonFromResponse<{ analysis: string; actions: string[] }>(text);

    return NextResponse.json({
      analysis: parsed.analysis,
      actions: parsed.actions ?? [],
      source: "anthropic",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "주차 AI 분석 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
